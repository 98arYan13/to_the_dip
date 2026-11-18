import { describe, it, expect } from 'vitest';
import { PLANETS, PHYSICS, planetGravity, lifeSupportMul, TILE } from '../src/config.js';
import { hardLandingDamage, jumpVelocity } from '../src/entities/Player.js';
import { idleDrain } from '../src/systems/Energy.js';
import { maxHPFor, hpMulAt } from '../src/world/WorldGen.js';

describe('planet physics', () => {
  it('fall damage scales with gravity; jump height does not', () => {
    const e = hardLandingDamage(20, 4, 1, planetGravity('earth'));
    expect(hardLandingDamage(20, 4, 1, planetGravity('moon'))).toBeCloseTo(0.4 * e, 0);
    expect(hardLandingDamage(20, 4, 1, planetGravity('tessera'))).toBeGreaterThan(e);
    for (const id of ['earth', 'moon', 'tessera']) {
      const g = PHYSICS.GRAVITY * planetGravity(id), v = jumpVelocity(PHYSICS.JUMP_H, g);
      expect(Math.abs(v * v / (2 * g) - PHYSICS.JUMP_H)).toBeLessThan(1);
    }
  });
  it('life support drain', () => {
    expect(lifeSupportMul('earth', [])).toBe(1); expect(lifeSupportMul('mars', [])).toBe(1.5);
    expect(lifeSupportMul('moon', [])).toBe(2); expect(lifeSupportMul('moon', ['fusion_power'])).toBe(1.5);
    expect(lifeSupportMul('mars', ['fusion_power'])).toBe(1.25);
    expect(idleDrain(0, 0, 2)).toBeCloseTo(0.4);
  });
  it('rock HP scales with hpMul (planet x stratum)', () => {
    expect(maxHPFor(TILE.GRANITE, 0, 2)).toBe(2 * maxHPFor(TILE.GRANITE, 0));
    expect(maxHPFor(TILE.BEDROCK, 0, 3)).toBe(65535);
    const p = { hpMul: 3, strata: [{ tile: TILE.GRANITE }, { tile: TILE.BASALT, hpMul: 2 }] };
    expect(hpMulAt(p, TILE.GRANITE)).toBe(3); expect(hpMulAt(p, TILE.BASALT)).toBe(6); expect(hpMulAt(p, 0)).toBe(3);
  });
});
