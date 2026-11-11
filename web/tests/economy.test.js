import { describe, it, expect } from 'vitest';
import { ORES, PICKAXES, BALANCE, ECONOMY } from '../src/config.js';
import {
  expectedTripIncome, tripsToAffordNext, slotsUsed, canAddOre, rescueLoss, cargoValue, Economy, createEconomyState,
} from '../src/systems/Economy.js';
import { EventBus } from '../src/core/EventBus.js';

describe('Economy balance', () => {
  it('ore prices strictly increase: Coal < Iron < Copper < Silver < Platinum < Gold < Diamond', () => {
    const order = ['COAL', 'IRON', 'COPPER', 'SILVER', 'PLATINUM', 'GOLD', 'DIAMOND'];
    const prices = order.map((k) => ORES.find((o) => o && o.key === k).price);
    for (let i = 1; i < prices.length; i++) expect(prices[i]).toBeGreaterThan(prices[i - 1]);
  });

  it('pickaxe costs increase per tier', () => {
    for (let i = 1; i < PICKAXES.length; i++) expect(PICKAXES[i].cost).toBeGreaterThan(PICKAXES[i - 1].cost);
  });

  it('3 to 5 full trips at tier N afford the tier N+1 pickaxe', () => {
    for (let tier = 1; tier < PICKAXES.length; tier++) {
      const trips = tripsToAffordNext(tier);
      const msg = 'tier ' + tier + ' needs ' + trips.toFixed(2) + ' trips';
      expect(trips, msg).toBeGreaterThanOrEqual(BALANCE.TRIPS_MIN);
      expect(trips, msg).toBeLessThanOrEqual(BALANCE.TRIPS_MAX);
    }
  });

  it('expected value per trip rises with each tier', () => {
    for (let tier = 2; tier <= PICKAXES.length; tier++) {
      expect(expectedTripIncome(tier)).toBeGreaterThan(expectedTripIncome(tier - 1));
    }
  });
});

describe('Cargo rules', () => {
  it('units of one ore share stacked slots', () => {
    const c = new Array(ORES.length).fill(0);
    c[1] = ECONOMY.STACK_SIZE + 1;
    c[2] = 1;
    expect(slotsUsed(c)).toBe(3);
    expect(canAddOre(c, 1, 3)).toBe(true);
    expect(canAddOre(c, 3, 3)).toBe(false);
  });

  it('rescue loses 50% of each stack, rounded per stack', () => {
    expect(rescueLoss([0, 4, 3, 1, 0, 0, 0, 0])).toEqual([0, 2, 2, 1, 0, 0, 0, 0]);
  });

  it('sells, buys and refuses unaffordable upgrades', () => {
    const e = new Economy(new EventBus(), createEconomyState());
    for (let k = 0; k < 10; k++) e.addOre(1);
    expect(cargoValue(e.cargo)).toBe(50);
    expect(e.sellAll().total).toBe(50);
    expect(e.credits).toBe(50);
    expect(e.buyUpgrade('pickaxe').ok).toBe(false);
    e.credits = 300;
    expect(e.buyUpgrade('pickaxe').ok).toBe(true);
    expect(e.pickTier).toBe(2);
    expect(e.credits).toBe(0);
  });
});
