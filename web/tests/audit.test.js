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
