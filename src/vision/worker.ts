// Web Worker running the recognition models off the UI thread.
import type { Pt } from './geometry';
import type { Gray } from './imageops';
import { Model } from './nn';
import { classifyAnyRotation, detectBoard } from './recognize';

type Msg =
  | { id: number; type: 'init'; board: ArrayBuffer; squares: ArrayBuffer }
  | { id: number; type: 'image'; gray: Gray }
  | { id: number; type: 'detect' }
  | { id: number; type: 'classify'; corners: Pt[] };

const ctx = self as unknown as {
  postMessage(msg: unknown, transfer?: Transferable[]): void;
  onmessage: ((e: MessageEvent<Msg>) => void) | null;
};

// The main thread fetches the model files and transfers them here (fetching from
// inside a worker is unreliable with custom schemes such as capacitor:// on iOS).
let boardNet: Model | null = null;
let squareNet: Model | null = null;
let image: Gray | null = null;

const nets = (): [Model, Model] => {
  if (!boardNet || !squareNet) throw new Error('models not loaded');
  return [boardNet, squareNet];
};

ctx.onmessage = (e) => {
  const msg = e.data;
  try {
    switch (msg.type) {
      case 'init':
        boardNet = Model.fromBuffer(msg.board);
        squareNet = Model.fromBuffer(msg.squares);
        ctx.postMessage({ id: msg.id, result: true });
        break;
      case 'image':
        image = msg.gray;
        ctx.postMessage({ id: msg.id, result: true });
        break;
      case 'detect': {
        if (!image) throw new Error('no image');
        const [bn] = nets();
        ctx.postMessage({ id: msg.id, result: detectBoard(bn, image) });
        break;
      }
      case 'classify': {
        if (!image) throw new Error('no image');
        const [, sn] = nets();
        const res = classifyAnyRotation(sn, image, msg.corners);
        ctx.postMessage({ id: msg.id, result: res }, [res.probs.buffer]);
        break;
      }
    }
  } catch (err) {
    ctx.postMessage({ id: msg.id, error: err instanceof Error ? err.message : String(err) });
  }
};
