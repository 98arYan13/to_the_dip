import { describe, it, expect } from 'vitest';
import { tileHeat, heatDps } from '../src/entities/Player.js';
import { TILE } from '../src/config.js';

describe('contact heat', () => {
  it('magma gets hotter with depth, core is hottest, rock is safe', () => {
    expect(tileHeat(TILE.MAGMA, 1)).toBeGreaterThan(tileHeat(TILE.MAGMA, 0));
    expect(tileHeat(TILE.CORE, 1)).toBeGreaterThan(tileHeat(TILE.MAGMA, 1));
    expect(tileHeat(TILE.GRANITE, 1)).toBe(0);
  });
  it('damage rises with temperature and is 0 below the safe limit', () => {
    expect(heatDps(0)).toBe(0);
    expect(heatDps(tileHeat(TILE.MAGMA, 1))).toBeGreaterThan(heatDps(tileHeat(TILE.MAGMA, 0)));
  });
});

import { ambientTemp, canStandOn } from '../src/entities/Player.js';
import { PHYSICS } from '../src/config.js';

describe('gear and ambient temperature', () => {
  it('ambient rises with depth: safe up top, slowly burns in the depths', () => {
    expect(ambientTemp(1)).toBeGreaterThan(ambientTemp(0.5));
    expect(ambientTemp(0.5)).toBeGreaterThan(ambientTemp(0));
    expect(heatDps(ambientTemp(0.1))).toBe(0);
    expect(heatDps(ambientTemp(1))).toBeGreaterThan(0);
    expect(heatDps(ambientTemp(1))).toBeLessThan(heatDps(tileHeat(TILE.MAGMA, 1) + ambientTemp(1)) / 3);
  });
  it('heat suit cuts damage by its resist fraction', () => {
    const t = tileHeat(TILE.MAGMA, 1);
    expect(heatDps(t, 0.8)).toBeCloseTo(0.2 * heatDps(t, 0));
  });
  it('magma needs boots', () => {
    expect(canStandOn(TILE.MAGMA, false)).toBe(false);
    expect(canStandOn(TILE.MAGMA, true)).toBe(true);
    expect(canStandOn(TILE.GRANITE, false)).toBe(true);
  });
});

import { Player } from '../src/entities/Player.js';

describe('burning', () => {
  it('heat drains the suit but only flinches about once a second', () => {
    const p = new Player({ economy: { tech: [] }, bus: { emit() {} } });
    const world = { W: 8, H: 8, inBounds: () => true, tileType: new Uint8Array(64).fill(TILE.CORE) };
    p.x = 40; p.y = 40; // inside the core-rock box
    let hurtFrames = 0;
    for (let k = 0; k < 120; k++) { p.burn(1 / 60, world, 1); if (p.hurtTimer > 0) hurtFrames++; p.hurtTimer = Math.max(0, p.hurtTimer - 1 / 60); }
    expect(p.hp).toBeLessThan(PHYSICS.SUIT_HP - 30);
    expect(hurtFrames).toBeLessThan(60); // 2 flinches x 0.3 s, not the whole 2 s
  });
});
