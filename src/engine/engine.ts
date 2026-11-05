// Stockfish (WASM, running in a Web Worker on the device) behind a small
// promise / callback API. Only one search runs at a time; asking for a new
// position stops the current search first.
import { t } from '../i18n';
import { parseInfo, type EngineLine } from './uci';

export interface AnalysisOptions {
  multiPv: number;
  /** maximum depth; 0 = infinite */
  depth: number;
  /** only consider these moves (UCI), e.g. to score one particular move */
  searchMoves?: string[];
  /** stop after this many milliseconds (with depth: whichever comes first) */
  movetime?: number;
  /** playing strength, 0 (weakest) to 20 (full strength, the default) */
  skill?: number;
}

export interface AnalysisUpdate {
  fen: string;
  /** depth of the best line */
  depth: number;
  targetDepth: number;
  lines: EngineLine[];
  nps?: number;
  done: boolean;
  /** the search was replaced by another request before it finished (last update) */
  aborted?: boolean;
  /** the move the engine chose (last update; with a skill below 20 not always the top line's) */
  bestmove?: string;
}

type Listener = (u: AnalysisUpdate) => void;

const MAX_SKILL = 20;

interface Request {
  fen: string;
  opts: AnalysisOptions;
  listener: Listener;
}

/**
 * The bundled Stockfish build uses WebAssembly SIMD, which needs Safari / iOS 16.4+
 * (Chrome 91+). Tiny module: (func (result v128) i32.const 0 i8x16.splat i8x16.popcnt)
 */
export function wasmSimdSupported(): boolean {
  try {
    return WebAssembly.validate(
      new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]),
    );
  } catch {
    return false;
  }
}

export class StockfishEngine {
  private worker: Worker | null = null;
  private readyPromise: Promise<void> | null = null;
  private waiters: { match: (l: string) => boolean; resolve: () => void; reject: (e: Error) => void }[] = [];
  /** when the worker last died: a second crash soon after isn't retried */
  private lastCrash = 0;
  private searching = false;
  private current: Request | null = null;
  private pending: Request | null = null;
  private lines = new Map<number, EngineLine>();
  private nps: number | undefined;
  private multiPvSet = -1;
  private skillSet = MAX_SKILL;
  /** the running search was stopped to make way for `pending` */
  private superseded = false;
  readonly url: string;

  constructor(url = 'engine/stockfish.js') {
    this.url = url;
  }

  /** Spawn the worker and complete the UCI handshake (idempotent). */
  start(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    if (!wasmSimdSupported()) {
      return Promise.reject(new Error(t('engine.tooOld')));
    }
    this.readyPromise = (async () => {
      // Fetch the WASM here and give the worker a blob URL (passed in the URL hash,
      // which stockfish.js reads): fetches from inside workers are unreliable with
      // custom schemes such as capacitor:// on iOS.
      let hash = '';
      try {
        const res = await fetch(this.url.replace(/\.js$/, '.wasm'));
        if (res.ok) {
          const blob = new Blob([await res.arrayBuffer()], { type: 'application/wasm' });
          hash = '#' + encodeURIComponent(URL.createObjectURL(blob));
        }
      } catch {
        // fall back to the worker loading it itself
      }
      const w = new Worker(this.url + hash);
      this.worker = w;
      w.onmessage = (e: MessageEvent) => {
        const data = typeof e.data === 'string' ? e.data : String(e.data ?? '');
        for (const line of data.split('\n')) if (line) this.onLine(line.trim());
      };
      w.onerror = (e) => {
        console.error('engine worker error', e);
        this.crashed(e.message || 'the chess engine stopped');
      };
      this.send('uci');
      await this.waitFor((l) => l === 'uciok');
      // the bundled build is single-threaded, so it runs without cross-origin isolation
      this.send('setoption name Hash value 32');
      this.send('setoption name UCI_ShowWDL value true');
      this.send('isready');
      await this.waitFor((l) => l === 'readyok');
    })();
    return this.readyPromise;
  }

  private send(cmd: string) {
    this.worker?.postMessage(cmd);
  }

  private waitFor(match: (l: string) => boolean): Promise<void> {
    return new Promise((resolve, reject) => this.waiters.push({ match, resolve, reject }));
  }

  /** Analyse `fen`, streaming updates to `listener` (replaces any running search). */
  async analyze(fen: string, opts: AnalysisOptions, listener: Listener): Promise<void> {
    await this.start();
    if (this.pending) this.emit(this.pending, true, true);
    this.pending = { fen, opts, listener };
    if (this.searching) {
      this.superseded = true;
      this.send('stop');
    } else this.startPending();
  }

  /** Stop searching; with a listener, only that listener's queued or running search. */
  stop(listener?: Listener) {
    if (listener) {
      if (this.pending?.listener === listener) {
        this.pending = null;
        return;
      }
      if (this.pending || this.current?.listener !== listener) return;
    }
    this.pending = null;
    if (this.searching) this.send('stop');
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
    this.readyPromise = null;
    this.searching = false;
    this.multiPvSet = -1;
    this.skillSet = MAX_SKILL;
  }

  /**
   * The worker died (e.g. iOS ended it for memory): end what was waiting and start afresh, once, with the
   * search that was running; the next request starts a new worker in any case.
   */
  private crashed(message: string) {
    const retry = this.current ?? this.pending;
    const waiting = this.waiters;
    this.waiters = [];
    this.current = null;
    this.pending = null;
    this.superseded = false;
    this.terminate();
    for (const w of waiting) w.reject(new Error(message));
    const now = Date.now();
    const again = now - this.lastCrash < 30_000;
    this.lastCrash = now;
    if (retry && !again) this.analyze(retry.fen, retry.opts, retry.listener).catch(() => undefined);
    else if (retry) this.emit(retry, true, true);
  }

  private startPending() {
    const req = this.pending;
    this.pending = null;
    if (!req) return;
    this.current = req;
    this.lines.clear();
    this.nps = undefined;
    this.searching = true;
    if (this.multiPvSet !== req.opts.multiPv) {
      this.send(`setoption name MultiPV value ${req.opts.multiPv}`);
      this.multiPvSet = req.opts.multiPv;
    }
    const skill = req.opts.skill ?? MAX_SKILL;
    if (this.skillSet !== skill) {
      this.send(`setoption name Skill Level value ${skill}`);
      this.skillSet = skill;
    }
    this.send(`position fen ${req.fen}`);
    let go = 'go';
    if (req.opts.depth > 0) go += ` depth ${req.opts.depth}`;
    if (req.opts.movetime) go += ` movetime ${req.opts.movetime}`;
    if (go === 'go') go += ' infinite';
    // searchmoves takes all remaining tokens, so it goes last
    if (req.opts.searchMoves?.length) go += ` searchmoves ${req.opts.searchMoves.join(' ')}`;
    this.send(go);
  }

  private onLine(line: string) {
    for (let i = 0; i < this.waiters.length; i++) {
      if (this.waiters[i].match(line)) {
        this.waiters[i].resolve();
        this.waiters.splice(i--, 1);
      }
    }
    const req = this.current;
    if (line.startsWith('bestmove')) {
      this.searching = false;
      const best = line.split(/\s+/)[1];
      // stopped for a newer request (aborted), or finished / stopped by stop()
      if (req) this.emit(req, true, this.superseded, best && best !== '(none)' ? best : undefined);
      this.superseded = false;
      this.current = null;
      if (this.pending) this.startPending();
      return;
    }
    if (!req || this.pending || !line.startsWith('info ')) return;
    const turn = req.fen.split(' ')[1] === 'b' ? 'b' : 'w';
    const info = parseInfo(line, turn);
    if (!info) return;
    if (info.nps) this.nps = info.nps;
    const l: EngineLine = {
      multipv: info.multipv,
      depth: info.depth,
      cp: info.cp,
      mate: info.mate,
      pv: info.pv,
      wdl: info.wdl,
    };
    // a new iteration of the best line invalidates deeper-numbered stale lines
    if (l.multipv === 1) {
      for (const [k, v] of this.lines) if (k > 1 && v.depth < l.depth - 1) this.lines.delete(k);
    }
    this.lines.set(l.multipv, l);
    this.emit(req, false);
  }

  private emit(req: Request, done: boolean, aborted = false, bestmove?: string) {
    const lines = req === this.current ? [...this.lines.values()].sort((a, b) => a.multipv - b.multipv) : [];
    req.listener({
      fen: req.fen,
      depth: lines[0]?.depth ?? 0,
      targetDepth: req.opts.depth,
      lines,
      nps: req === this.current ? this.nps : undefined,
      done,
      aborted,
      bestmove,
    });
  }
}

let shared: StockfishEngine | null = null;
export function getEngine(): StockfishEngine {
  shared ??= new StockfishEngine();
  return shared;
}
