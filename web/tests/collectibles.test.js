import { describe, it, expect } from 'vitest';
import { Collectibles } from '../src/systems/Collectibles.js';
import { Economy } from '../src/systems/Economy.js';
import { EventBus, EV } from '../src/core/EventBus.js';

const T = 32;
function make(water = 0) {
  const bus = new EventBus();
  const economy = { achievements: [], collect: { ore: {}, maxDepth: 0, pulses: 0 }, relics: [], tech: [], story: { flags: [] }, stat: (n, b) => (economy.tech.includes('hard') ? 1 : b) };
  const ctx = { ruinRect: () => ({ x: 10, y: 20, w: 8, h: 6 }), waterIn: () => water };
  new Collectibles(bus, economy, ctx);
  const got = [];
  bus.on(EV.ACHIEVEMENT, (p) => got.push(p.id));
  const relic = (id) => { economy.relics.push(id); bus.emit(EV.RELIC_FOUND, { id }); };
  return { bus, economy, got, relic };
}

describe('feats', () => {
  it('relic_first fires once, relic_all ignores seed_core', () => {
    const { got, relic } = make();
    relic('a'); relic('b');
    expect(got.filter((i) => i === 'relic_first')).toHaveLength(1);
    relic('c'); relic('d'); relic('seed_core');
    expect(got).not.toContain('relic_all');
    relic('e');
    expect(got).toContain('relic_all');
  });
  it('clean_air unless the hall exploded', () => {
    const a = make(); a.relic('thermal_siphon');
    expect(a.got).toContain('clean_air');
    const b = make(); b.bus.emit(EV.EXPLOSION, { x: 9 * T, y: 22 * T }); b.relic('thermal_siphon');
    expect(b.economy.story.flags).toContain('hall_exploded');
    expect(b.got).not.toContain('clean_air');
    const c = make(); c.bus.emit(EV.EXPLOSION, { x: 40 * T, y: 22 * T }); c.relic('thermal_siphon');
    expect(c.got).toContain('clean_air');
  });
  it('dry_feet needs no water in the ruin', () => {
    const a = make(0); a.relic('shield_lattice');
    expect(a.got).toContain('dry_feet');
    const b = make(3); b.relic('shield_lattice');
    expect(b.got).not.toContain('dry_feet');
  });
  it('pulse_10 counts only unsheltered pulses', () => {
    const { bus, got, economy } = make();
    for (let i = 0; i < 9; i++) bus.emit(EV.PULSE, { sheltered: false });
    for (let i = 0; i < 5; i++) bus.emit(EV.PULSE, { sheltered: true });
    expect(got).not.toContain('pulse_10');
    bus.emit(EV.PULSE, { sheltered: false });
    expect(economy.collect.pulses).toBe(10);
    expect(got).toContain('pulse_10');
  });
  it('immune when pulseResist reaches 1', () => {
    const { bus, got, economy } = make();
    bus.emit(EV.TECH_UNLOCKED, 'x');
    expect(got).not.toContain('immune');
    economy.tech.push('hard'); bus.emit(EV.TECH_UNLOCKED, 'hard');
    expect(got).toContain('immune');
  });
  it('missing ruin does not throw', () => {
    const bus = new EventBus();
    const economy = { achievements: [], collect: { ore: {}, maxDepth: 0, pulses: 0 }, relics: ['shield_lattice'], tech: [], story: { flags: [] }, stat: (n, b) => b };
    new Collectibles(bus, economy, { ruinRect: () => undefined, waterIn: () => 5 });
    expect(() => { bus.emit(EV.EXPLOSION, { x: 1, y: 1 }); bus.emit(EV.RELIC_FOUND, { id: 'shield_lattice' }); }).not.toThrow();
    expect(economy.achievements).toContain('dry_feet');
  });
  it('New Map clears hall_exploded', () => {
    const e = new Economy(new EventBus(), undefined);
    e.story.flags.push('hall_exploded', 'other');
    expect(e.newMapState().story.flags).toEqual(['other']);
  });
});
