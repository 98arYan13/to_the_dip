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
