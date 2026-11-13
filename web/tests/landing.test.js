import { describe, it, expect } from 'vitest';
import { hardLandingDamage, jumpVelocity, Player } from '../src/entities/Player.js';
import { PHYSICS } from '../src/config.js';

describe('Hard landing', () => {
  it('is harmless up to the threshold', () => {
    expect(hardLandingDamage(3, 3, 1)).toBe(0);
  });
  it('deals at least 5 just past the threshold', () => {
    expect(hardLandingDamage(3.1, 3, 1)).toBe(5);
  });
  it('scales 18 per tile with sqrt(fall speed)', () => {
    expect(hardLandingDamage(5, 3, 1)).toBe(36);
    expect(hardLandingDamage(5, 3, 2)).toBe(Math.round(36 * Math.SQRT2));
  });
});

import { isCampGround } from '../src/systems/Mining.js';
import { WORLD } from '../src/config.js';

describe('Camp foundation', () => {
  it('protects ground under the camp only', () => {
    const b = WORLD.BASE_CAMP; const SR = WORLD.SURFACE_ROWS;
    expect(isCampGround(b.SPAWN_X, SR)).toBe(true);
    expect(isCampGround(b.SPAWN_X, SR + b.PAD_DEPTH)).toBe(false);
    expect(isCampGround(b.PAD_X1 + 1, SR)).toBe(false);
  });
});

describe('Jump', () => {
  it('launch speed reaches the apex height', () => {
    expect(jumpVelocity(34, 650)).toBeCloseTo(210.2, 0);
    const v = jumpVelocity(PHYSICS.JUMP_H, PHYSICS.GRAVITY);
    expect(v * v / (2 * PHYSICS.GRAVITY)).toBeCloseTo(PHYSICS.JUMP_H, 5);
  });
  const mkPlayer = (tile) => {
    const world = { T: 16, W: 8, H: 8, inBounds: () => true, tileType: new Uint8Array(64).fill(tile) };
    const e = { pickaxe: { swing: 0.4 }, jetpack: { thrust: 0, maxUp: 0 }, hasJetpack: false, speedMult: 1, stat: (_, b) => b };
    const p = new Player({ economy: e, energy: { value: 50 }, bus: { emit() {} }, physics: { world, move() {} }, mining: { findTarget: () => -1 } });
    p.x = 0; p.y = 0; // spawn() puts it at base camp, outside this tiny world
    return p;
  };
  const press = { isDown: () => false, wasPressed: (a) => a === 'jet', padMoveX: 0 };
  it('jumps only from the ground, not in the air or on a ladder', () => {
    const g = mkPlayer(0); g.onGround = true; g.update(1 / 60, press, 0, 0);
    expect(g.vy).toBeLessThan(-190);
    const a = mkPlayer(0); a.onGround = false; a.update(1 / 60, press, 0, 0);
    expect(a.vy).toBeGreaterThan(0);
    const l = mkPlayer(11); l.onGround = true; l.update(1 / 60, press, 0, 0);
    expect(Math.abs(l.vy)).toBe(0);
  });
});

describe('Ladder climb tick', () => {
  it('emits LADDER_STEP every LADDER_STEP_DIST px climbed', () => {
    let n = 0;
    const world = { T: 16, W: 8, H: 8, inBounds: () => true, tileType: new Uint8Array(64).fill(11) };
    const e = { pickaxe: { swing: 0.4 }, jetpack: { thrust: 0, maxUp: 0 }, hasJetpack: false, speedMult: 1, stat: (_, b) => b };
    const p = new Player({ economy: e, energy: { value: 50 }, bus: { emit: (ev) => { if (ev === 'player:ladderStep') n++; } }, physics: { world, move() {} }, mining: { findTarget: () => -1 } });
    p.x = 0; p.y = 0;
    const input = { isDown: (k) => k === 'down', wasPressed: () => false, padMoveX: 0 };
    for (let i = 0; i < 60; i++) p.update(1 / 60, input, 0, 0); // 90 px climbed
    expect(n).toBe(Math.floor(90 / PHYSICS.LADDER_STEP_DIST));
  });
});
