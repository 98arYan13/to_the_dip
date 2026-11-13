import { describe, it, expect } from 'vitest';
import { Economy, createEconomyState } from '../src/systems/Economy.js';
import { EventBus } from '../src/core/EventBus.js';
import { Player } from '../src/entities/Player.js';
import { ITEM, CONSUMABLES } from '../src/config.js';

const mk = () => new Economy(new EventBus(), createEconomyState());

describe('crafted equipment', () => {
  it('fresh game has no jetpack', () => {
    const e = mk();
    expect(e.levels.jetpack).toBe(0);
    expect(e.hasJetpack).toBe(false);
  });

  it('crafting the iron pickaxe needs ironworking, workshop 1 and 4 wrought iron', () => {
    const e = mk();
    const snap = () => JSON.stringify(e.toJSON());
    let before = snap();
    expect(e.craftUpgrade('pickaxe').reason).toBe('Requires Ironworking');
    expect(snap()).toBe(before);
    e.tech.push('ironworking'); e.buildings.workshop = 0; before = snap();
    expect(e.craftUpgrade('pickaxe').reason).toBe('Needs Workshop level 1');
    expect(snap()).toBe(before);
    e.buildings.workshop = 1; e.stash[ITEM.WROUGHT_IRON] = 3; before = snap();
    expect(e.craftUpgrade('pickaxe').reason).toBe('Not enough materials');
    expect(snap()).toBe(before);
    e.cargo[ITEM.WROUGHT_IRON] = 1;
    expect(e.craftUpgrade('pickaxe').ok).toBe(true);
    expect(e.pickTier).toBe(2);
    expect(e.stash[ITEM.WROUGHT_IRON] + e.cargo[ITEM.WROUGHT_IRON]).toBe(0);
  });

  it('levels craft in order only', () => {
    const e = mk(); e.tech.push('ironworking', 'steelmaking'); e.stash[ITEM.STEEL] = 50;
    expect(e.canCraftUpgrade('pickaxe').ok).toBe(false); // next is Iron (wrought iron), not Steel
    expect(e.pickTier).toBe(1);
  });

  it('no jetpack means no flight and no drain', () => {
    const e = mk();
    const energy = { value: 50 };
    const world = { T: 32, W: 8, H: 8, inBounds: () => false, tileType: new Uint8Array(64) };
    const p = new Player({ economy: e, energy, bus: { emit() {} }, physics: { world, move() {} }, mining: { findTarget: () => -1 } });
    p.vy = 0;
    p.update(1 / 60, { isDown: (k) => k === 'jet', padMoveX: 0 }, 0, 0);
    expect(p.jetting).toBe(false);
    expect(p.vy).toBeGreaterThan(0); // gravity only
    expect(energy.value).toBe(50);
  });
});

describe('shop items', () => {
  it('ladder is buyable on a fresh economy with $6', () => {
    const e = mk(); e.credits = 6;
    expect(e.buyConsumable('ladder').ok).toBe(true);
    expect(e.consumables.ladder).toBe(1);
  });
  it('teleporter is no longer sold', () => { expect(CONSUMABLES.teleporter).toBeUndefined(); });
  it('warp charges count stash + cargo and are used from cargo first', () => {
    const e = mk(); e.stash[ITEM.WARP_CHARGE] = 2; e.cargo[ITEM.WARP_CHARGE] = 1;
    expect(e.warpCharges).toBe(3);
    expect(e.useWarpCharge()).toBe(true);
    expect(e.cargo[ITEM.WARP_CHARGE]).toBe(0); expect(e.stash[ITEM.WARP_CHARGE]).toBe(2);
    expect(e.useWarpCharge()).toBe(true); expect(e.useWarpCharge()).toBe(true);
    expect(e.warpCharges).toBe(0);
    expect(e.useWarpCharge()).toBe(false);
  });
});
