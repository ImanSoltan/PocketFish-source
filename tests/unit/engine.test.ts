import { afterEach, describe, expect, it, vi } from 'vitest';
import { StockfishEngine, wasmSimdSupported } from '../../src/engine/engine';

describe('engine support check', () => {
  afterEach(() => vi.restoreAllMocks());

  it('detects WebAssembly SIMD (needed by the bundled Stockfish build)', () => {
    expect(wasmSimdSupported()).toBe(true);
  });

  it('explains the problem instead of hanging on devices without SIMD (iOS < 16.4)', async () => {
    vi.spyOn(WebAssembly, 'validate').mockReturnValue(false);
    await expect(new StockfishEngine().start()).rejects.toThrow(/iOS 16\.4/);
  });
});
