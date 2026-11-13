import { describe, it, expect } from 'vitest';
import { Economy, createEconomyState } from '../src/systems/Economy.js';
import { EventBus } from '../src/core/EventBus.js';
import { ORE, ITEM, ECONOMY } from '../src/config.js';
import { canCraft, craft, canUpgradeBuilding, upgradeBuilding } from '../src/systems/Crafting.js';

const mk = () => new Economy(new EventBus(), createEconomyState());
const steelReady = () => {
  const e = mk(); e.buildings.furnace = 3; e.tech.push('blast_furnace');
  e.stash[ORE.IRON] = 4; e.stash[ORE.COAL] = 4; e.power = 100;
  return e;
};
const snap = (e) => JSON.stringify({ ...e.toJSON(), power: e.power });

describe('crafting', () => {
  it('crafting pays inputs and power and puts output in the stash', () => {
    const e = steelReady();
    expect(craft(e, 'steel', 2).ok).toBe(true);
    expect(e.stash[ORE.IRON]).toBe(0); expect(e.stash[ORE.COAL]).toBe(0);
    expect(e.stash[ITEM.STEEL]).toBe(2);
    expect(e.power).toBe(90);
  });

  it('refuses and changes nothing', () => {
    const cases = [
      [(e) => { e.buildings.furnace = 2; }, /Furnace level 3/],
      [(e) => { e.tech = []; }, /Blast Furnace|blast_furnace/],
      [(e) => { e.stash[ORE.IRON] = 1; }, /Not enough/],
      [(e) => { e.power = 0; e.stash[ORE.COAL] = 2; }, /power/i],
    ];
    for (const [setup, reason] of cases) {
      const e = steelReady(); setup(e);
      const before = snap(e);
      const r = craft(e, 'steel', e.power ? 2 : 1);
      expect(r.ok).toBe(false);
      expect(r.reason).toMatch(reason);
      expect(snap(e)).toBe(before);
    }
  });

  it('output ignores the stash cap', () => {
    const e = steelReady(); e.stash[ITEM.STEEL] = ECONOMY.STASH_CAP;
    expect(craft(e, 'steel', 1).ok).toBe(true);
    expect(e.stash[ITEM.STEEL]).toBe(ECONOMY.STASH_CAP + 1);
  });

  it('buildings need tech, previous level and materials', () => {
    const e = mk();
    expect(canUpgradeBuilding(e, 'furnace').ok).toBe(false);
    e.tech.push('bloomery'); e.stash[ORE.IRON] = 15; e.stash[ORE.COAL] = 10;
    expect(upgradeBuilding(e, 'furnace').ok).toBe(true);
    expect(e.buildings.furnace).toBe(2);
    expect(e.stash[ORE.IRON]).toBe(0);
    const f = mk(); f.buildings.furnace = 3; f.tech.push('arc_furnace'); f.stash[ITEM.STEEL] = 30; f.stash[ITEM.COPPER_WIRE] = 20;
    const r = upgradeBuilding(f, 'furnace');
    expect(r.ok).toBe(false); expect(r.reason).toMatch(/Generator level 2/);
    expect(f.buildings.furnace).toBe(3);
  });

  it('fresh economy starts with generator, furnace and workshop at level 1', () => {
    const e = mk();
    expect(e.buildings).toMatchObject({ generator: 1, furnace: 1, workshop: 1 });
    expect(e.buildings.refinery || 0).toBe(0);
    expect(canCraft(e, 'steel').ok).toBe(false);
  });
});
