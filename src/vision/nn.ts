// Minimal CNN inference (no dependencies) for the models exported by
// ml/models.py: conv (BN folded, optional ReLU), nearest x2 upsampling,
// channel concat, global average pooling and broadcast add. Tensors are
// single images in CHW layout.

export interface Tensor {
  c: number;
  h: number;
  w: number;
  data: Float32Array;
}

interface ConvOp {
  op: 'conv';
  in: string;
  out: string;
  cin: number;
  cout: number;
  k: number;
  s: number;
  p: number;
  d: number;
  relu: boolean;
  w: number;
  b: number;
}
type Op =
  | ConvOp
  | { op: 'up2' | 'gap'; in: string; out: string }
  | { op: 'concat' | 'add'; in: [string, string]; out: string };

export interface ModelHeader {
  input: [number, number, number];
  output: string;
  ops: Op[];
  dtype: 'f16' | 'f32';
  count: number;
  meta: Record<string, unknown>;
}

export function halfToFloat(src: Uint16Array): Float32Array {
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) {
    const h = src[i];
    const e = (h >> 10) & 0x1f;
    const f = h & 0x3ff;
    let v: number;
    if (e === 0) v = f * 5.960464477539063e-8; // 2^-24
    else if (e === 31) v = f ? Number.NaN : Number.POSITIVE_INFINITY;
    else v = (1 + f / 1024) * 2 ** (e - 15);
    out[i] = h & 0x8000 ? -v : v;
  }
  return out;
}

export class Model {
  readonly header: ModelHeader;
  private readonly weights: Float32Array;
  private scratch = new Float32Array(0);

  constructor(header: ModelHeader, weights: Float32Array) {
    this.header = header;
    this.weights = weights;
  }

  static fromBuffer(buf: ArrayBuffer): Model {
    const bytes = new Uint8Array(buf);
    const magic = String.fromCharCode(...bytes.subarray(0, 4));
    if (magic !== 'CNN1') throw new Error('not a CNN1 model file');
    const n = new DataView(buf).getUint32(4, true);
    const header = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + n))) as ModelHeader;
    const start = 8 + n;
    const raw = buf.slice(start, start + header.count * (header.dtype === 'f16' ? 2 : 4));
    const weights = header.dtype === 'f16' ? halfToFloat(new Uint16Array(raw)) : new Float32Array(raw);
    return new Model(header, weights);
  }

  static async load(url: string): Promise<Model> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`failed to load model ${url}: ${res.status}`);
    return Model.fromBuffer(await res.arrayBuffer());
  }

  run(input: Tensor): Tensor {
    const t = new Map<string, Tensor>([['input', input]]);
    const get = (name: string) => {
      const v = t.get(name);
      if (!v) throw new Error(`missing tensor ${name}`);
      return v;
    };
    for (const op of this.header.ops) {
      switch (op.op) {
        case 'conv':
          t.set(op.out, this.conv(get(op.in), op));
          break;
        case 'up2':
          t.set(op.out, upsample2(get(op.in)));
          break;
        case 'concat':
          t.set(op.out, concat(get(op.in[0]), get(op.in[1])));
          break;
        case 'gap':
          t.set(op.out, globalAvgPool(get(op.in)));
          break;
        case 'add':
          t.set(op.out, addBroadcast(get(op.in[0]), get(op.in[1])));
          break;
      }
    }
    return get(this.header.output);
  }

  private conv(x: Tensor, op: ConvOp): Tensor {
    const { cin, cout, k, s, p, d } = op;
    if (x.c !== cin) throw new Error(`conv ${op.out}: expected ${cin} channels, got ${x.c}`);
    const Ho = Math.floor((x.h + 2 * p - d * (k - 1) - 1) / s) + 1;
    const Wo = Math.floor((x.w + 2 * p - d * (k - 1) - 1) / s) + 1;
    const out =
      k === 1 && s === 1 && p === 0
        ? this.conv1x1(x, op, Ho * Wo)
        : cout % 4 === 0 && (Ho * Wo) % 4 === 0
          ? this.convBlocked(x, op, Ho, Wo)
          : this.convGeneric(x, op, Ho, Wo);
    if (op.relu) for (let i = 0; i < out.length; i++) if (out[i] < 0) out[i] = 0;
    return { c: cout, h: Ho, w: Wo, data: out };
  }

  private buffer(n: number): Float32Array {
    if (this.scratch.length < n) this.scratch = new Float32Array(n);
    return this.scratch;
  }

  /** Patches as rows: P[n * K + kk] with kk = (ic * k + ky) * k + kx (the weight order). */
  private im2row(x: Tensor, op: ConvOp, Ho: number, Wo: number): Float32Array {
    const { cin, k, s, p, d } = op;
    const { h: H, w: W, data: X } = x;
    const K = cin * k * k;
    const P = this.buffer(Ho * Wo * K);
    let o = 0;
    for (let oy = 0; oy < Ho; oy++) {
      for (let ox = 0; ox < Wo; ox++) {
        for (let ic = 0; ic < cin; ic++) {
          const xb = ic * H * W;
          for (let ky = 0; ky < k; ky++) {
            const iy = oy * s + ky * d - p;
            const inRow = iy >= 0 && iy < H;
            const rb = xb + iy * W;
            for (let kx = 0; kx < k; kx++, o++) {
              const ix = ox * s + kx * d - p;
              P[o] = inRow && ix >= 0 && ix < W ? X[rb + ix] : 0;
            }
          }
        }
      }
    }
    return P;
  }

  /** Spatial convolutions: im2row + GEMM register-blocked over 4 channels x 4 positions. */
  private convBlocked(x: Tensor, op: ConvOp, Ho: number, Wo: number): Float32Array {
    const { cin, cout, k } = op;
    const N = Ho * Wo;
    const K = cin * k * k;
    const P = this.im2row(x, op, Ho, Wo);
    const Wt = this.weights;
    const out = new Float32Array(cout * N);
    for (let oc = 0; oc < cout; oc += 4) {
      const w0b = op.w + oc * K;
      const w1b = w0b + K;
      const w2b = w1b + K;
      const w3b = w2b + K;
      const b0 = Wt[op.b + oc];
      const b1 = Wt[op.b + oc + 1];
      const b2 = Wt[op.b + oc + 2];
      const b3 = Wt[op.b + oc + 3];
      for (let n = 0; n < N; n += 4) {
        const p0 = n * K;
        const p1 = p0 + K;
        const p2 = p1 + K;
        const p3 = p2 + K;
        let a00 = b0, a01 = b0, a02 = b0, a03 = b0;
        let a10 = b1, a11 = b1, a12 = b1, a13 = b1;
        let a20 = b2, a21 = b2, a22 = b2, a23 = b2;
        let a30 = b3, a31 = b3, a32 = b3, a33 = b3;
        for (let kk = 0; kk < K; kk++) {
          const x0 = P[p0 + kk], x1 = P[p1 + kk], x2 = P[p2 + kk], x3 = P[p3 + kk];
          const w0 = Wt[w0b + kk], w1 = Wt[w1b + kk], w2 = Wt[w2b + kk], w3 = Wt[w3b + kk];
          a00 += w0 * x0; a01 += w0 * x1; a02 += w0 * x2; a03 += w0 * x3;
          a10 += w1 * x0; a11 += w1 * x1; a12 += w1 * x2; a13 += w1 * x3;
          a20 += w2 * x0; a21 += w2 * x1; a22 += w2 * x2; a23 += w2 * x3;
          a30 += w3 * x0; a31 += w3 * x1; a32 += w3 * x2; a33 += w3 * x3;
        }
        let o = oc * N + n;
        out[o] = a00; out[o + 1] = a01; out[o + 2] = a02; out[o + 3] = a03;
        o += N;
        out[o] = a10; out[o + 1] = a11; out[o + 2] = a12; out[o + 3] = a13;
        o += N;
        out[o] = a20; out[o + 1] = a21; out[o + 2] = a22; out[o + 3] = a23;
        o += N;
        out[o] = a30; out[o + 1] = a31; out[o + 2] = a32; out[o + 3] = a33;
      }
    }
    return out;
  }

  /** 1x1 convolutions: rank-1 updates over the contiguous input planes. */
  private conv1x1(x: Tensor, op: ConvOp, N: number): Float32Array {
    return this.rank1(x.data, op, N, op.cin);
  }

  /** Any other shape: im2col then rank-1 updates. */
  private convGeneric(x: Tensor, op: ConvOp, Ho: number, Wo: number): Float32Array {
    const { cin, k, s, p, d } = op;
    const { h: H, w: W, data: X } = x;
    const N = Ho * Wo;
    const K = cin * k * k;
    const col = this.buffer(K * N);
    let row = 0;
    for (let ic = 0; ic < cin; ic++) {
      for (let ky = 0; ky < k; ky++) {
        for (let kx = 0; kx < k; kx++, row++) {
          for (let oy = 0; oy < Ho; oy++) {
            const iy = oy * s + ky * d - p;
            for (let ox = 0; ox < Wo; ox++) {
              const ix = ox * s + kx * d - p;
              col[row * N + oy * Wo + ox] = iy >= 0 && iy < H && ix >= 0 && ix < W ? X[ic * H * W + iy * W + ix] : 0;
            }
          }
        }
      }
    }
    return this.rank1(col, op, N, K);
  }

  private rank1(col: Float32Array, op: ConvOp, N: number, K: number): Float32Array {
    const Wt = this.weights;
    const out = new Float32Array(op.cout * N);
    for (let oc = 0; oc < op.cout; oc++) {
      const o = oc * N;
      out.fill(Wt[op.b + oc], o, o + N);
      for (let kk = 0; kk < K; kk++) {
        const w = Wt[op.w + oc * K + kk];
        if (w === 0) continue;
        const cb = kk * N;
        for (let n = 0; n < N; n++) out[o + n] += w * col[cb + n];
      }
    }
    return out;
  }
}

function upsample2(x: Tensor): Tensor {
  const { c, h, w } = x;
  const H = h * 2;
  const W = w * 2;
  const out = new Float32Array(c * H * W);
  for (let ch = 0; ch < c; ch++) {
    for (let y = 0; y < H; y++) {
      const src = ch * h * w + (y >> 1) * w;
      const dst = ch * H * W + y * W;
      for (let xx = 0; xx < W; xx++) out[dst + xx] = x.data[src + (xx >> 1)];
    }
  }
  return { c, h: H, w: W, data: out };
}

function concat(a: Tensor, b: Tensor): Tensor {
  if (a.h !== b.h || a.w !== b.w) throw new Error('concat: spatial size mismatch');
  const out = new Float32Array(a.data.length + b.data.length);
  out.set(a.data, 0);
  out.set(b.data, a.data.length);
  return { c: a.c + b.c, h: a.h, w: a.w, data: out };
}

function globalAvgPool(x: Tensor): Tensor {
  const n = x.h * x.w;
  const out = new Float32Array(x.c);
  for (let ch = 0; ch < x.c; ch++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += x.data[ch * n + i];
    out[ch] = s / n;
  }
  return { c: x.c, h: 1, w: 1, data: out };
}

function addBroadcast(a: Tensor, b: Tensor): Tensor {
  const n = a.h * a.w;
  const out = new Float32Array(a.data.length);
  const bn = b.h * b.w;
  for (let ch = 0; ch < a.c; ch++) {
    for (let i = 0; i < n; i++) out[ch * n + i] = a.data[ch * n + i] + b.data[ch * bn + (bn === 1 ? 0 : i)];
  }
  return { c: a.c, h: a.h, w: a.w, data: out };
}
