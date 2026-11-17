import { describe, it, expect } from 'vitest';
import { rleEncode, rleDecode, serialize, deserialize, SaveSystem, migrate, migrateEconomyV6 } from '../src/save/SaveSystem.js';
import { generateWorld } from '../src/world/WorldGen.js';
import { World } from '../src/world/World.js';
import { Economy, createEconomyState } from '../src/systems/Economy.js';
import { EventBus } from '../src/core/EventBus.js';
import { FLAG, SAVE, ITEM, TECH, RELICS } from '../src/config.js';

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
}

describe('Save codec', () => {
  it('RLE round-trips', () => {
    const src = new Uint8Array(2000);
    for (let i = 0; i < src.length; i++) src[i] = i % 300 < 260 ? 7 : i & 255;
    expect(Array.from(rleDecode(rleEncode(src), src.length))).toEqual(Array.from(src));
  });

  it('save then load restores exact world, player and economy', () => {
    const w = new World(generateWorld(777));
    w.clear(10 * w.W + 10);
    w.tileHP[20 * w.W + 20] = 1;
    w.flags[30 * w.W + 30] |= FLAG.DISCOVERED;
    w.flags[10 * w.W + 10] &= ~FLAG.DIRTY;
    const eco = new Economy(new EventBus(), createEconomyState());
    eco.credits = 1234; eco.cargo[3] = 5; eco.levels.pickaxe = 2; eco.consumables.dynamite = 7;
    const player = { x: 123.5, y: 456.25, energy: 42.5 };
    const sys = new SaveSystem(memStorage());
    expect(sys.save({ seed: 777, player, economy: eco.toJSON(), world: w })).toBe(true);
    const r = sys.load();
    expect(r.ok).toBe(true);
    const d = r.data;
    expect(d.seed).toBe(777);
    expect(d.player).toEqual(player);
    expect(d.economy).toEqual(eco.toJSON());
    for (const k of ['tileType', 'tileHP', 'oreType', 'flags', 'band']) expect(Array.from(d.world[k])).toEqual(Array.from(w[k]));
  });

  it('strips transient radar flags', () => {
    const w = new World(generateWorld(5));
    w.flags[500] |= FLAG.RADAR_LIT;
    const d = deserialize(serialize({ seed: 5, player: {}, economy: createEconomyState(), world: w }));
    expect(d.world.flags[500] & FLAG.RADAR_LIT).toBe(0);
  });

  it('detects corrupted saves gracefully', () => {
    const storage = memStorage();
    storage.setItem(SAVE.KEY, '{not json');
    const bad = new SaveSystem(storage).load();
    expect(bad.ok).toBe(false);
    expect(typeof bad.error).toBe('string');
    const w = new World(generateWorld(9));
    const s = JSON.parse(serialize({ seed: 9, player: {}, economy: createEconomyState(), world: w }));
    s.world.sum = (s.world.sum + 1) >>> 0;
    storage.setItem(SAVE.KEY, JSON.stringify(s));
    const r = new SaveSystem(storage).load();
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/checksum/);
  });

  it('reports no save as a non-error', () => {
    expect(new SaveSystem(memStorage()).load()).toEqual({ ok: false, error: null });
  });

  it('rejects pre-v3 saves (ore ids were remapped)', () => {
    expect(() => migrate({ version: 1, seed: 1, settings: { x: 1 }, economy: { levels: { pickaxe: 1 } } })).toThrow(/not compatible/);
  });
});

describe('Save outfit', () => {
  it('round-trips player.outfit and tolerates its absence', () => {
    const w = new World(generateWorld(9));
    const sys = new SaveSystem(memStorage());
    const outfit = { hat: null, colors: { hat: '#112233' } };
    sys.save({ seed: 9, player: { x: 1, y: 2, outfit }, economy: createEconomyState(), world: w });
    expect(sys.load().data.player.outfit).toEqual(outfit);
    sys.save({ seed: 9, player: { x: 1, y: 2 }, economy: createEconomyState(), world: w });
    expect(sys.load().data.player.outfit).toBeUndefined();
  });
});

describe('Save migration v4 -> v5', () => {
  it('v4 save migrates to the new economy', () => {
    const w = new World(generateWorld(5));
    const s = JSON.parse(serialize({ seed: 5, player: {}, economy: {}, world: w }));
    s.version = 4;
    s.economy = {
      credits: 0, cargo: new Array(22).fill(0), stash: new Array(22).fill(0),
      tech: ['ladder_kit', 'heat_suit'], buildings: { workshop: 2 },
      levels: { pickaxe: 2, rig: 1, jetpack: 3, radar: 1 }, consumables: { dynamite: 2, teleporter: 5 },
    };
    const d = deserialize(JSON.stringify(s));
    expect(d.version).toBe(SAVE.VERSION);
    const e = new Economy(new EventBus(), d.economy);
    expect(e.levels.jetpack).toBe(4);
    expect(e.levels.pickaxe).toBe(2);
    expect(e.tech).not.toContain('ladder_kit');
    expect(e.tech).toContain('heat_suit');
    for (const r of TECH.find((t) => t.id === 'heat_suit').requires) expect(e.tech).toContain(r);
    expect(e.tech).toContain('bloomery'); // ancestors all the way up
    expect(e.credits).toBe(1200 + 3000 + 25000);
    expect(e.buildings).toMatchObject({ workshop: 1, generator: 1, furnace: 1 });
    expect(e.stash[ITEM.WARP_CHARGE]).toBe(5);
    expect(e.consumables.teleporter).toBeUndefined();
    expect(e.power).toBe(100);
  });
});

describe('New map carry-over', () => {
  it('newMapState keeps progress and clears the map-bound parts', () => {
    const e = new Economy(new EventBus(), createEconomyState());
    e.credits = 500; e.stash[ITEM.STEEL] = 7; e.tech.push('bloomery'); e.buildings.furnace = 2; e.levels.pickaxe = 1; e.power = 42;
    e.cargo[2] = 3; e.stations.push({ x: 1, y: 2 }); e.fieldCamps.push({ x: 3, y: 4 });
    e.contracts.active.push({ id: 'a', ore: 1, qty: 1, rewardCash: 1 }); e.contracts.done.push('b'); e.completed = true;
    const n = e.newMapState();
    expect(n.credits).toBe(500); expect(n.stash[ITEM.STEEL]).toBe(7); expect(n.tech).toEqual(['bloomery']);
    expect(n.buildings.furnace).toBe(2); expect(n.levels.pickaxe).toBe(1); expect(n.power).toBe(42);
    expect(n.cargo.every((v) => v === 0)).toBe(true);
    expect(n.stations).toEqual([]); expect(n.fieldCamps).toEqual([]);
    expect(n.contracts.active).toEqual([]); expect(n.contracts.done).toEqual(['b']);
    expect(n.completed).toBe(false);
    expect(e.cargo[2]).toBe(3); // the live economy is untouched
  });
  it('setCarry then takeCarry round-trips once', () => {
    const sys = new SaveSystem(memStorage());
    expect(sys.takeCarry()).toBe(null);
    sys.setCarry({ credits: 9 });
    expect(sys.takeCarry()).toEqual({ credits: 9 });
    expect(sys.takeCarry()).toBe(null);
  });
});

describe('v6 migration', () => {
  it('fresh fields', () => {
    expect(migrateEconomyV6({ tech: ['bloomery'] })).toMatchObject({ relics: [], story: { seen: [], read: ['intro'], flags: ['sold'], mission: 0 } });
  });
  it('a completed save owns every relic and the interface', () => {
    const e = migrateEconomyV6({ completed: true, tech: ['heat_suit'] });
    expect(e.relics).toEqual(RELICS.map((r) => r.id));
    expect(e.tech).toContain('core_interface');
    expect(e.tech).toContain('heat_suit');
  });
  it('owning a relic-gated tech grants that relic', () => {
    expect(migrateEconomyV6({ tech: ['exotic_materials', 'warp_drive'] }).relics.sort()).toEqual(['matter_loom', 'seed_core']);
  });
  it('migrate() steps v5 to current', () => {
    expect(migrate({ version: 5, economy: { tech: [] } }).economy.story.mission).toBe(0);
  });
  it('migrated completed v5 save: no modal flood, missions advance', async () => {
    const { Story } = await import('../src/systems/Story.js');
    const bus = new EventBus();
    const ec = new Economy(bus, { ...createEconomyState(), ...migrateEconomyV6({ completed: true, tech: ['bloomery'], collect: { ore: {}, maxDepth: 900 } }) });
    const st = new Story(bus, ec); st.sync(true);
    expect(st.pendingModals()).toEqual([]);
    expect(ec.story.mission).toBeGreaterThan(2);
    expect(ec.story.flags).toEqual(expect.arrayContaining(['sold', 'pulse', 'exotic']));
  });
  it('collect.pulses round-trips', () => {
    const ec = new Economy(new EventBus(), createEconomyState()); ec.collect.pulses = 7;
    expect(new Economy(new EventBus(), ec.toJSON()).collect.pulses).toBe(7);
  });
});
