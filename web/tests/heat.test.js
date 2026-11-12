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
  it('ambient rises with depth and stays below the damage threshold', () => {
    expect(ambientTemp(1)).toBeGreaterThan(ambientTemp(0.5));
    expect(ambientTemp(0.5)).toBeGreaterThan(ambientTemp(0));
    expect(ambientTemp(1)).toBeLessThan(PHYSICS.HEAT_SAFE_T);
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
