import { describe, it, expect } from 'vitest';
import { Collapse, isUnstable } from '../src/systems/Hazards/Collapse.js';
import { World } from '../src/world/World.js';
import { generateWorld } from '../src/world/WorldGen.js';
import { EventBus, EV } from '../src/core/EventBus.js';
import { TILE, FLAG, HAZARD, WORLD } from '../src/config.js';

/** Solid granite box with one open air column of height `h` under the sand/soil at (x, y). */
function setup(type, y = 40, x = 10) {
  const w = new World(generateWorld(1));
  for (let yy = 30; yy < 60; yy++) for (let xx = 5; xx < 16; xx++) {
    const i = yy * w.W + xx; w.tileType[i] = TILE.GRANITE; w.oreType[i] = 0; w.flags[i] |= FLAG.SOLID; w.tileHP[i] = 9;
  }
  const i = y * w.W + x; w.tileType[i] = type; w.flags[i] |= FLAG.SOLID;
  const bus = new EventBus();
  return { w, bus, c: new Collapse(w, bus), i, x, y };
}
const run = (c, secs) => { for (let t = 0; t < secs; t += 0.05) c.update(0.05); };

describe('collapse', () => {
  it('sand over air warns first, then falls until it rests on solid', () => {
    const { w, c, i, x, y } = setup(TILE.SAND);
    for (let yy = y + 1; yy < y + 5; yy++) w.clear(yy * w.W + x);
    c.markDirty(x, y + 1);
    c.update(0.05);
    expect(w.tileType[i]).toBe(TILE.SAND); // still there: warning
    expect(w.flags[i] & FLAG.UNSTABLE).toBeTruthy();
    run(c, HAZARD.COLLAPSE.WARN_S + 2);
    expect(w.tileType[i]).toBe(TILE.AIR);
    expect(w.tileType[(y + 4) * w.W + x]).toBe(TILE.SAND);
    expect(w.flags[(y + 4) * w.W + x] & FLAG.UNSTABLE).toBe(0);
  });
  it('a RELIC tile with air below is never marked unstable and never falls', () => {
    const { w, c, i, x, y } = setup(TILE.RELIC);
    for (let yy = y + 1; yy < y + 4; yy++) w.clear(yy * w.W + x);
    expect(isUnstable(w, x, y)).toBe(false);
    c.markDirty(x, y); c.markDirty(x, y + 1);
    run(c, HAZARD.COLLAPSE.WARN_S + 2);
    expect(w.tileType[i]).toBe(TILE.RELIC);
    expect(w.flags[i] & FLAG.UNSTABLE).toBe(0);
  });
  it('soil in a tunnel ceiling (solid on a side) stays up', () => {
    const { w, c, x, y } = setup(TILE.SOIL);
    w.clear((y + 1) * w.W + x);
    expect(isUnstable(w, x, y)).toBe(false);
  });
  it('a landing tile crushes the player', () => {
    const { w, bus, c, x, y } = setup(TILE.SAND);
    for (let yy = y + 1; yy < y + 4; yy++) w.clear(yy * w.W + x);
    let crushed = false;
    bus.on(EV.TILE_CRUSH, () => { crushed = true; });
    c.crush = (cx, cy) => cx === x && cy === y + 3;
    c.markDirty(x, y + 1);
    run(c, HAZARD.COLLAPSE.WARN_S + 2);
    expect(crushed).toBe(true);
  });
  it('a 200-tile unstable column is bounded per tick and terminates', () => {
    const w = new World(generateWorld(2));
    const bus = new EventBus();
    const c = new Collapse(w, bus);
    for (let y = 20; y < 220; y++) { const i = y * w.W + 30; w.tileType[i] = TILE.SAND; w.flags[i] |= FLAG.SOLID; }
    for (let y = 20; y < 220; y++) c.markDirty(30, y);
    let max = 0;
    for (let k = 0; k < 4000; k++) { c.update(0.05); max = Math.max(max, c.processed); }
    expect(max).toBeLessThanOrEqual(HAZARD.COLLAPSE.MAX_PER_TICK);
    expect(c.dirty.size + c.warn.size + c.falling.size).toBe(0);
  });
  it('core rock melts into magma only when the tile under it is emptied', () => {
    const { w, bus, c, i } = setup(TILE.CORE);
    const side = i + 1; w.tileType[side] = TILE.CORE; w.clear(side + w.W); // natural ceiling: left alone
    w.clear(i + w.W); bus.emit(EV.TILE_CHANGED, i + w.W);
    c.update(0.05);
    expect(w.tileType[i]).toBe(TILE.MAGMA);
    expect(w.fluid[i]).toBe(HAZARD.FLUID.MAX);
    expect(w.tileType[side]).toBe(TILE.CORE);
  });
  it('camp pad never becomes unstable', () => {
    const { w, c } = setup(TILE.SAND);
    const x = WORLD.BASE_CAMP.PAD_X0 + 1; const y = WORLD.SURFACE_ROWS;
    const i = y * w.W + x; w.tileType[i] = TILE.SAND; w.clear((y + 1) * w.W + x);
    expect(isUnstable(w, x, y)).toBe(false);
  });
});

describe('loose rock (spec 5.3/5.4)', () => {
  it('regolith falls like sand', () => {
    for (const type of [TILE.REGOLITH, TILE.RUST_REGOLITH]) {
      const { w, c, i, x, y } = setup(type);
      for (let yy = y + 1; yy < y + 5; yy++) w.clear(yy * w.W + x);
      expect(isUnstable(w, x, y)).toBe(true); // even with solid neighbours either side, like sand
      c.markDirty(x, y + 1);
      run(c, HAZARD.COLLAPSE.WARN_S + 2);
      expect(w.tileType[i]).toBe(TILE.AIR);
      expect(w.tileType[(y + 4) * w.W + x]).toBe(type);
    }
  });
});
