import { describe, it, expect } from 'vitest';
import { World } from '../src/world/World.js';
import { generateWorld } from '../src/world/WorldGen.js';
import { Visibility } from '../src/world/Visibility.js';
import { EventBus } from '../src/core/EventBus.js';
import { FLAG, WORLD } from '../src/config.js';
import { techStat } from '../src/systems/Tech.js';

describe('Visibility aura', () => {
  const T = WORLD.TILE_PX; const ty = WORLD.SURFACE_ROWS + 20;
  it('reveals tiles within 2.5 tiles even behind the player, but not 6 tiles away', () => {
    const w = new World(generateWorld(1)); const v = new Visibility(w, new EventBus());
    const tx = 30;
    for (let x = tx - 8; x <= tx + 8; x++) w.flags[ty * w.W + x] &= ~FLAG.DISCOVERED;
    v.update(0.016, tx * T + T / 2, ty * T + T / 2, 100, 0); // aiming right
    expect(w.flags[ty * w.W + tx - 2] & FLAG.DISCOVERED).toBeTruthy();
    expect(w.flags[ty * w.W + tx - 7] & FLAG.DISCOVERED).toBeFalsy();
  });
  it('does not crash at the world corner', () => {
    const w = new World(generateWorld(1)); const v = new Visibility(w, new EventBus());
    expect(() => v.update(0.016, 1, 1, 100, 0)).not.toThrow();
  });
  it('LED lamp tech lengthens the headlamp by 30%', () => {
    expect(techStat(['led_lamp'], 'headlamp', 190)).toBeCloseTo(247);
  });
});
