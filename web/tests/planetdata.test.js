import { describe, it, expect } from 'vitest';
import { PLANETS, ORES, TILE, MATERIALS, oreHosts } from '../src/config.js';
import { maxHPFor, hpMulAt } from '../src/world/WorldGen.js';

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
        const idx = p.strata.map((s, k) => (oreHosts(p.id, ore).includes(s.tile) ? k : -1)).filter((k) => k >= 0);
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

  it('four worlds with their own strata, gravity, height and goal', () => {
    expect(Object.keys(PLANETS).sort()).toEqual(['earth', 'mars', 'moon', 'tessera']);
    const t = Object.values(PLANETS).map((p) => p.strata);
    for (let a = 0; a < t.length; a++) for (let b = a + 1; b < t.length; b++) expect(t[a]).not.toBe(t[b]);
    expect(Object.values(PLANETS).map((p) => [p.H, p.gravity, p.goal])).toEqual([[256, 1, 'core'], [448, 0.4, 'relic'], [704, 0.6, 'relic'], [1000, 1.4, 'mind']]);
    expect([PLANETS.moon, PLANETS.mars, PLANETS.tessera].map((p) => [p.pulse.mul, p.quake.mul, p.hpMul])).toEqual([[0.5, 1.5, 1.5], [1, 0.5, 2], [3, 0, 3]]);
  });

  it('every stratum rock is a defined, solid material of its stated tier; regolith is loose', () => {
    for (const p of Object.values(PLANETS)) for (const s of p.strata) expect(MATERIALS[s.tile].tier, `${p.id} ${MATERIALS[s.tile].key}`).toBe(s.tier);
    expect(MATERIALS[TILE.REGOLITH].loose && MATERIALS[TILE.RUST_REGOLITH].loose && MATERIALS[TILE.SAND].loose).toBe(true);
    expect(MATERIALS[TILE.MARE_BASALT].loose).toBeFalsy();
  });

  it('Tessera heat-sink rock has 2x the HP of its hull plating at the same tier', () => {
    const p = PLANETS.tessera;
    expect(MATERIALS[TILE.HEAT_SINK].tier).toBe(MATERIALS[TILE.HULL_PLATE].tier);
    expect(maxHPFor(TILE.HEAT_SINK, 0, hpMulAt(p, TILE.HEAT_SINK))).toBe(2 * maxHPFor(TILE.HULL_PLATE, 0, hpMulAt(p, TILE.HULL_PLATE)));
  });

  it('tube radius, flat pockets and corridor styles follow the cave table', () => {
    expect(PLANETS.moon.strata[2].cave).toMatchObject({ style: 'tube', radius: 3 });
    expect(PLANETS.mars.strata[1].cave).toMatchObject({ style: 'pocket', fyMul: 3 });
    expect(PLANETS.tessera.strata.every((s, k) => k === 0 || s.cave.style === 'corridor')).toBe(true);
  });
});
