import { describe, it, expect } from 'vitest';
import { ORES, PICKAXES, BALANCE, ORE } from '../src/config.js';
import {
  expectedTripIncome, cargoWeight, canAddOre, loadSpeedMult, rescueLoss, cargoValue, Economy, createEconomyState,
} from '../src/systems/Economy.js';
import { EventBus } from '../src/core/EventBus.js';

describe('Economy balance', () => {
  it('energy formulas match the design', async () => {
    const { blockEnergy, idleDrain } = await import('../src/systems/Energy.js');
    expect(blockEnergy(10, 0, 1)).toBe(20); // diamond at surface, tier-1 rig
    expect(blockEnergy(1, 500, 2)).toBe(2); // coal at 500 m, eta 2
    expect(idleDrain(0, 0)).toBeCloseTo(0.2);
    expect(idleDrain(300, 1)).toBeCloseTo(0.6);
  });

  it('ore prices strictly increase: Coal < Iron < Copper < Silver < Gold < Platinum < Diamond', () => {
    const order = ['COAL', 'IRON', 'COPPER', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'];
    const prices = order.map((k) => ORES.find((o) => o && o.key === k).price);
    for (let i = 1; i < prices.length; i++) expect(prices[i]).toBeGreaterThan(prices[i - 1]);
  });


  it('expected value per trip rises with each tier', () => {
    for (let tier = 2; tier <= PICKAXES.length; tier++) {
      expect(expectedTripIncome(tier)).toBeGreaterThan(expectedTripIncome(tier - 1));
    }
  });
});

describe('Cargo rules', () => {
  it('cargo is limited by weight, not block count', () => {
    const c = new Array(ORES.length).fill(0);
    c[ORE.COAL] = 6; // 30 kg
    expect(cargoWeight(c)).toBe(30);
    expect(canAddOre(c, ORE.COAL, 35)).toBe(true); // exactly 35
    expect(canAddOre(c, ORE.IRON, 35)).toBe(false); // 36 kg
    expect(canAddOre(c, ORE.DIAMOND, 35)).toBe(true);
  });

  it('a full pack slows the player by 40%', () => {
    expect(loadSpeedMult(0, 35)).toBe(1);
    expect(loadSpeedMult(35, 35)).toBeCloseTo(0.6);
    expect(loadSpeedMult(17.5, 35)).toBeCloseTo(0.9);
  });

  it('rescue loses 50% of each stack, rounded per stack', () => {
    expect(rescueLoss([0, 4, 3, 1, 0, 0, 0, 0])).toEqual([0, 2, 2, 1, 0, 0, 0, 0]);
  });

  it('sells cargo for cash', () => {
    const e = new Economy(new EventBus(), createEconomyState());
    for (let k = 0; k < 10; k++) e.addOre(ORE.COAL); // only 7 × 5 kg fit in 35 kg
    expect(e.cargo[ORE.COAL]).toBe(7);
    expect(cargoValue(e.cargo)).toBe(4.9);
    expect(e.sellAll().total).toBe(4.9);
    expect(e.credits).toBe(4.9);
  });
});

describe('relics and story state', () => {
  it('round-trip and survive New Map', () => {
    const e = new Economy(new EventBus()); e.relics.push('hull_shard'); e.story.flags.push('sold'); e.story.mission = 3;
    const n = new Economy(new EventBus(), e.newMapState());
    expect(n.relics).toEqual(['hull_shard']); expect(n.story).toEqual({ seen: [], read: [], flags: ['sold'], mission: 3 });
  });
});
