import { describe, expect, it } from 'vitest';
import { formatScore, parseInfo, wdlPercent, whiteWinChance } from '../../src/engine/uci';

describe('parseInfo', () => {
  const line =
    'info depth 18 seldepth 24 multipv 2 score cp 35 nodes 123456 nps 654321 hashfull 12 time 188 pv e2e4 e7e5 g1f3';

  it('parses a white-to-move line', () => {
    expect(parseInfo(line, 'w')).toEqual({
      multipv: 2,
      depth: 18,
      cp: 35,
      mate: null,
      pv: ['e2e4', 'e7e5', 'g1f3'],
      nodes: 123456,
      nps: 654321,
    });
  });

  it('converts scores to White\'s point of view', () => {
    expect(parseInfo(line, 'b')!.cp).toBe(-35);
    expect(parseInfo('info depth 5 score mate 3 pv a1a2', 'b')!.mate).toBe(-3);
  });

  it('reads win / draw / loss chances, from White\'s side', () => {
    const wdl = 'info depth 20 multipv 1 score cp 35 wdl 120 850 30 nodes 10 pv e2e4';
    expect(parseInfo(wdl, 'w')!.wdl).toEqual([120, 850, 30]);
    expect(parseInfo(wdl, 'b')!.wdl).toEqual([30, 850, 120]);
    expect(parseInfo(line, 'w')!.wdl).toBeUndefined();
  });

  it('ignores bound and pv-less lines', () => {
    expect(parseInfo('info depth 10 score cp 20 lowerbound pv e2e4', 'w')).toBeNull();
    expect(parseInfo('info depth 10 currmove e2e4 currmovenumber 1', 'w')).toBeNull();
    expect(parseInfo('bestmove e2e4', 'w')).toBeNull();
  });
});

describe('formatting', () => {
  it('formats scores like the app shows them', () => {
    expect(formatScore({ cp: 53, mate: null })).toBe('+0.5');
    expect(formatScore({ cp: -120, mate: null })).toBe('-1.2');
    expect(formatScore({ cp: 2, mate: null })).toBe('0.0');
    expect(formatScore({ cp: null, mate: 3 })).toBe('#3');
    expect(formatScore({ cp: null, mate: -2 })).toBe('#-2');
  });

  it('turns per-mille chances into percentages that add up to 100', () => {
    expect(wdlPercent([120, 850, 30])).toEqual([12, 85, 3]);
    expect(wdlPercent([333, 334, 333])).toEqual([33, 34, 33]);
    expect(wdlPercent([1000, 0, 0])).toEqual([100, 0, 0]);
  });

  it('maps evaluations to a win chance', () => {
    expect(whiteWinChance({ cp: 0, mate: null })).toBeCloseTo(0.5);
    expect(whiteWinChance({ cp: 300, mate: null })).toBeGreaterThan(0.7);
    expect(whiteWinChance({ cp: null, mate: -1 })).toBe(0);
  });
});
