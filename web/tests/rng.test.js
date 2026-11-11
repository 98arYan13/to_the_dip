import { describe, it, expect } from 'vitest';
import { RNG, mulberry32, hash2 } from '../src/core/RNG.js';
import { createNoise2D, fbm } from '../src/core/Noise.js';

describe('RNG', () => {
  it('is deterministic per seed', () => {
    const a = new RNG(1234); const b = new RNG(1234);
    for (let i = 0; i < 1000; i++) expect(a.float()).toBe(b.float());
  });

  it('differs across seeds', () => {
    const a = mulberry32(1); const b = mulberry32(2);
    let same = 0;
    for (let i = 0; i < 100; i++) if (a() === b()) same++;
    expect(same).toBeLessThan(3);
  });

  it('stays in [0,1) and int() is inclusive', () => {
    const r = new RNG(99);
    let lo = false; let hi = false;
    for (let i = 0; i < 5000; i++) {
      const f = r.float();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = r.int(3, 5);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(5);
      if (n === 3) lo = true;
      if (n === 5) hi = true;
    }
    expect(lo && hi).toBe(true);
  });

  it('hash2 is stable and position-sensitive', () => {
    expect(hash2(3, 4, 5)).toBe(hash2(3, 4, 5));
    expect(hash2(3, 4, 5)).not.toBe(hash2(4, 3, 5));
  });

  it('noise is deterministic and bounded', () => {
    const n1 = createNoise2D(7); const n2 = createNoise2D(7);
    for (let i = 0; i < 200; i++) {
      const v = fbm(n1, i * 0.37, i * 0.11);
      expect(v).toBe(fbm(n2, i * 0.37, i * 0.11));
      expect(Math.abs(v)).toBeLessThanOrEqual(1);
    }
  });
});
