import { describe, it, expect } from 'vitest';
import { EventBus, EV } from '../src/core/EventBus.js';
import { Economy, createEconomyState } from '../src/systems/Economy.js';
import { Story, currentMission } from '../src/systems/Story.js';
import { LOG_ENTRIES, MISSIONS } from '../src/story.js';
import { TECH, RELICS, STORY } from '../src/config.js';

const setup = () => {
  const bus = new EventBus(); const ec = new Economy(bus, createEconomyState());
  const s = new Story(bus, ec); s.sync(); return { bus, ec, s, c0: ec.credits };
};

describe('story', () => {
  it('data is well-formed', () => {
    for (const list of [LOG_ENTRIES, MISSIONS]) {
      expect(new Set(list.map((x) => x.id)).size).toBe(list.length);
      for (const x of list) {
        expect(x.chapter).toBeGreaterThanOrEqual(1); expect(x.chapter).toBeLessThanOrEqual(6);
        if (x.when.tech) expect(TECH.some((t) => t.id === x.when.tech)).toBe(true);
        if (x.when.relic) expect(RELICS.some((r) => r.id === x.when.relic)).toBe(true);
      }
    }
    expect(MISSIONS.length).toBe(19); expect(LOG_ENTRIES.length).toBe(15);
  });
  it('fresh game: intro seen, first mission pending', () => {
    const { ec } = setup();
    expect(ec.story.seen).toEqual(['intro']); expect(currentMission(ec).id).toBe(MISSIONS[0].id);
  });
  it('selling advances the mission and pays the chapter-1 reward once', () => {
    const { bus, ec, c0 } = setup();
    bus.emit(EV.SOLD, { total: 5 }); expect(ec.story.mission).toBe(1); expect(ec.credits - c0).toBe(STORY.REWARD_BY_CHAPTER[0]);
    bus.emit(EV.SOLD, { total: 5 }); expect(ec.credits - c0).toBe(STORY.REWARD_BY_CHAPTER[0]);
  });
  it('missions advance in order even when a later one is met first', () => {
    const { bus, ec, s } = setup();
    bus.emit(EV.SOLD, { total: 5 });
    ec.relics.push('hull_shard'); s.sync(); expect(ec.story.mission).toBe(1);
    ec.tech.push('bloomery'); s.sync(); expect(ec.story.mission).toBe(3);
  });
  it('relic entries wait as modals until read', () => {
    const { bus, ec, s } = setup();
    ec.relics.push('hull_shard'); bus.emit(EV.RELIC_FOUND, { id: 'hull_shard' });
    expect(s.pendingModals().map((e) => e.id)).toEqual(['intro', 'relic_hull_shard']);
    s.markRead('intro'); s.markRead('relic_hull_shard'); expect(s.pendingModals()).toEqual([]);
  });
  it('silent sync catches up without toasts', () => {
    const bus = new EventBus(); const ec = new Economy(bus, createEconomyState());
    ec.tech.push('bloomery', 'radio'); ec.story.flags.push('sold'); ec.relics.push('hull_shard');
    const toasts = []; bus.on(EV.TOAST, (t) => toasts.push(t));
    new Story(bus, ec).sync(true);
    expect(toasts).toEqual([]); expect(ec.story.mission).toBeGreaterThan(0);
  });
  it('a loaded completed save sees the ending and passes ch6_core', () => {
    const bus = new EventBus(); const ec = new Economy(bus, createEconomyState());
    ec.completed = true; ec.story.mission = MISSIONS.findIndex((m) => m.id === 'ch6_core'); // earlier missions done
    new Story(bus, ec).sync(true);
    expect(ec.story.seen).toContain('ending');
    expect(ec.story.mission).toBeGreaterThan(MISSIONS.findIndex((m) => m.id === 'ch6_core'));
  });
});

import { renderLog } from '../src/ui/LogScreen.js';
import { renderTech } from '../src/ui/TechScreen.js';

const ecWith = (story) => { const ec = createEconomyState(); Object.assign(ec.story, story); return ec; };
describe('story ui', () => {
  it('log shows the current objective and unread marks', () => {
    const html = renderLog(ecWith({ seen: ['intro', 'ch1_tools'], read: ['intro'], mission: 1 }));
    expect(html).toContain(MISSIONS[1].text); expect(html).toContain('unread');
    expect(html.indexOf('"ch1_tools"')).toBeLessThan(html.indexOf('"intro"'));
  });
  it('tech panel names a missing relic and its layer', () => {
    expect(renderTech(ecWith({}), { era: 3, selected: 'faraday_shielding' })).toContain('not found (ruin in layer 2)');
  });
});
