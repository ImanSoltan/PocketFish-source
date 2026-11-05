import { describe, expect, it } from 'vitest';
import { moveSound } from '../../src/app/sound';

describe('move sounds', () => {
  it('picks the sound from the SAN', () => {
    expect(moveSound('e4')).toBe('move');
    expect(moveSound('O-O')).toBe('move');
    expect(moveSound('Nxe5')).toBe('capture');
    expect(moveSound('exd6')).toBe('capture');
    expect(moveSound('Qh5+')).toBe('check');
    expect(moveSound('Qxf7#')).toBe('check');
    expect(moveSound('e8=Q+')).toBe('check');
  });
});
