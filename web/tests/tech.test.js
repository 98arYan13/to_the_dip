import { describe, it, expect } from 'vitest';
import { Economy, createEconomyState } from '../src/systems/Economy.js';
import { EventBus } from '../src/core/EventBus.js';
import { TECH } from '../src/config.js';
import { canUnlock, unlockTech, unlocksOf, eraReached } from '../src/systems/Tech.js';

const mk = () => new Economy(new EventBus(), createEconomyState());
const rich = (e, id) => { const c = TECH.find((t) => t.id === id).cost; e.credits = c.cash; for (const [o, n] of Object.entries(c.ores)) e.stash[o] = n; };

describe('tech', () => {
  it('locked while prerequisite missing, names it', () => {
    const e = mk(); rich(e, 'blast_furnace');
    const r = canUnlock(e, 'blast_furnace');
    expect(r.ok).toBe(false); expect(r.reason).toMatch(/Requires Bloomery/);
  });
  it('unlock pays, raises stat, and is not repeatable', () => {
    const e = mk(); e.tech.push('bloomery'); rich(e, 'battery_1');
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
  it('unlocksOf finds recipes and building levels by reverse lookup', () => {
    const u = unlocksOf('blast_furnace');
    expect(u).toContainEqual({ kind: 'building', id: 'furnace', level: 3 });
    expect(u).toContainEqual({ kind: 'recipe', id: 'steel' });
  });
  it('eraReached counts owned key techs', () => {
    const e = mk();
    expect(eraReached(e)).toBe(1);
    e.tech.push('bloomery', 'blast_furnace');
    expect(eraReached(e)).toBe(3);
  });
  it('nothing but era-1 techs is free of prerequisites', () => {
    for (const t of TECH) if (t.era > 1) expect(t.requires.length, t.id).toBeGreaterThan(0);
  });
});
