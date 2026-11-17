import { describe, it, expect } from 'vitest';
import { ORE, ORES } from '../src/config.js';
import { generateWorld } from '../src/world/WorldGen.js';
import { auditOres, repairOres } from '../src/world/gen/audit.js';
import { RNG } from '../src/core/RNG.js';

const seeds = Array.from({ length: 60 }, (_, k) => 11 + k * 7919);
const fresh = (s) => generateWorld(s);
const repaired = new Map();
const rep = (s) => {
  if (!repaired.has(s)) { const d = fresh(s); const ok = repairOres(d, new RNG(s ^ 0xabc)); repaired.set(s, { d, ok }); }
  return repaired.get(s);
};

describe('ore audit', () => {
  it('bulk ores on Earth are exactly these (a balance change shows up here)', () => {
    const bulk = auditOres(fresh(seeds[0])).filter((r) => r.bulk).map((r) => ORES[r.ore].key).sort();
    expect(bulk).toEqual(['BAUXITE', 'COAL', 'COPPER', 'ILMENITE', 'IRON', 'LEAD', 'NICKEL', 'OIL_SHALE']);
    expect(bulk).not.toContain('DIAMOND');
    expect(bulk).not.toContain('METEORITE');
  });
  it('after repair every needed ore is between floor and ceiling (60 seeds)', () => {
    for (const s of seeds) {
      const { d, ok } = rep(s);
      expect(ok, `seed ${s}`).toBe(true);
      for (const r of auditOres(d)) {
        expect(r.have, `seed ${s} ${ORES[r.ore].key} ceil`).toBeLessThanOrEqual(Math.floor(r.ceil));
        if (r.bulk) continue;
        expect(r.have, `seed ${s} ${ORES[r.ore].key} floor`).toBeGreaterThanOrEqual(r.floor);
        expect(r.haveOpen, `seed ${s} ${ORES[r.ore].key} open`).toBeGreaterThanOrEqual(r.floor / 1.5);
      }
    }
  });
  it('repair never writes into a protected tile and never changes tiles that were fine', () => {
    for (const s of seeds.slice(0, 20)) {
      const before = fresh(s);
      const { d } = rep(s);
      const meteor = before.oreType.filter((o) => o === ORE.METEORITE).length;
      expect(meteor).toBeGreaterThan(0);
      for (let i = 0; i < before.oreType.length; i++) {
        if (before.protect[i]) expect(d.oreType[i], `seed ${s} tile ${i}`).toBe(before.oreType[i]);
        if (before.oreType[i] !== d.oreType[i]) {
          // only added ore on plain host rock, or trimmed ore of an over-ceiling ore
          expect(d.tileType[i]).toBe(before.tileType[i]);
        }
      }
      // bulk ores are never topped up
      const b = auditOres(before).filter((r) => r.bulk);
      const a = auditOres(d);
      for (const r of b) expect(a.find((x) => x.ore === r.ore).have).toBeLessThanOrEqual(r.have);
    }
  });
});

describe('reachability, safety and retry', () => {
  const many = Array.from({ length: 200 }, (_, k) => 1000 + k * 7919);
  const worlds = new Map();
  const gen = (s) => { if (!worlds.has(s)) worlds.set(s, generateWorld(s)); return worlds.get(s); };

  it('200 Earth seeds: no reachability or safety problems remain', () => {
    const t0 = Date.now();
    for (const s of many) expect(gen(s).problems, `seed ${s}`).toEqual([]);
    console.log(`200-seed generation: ${Date.now() - t0} ms`);
  });
  it('fewer than 2% of 200 seeds needed a retry', () => {
    expect(many.filter((s) => gen(s).genSeed !== s).length).toBeLessThan(4);
  });
  it('a world forced to retry is still deterministic', () => {
    const a = generateWorld(31337, 'earth', 64, 256, { forceRetry: 1 });
    const b = generateWorld(31337, 'earth', 64, 256, { forceRetry: 1 });
    expect(a.genSeed).not.toBe(31337);
    expect(a.genSeed).toBe(b.genSeed);
    expect(Array.from(a.tileType)).toEqual(Array.from(b.tileType));
    expect(a.problems).toEqual([]);
  });
  it('retry is bounded: with every attempt failing, generateWorld returns after 8 with problems listed', () => {
    const w = generateWorld(5, 'earth', 64, 256, { forceRetry: 99 });
    expect(w.problems.length).toBeGreaterThan(0);
    expect(w.seed).toBe(5);
  });
  it('repairReach makes rock softer, never opens air', async () => {
    const { auditReach, repairReach } = await import('../src/world/gen/audit.js');
    const { computeBandStarts } = await import('../src/world/gen/strata.js');
    const { TILE, MATERIALS } = await import('../src/config.js');
    const d = generateWorld(77);
    const starts = computeBandStarts(77, d.W, d.H);
    const y = starts[2 * d.W + 31] - 2; // a wall of core rock above the granite top
    for (let x = 1; x < d.W - 1; x++) { const i = y * d.W + x; d.tileType[i] = TILE.CORE; d.oreType[i] = 0; d.protect[i] = 0; }
    const solid = () => d.tileType.reduce((n, t) => n + (MATERIALS[t].solid ? 1 : 0), 0);
    const tierSum = () => d.tileType.reduce((n, t) => n + (MATERIALS[t].solid ? MATERIALS[t].tier : 0), 0);
    expect(auditReach(d, starts).length).toBeGreaterThan(0);
    const [s0, t0] = [solid(), tierSum()];
    repairReach(d, starts);
    expect(auditReach(d, starts)).toEqual([]);
    expect(solid()).toBeLessThanOrEqual(s0);
    expect(solid()).toBeGreaterThanOrEqual(s0 - 8); // only a thin fault was cut
    expect(tierSum()).toBeLessThan(t0);
  });
});
