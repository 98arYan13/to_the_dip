import { describe, it, expect } from 'vitest';
import { Economy, createEconomyState } from '../src/systems/Economy.js';
import { EventBus, EV } from '../src/core/EventBus.js';
import { World } from '../src/world/World.js';
import { generateWorld } from '../src/world/WorldGen.js';
import { planZones, coreChamber } from '../src/world/Zones.js';
import { upgradeBuilding, placeChargeStation, fieldCampBlocker, placeFieldCamp, nearFieldCamp } from '../src/systems/Camp.js';
import { rollContracts, acceptContract, turnIn } from '../src/systems/Contracts.js';
import { Collectibles } from '../src/systems/Collectibles.js';
import { CoreGoal } from '../src/systems/CoreGoal.js';
import { dailySeed } from '../src/systems/Daily.js';
import { canPlaceLadder, placeLadder, pickUpLadder, FallingLadders } from '../src/systems/Items.js';
import { Mining, canMine } from '../src/systems/Mining.js';
import { ORE, ITEM, TILE, ORES, ZONES, WORLD, CAMP, CONTRACTS, CORE_GOAL, FLAG, SAVE, GAS, PICKAXES, DYNAMITE, PHYSICS } from '../src/config.js';

const mk = () => new Economy(new EventBus(), createEconomyState());

describe('zones', () => {
  const W = WORLD.W; const H = WORLD.H;
  it('same seed gives the same plan', () => { expect(planZones(5, W, H)).toEqual(planZones(5, W, H)); });
  it('no overlaps, no camp/shaft, inside its depth band, every layer has its landmark', () => {
    const bc = WORLD.BASE_CAMP; const U = H - 1 - WORLD.SURFACE_ROWS;
    for (const seed of [1, 2, 3, 42, 777]) {
      const zs = planZones(seed, W, H);
      zs.forEach((a, i) => {
        zs.slice(i + 1).forEach((b) => expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).toBe(false));
        expect(a.x + a.w <= bc.SHAFT_X - 3 || a.x >= bc.SHAFT_X + 4).toBe(true);
        expect(a.y).toBeGreaterThan(WORLD.SURFACE_ROWS + bc.PAD_DEPTH);
        const [b0, b1] = ZONES.BANDS[a.kind];
        expect((a.y - WORLD.SURFACE_ROWS) / U).toBeGreaterThanOrEqual(b0 - 1e-9);
        expect((a.y + a.h - WORLD.SURFACE_ROWS) / U).toBeLessThanOrEqual(b1 + 1e-9);
      });
      ZONES.LANDMARKS.forEach((k) => expect(zs.some((z) => z.kind === k)).toBe(true));
    }
  });
  it('vaults have a diggable shell; gas caverns and lava lakes have a safe approach', () => {
    for (const seed of [1, 2, 3]) {
      const w = new World(generateWorld(seed));
      for (const z of planZones(seed, w.W, w.H)) {
        if (z.kind === 'vault') {
          for (let x = z.x; x < z.x + z.w; x++) { expect(w.tileType[z.y * w.W + x]).not.toBe(TILE.BEDROCK); expect(w.tileType[(z.y + z.h - 1) * w.W + x]).not.toBe(TILE.BEDROCK); }
          expect(w.tileType[(z.y + 1) * w.W + z.x + 1]).toBe(TILE.AIR);
        }
        if (z.kind === 'gas_cavern' || z.kind === 'lava_lake') {
          const ay = z.y + z.h - 2; const i = ay * w.W + z.x - 1;
          expect(w.tileType[i]).toBe(TILE.AIR); expect(w.gas[i]).toBe(0); expect(w.isSolid(z.x - 1, ay + 1)).toBe(true);
        }
        if (z.kind === 'gas_cavern') expect(w.gas[(z.y + 2) * w.W + z.x + 2]).toBe(GAS.MAX);
      }
    }
  });
  it('core chamber is carved and sealed from the bottom bedrock', () => {
    const w = new World(generateWorld(9)); const c = coreChamber(w.W, w.H);
    expect(w.tileType[c.y * w.W + c.x]).toBe(TILE.AIR);
    expect(w.tileType[(w.H - 1) * w.W + c.x]).toBe(TILE.BEDROCK);
  });
});

describe('camp', () => {
  const world = () => { const w = new World(generateWorld(1)); for (let x = 5; x < 40; x++) { w.tileType[60 * w.W + x] = TILE.GRANITE; w.flags[60 * w.W + x] |= FLAG.SOLID; w.clear(59 * w.W + x); } return w; };
  const rich = (e) => { e.credits = 1e6; e.stash[ITEM.STEEL] = 50; e.stash[ITEM.COPPER_WIRE] = 50; e.tech.push('charge_station'); };
  it('station needs tech and cost, a floor, and spacing; survives death', () => {
    const w = world(); const e = mk(); e.credits = 1e6; e.stash[ITEM.STEEL] = 50; e.stash[ITEM.COPPER_WIRE] = 50;
    expect(placeChargeStation(e, w, 10, 59).ok).toBe(false);
    rich(e);
    expect(placeChargeStation(e, w, 10, 59).ok).toBe(true);
    expect(placeChargeStation(e, w, 10 + CAMP.STATION_MIN_GAP - 1, 59).ok).toBe(false);
    expect(placeChargeStation(e, w, 10 + CAMP.STATION_MIN_GAP + 1, 59).ok).toBe(true);
    e.applyDeath();
    expect(e.stations.length).toBe(2);
  });
  it('buildings upgrade one level at a time and change prices', () => {
    const e = mk(); e.credits = 1e6;
    expect(e.sellMul).toBe(1);
    expect(upgradeBuilding(e, 'shop').ok).toBe(true);
    expect(upgradeBuilding(e, 'shop').ok).toBe(true);
    expect(e.buildings.shop).toBe(2);
    expect(e.sellMul).toBeGreaterThan(1.1);
    expect(upgradeBuilding(e, 'workshop').reason).toMatch(/Requires/); // Workshop 2 needs machining, no cash discount any more
    expect(e.buildings.workshop).toBe(1);
  });
});

describe('field camp', () => {
  /** Rows 56..59 open, granite floor at row 60, for x in 5..39. */
  const cave = () => {
    const w = new World(generateWorld(1));
    for (let x = 5; x < 40; x++) {
      w.tileType[60 * w.W + x] = TILE.GRANITE; w.flags[60 * w.W + x] |= FLAG.SOLID;
      for (let y = 56; y < 60; y++) w.clear(y * w.W + x);
    }
    return w;
  };
  const kit = (e, n = 4) => { e.consumables.campKit = n; return e; };
  it('needs a kit, a 4x4 open space, a solid floor and stays under the limit', () => {
    const w = cave();
    expect(fieldCampBlocker(mk(), w, 10, 59)).toBe('No camp kit');
    const e = kit(mk());
    expect(fieldCampBlocker(e, w, 10, 59)).toBe(null);
    expect(fieldCampBlocker(e, w, 10, 58)).toBe('Needs a 4×4 open space'); // top row 55 is not cleared
    w.clear(60 * w.W + 12); w.tileType[60 * w.W + 12] = TILE.AIR;
    expect(fieldCampBlocker(e, w, 10, 59)).toBe('Needs solid floor');
    e.fieldCamps.push({ x: 0, y: 0 }, { x: 0, y: 20 }, { x: 0, y: 40 });
    expect(fieldCampBlocker(e, w, 20, 59)).toBe('Camp limit reached');
  });
  it('placing spends a kit and persists through save and death', () => {
    const w = cave(); const e = kit(mk(), 1);
    expect(placeFieldCamp(e, w, 10, 59).ok).toBe(true);
    expect(e.consumables.campKit).toBe(0);
    expect(nearFieldCamp(e, 12 * 32, 58 * 32)).toBe(true);
    expect(nearFieldCamp(e, 30 * 32, 58 * 32)).toBe(false);
    e.applyDeath();
    const e2 = mk(); e2.load(e.toJSON());
    expect(e2.fieldCamps).toEqual([{ x: 10, y: 59 }]);
  });
});

describe('contracts', () => {
  it('are deterministic, pay a premium and stay within the pickaxe tier', () => {
    const a = rollContracts(5, 100, 2); const b = rollContracts(5, 100, 2);
    expect(a).toEqual(b);
    for (const tier of [1, 2, 4, 6]) for (const c of rollContracts(9, 7, tier)) {
      expect(ORES[c.ore].tier).toBeLessThanOrEqual(tier);
      expect(c.rewardCash).toBeGreaterThan(c.qty * ORES[c.ore].price * (1 + CONTRACTS.PREMIUM - 1e-9));
    }
  });
  it('turn in takes ore, pays once, and fails without changing anything', () => {
    const e = mk(); const c = rollContracts(1, 1, 1)[0];
    expect(acceptContract(e, c).ok).toBe(true);
    e.cargo[c.ore] = c.qty - 1;
    expect(turnIn(e, c.id).ok).toBe(false);
    expect(e.cargo[c.ore]).toBe(c.qty - 1); expect(e.contracts.active.length).toBe(1);
    e.stash[c.ore] = 1;
    const cash = e.credits;
    expect(turnIn(e, c.id).ok).toBe(true);
    expect(e.credits).toBeGreaterThan(cash);
    expect(turnIn(e, c.id).ok).toBe(false);
    expect(acceptContract(e, c).ok).toBe(false);
    e.applyDeath(); expect(e.contracts.done).toContain(c.id);
  });
  it('active contracts survive death and are capped', () => {
    const e = mk(); const offers = rollContracts(1, 1, 6);
    offers.slice(0, CONTRACTS.MAX_ACTIVE).forEach((c) => acceptContract(e, c));
    expect(acceptContract(e, offers[CONTRACTS.MAX_ACTIVE]).ok).toBe(false);
    e.applyDeath(); expect(e.contracts.active.length).toBe(CONTRACTS.MAX_ACTIVE);
  });
});

describe('collectibles', () => {
  it('award each achievement once and keep it through death', () => {
    const e = mk(); const bus = e.bus; new Collectibles(bus, e);
    let awards = 0; bus.on(EV.ACHIEVEMENT, () => awards++);
    for (let k = 0; k < 6; k++) bus.emit(EV.ORE_COLLECTED, 10);
    expect(e.achievements).toContain('first_fossil'); expect(e.achievements).toContain('fossils_5'); expect(e.achievements).not.toContain('fossils_15');
    bus.emit(EV.DEPTH_CHANGED, { meters: 150, layer: '' }); bus.emit(EV.DEPTH_CHANGED, { meters: 150, layer: '' });
    expect(e.achievements).toContain('depth_100');
    const n = awards; bus.emit(EV.ORE_COLLECTED, 10); expect(awards).toBe(n);
    e.applyDeath(); expect(e.achievements).toContain('fossils_5');
  });
});

describe('core goal', () => {
  const setup = (tech, iface = true) => {
    const w = new World(generateWorld(1)); const e = mk(); if (tech) e.tech.push('heat_suit');
    if (iface) e.tech.push('core_interface');
    const g = new CoreGoal(w, e.bus, e); const c = coreChamber(w.W, w.H);
    return { w, e, g, px: (c.x + 2) * 32, py: (c.y + 2) * 32 };
  };
  it('completes only after surviving HOLD_S, rewards once, and death resets the hold', () => {
    const { e, g, px, py } = setup(true);
    let done = 0; e.bus.on(EV.COMPLETED, () => done++);
    for (let t = 0; t < CORE_GOAL.HOLD_S - 1; t += 0.5) g.update(0.5, px, py);
    expect(done).toBe(0);
    e.bus.emit(EV.PLAYER_DEAD, 'x');
    expect(g.hold).toBe(0); expect(e.completed).toBe(false);
    for (let t = 0; t <= CORE_GOAL.HOLD_S + 1; t += 0.5) g.update(0.5, px, py);
    expect(done).toBe(1); expect(e.completed).toBe(true);
    const cash = e.credits; g.complete(); expect(e.credits).toBe(cash);
    e.applyDeath(); expect(e.completed).toBe(true);
  });
  it('kills without the heat suit', () => {
    const { g, px, py } = setup(false); let failed = 0; g.onFail = () => failed++;
    g.update(0.1, px, py); expect(failed).toBe(1);
  });
  it('without the interface the hold never starts and nobody dies', () => {
    const { e, g, px, py } = setup(true, false); let failed = 0, denied = 0; g.onFail = () => failed++;
    e.bus.on(EV.CORE_DENIED, () => denied++);
    for (let t = 0; t < 30; t += 0.5) g.update(0.5, px, py);
    expect(e.completed).toBe(false); expect(failed).toBe(0); expect(g.hold).toBe(0); expect(denied).toBe(1);
    g.update(0.5, 0, 0); g.update(0.5, px, py); expect(denied).toBe(2);
  });
  it('with interface + heat suit the hold completes and grants the seed core', () => {
    const { e, g, px, py } = setup(true);
    for (let t = 0; t <= CORE_GOAL.HOLD_S + 1; t += 0.5) g.update(0.5, px, py);
    expect(e.completed).toBe(true); expect(e.relics).toContain('seed_core');
  });
  it('a tier-6 pickaxe can mine the core rock', () => {
    expect(canMine(TILE.CORE, 0, 6)).toBe(true); expect(canMine(TILE.CORE, 0, 5)).toBe(false);
  });
});

describe('daily', () => {
  it('seed is stable within a UTC day and differs the next', () => {
    expect(dailySeed(new Date('2026-11-12T01:00:00Z'))).toBe(dailySeed(new Date('2026-11-12T23:00:00Z')));
    expect(dailySeed(new Date('2026-11-13T01:00:00Z'))).not.toBe(dailySeed(new Date('2026-11-12T23:00:00Z')));
  });
  it('a fresh economy has base equipment', () => {
    const e = mk(); expect(e.tech).toEqual([]); expect(e.levels.pickaxe).toBe(0);
  });
});

describe('items', () => {
  const world = () => {
    const w = new World(generateWorld(1));
    for (let y = 40; y < 60; y++) for (let x = 10; x < 20; x++) { const i = y * w.W + x; w.tileType[i] = TILE.GRANITE; w.flags[i] |= FLAG.SOLID; }
    for (let y = 45; y < 55; y++) w.clear(y * w.W + 15);
    return w;
  };
  it('a ladder placed in open air falls until something solid or another ladder is below it', () => {
    const w = world(); const bus = new EventBus(); const at = (y) => w.tileType[y * w.W + 15];
    expect(placeLadder(w, bus, 12, 50)).toBe(false); // solid tile
    expect(placeLadder(w, bus, 15, 46)).toBe(true);
    expect(at(46)).toBe(TILE.AIR); expect(at(54)).toBe(TILE.LADDER); // rests on the floor at row 55
    expect(placeLadder(w, bus, 15, 46)).toBe(true);
    expect(at(53)).toBe(TILE.LADDER); // stacks on the ladder below
    expect(canPlaceLadder(w, 12, 50)).toBe(false);
  });
  it('a dropped ladder falls at player fall speed and lands on the floor, stacking on earlier ladders', () => {
    const w = world(); const bus = new EventBus(); const f = new FallingLadders(w, bus); const at = (y) => w.tileType[y * w.W + 15];
    expect(f.drop(12, 50)).toBe(false); // solid tile
    expect(f.drop(15, 46)).toBe(true);
    f.update(1 / 60, PHYSICS.GRAVITY, PHYSICS.MAX_FALL);
    expect(f.active.length).toBe(1); expect(at(54)).toBe(TILE.AIR); // still in the air after one frame
    let t = 0; while (f.active.length && t++ < 600) f.update(1 / 60, PHYSICS.GRAVITY, PHYSICS.MAX_FALL);
    expect(at(46)).toBe(TILE.AIR); expect(at(54)).toBe(TILE.LADDER);
    expect(t / 60).toBeCloseTo(Math.sqrt(2 * 8 * 32 / PHYSICS.GRAVITY), 0); // ~0.9 s for 8 tiles
    f.drop(15, 46); t = 0; while (f.active.length && t++ < 600) f.update(1 / 60, PHYSICS.GRAVITY, PHYSICS.MAX_FALL);
    expect(at(53)).toBe(TILE.LADDER);
  });
  it('a big bomb clears more than a normal one and still spares bedrock and the camp', () => {
    const count = (r) => {
      const w = world(); const bus = new EventBus();
      const m = new Mining(w, bus, { pickTier: 6, addOre() { return true; } }, { revealAround() {} }, { spawn() {} });
      return m.blast(15, 50, r);
    };
    expect(count(DYNAMITE.BIG_RADIUS)).toBeGreaterThan(count(DYNAMITE.RADIUS));
    const w = new World(generateWorld(1)); const m = new Mining(w, new EventBus(), { pickTier: 6, addOre() { return true; } }, { revealAround() {} }, { spawn() {} });
    const camp = WORLD.SURFACE_ROWS * w.W + WORLD.BASE_CAMP.PAD_X0 + 2;
    m.blast(WORLD.BASE_CAMP.PAD_X0 + 2, WORLD.SURFACE_ROWS + 1, 3);
    expect(w.flags[camp] & FLAG.SOLID).toBeTruthy();
    const bedY = w.H - 1; expect(w.tileType[bedY * w.W + 10]).toBe(TILE.BEDROCK);
    m.blast(10, bedY - 1, 3); expect(w.tileType[bedY * w.W + 10]).toBe(TILE.BEDROCK);
  });
  it('a placed ladder can be picked up again, other tiles cannot', () => {
    const w = new World(generateWorld(1)); const bus = new EventBus();
    const x = WORLD.BASE_CAMP.SPAWN_X; const y = WORLD.SURFACE_ROWS - 1; // open air above the surface, rock below
    expect(placeLadder(w, bus, x, y)).toBe(true);
    expect(pickUpLadder(w, bus, x, y)).toBe(true);
    expect(w.tileType[y * w.W + x]).toBe(TILE.AIR);
    expect(pickUpLadder(w, bus, x, WORLD.SURFACE_ROWS + 3)).toBe(false);
  });
  it('death loses ores but keeps materials and consumables', () => {
    const e = mk(); e.consumables.ladder = 3; e.consumables.bigBomb = 2;
    e.cargo[ORE.COAL] = 3; e.cargo[ITEM.STEEL] = 2; e.applyDeath();
    expect(e.cargo[ORE.COAL]).toBe(0); expect(e.cargo[ITEM.STEEL]).toBe(2);
    expect(e.consumables.ladder).toBe(3); expect(e.consumables.bigBomb).toBe(2);
    expect(() => mk().applyDeath()).not.toThrow();
  });
  it('new map keeps at least 10 ladders and never reduces more', () => {
    const e = mk(); e.consumables.ladder = 2;
    expect(e.newMapState().consumables.ladder).toBe(10);
    e.consumables.ladder = 25;
    expect(e.newMapState().consumables.ladder).toBe(25);
  });
});

describe('polish items', () => {
  it('thin gas in an open cavern dissipates, sealed gas does not', async () => {
    const { Gas } = await import('../src/systems/Hazards/Gas.js');
    const w = new World(generateWorld(3));
    for (let y = 40; y < 50; y++) for (let x = 4; x < 20; x++) { const i = y * w.W + x; w.tileType[i] = TILE.GRANITE; w.flags[i] |= FLAG.SOLID; w.gas[i] = 0; w.fluid[i] = 0; }
    for (let y = 42; y < 47; y++) for (let x = 6; x < 14; x++) w.clear(y * w.W + x);
    const g = new Gas(w, new EventBus());
    for (let x = 6; x < 14; x++) { w.gas[44 * w.W + x] = 1; g.dirty.add(44 * w.W + x); }
    for (let k = 0; k < 300; k++) g.update(0.3);
    let left = 0; for (let x = 6; x < 14; x++) left += w.gas[44 * w.W + x];
    expect(left).toBe(0);
  });
  it('stash is capped and stash_2 raises the cap', () => {
    const e = mk(); e.cargo[2] = 5; e.stash[2] = 198; e.deposit();
    expect(e.stash[2]).toBe(200); expect(e.cargo[2]).toBe(3);
    e.tech.push('stash_2'); e.deposit(); expect(e.cargo[2]).toBe(0);
  });
  it('jet tech lowers drain and raises thrust', () => {
    const e = mk(); e.tech.push('jet_tank_1', 'jet_thrust_1');
    expect(e.stat('jetDrain', 1)).toBeLessThan(1); expect(e.stat('jetThrust', 1900)).toBeGreaterThan(1900);
  });
  it('a v3 save (no fluid/gas/extras) still loads', async () => {
    const { serialize, deserialize } = await import('../src/save/SaveSystem.js');
    const w = new World(generateWorld(4));
    const s = JSON.parse(serialize({ seed: 4, player: {}, economy: createEconomyState(), world: w }));
    s.version = 3; delete s.world.fluid; delete s.world.gas; delete s.economy.tech; delete s.economy.stash;
    const d = deserialize(JSON.stringify(s));
    expect(d.version).toBe(SAVE.VERSION); expect(d.world.gas.length).toBe(w.W * w.H);
    const e = mk(); e.load(d.economy); expect(e.tech).toEqual([]); expect(e.stash[2]).toBe(0);
  });
});
