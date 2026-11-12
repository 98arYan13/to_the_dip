import { describe, it, expect } from 'vitest';
import { Economy, createEconomyState } from '../src/systems/Economy.js';
import { EventBus } from '../src/core/EventBus.js';
import { TECH } from '../src/config.js';
import { canUnlock, unlockTech } from '../src/systems/Tech.js';

const mk = () => new Economy(new EventBus(), createEconomyState());
const rich = (e, id) => { const c = TECH.find((t) => t.id === id).cost; e.credits = c.cash; for (const [o, n] of Object.entries(c.ores)) e.stash[o] = n; };

describe('tech', () => {
  it('locked while prerequisite missing, names it', () => {
    const e = mk(); rich(e, 'battery_2');
    const r = canUnlock(e, 'battery_2');
    expect(r.ok).toBe(false); expect(r.reason).toMatch(/Battery Cell I/);
  });
  it('unlock pays, raises stat, and is not repeatable', () => {
    const e = mk(); rich(e, 'battery_1');
    expect(e.stat('maxEnergy', 100)).toBe(100);
    expect(unlockTech(e, 'battery_1').ok).toBe(true);
    expect(e.credits).toBe(0); expect(e.stat('maxEnergy', 100)).toBe(150);
    expect(unlockTech(e, 'battery_1').ok).toBe(false);
  });
  it('tech persists through save and death', () => {
    const e = mk(); e.tech.push('pack_1'); e.applyDeath();
    const e2 = mk(); e2.load(e.toJSON());
    expect(e2.capacity).toBe(35 + 25);
  });
  it('balance: costs exceed prerequisite costs and nothing is free at start', () => {
    for (const t of TECH) {
      expect(canUnlock(mk(), t.id).ok).toBe(false);
      for (const r of t.requires) expect(t.cost.cash).toBeGreaterThan(TECH.find((x) => x.id === r).cost.cash);
    }
  });
});
