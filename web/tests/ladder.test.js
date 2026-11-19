import { describe, it, expect } from 'vitest';
import { World } from '../src/world/World.js';
import { generateWorld } from '../src/world/WorldGen.js';
import { Physics } from '../src/systems/Physics.js';
import { Player } from '../src/entities/Player.js';
import { TILE, FLAG, WORLD } from '../src/config.js';
import { Economy, createEconomyState } from '../src/systems/Economy.js';
import { EventBus } from '../src/core/EventBus.js';

const T = WORLD.TILE_PX;

/** A 1-wide shaft full of ladders whose top cell is level with the ledge on both sides. */
function shaft() {
  const w = new World(generateWorld(1)); const bus = new EventBus();
  const tx = 20; const top = WORLD.SURFACE_ROWS + 3; const bottom = top + 12;
  for (let y = top - 4; y <= bottom; y++) for (let x = tx - 3; x <= tx + 3; x++) {
    const i = y * w.W + x;
    const solid = y >= top && Math.abs(x - tx) >= 1;
    w.tileType[i] = x === tx && y >= top ? TILE.LADDER : solid ? TILE.SOIL : TILE.AIR;
    w.flags[i] = solid ? w.flags[i] | FLAG.SOLID : w.flags[i] & ~FLAG.SOLID;
  }
  const e = new Economy(bus, createEconomyState());
  const p = new Player({ economy: e, energy: { value: 50, drain() {} }, bus, physics: new Physics(w), mining: { findTarget: () => -1 } });
  p.x = tx * T + 7; p.y = (bottom + 1) * T - p.h;
  return { p, tx, top };
}
const keys = (...k) => ({ isDown: (a) => k.includes(a), wasPressed: () => false, padMoveX: 0 });

describe('ladder', () => {
  it('climbs a shaft and steps out onto the ledge at the top', () => {
    const { p, tx, top } = shaft();
    for (let i = 0; i < 600; i++) p.update(1 / 60, keys('jet'), p.cx, p.cy - 50);
    expect(p.feetY).toBeLessThanOrEqual(top * T + 1); // feet at or above the ledge surface
    for (let i = 0; i < 120; i++) p.update(1 / 60, keys('right'), p.cx + 50, p.cy);
    expect(p.cx).toBeGreaterThan((tx + 1) * T);
    expect(p.onGround).toBe(true);
  });
});

describe('ladder pass-through and falling', () => {
  it('walking past a ladder does not grab it; holding up does, and sideways steps off in open air', () => {
    const w = new World(generateWorld(1)); const bus = new EventBus();
    const y = WORLD.SURFACE_ROWS + 6;
    for (let yy = y - 4; yy <= y + 1; yy++) for (let x = 15; x <= 25; x++) {
      const i = yy * w.W + x; const solid = yy > y;
      w.tileType[i] = solid ? TILE.SOIL : TILE.AIR; w.flags[i] = solid ? w.flags[i] | FLAG.SOLID : w.flags[i] & ~FLAG.SOLID;
    }
    w.tileType[y * w.W + 20] = TILE.LADDER; // ladder standing on the floor
    const e = new Economy(bus, createEconomyState());
    const p = new Player({ economy: e, energy: { value: 50, drain() {} }, bus, physics: new Physics(w), mining: { findTarget: () => -1 } });
    p.x = 17 * T; p.y = (y + 1) * T - p.h;
    for (let i = 0; i < 120; i++) p.update(1 / 60, keys('right'), p.cx + 50, p.cy);
    expect(p.cx).toBeGreaterThan(21 * T); // walked straight through
    expect(p.onLadder).toBe(false);
    p.x = 20 * T - 1; p.y = (y + 1) * T - p.h; p.vx = 0; p.vy = 0;
    for (let i = 0; i < 10; i++) p.update(1 / 60, keys('down'), p.cx, p.cy);
    expect(p.onLadder).toBe(true);
    for (let i = 0; i < 60; i++) p.update(1 / 60, keys('left'), p.cx - 50, p.cy);
    expect(p.onLadder).toBe(false);
  });

  it('a ladder column drops when the tile under it is dug out', async () => {
    const { FallingLadders } = await import('../src/systems/Items.js');
    const w = new World(generateWorld(1)); const bus = new EventBus();
    const x = 20; const top = WORLD.SURFACE_ROWS + 4;
    for (let y = top - 2; y <= top + 8; y++) { const i = y * w.W + x; w.tileType[i] = y > top + 1 ? TILE.SOIL : y >= top ? TILE.LADDER : TILE.AIR; w.flags[i] = y > top + 1 ? w.flags[i] | FLAG.SOLID : w.flags[i] & ~FLAG.SOLID; }
    const fl = new FallingLadders(w, bus);
    const dug = (top + 2) * w.W + x; w.tileType[dug] = TILE.AIR; w.flags[dug] &= ~FLAG.SOLID; // two ladders hang above the hole
    fl.release(x, top + 2);
    expect(fl.active.length).toBe(2);
    for (let i = 0; i < 120; i++) fl.update(1 / 60, 650, 400);
    expect(fl.active.length).toBe(0);
    expect(w.tileType[(top + 2) * w.W + x]).toBe(TILE.LADDER); // fell into the hole onto the soil below
    expect(w.tileType[(top + 1) * w.W + x]).toBe(TILE.LADDER);
  });
});

describe('ladder stacking and top rung', () => {
  it('no ladder is ever lost when many land in one column', async () => {
    const { FallingLadders } = await import('../src/systems/Items.js');
    const w = new World(generateWorld(1)); const bus = new EventBus();
    const x = 20; const top = WORLD.SURFACE_ROWS + 2; const N = 100;
    for (let y = top; y <= top + N + 4; y++) { const i = y * w.W + x; const solid = y > top + N + 3; w.tileType[i] = solid ? TILE.SOIL : TILE.AIR; w.flags[i] = solid ? w.flags[i] | FLAG.SOLID : w.flags[i] & ~FLAG.SOLID; }
    const fl = new FallingLadders(w, bus); let lost = 0; fl.onLost = () => lost++;
    for (let k = 0; k < N; k++) fl.drop(x, top);
    for (let i = 0; i < 2000 && fl.active.length; i++) fl.update(1 / 60, 650, 400);
    let n = 0; for (let y = top; y <= top + N + 4; y++) if (w.tileType[y * w.W + x] === TILE.LADDER) n++;
    expect(n + lost).toBe(N);
  });

  it('the top rung is a floor; down walks onto the ladder', () => {
    const { p, tx, top } = shaft();
    for (let i = 0; i < 600; i++) p.update(1 / 60, keys('jet'), p.cx, p.cy - 50);
    for (let i = 0; i < 60; i++) p.update(1 / 60, keys(), p.cx, p.cy);
    expect(p.onGround).toBe(true);
    expect(p.feetY).toBeCloseTo(top * T, 0);
    const y0 = p.y;
    for (let i = 0; i < 60; i++) p.update(1 / 60, keys('down'), p.cx, p.cy + 50);
    expect(p.y).toBeGreaterThan(y0 + 10);
  });
});
