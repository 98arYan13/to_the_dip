import { describe, it, expect } from 'vitest';
import { World } from '../src/world/World.js';
import { generateWorld } from '../src/world/WorldGen.js';
import { Visibility } from '../src/world/Visibility.js';
import { EventBus } from '../src/core/EventBus.js';
import { FLAG, WORLD } from '../src/config.js';
import { techStat } from '../src/systems/Tech.js';

describe('Visibility aura', () => {
  const T = WORLD.TILE_PX; const ty = WORLD.SURFACE_ROWS + 20;
  it('reveals the adjacent tile even behind the player, but not 6 tiles away', () => {
    const w = new World(generateWorld(1)); const v = new Visibility(w, new EventBus());
    const tx = 30;
    for (let x = tx - 8; x <= tx + 8; x++) w.flags[ty * w.W + x] &= ~FLAG.DISCOVERED;
    v.update(0.016, tx * T + T / 2, ty * T + T / 2, 100, 0); // aiming right
    expect(w.flags[ty * w.W + tx - 1] & FLAG.DISCOVERED).toBeTruthy();
    expect(w.flags[ty * w.W + tx - 7] & FLAG.DISCOVERED).toBeFalsy();
  });
  it('lamp reveal fades from full near the player to the edge alpha at max range', () => {
    expect(Visibility.lampAlpha(1, 6)).toBe(1);
    const mid = Visibility.lampAlpha(4.5, 6);
    expect(mid).toBeLessThan(1); expect(mid).toBeGreaterThan(0.25);
    expect(Visibility.lampAlpha(6, 6)).toBeCloseTo(0.25);
  });
  it('a glimpsed tile fades up to its partial alpha and is not discovered', () => {
    const w = new World(generateWorld(1)); const v = new Visibility(w, new EventBus());
    const i = ty * w.W + 30; w.flags[i] &= ~FLAG.DISCOVERED; v.alpha[i] = v.target[i] = 0;
    v.glimpse(i, 0.4);
    for (let k = 0; k < 60; k++) v.update(0.05, -9999, -9999, 0);
    expect(v.alpha[i]).toBeCloseTo(0.4);
    expect(w.flags[i] & FLAG.DISCOVERED).toBeFalsy();
    v.reveal(i);
    for (let k = 0; k < 60; k++) v.update(0.05, -9999, -9999, 0);
    expect(v.alpha[i]).toBe(1);
  });
  it('does not crash at the world corner', () => {
    const w = new World(generateWorld(1)); const v = new Visibility(w, new EventBus());
    expect(() => v.update(0.016, 1, 1, 100, 0)).not.toThrow();
  });
  it('LED lamp tech lengthens the headlamp by 30%', () => {
    expect(techStat(['led_lamp'], 'headlamp', 190)).toBeCloseTo(247);
  });
});
