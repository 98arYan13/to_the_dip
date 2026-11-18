import { describe, it, expect } from 'vitest';
import { PLANETS, RELICS, TECH, ERAS, RECIPES, CAMP_BUILDINGS, PICKAXES, UPGRADES, CONSUMABLES, ORES, MATERIALS, MATERIAL_INPUTS, ORE, isOre } from '../src/config.js';
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

/** Pickaxe tier needed to dig an ore: its own tier or its softest host rock's (off-world ores have no Earth host: their own tier). */
const digTier = (o) => (ORES[o].hosts.length ? Math.max(ORES[o].tier, Math.min(...ORES[o].hosts.map((h) => MATERIALS[h].tier))) : ORES[o].tier);

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
  // An ore with no Earth host comes from another world: not before era 6.
  const offWorld = [...rawOres(o)].some((raw) => !ORES[raw].hosts.length) ? 6 : 1;
  return Math.max(offWorld, r.tech ? byId(r.tech).era : 1, ...bl.map((l) => (l.tech ? byId(l.tech).era : 1)));
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

  it('eras 1-7 have exactly one key tech, era 8 none, and key techs chain eras', () => {
    const ancestors = (id, out = new Set()) => { for (const r of byId(id).requires) { out.add(r); ancestors(r, out); } return out; };
    for (const e of ERAS) {
      const keys = TECH.filter((t) => t.era === e.n && t.key);
      expect(keys.length, `era ${e.n}`).toBe(e.n === 8 ? 0 : 1);
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

describe('relic data', () => {
  it('every relic reference exists and each world relic gates a tech (the Origin Core is the ending, not a tech)', () => {
    const rel = new Set(RELICS.map((r) => r.id));
    for (const t of TECH) if (t.relic) expect(rel.has(t.relic), t.id).toBe(true);
    for (const r of RELICS.filter((x) => x.id !== 'origin_core')) expect(TECH.some((t) => t.relic === r.id), r.id).toBe(true);
  });
  // Soft-lock guard on Earth: eras 1-5 key techs never need a relic. Eras 6-7 key techs (mars_mission, interstellar) may need
  // Moon/Mars relics: those are always obtainable on their own world, which the previous key tech opens.
  it('Earth key techs (eras 1-5) never need a relic, directly or through requires', () => {
    const needsRelic = (id) => { const t = byId(id); return !!t.relic || t.requires.some(needsRelic); };
    for (const t of TECH) if (t.key && t.era <= 5) expect(needsRelic(t.id), t.id).toBe(false);
  });
  it('a relic is reachable by the era that needs it (spec 4.3)', () => {
    for (const r of RELICS.filter((x) => x.layer >= 0)) {
      const era = Math.min(...TECH.filter((t) => t.relic === r.id).map((t) => t.era));
      expect(eraPickTier(era), r.id).toBeGreaterThanOrEqual(r.layer + 1);
    }
  });
  it('exotic materials moved to era 5', () => { expect(byId('exotic_materials').era).toBe(5); });
});

describe('world entry and gear (spec 8.1)', () => {
  const order = ['moon', 'mars', 'tessera'];
  // Off-world ores (no Earth host) each world really hosts, read from its profile.
  const SUPPLY = Object.fromEntries(order.map((p) => [p, Object.keys(PLANETS[p].ores).map(Number).filter((o) => !ORES[o].hosts.length)]));
  it('the spec hosts the space ores: Moon He-3, rare earths, water ice; Mars perchlorate, water ice', () => {
    expect(SUPPLY.moon.sort()).toEqual([ORE.HELIUM3, ORE.RARE_EARTHS, ORE.WATER_ICE].sort());
    expect(SUPPLY.mars.sort()).toEqual([ORE.WATER_ICE, ORE.PERCHLORATE].sort());
  });
  // Pickaxe tier needed for a world's last stratum, and the highest first-stratum tier its entry gear can dig.
  const LAST_PICK = { moon: 6, mars: 7, tessera: 8 };
  const FIRST_MAX = { moon: 6, mars: 7, tessera: 7 };
  it("every tech's raw ores come from Earth or a world reachable before it (fusion_power: the Moon)", () => {
    const reach = { lunar_landing: ['moon'], mars_mission: ['moon', 'mars'], interstellar: ['moon', 'mars', 'tessera'] };
    const worldsFor = (t) => (t.era < 6 ? [] : t.era === 6 ? (t.id === 'mars_mission' ? reach.mars_mission : reach.lunar_landing) : reach.mars_mission);
    for (const t of TECH) {
      const ok = new Set(worldsFor(t).flatMap((w) => SUPPLY[w]));
      for (const i of Object.keys(t.cost.ores)) for (const raw of rawOres(+i)) expect(ORES[raw].hosts.length > 0 || ok.has(raw), `${t.id}: ${ORES[raw].name}`).toBe(true);
    }
    for (const i of Object.keys(byId('fusion_power').cost.ores)) for (const raw of rawOres(+i)) expect(ORES[raw].hosts.length > 0 || SUPPLY.moon.includes(raw), ORES[raw].name).toBe(true);
  });
  it('each world can be entered and finished with gear it or earlier worlds supply', () => {
    for (const w of order) {
      expect(PLANETS[w].strata[0].tier, `${w} first stratum`).toBeLessThanOrEqual(FIRST_MAX[w]);
      const supplied = new Set(order.slice(0, order.indexOf(w) + 1).flatMap((x) => SUPPLY[x]));
      for (const raw of Object.keys(PICKAXES[LAST_PICK[w] - 1].recipe).flatMap((i) => [...rawOres(+i)])) {
        expect(ORES[raw].hosts.length > 0 || supplied.has(raw), `${w}: ${ORES[raw].name}`).toBe(true);
      }
    }
  });
});
