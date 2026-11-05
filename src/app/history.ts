// Recently scanned positions (with a small thumbnail of the photo), kept in localStorage.
import { loadJson, saveJson } from './settings';

export interface ScanRecord {
  id: string;
  fen: string;
  /** small JPEG data URL of the rectified board photo */
  thumb: string | null;
  time: number;
  /** board orientation the position was reviewed in */
  orientation?: 'w' | 'b';
}

const KEY = 'chessy.history.v1';
const MAX = 24;

export function loadHistory(): ScanRecord[] {
  const h = loadJson<ScanRecord[]>(KEY);
  return Array.isArray(h) ? h.filter((r) => r && typeof r.fen === 'string') : [];
}

export function addToHistory(
  history: ScanRecord[],
  fen: string,
  thumb: string | null,
  orientation: 'w' | 'b' = 'w',
): ScanRecord[] {
  const rec: ScanRecord = { id: `${Date.now()}`, fen, thumb, time: Date.now(), orientation };
  const next = [rec, ...history.filter((r) => r.fen !== fen)].slice(0, MAX);
  saveJson(KEY, next);
  return next;
}

export function clearHistory(): ScanRecord[] {
  saveJson(KEY, []);
  return [];
}

/** Shrink a data URL image to a small square thumbnail. */
export async function thumbnail(dataUrl: string | null, size = 112): Promise<string | null> {
  if (!dataUrl) return null;
  try {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, size, size);
    return c.toDataURL('image/jpeg', 0.8);
  } catch {
    return null;
  }
}
