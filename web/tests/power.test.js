import { describe, it, expect } from 'vitest';
import { Economy, createEconomyState } from '../src/systems/Economy.js';
import { Energy } from '../src/systems/Energy.js';
import { EventBus } from '../src/core/EventBus.js';
import { ORE, ITEM, POWER } from '../src/config.js';
import { powerCap, refuel, drawPower } from '../src/systems/Power.js';
import { unlockTech } from '../src/systems/Tech.js';
import { upgradeBuilding, craft } from '../src/systems/Crafting.js';

const mk = () => new Economy(new EventBus(), createEconomyState());
const empty = (e) => { e.stash.fill(0); e.power = 0; return e; };

describe('power', () => {
  it('fresh economy has 100 power and 20 coal in the stash', () => {
    const e = mk();
    expect(e.power).toBe(POWER.START);
    expect(e.power).toBe(100);
    expect(e.stash[ORE.COAL]).toBe(20);
  });

  it('draw auto-burns the cheapest allowed fuel', () => {
    const e = empty(mk()); e.buildings.generator = 2; e.stash[ORE.COAL] = 5; e.stash[ITEM.FUEL] = 5;
    expect(drawPower(e, 30)).toBe(30);
    expect(e.stash[ORE.COAL]).toBe(2);
    expect(e.stash[ITEM.FUEL]).toBe(5);
    const g = empty(mk()); g.stash[ITEM.FUEL] = 5;
    expect(drawPower(g, 30)).toBe(0);
    expect(g.stash[ITEM.FUEL]).toBe(5);
  });

  it('never exceeds the cap', () => {
    const e = empty(mk()); e.power = 195; e.stash[ORE.COAL] = 10;
    expect(powerCap(e)).toBe(200);
    expect(refuel(e)).toBe(0);
    expect(e.power).toBe(195);
  });

  it('a draw larger than the cap is served in chunks', () => {
    const e = empty(mk()); e.stash[ORE.COAL] = 40;
    expect(drawPower(e, 350)).toBe(350);
    expect(e.stash[ORE.COAL]).toBe(5);
  });

  it('empty pool with no fuel grants 0 and station charging stops', () => {
    const e = empty(mk());
    const en = new Energy(new EventBus(), e); en.value = 10;
    en.update(1, { jetting: false, atStation: true });
    expect(en.value).toBe(10);
  });

  it('charging costs 1 power per 10 energy', () => {
    const e = mk(); e.power = 100;
    const en = new Energy(new EventBus(), e); en.value = 0;
    for (let i = 0; i < 20; i++) en.update(0.5, { jetting: false, atStation: true });
    expect(en.value).toBe(100);
    expect(e.power).toBeCloseTo(90, 6);
  });

  it('fresh economy can reach bloomery', () => {
    const e = mk(); e.stash[ORE.IRON] = 15; e.credits = 300;
    expect(unlockTech(e, 'bloomery').ok).toBe(true);
    expect(upgradeBuilding(e, 'furnace').ok).toBe(false); // spent the iron on the tech; mine 15 more
    e.stash[ORE.IRON] = 15;
    expect(upgradeBuilding(e, 'furnace').ok).toBe(true);
    e.power = 0; e.stash[ORE.IRON] = 2; e.stash[ORE.COAL] = 2; // power gone: freshly mined coal is both input and fuel
    expect(craft(e, 'wrought_iron').ok).toBe(true);
  });
});
