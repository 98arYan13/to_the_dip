import { describe, it, expect } from 'vitest';
import { Economy } from '../src/systems/Economy.js';
import { EventBus } from '../src/core/EventBus.js';

describe('hand tools (Q)', () => {
  it('cycles only through owned tools and exposes their modifiers', () => {
    const ec = new Economy(new EventBus());
    expect(ec.cycleTool()).toBe('pick'); // nothing else owned
    expect(ec.toolDef).toBe(null);
    ec.levels.cone_drill = 1;
    expect(ec.cycleTool()).toBe('cone_drill');
    expect(ec.toolDef.bore).toBe(3);
    ec.levels.jackhammer = 1;
    expect(ec.cycleTool()).toBe('pick');
    expect(ec.cycleTool()).toBe('jackhammer');
    expect(ec.toolDef.swingMul).toBeLessThan(1);
  });
});

import { canAddOre, usedSlots } from '../src/systems/Economy.js';
import { ORES } from '../src/config.js';

describe('backpack slots', () => {
  it('a new ore type needs a free slot; stacking an owned type does not', () => {
    const c = new Array(ORES.length).fill(0);
    c[1] = 1; c[2] = 1;
    expect(usedSlots(c)).toBe(2);
    expect(canAddOre(c, 3, 1000, 2)).toBe(false); // both slots taken
    expect(canAddOre(c, 1, 1000, 2)).toBe(true); // same type stacks
    expect(canAddOre(c, 3, 1000)).toBe(true); // no slot limit given
  });
  it('the starting rig has 6 slots', () => {
    const ec = new Economy(new EventBus());
    expect(ec.slots).toBe(6);
  });
});

import { Player } from '../src/entities/Player.js';

describe('power tool on an empty battery', () => {
  it('sets player.flat while mining with no energy, and never strikes', () => {
    const ec = new Economy(new EventBus());
    ec.levels.cone_drill = 1; ec.cycleTool();
    const energy = { value: 0, drainBlock() {} };
    const world = { T: 32, W: 8, H: 8, inBounds: () => false, tileType: new Uint8Array(64) };
    let strikes = 0;
    const p = new Player({ economy: ec, energy, bus: { emit() {} }, physics: { world, move() {} }, mining: { findTarget: () => 9, strike: () => { strikes++; return 'hit'; }, hit: {} } });
    const input = { isDown: (k) => k === 'mine', wasPressed: () => false, padMoveX: 0 };
    for (let i = 0; i < 120; i++) p.update(1 / 60, input, 100, 0);
    expect(p.flat).toBe(true);
    expect(strikes).toBe(0);
    energy.value = 50;
    p.update(1 / 60, input, 100, 0);
    expect(p.flat).toBe(false);
  });
});
