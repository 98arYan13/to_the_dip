import { describe, it, expect } from 'vitest';
import { Economy, createEconomyState } from '../src/systems/Economy.js';
import { EventBus } from '../src/core/EventBus.js';
import { ORES } from '../src/config.js';

const mk = () => new Economy(new EventBus(), createEconomyState());
const IRON = ORES.findIndex((o) => o && /iron/i.test(o.name));

describe('stash', () => {
  it('deposit moves all cargo', () => {
    const e = mk(); e.cargo[IRON] = 5; e.deposit();
    expect(e.cargo[IRON]).toBe(0); expect(e.stash[IRON]).toBe(5);
  });
  it('sellFromStash credits cash and decrements', () => {
    const e = mk(); e.stash[IRON] = 4; const c0 = e.credits;
    const got = e.sellFromStash(IRON, 3);
    expect(got).toBeCloseTo(3 * ORES[IRON].price); expect(e.credits).toBeCloseTo(c0 + got); expect(e.stash[IRON]).toBe(1);
  });
  it('pay takes stash first, then cargo; unaffordable changes nothing', () => {
    const e = mk(); e.stash[IRON] = 6; e.cargo[IRON] = 4;
    expect(e.pay({ ores: { [IRON]: 10 } })).toBe(true);
    expect(e.stash[IRON]).toBe(0); expect(e.cargo[IRON]).toBe(0);
    e.stash[IRON] = 6; e.cargo[IRON] = 3;
    expect(e.pay({ ores: { [IRON]: 10 } })).toBe(false);
    expect(e.stash[IRON]).toBe(6); expect(e.cargo[IRON]).toBe(3);
  });
  it('stash survives toJSON/load and death; cargo and consumables do not', () => {
    const e = mk(); e.stash[IRON] = 9; e.cargo[IRON] = 5; e.levels.pickaxe = 3; e.consumables.dynamite = 7; e.credits = 50;
    e.applyDeath();
    expect(e.cargo[IRON]).toBe(0); expect(e.consumables.dynamite).toBe(createEconomyState().consumables.dynamite);
    expect(e.levels.pickaxe).toBe(3); expect(e.stash[IRON]).toBe(9); expect(e.credits).toBe(50);
    const e2 = mk(); e2.load(e.toJSON()); expect(e2.stash[IRON]).toBe(9);
  });
  it('old saves without stash load with an empty one', () => {
    const s = createEconomyState(); delete s.stash;
    expect(mk().load(s)).toBeUndefined();
    const e = mk(); e.load(s); expect(e.stash[IRON]).toBe(0);
  });
});
