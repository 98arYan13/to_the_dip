import { describe, it, expect } from 'vitest';
import { PLANETS, ORES } from '../src/config.js';

describe('planet profiles', () => {
  it('strata cover 0..1 without gaps and tiers rise by at most one', () => {
    for (const p of Object.values(PLANETS)) {
      expect(p.strata[0].from).toBe(0); expect(p.strata.at(-1).to).toBe(1);
      p.strata.forEach((s, k) => {
        if (!k) return;
        expect(s.from).toBe(p.strata[k - 1].to);
        expect(s.tier - p.strata[k - 1].tier).toBeLessThanOrEqual(1);
        expect(s.tier).toBeGreaterThanOrEqual(p.strata[k - 1].tier);
      });
    }
  });

  it('every ore sits in at most two neighbouring strata and is at most one tier above its host', () => {
    for (const p of Object.values(PLANETS)) {
      for (const ore of ORES) {
        if (!ore || ore.kind !== 'ore') continue;
        const idx = p.strata.map((s, k) => (ore.hosts.includes(s.tile) ? k : -1)).filter((k) => k >= 0);
        expect(idx.length).toBeLessThanOrEqual(2);
        if (idx.length === 2) expect(idx[1] - idx[0]).toBe(1);
        for (const k of idx) expect(ore.tier).toBeLessThanOrEqual(p.strata[k].tier + 1);
      }
    }
  });

  it('magma only in the two deepest strata; a stratum without water has no aquifer set piece', () => {
    for (const p of Object.values(PLANETS)) {
      p.strata.forEach((s, k) => { if (s.magma) expect(k).toBeGreaterThanOrEqual(p.strata.length - 2); });
      for (const k of p.setPieces.aquifer?.strata ?? []) expect(p.strata[k].water).toBe(true);
    }
  });
});
