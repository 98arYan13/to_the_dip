import { describe, it, expect } from 'vitest';
import { ORE, ITEM, ORES, MATERIAL_INPUTS, isOre } from '../src/config.js';
import { generateWorld } from '../src/world/WorldGen.js';
import { rollContracts } from '../src/systems/Contracts.js';

describe('ore and material items', () => {
  it('new ores keep old ids stable', () => {
    expect(ORE.TUNGSTEN).toBe(21);
    expect(ORE.BAUXITE).toBe(22);
    expect(ORE.OIL_SHALE).toBe(24);
    expect(ITEM.STEEL).toBe(29);
    expect(ORE.HELIUM3).toBe(43);
    expect(ITEM.PROPELLANT).toBe(47);
    expect(ORES.length).toBe(50);
    for (let o = 1; o < ORES.length; o++) expect(ORES[o].id).toBe(o);
  });

  it('materials follow kg and price rules', () => {
    for (const [id, inputs] of Object.entries(MATERIAL_INPUTS)) {
      let kg = 0; let price = 0;
      for (const [o, n] of Object.entries(inputs)) { kg += n * ORES[+o].kg; price += n * ORES[+o].price; }
      expect(ORES[+id].kind).toBe('material');
      expect(ORES[+id].hosts).toEqual([]);
      expect(ORES[+id].kg).toBeCloseTo(0.5 * kg, 2);
      expect(ORES[+id].price).toBeCloseTo(1.3 * price, 2);
    }
  });

  it('materials are never generated', () => {
    const w = generateWorld(1);
    for (let i = 0; i < w.oreType.length; i++) if (w.oreType[i]) expect(isOre(w.oreType[i])).toBe(true);
  });

  it('contracts only ask for ores', () => {
    for (let d = 1; d <= 50; d++) for (const c of rollContracts(1, d, 6)) expect(isOre(c.ore)).toBe(true);
  });

  it('rare ores are rarer', () => {
    expect(ORES[ORE.DIAMOND].weight).toBe(0.35);
    expect(ORES[ORE.RUBY].weight).toBe(0.7);
    expect(ORES[ORE.RHODIUM].weight).toBe(1.4);
    expect(ORES[ORE.METEORITE].weight).toBe(1.4);
  });
});
