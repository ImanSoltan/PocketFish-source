// React hook: analyse a FEN with the shared on-device engine.
import { useEffect, useRef, useState } from 'react';
import { getEngine, type AnalysisUpdate } from './engine';

export function useAnalysis(fen: string | null, lines: number, depth: number) {
  const [update, setUpdate] = useState<AnalysisUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const listenerRef = useRef<((u: AnalysisUpdate) => void) | null>(null);

  useEffect(() => {
    const engine = getEngine();
    if (!fen) {
      // only our own search: the engine may be busy for someone else (e.g. solve mode)
      if (listenerRef.current) engine.stop(listenerRef.current);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last = 0;
    let latest: AnalysisUpdate | null = null;
    const flush = () => {
      timer = null;
      last = performance.now();
      if (!cancelled && latest) setUpdate(latest);
    };
    setError(null);
    const listener = (u: AnalysisUpdate) => {
      if (cancelled || u.aborted) return;
      latest = u;
      // throttle UI updates to ~8 per second
      if (u.done || performance.now() - last > 120) flush();
      else timer ??= setTimeout(flush, 120);
    };
    listenerRef.current = listener;
    engine
      .analyze(fen, { multiPv: lines, depth }, listener)
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [fen, lines, depth]);

  return { analysis: update && update.fen === fen ? update : null, error };
}
