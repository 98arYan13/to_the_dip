import { describe, it, expect } from 'vitest';
import { TECH, ERAS, RECIPES, CAMP_BUILDINGS, PICKAXES, UPGRADES, CONSUMABLES, ORES, MATERIALS, MATERIAL_INPUTS, isOre } from '../src/config.js';
import { eraPickTier } from '../src/systems/Tech.js';

const ids = new Set(TECH.map((t) => t.id));
const byId = (id) => TECH.find((t) => t.id === id);

/** Every (tech ref, item cost) in the data, with where it came from. */
function refs() {
  const techRefs = []; const costs = [];
  for (const t of TECH) { techRefs.push(...t.requires, ...(t.parent ? [t.parent] : [])); costs.push(t.cost.ores); }
  for (const r of RECIPES) { if (r.tech) techRefs.push(r.tech); costs.push(r.in, r.out); }
  for (const b of Object.values(CAMP_BUILDINGS)) for (const l of b.levels) { if (l.tech) techRefs.push(l.tech); costs.push(l.cost.ores || {}); }
  for (const lv of [PICKAXES, ...Object.values(UPGRADES).map((u) => u.levels)]) for (const l of lv) { if (l.tech) techRefs.push(l.tech); if (l.recipe) costs.push(l.recipe); }
  for (const c of Object.values(CONSUMABLES)) if (c.tech) techRefs.push(c.tech);
  return { techRefs, costs };
}

/** Pickaxe tier needed to dig an ore: its own tier or its softest host rock's. */
const digTier = (o) => Math.max(ORES[o].tier, Math.min(...ORES[o].hosts.map((h) => MATERIALS[h].tier)));

/** Raw ores behind an item (materials expand through their recipe inputs). */
function rawOres(o, out = new Set()) {
  if (isOre(o)) out.add(o);
  else for (const i of Object.keys(MATERIAL_INPUTS[o])) rawOres(+i, out);
  return out;
}

/** Earliest era in which a material can be produced (recipe tech era, building level tech era). */
function materialEra(o) {
  const r = RECIPES.find((x) => x.out[o]);
  const bl = CAMP_BUILDINGS[r.building].levels.slice(0, r.level);
  return Math.max(r.tech ? byId(r.tech).era : 1, ...bl.map((l) => (l.tech ? byId(l.tech).era : 1)));
}

describe('tech data', () => {
  it('every reference exists', () => {
    const { techRefs, costs } = refs();
    for (const r of techRefs) expect(ids.has(r), r).toBe(true);
    for (const c of costs) for (const o of Object.keys(c)) expect(ORES[+o], `item ${o}`).toBeTruthy();
    expect(ids.size).toBe(TECH.length);
  });

  it('graph has no cycles and every tech is reachable', () => {
    const owned = new Set();
    let grew = true;
    while (grew) {
      grew = false;
      for (const t of TECH) if (!owned.has(t.id) && t.requires.every((r) => owned.has(r))) { owned.add(t.id); grew = true; }
    }
    expect([...ids].filter((i) => !owned.has(i))).toEqual([]);
  });

  it('each era has exactly one key tech, except era 6, and key techs chain eras', () => {
    const ancestors = (id, out = new Set()) => { for (const r of byId(id).requires) { out.add(r); ancestors(r, out); } return out; };
    for (const e of ERAS) {
      const keys = TECH.filter((t) => t.era === e.n && t.key);
      expect(keys.length, `era ${e.n}`).toBe(e.n === 6 ? 0 : 1);
    }
    for (const t of TECH) {
      if (t.era === 1) continue;
      const prevKey = TECH.find((k) => k.key && k.era === t.era - 1);
      expect(ancestors(t.id).has(prevKey.id), `${t.id} needs ${prevKey.id}`).toBe(true);
    }
  });

  it('materials used in era N are producible by era N', () => {
    for (const t of TECH) for (const o of Object.keys(t.cost.ores)) {
      if (!isOre(+o)) expect(materialEra(+o), `${t.id} uses ${ORES[+o].name}`).toBeLessThanOrEqual(t.era);
    }
  });

  it("ores needed in era N are mineable with that era's pickaxe", () => {
    for (const t of TECH) for (const o of Object.keys(t.cost.ores)) for (const raw of rawOres(+o)) {
      expect(digTier(raw), `${t.id} needs ${ORES[raw].name}`).toBeLessThanOrEqual(eraPickTier(t.era));
    }
  });
});
