import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/random.js';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 100 }, a);
    const seqB = Array.from({ length: 100 }, b);
    expect(seqA).toStrictEqual(seqB);
  });

  it('produces values in [0, 1)', () => {
    const rng = mulberry32(1234);
    for (let i = 0; i < 10_000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('gives different sequences for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(Array.from({ length: 10 }, a)).not.toStrictEqual(Array.from({ length: 10 }, b));
  });

  it('matches known golden values (mulberry32 reference implementation)', () => {
    expect([
      0.6011037519201636, 0.44829055899754167, 0.8524657934904099, 0.6697340414393693,
    ]).toStrictEqual(Array.from({ length: 4 }, mulberry32(42)));
    expect([0.26642920868471265, 0.0003297457005828619]).toStrictEqual(
      Array.from({ length: 2 }, mulberry32(0)),
    );
  });

  it('normalizes negative seeds like an unsigned 32-bit state', () => {
    expect(Array.from({ length: 8 }, mulberry32(-42))).toStrictEqual(
      Array.from({ length: 8 }, mulberry32(-42 >>> 0)),
    );
  });
});
