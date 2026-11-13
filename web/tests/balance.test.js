import { describe, it, expect } from 'vitest';
import { TECH, ERAS } from '../src/config.js';
import { techTrips } from '../src/systems/Economy.js';

describe('tech cost balance (trips of income at that era)', () => {
  it('key techs cost 4-6 trips, other techs 1-3 (space era: key chain only)', () => {
    for (const t of TECH) {
      if (t.era === 6) continue;
      const n = techTrips(t.id);
      const [lo, hi] = t.key ? [4, 6] : [1, 3];
      expect(n, `${t.id} = ${n.toFixed(2)} trips`).toBeGreaterThanOrEqual(lo);
      expect(n, `${t.id} = ${n.toFixed(2)} trips`).toBeLessThanOrEqual(hi);
    }
  });

  it('space-era chain costs rise along requires', () => {
    for (const t of TECH.filter((x) => x.era === 6)) for (const r of t.requires) {
      const p = TECH.find((x) => x.id === r);
      if (p.era === 6) expect(techTrips(t.id), `${t.id} vs ${r}`).toBeGreaterThan(techTrips(r));
    }
  });

  it('per-era total trips strictly increase', () => {
    const total = ERAS.map((e) => TECH.filter((t) => t.era === e.n).reduce((a, t) => a + techTrips(t.id), 0));
    for (let i = 1; i < total.length; i++) expect(total[i], `era ${i + 1}`).toBeGreaterThan(total[i - 1]);
  });
});
