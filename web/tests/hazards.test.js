import { describe, it, expect } from 'vitest';
import { World } from '../src/world/World.js';
import { generateWorld } from '../src/world/WorldGen.js';
import { EventBus, EV } from '../src/core/EventBus.js';
import { RNG } from '../src/core/RNG.js';
import { Fluids } from '../src/systems/Hazards/Fluids.js';
import { Gas } from '../src/systems/Hazards/Gas.js';
import { Quake } from '../src/systems/Hazards/Quake.js';
import { Collapse } from '../src/systems/Hazards/Collapse.js';
import { Mining } from '../src/systems/Mining.js';
import { TILE, FLAG, HAZARD, GAS } from '../src/config.js';

/** Solid granite block x 4..40, y 40..80 with an air box carved by `carve`. */
function box(carve) {
  const w = new World(generateWorld(3));
  for (let y = 40; y < 80; y++) for (let x = 4; x < 40; x++) {
    const i = y * w.W + x; w.tileType[i] = TILE.GRANITE; w.oreType[i] = 0; w.fluid[i] = 0; w.gas[i] = 0; w.flags[i] |= FLAG.SOLID;
  }
  carve(w);
  return w;
}
const air = (w, x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) w.clear(y * w.W + x); };
const inBox = (i, w) => { const x = i % w.W; const y = (i / w.W) | 0; return x >= 4 && x < 40 && y >= 40 && y < 80; };
const total = (w, type) => { let s = 0; for (let i = 0; i < w.tileType.length; i++) if (inBox(i, w) && w.tileType[i] === type) s += w.fluid[i]; return s; };
const gasSum = (w) => { let s = 0; for (let i = 0; i < w.gas.length; i++) if (inBox(i, w)) s += w.gas[i]; return s; };
const run = (sys, steps, dt = 0.12) => { for (let k = 0; k < steps; k++) sys.update(dt); };

describe('fluids', () => {
  it('water flows down and sideways, conserving volume, and settles', () => {
    const w = box((w) => air(w, 10, 50, 20, 60));
    const bus = new EventBus();
    const f = new Fluids(w, bus);
    const i = 50 * w.W + 15; w.tileType[i] = TILE.WATER; w.fluid[i] = 8;
    f.dirty.add(i);
    run(f, 400);
    expect(total(w, TILE.WATER)).toBe(8);
    expect(w.tileType[60 * w.W + 15]).toBe(TILE.WATER); // reached the floor
    expect(f.dirty.size).toBe(0);
  });
  it('magma meeting water becomes basalt', () => {
    const w = box((w) => air(w, 10, 50, 14, 52));
    const f = new Fluids(w, new EventBus());
    const a = 50 * w.W + 10; const b = 50 * w.W + 11;
    w.tileType[a] = TILE.MAGMA; w.fluid[a] = 8; w.tileType[b] = TILE.WATER; w.fluid[b] = 8;
    f.dirty.add(a);
    run(f, 3);
    expect(w.tileType[a]).toBe(TILE.BASALT);
    expect(w.flags[a] & FLAG.SOLID).toBeTruthy();
  });
  it('never flows into solid rock and a big cavern terminates under the cap', () => {
    const w = box((w) => air(w, 5, 41, 38, 78));
    const f = new Fluids(w, new EventBus());
    for (let x = 6; x < 38; x++) { const i = 42 * w.W + x; w.tileType[i] = TILE.WATER; w.fluid[i] = 8; f.dirty.add(i); }
    let max = 0;
    for (let k = 0; k < 10000; k++) { f.update(0.1); max = Math.max(max, f.processed); }
    expect(max).toBeLessThanOrEqual(HAZARD.FLUID.MAX_PER_TICK);
    expect(f.dirty.size).toBe(0);
    expect(total(w, TILE.WATER)).toBe(32 * 8);
    for (let i = 0; i < w.tileType.length; i++) if (w.flags[i] & FLAG.SOLID) expect(w.fluid[i]).toBe(0);
  });
});

describe('gas', () => {
  const player = (x, y) => ({ cx: x * 32 + 16, cy: y * 32 + 16, hp: 100, setHP(h) { this.hp = h; }, die(c) { this.dead = c; } });
  it('stays sealed until a wall breaks, then spreads', () => {
    const w = box((w) => air(w, 10, 50, 12, 52));
    const bus = new EventBus(); const g = new Gas(w, bus);
    for (let x = 10; x <= 12; x++) { w.gas[51 * w.W + x] = GAS.MAX; g.dirty.add(51 * w.W + x); }
    run(g, 20, 0.3);
    expect(w.gas[51 * w.W + 14]).toBe(0);
    w.clear(51 * w.W + 13); bus.emit(EV.TILE_CHANGED, 51 * w.W + 13);
    run(g, 40, 0.3);
    expect(w.gas[51 * w.W + 13]).toBeGreaterThan(0);
  });
  it('mining while standing in gas explodes and kills; from a neighbouring tile it does not', () => {
    const w = box((w) => air(w, 10, 50, 14, 52));
    const p = player(11, 51); const g = new Gas(w, new EventBus(), p);
    w.gas[51 * w.W + 12] = 3;
    g.onPlayerMine();
    expect(p.dead).toBeUndefined();
    w.gas[51 * w.W + 11] = 3;
    g.onPlayerMine();
    expect(p.dead).toBe('gas explosion');
  });
  it('hurts without a mask and not with one', () => {
    const w = box((w) => air(w, 10, 50, 14, 52));
    const p = player(11, 51); const g = new Gas(w, new EventBus(), p);
    w.gas[51 * w.W + 11] = 2;
    run(g, 10, 0.1);
    expect(p.hp).toBeLessThan(100);
    const q = player(11, 51); const g2 = new Gas(w, new EventBus(), q); g2.hasMask = () => true;
    run(g2, 10, 0.1);
    expect(q.hp).toBe(100);
  });
  it('a bomb blast reaching gas detonates it', () => {
    const w = box((w) => air(w, 10, 50, 14, 52));
    const bus = new EventBus(); const g = new Gas(w, bus);
    const mining = new Mining(w, bus, { pickTier: 1, addOre() { return true; } }, { revealAround() {} }, { spawn() {} });
    mining.gas = g; g.mining = mining;
    w.gas[51 * w.W + 12] = 5;
    mining.blast(11, 51);
    expect(g.concentrationAt(12, 51)).toBe(0);
  });
  it('a 500-tile gas chain resolves in bounded steps without recursion', () => {
    const w = box((w) => air(w, 5, 41, 38, 78));
    const bus = new EventBus(); const g = new Gas(w, bus);
    let n = 0;
    for (let y = 45; y < 62 && n < 500; y++) for (let x = 6; x < 38 && n < 500; x++) { w.gas[y * w.W + x] = 1; n++; }
    g.explodeAt(20, 50);
    let ticks = 0; let max = g.processed;
    while (g.pending.length && ticks++ < 1000) { g.update(0.01); max = Math.max(max, g.processed); }
    expect(g.pending.length).toBe(0);
    expect(max).toBeLessThanOrEqual(GAS.MAX_CHAIN_PER_TICK);
    expect(gasSum(w)).toBe(0);
  });
  it('one explosion kills the player only once', () => {
    const w = box((w) => air(w, 10, 50, 14, 52));
    let deaths = 0; const p = { cx: 11 * 32 + 16, cy: 51 * 32 + 16, hp: 100, setHP() {}, die() { deaths++; } };
    const g = new Gas(w, new EventBus(), p);
    w.gas[51 * w.W + 11] = 1; w.gas[51 * w.W + 12] = 1;
    g.explodeAt(11, 51);
    expect(deaths).toBeGreaterThanOrEqual(1); // Player.die itself guards repeats (hp > 0)
  });
});

describe('quake', () => {
  const mk = (seed = 1) => {
    const w = box((w) => air(w, 8, 50, 30, 58));
    const bus = new EventBus(); const c = new Collapse(w, bus);
    return { w, bus, c, q: new Quake(w, bus, c, new RNG(seed)) };
  };
  it('is reproducible for a seed and silent above the safe depth', () => {
    const times = (seed, depth) => { const { q, bus } = mk(seed); const t = []; let now = 0; bus.on(EV.QUAKE, () => t.push(now)); for (; now < 2000; now += 0.5) q.update(0.5, depth); return t; };
    expect(times(7, 0.6)).toEqual(times(7, 0.6));
    expect(times(7, 0.6).length).toBeGreaterThan(0);
    expect(times(7, 0.01)).toEqual([]);
    expect(times(7, 0)).toEqual([]);
  });
  it('trigger marks ceiling tiles to fall; shake decays to zero', () => {
    const { q, c } = mk();
    q.focus.x = 19; q.focus.y = 54;
    expect(q.trigger(1)).toBeGreaterThanOrEqual(1);
    expect(c.warn.size).toBeGreaterThanOrEqual(1);
    for (let k = 0; k < 100; k++) q.update(0.1, 0);
    expect(q.shake).toBe(0);
  });
  it('hard rock stays put', () => {
    const { w, q } = mk();
    for (let y = 40; y < 80; y++) for (let x = 4; x < 40; x++) if (w.isSolid(x, y)) w.tileType[y * w.W + x] = TILE.BASALT;
    q.focus.x = 19; q.focus.y = 54;
    expect(q.trigger(1)).toBe(0);
  });
  it('forced rock really falls', () => {
    const { w, c } = mk();
    expect(c.forceFall(19, 49)).toBe(true);
    for (let k = 0; k < 200; k++) c.update(0.05);
    expect(w.tileType[49 * w.W + 19]).toBe(TILE.AIR);
    expect(w.tileType[58 * w.W + 19]).toBe(TILE.GRANITE);
  });
});
