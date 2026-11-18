import { describe, it, expect } from 'vitest';
import { TILE, ORE, PLANETS, ZONES, BALANCE } from '../src/config.js';
import { generateWorld } from '../src/world/WorldGen.js';
import { World } from '../src/world/World.js';
import { mindNodes, mindChamber, planZones, inZone, goalChamber } from '../src/world/Zones.js';
import { Energy } from '../src/systems/Energy.js';
import { Pulse } from '../src/systems/Hazards/Pulse.js';
import { Mining } from '../src/systems/Mining.js';
import { CoreGoal } from '../src/systems/CoreGoal.js';
import { Economy, createEconomyState, expectedTripIncome } from '../src/systems/Economy.js';
import { EventBus } from '../src/core/EventBus.js';
import { RNG } from '../src/core/RNG.js';
import { oreNeed } from '../src/world/gen/need.js';
import { carveCaves, placeFluids } from '../src/world/gen/caves.js';
import { computeBandStarts } from '../src/world/gen/strata.js';

const moon = generateWorld(42, 'moon');
const tess = generateWorld(42, 'tessera');

describe('set pieces of the new worlds', () => {
  it('cold trap walls hold water ice; the tube cathedral is 30x9', () => {
    const z = planZones(moon.genSeed, moon.W, moon.H, PLANETS.moon);
    const ct = z.find((p) => p.kind === 'cold_trap');
    let ice = 0;
    for (let y = ct.y; y < ct.y + ct.h; y++) for (let x = ct.x; x < ct.x + ct.w; x++) if (moon.oreType[y * moon.W + x] === ORE.WATER_ICE) ice++;
    expect(ice).toBeGreaterThanOrEqual(4);
    expect(inZone(new World(moon), 'cold_trap', ct.x + 2, ct.y + 2)).toBe(true);
    expect(inZone(new World(moon), 'cold_trap', 0, 0)).toBe(false);
    const cat = z.find((p) => p.kind === 'tube_cathedral');
    expect([cat.w, cat.h]).toEqual([30, 9]);
  });
  it('every new world holds its landmarks and only its own kinds', () => {
    const table = { moon: ['cold_trap', 'tube_cathedral', 'regolith_slide'], mars: ['ice_lens', 'brine_pocket', 'methane_vent', 'dust_sink'], tessera: ['fabricator_hall', 'coolant_channel', 'data_vault'] };
    for (const [p, kinds] of Object.entries(table)) {
      const w = generateWorld(77, p);
      const got = new Set(planZones(w.genSeed, w.W, w.H, PLANETS[p]).map((z) => z.kind));
      for (const k of kinds) expect(got.has(k), `${p} ${k}`).toBe(true);
      for (const k of got) expect(kinds, p).toContain(k);
    }
  });
});

describe('Tessera goal chamber', () => {
  it('is 15x9 at the bottom with hull nodes left, right and top', () => {
    const c = mindChamber(64, 1000);
    expect([c.w, c.h]).toEqual([15, 9]);
    const n = mindNodes(tess.W, tess.H);
    expect(n.length).toBe(3);
    for (const { x, y } of n) expect(tess.tileType[y * tess.W + x]).toBe(TILE.ALIEN_HULL);
    expect(n[0].x).toBeLessThan(n[2].x);
    expect(n[2].x).toBeLessThan(n[1].x);
    expect(n[2].y).toBeLessThan(n[0].y);
    expect(tess.tileType[(c.y + 4) * tess.W + c.x + 7]).toBe(TILE.AIR);
  });
  it('Earth has a core chamber, the Moon and Mars none', () => {
    expect(goalChamber(64, 256, PLANETS.earth)).not.toBeNull();
    expect(goalChamber(64, 448, PLANETS.moon)).toBeNull();
    expect(goalChamber(64, 704, PLANETS.mars)).toBeNull();
    expect(ZONES.MIND_CHAMBER).toEqual({ W: 15, H: 9 });
  });
});

describe('cave styles on the deep worlds', () => {
  it('gas branch: methane sits only in cave air', () => {
    const w = generateWorld(5, 'mars');
    let gas = 0;
    for (let i = 0; i < w.gas.length; i++) if (w.gas[i]) { gas++; expect([TILE.AIR]).toContain(w.tileType[i]); }
    expect(gas).toBeGreaterThan(0);
  });
  it('corridor style carves air into a solid lattice and the Mind stratum stays solid', () => {
    const W = 64; const H = 1000; const n = W * H; const p = PLANETS.tessera;
    const d = { W, H, seed: 9, planet: 'tessera', tileType: new Uint8Array(n).fill(TILE.LATTICE), oreType: new Uint8Array(n), flags: new Uint8Array(n), fluid: new Uint8Array(n), gas: new Uint8Array(n), band: new Uint8Array(n).fill(TILE.LATTICE), protect: new Uint8Array(n) };
    const starts = computeBandStarts(9, W, H, p);
    carveCaves(d, starts, 9);
    placeFluids(d, starts, 9);
    expect(d.tileType.includes(TILE.AIR)).toBe(true);
    for (let y = H - 20; y < H - 1; y++) for (let x = 1; x < W - 1; x++) expect(d.tileType[y * W + x]).not.toBe(TILE.AIR);
  });
});

describe('hazards inside set pieces', () => {
  const eco = (planet) => ({ planet, tech: [], loadFrac: 0, stat: (_n, b) => b, rig: { maxEnergy: 1000 } });
  it('Moon cold trap doubles the idle drain', () => {
    const drop = (coldTrap) => { const en = new Energy(new EventBus(), eco('moon')); en.depthM = 100; en.update(1, { jetting: false, atStation: false, onSurface: false, coldTrap }); return 1000 - en.value; };
    expect(drop(true)).toBeCloseTo(2 * drop(false));
    expect(drop(false)).toBeGreaterThan(0);
  });
  it('fabricator hall halves the gap between pulses (rate 2)', () => {
    const next = (rate) => { const p = new Pulse(new EventBus(), new RNG(1), { planet: 'tessera', tech: [], stat: (_n, b) => b }); p.underM = 1000; p.rate = rate; p.timer = 100; p.update(1, 500, false); return 100 - p.timer; };
    expect(next(2)).toBe(2 * next(1));
  });
});

describe('goals', () => {
  it('taking the relic on the Moon or Mars sets economy.done[planet]; Earth does not', () => {
    for (const p of ['moon', 'mars']) {
      const w = new World(generateWorld(3, p));
      const eco = { relics: [], done: {}, pickTier: 1 };
      new Mining(w, new EventBus(), eco, { revealAround() {} }, { spawn() {} }).breakTile(w.tileType.indexOf(TILE.RELIC), true);
      expect(eco.done).toEqual({ [p]: true });
      expect(eco.relics).toEqual([PLANETS[p].relic]);
    }
    const w = new World(generateWorld(3));
    const eco = { relics: [], done: {}, pickTier: 1 };
    new Mining(w, new EventBus(), eco, { revealAround() {} }, { spawn() {} }).breakTile(w.tileType.indexOf(TILE.RELIC), true);
    expect(eco.done).toEqual({});
  });
  it('economy.done survives save, load and a new map', () => {
    const e = new Economy(new EventBus());
    expect(e.done).toEqual({});
    e.done.moon = true;
    expect(new Economy(new EventBus(), JSON.parse(JSON.stringify(e.toJSON()))).done).toEqual({ moon: true });
    expect(e.newMapState().done).toEqual({ moon: true });
    expect(createEconomyState().done).toEqual({});
  });
  it('the Core hold only runs on Earth', () => {
    const g = new CoreGoal(new World(moon), new EventBus(), { tech: ['core_interface', 'heat_suit'], relics: [] });
    expect(g.inChamber(32 * 32, 440 * 32)).toBe(false);
  });
});

describe('need and income', () => {
  it('needs only name ores the planet hosts; Tessera feeds meteorite, rhodium, platinum, diamond', () => {
    for (const p of ['moon', 'mars', 'tessera']) for (const o of Object.keys(oreNeed(p))) expect(PLANETS[p].ores[o], `${p} ${o}`).toBeDefined();
    expect(Object.keys(oreNeed('tessera')).map(Number).sort((a, b) => a - b)).toEqual([ORE.PLATINUM, ORE.METEORITE, ORE.RHODIUM, ORE.DIAMOND].sort((a, b) => a - b));
  });
  it('trip income keeps rising through tiers 7 and 8 using Moon and Mars strata', () => {
    expect(BALANCE.FOCUS_BY_TIER.slice(6).map((f) => f[0])).toEqual(['moon', 'mars']);
    for (let t = 2; t <= 8; t++) expect(expectedTripIncome(t)).toBeGreaterThan(expectedTripIncome(t - 1));
  });
});
