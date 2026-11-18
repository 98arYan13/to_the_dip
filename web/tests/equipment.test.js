import { describe, it, expect } from 'vitest';
import { Economy, createEconomyState } from '../src/systems/Economy.js';
import { EventBus } from '../src/core/EventBus.js';
import { Player } from '../src/entities/Player.js';
import { ITEM, CONSUMABLES, PICKAXES, UPGRADES, POWER, CAMP_BUILDINGS, RECIPES, RELICS } from '../src/config.js';
import { eraPickTier } from '../src/systems/Tech.js';

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
    p.update(1 / 60, { isDown: (k) => k === 'jet', wasPressed: () => false, padMoveX: 0 }, 0, 0);
    expect(p.jetting).toBe(false);
    expect(p.vy).toBeGreaterThan(0); // gravity only
    expect(energy.value).toBe(50);
  });
});

describe('shop items', () => {
  it('a fresh economy starts with 10 ladders and one costs $3', () => {
    const e = mk(); e.credits = 3;
    expect(e.consumables.ladder).toBe(10);
    expect(e.buyConsumable('ladder').ok).toBe(true);
    expect(e.consumables.ladder).toBe(11);
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

describe('space-era gear and recipes (spec 8.1)', () => {
  it('pickaxes 7-8, rigs 6-7 and jetpack 5 use the spec numbers', () => {
    expect(PICKAXES.slice(6).map((p) => [p.damage, p.swing, p.powered, p.workshop])).toEqual([[40, 0.30, true, 3], [64, 0.28, true, 3]]);
    expect(UPGRADES.rig.levels.slice(6).map((l) => [l.capacity, l.maxEnergy, l.eff])).toEqual([[2400, 25000, 6.5], [4800, 60000, 8]]);
    expect(UPGRADES.jetpack.levels[5]).toMatchObject({ thrust: 4800, maxUp: 520, drain: 0.45 });
  });
  it('Fusion Reactor, its fuel, and the second Propellant recipe', () => {
    expect(CAMP_BUILDINGS.generator.levels[3]).toMatchObject({ name: 'Fusion Reactor', tech: 'fusion_power' });
    expect(POWER.CAP[3]).toBe(100000);
    expect(POWER.FUELS).toContainEqual({ id: ITEM.FUSION_FUEL, power: 5000, gen: 4 });
    expect(RECIPES.filter((r) => r.out[ITEM.PROPELLANT]).map((r) => r.id).sort()).toEqual(['propellant', 'propellant_lunar']);
    expect(RECIPES.find((r) => r.id === 'propellant_lunar').in).toEqual({ 45: 2, [ITEM.FUEL]: 2 });
  });
  it('era pick tiers and the off-world relics', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(eraPickTier)).toEqual([1, 2, 3, 4, 6, 7, 8, 8]);
    expect(RELICS.filter((r) => r.planet !== 'earth').map((r) => r.id)).toEqual(['relay_alpha', 'relay_beta', 'origin_core']);
  });
});

describe('tech screen relic line', () => {
  it('names the planet for off-world relics, no NaN', async () => {
    const { relicLine } = await import('../src/ui/TechScreen.js');
    expect(relicLine({ relics: [] }, 'relay_alpha')).toBe('Relic: Relay Alpha — not found (ruin on Moon)');
    expect(relicLine({ relics: ['relay_beta'] }, 'relay_beta')).toContain('found ✓');
    expect(relicLine({ relics: [] }, 'hull_shard')).toContain('layer 1');
  });
});
