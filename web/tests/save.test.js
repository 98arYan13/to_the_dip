import { describe, it, expect } from 'vitest';
import { rleEncode, rleDecode, serialize, deserialize, SaveSystem, migrate } from '../src/save/SaveSystem.js';
import { generateWorld } from '../src/world/WorldGen.js';
import { World } from '../src/world/World.js';
import { Economy, createEconomyState } from '../src/systems/Economy.js';
import { EventBus } from '../src/core/EventBus.js';
import { FLAG, SAVE } from '../src/config.js';

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
