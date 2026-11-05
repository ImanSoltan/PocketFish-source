// Promise API around the recognition worker.
import type { Pt } from './geometry';
import type { Gray } from './imageops';
import type { Detection } from './recognize';

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

/** The trained models aren't in this build: they're not part of the public source (all rights reserved). */
export const MODELS_MISSING = 'models-missing';

export class VisionClient {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private ready: Promise<unknown>;

  constructor(modelBase = new URL('models/', document.baseURI).href) {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
      const p = this.pending.get(e.data.id);
      if (!p) return;
      this.pending.delete(e.data.id);
      if (e.data.error) p.reject(new Error(e.data.error));
      else p.resolve(e.data.result);
    };
    // the worker died (e.g. out of memory): fail what's waiting, and start a fresh one next time
    this.worker.onerror = (e) => {
      console.error('recognition worker error', e);
      this.worker.terminate();
      if (shared === this) shared = null;
      const waiting = [...this.pending.values()];
      this.pending.clear();
      for (const p of waiting) p.reject(new Error(e.message || 'recognition stopped'));
    };
    this.ready = (async () => {
      const load = async (name: string) => {
        const res = await fetch(new URL(name, modelBase));
        // a missing file: 404, or a dev server answering with the app's index.html
        if (res.status === 404 || res.headers.get('content-type')?.includes('text/html')) throw new Error(MODELS_MISSING);
        if (!res.ok) throw new Error(`could not load ${name} (${res.status})`);
        return res.arrayBuffer();
      };
      const [board, squares] = await Promise.all([load('board.bin'), load('squares.bin')]);
      await this.call('init', { board, squares }, [board, squares]);
    })();
  }

  /** Resolves once the models are loaded; rejects with MODELS_MISSING when the build has none. */
  get loaded(): Promise<unknown> {
    return this.ready;
  }

  private call(type: string, payload: object = {}, transfer: Transferable[] = []): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, type, ...payload }, transfer);
    });
  }

  async setImage(gray: Gray): Promise<void> {
    await this.ready;
    await this.call('image', { gray });
  }

  async detect(): Promise<Detection> {
    await this.ready;
    return (await this.call('detect')) as Detection;
  }

  /** Square probabilities, plus the corner order that reads the board upright. */
  async classify(corners: Pt[]): Promise<{ probs: Float32Array; corners: Pt[]; rotation: number }> {
    await this.ready;
    return (await this.call('classify', { corners })) as { probs: Float32Array; corners: Pt[]; rotation: number };
  }
}

let shared: VisionClient | null = null;
export const getVision = () => (shared ??= new VisionClient());
