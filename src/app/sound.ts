// Board sounds, synthesised with Web Audio (no sound files to ship or license):
// a short wooden knock for moves, a heavier one for captures, a brighter one for
// checks, and two small chimes for right and wrong answers in solve mode.

export type SoundKind = 'move' | 'capture' | 'check' | 'right' | 'wrong';

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      // iOS: mix with music and stay quiet when the silent switch is on (Safari 16.4+)
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session) session.type = 'ambient';
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Filtered noise click with a fast decay, plus a low thump. */
function knock(ac: AudioContext, t: number, freq: number, level: number, length = 0.08) {
  const n = Math.max(1, Math.floor(ac.sampleRate * length));
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 6;
  const noise = ac.createBufferSource();
  noise.buffer = buf;
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = freq;
  band.Q.value = 1.4;
  const ng = ac.createGain();
  ng.gain.value = level;
  noise.connect(band).connect(ng).connect(ac.destination);
  noise.start(t);

  const thump = ac.createOscillator();
  thump.frequency.setValueAtTime(freq / 8, t);
  thump.frequency.exponentialRampToValueAtTime(freq / 16, t + length);
  const tg = ac.createGain();
  tg.gain.setValueAtTime(level * 0.35, t);
  tg.gain.exponentialRampToValueAtTime(0.0001, t + length);
  thump.connect(tg).connect(ac.destination);
  thump.start(t);
  thump.stop(t + length);
}

/** A few soft sine notes. */
function chime(ac: AudioContext, t: number, freqs: number[], step: number, level: number) {
  freqs.forEach((f, i) => {
    const s = t + i * step;
    const osc = ac.createOscillator();
    osc.frequency.value = f;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(level, s + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 0.28);
    osc.connect(g).connect(ac.destination);
    osc.start(s);
    osc.stop(s + 0.3);
  });
}

export function playSound(kind: SoundKind) {
  const ac = context();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  switch (kind) {
    case 'move':
      knock(ac, t, 1500, 0.8);
      break;
    case 'capture':
      knock(ac, t, 900, 1, 0.11);
      knock(ac, t + 0.04, 1400, 0.5);
      break;
    case 'check':
      knock(ac, t, 2300, 0.8);
      break;
    case 'right':
      chime(ac, t, [660, 880], 0.09, 0.2); // E5, A5
      break;
    case 'wrong':
      chime(ac, t, [311, 262], 0.13, 0.18); // E♭4, C4
      break;
  }
}

/** The sound for a move, from its SAN. */
export function moveSound(san: string): SoundKind {
  if (/[+#]/.test(san)) return 'check';
  return san.includes('x') ? 'capture' : 'move';
}
