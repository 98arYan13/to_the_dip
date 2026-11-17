/**
 * @module systems/Story
 * Unlocks Expedition Log entries and advances main missions from game events (like Collectibles).
 */
import { EV } from '../core/EventBus.js';
import { ITEM, STORY } from '../config.js';
import { LOG_ENTRIES, MISSIONS } from '../story.js';

/** Is trigger `when` satisfied? Pure. */
export function met(when, ec) {
  if (when.start) return true;
  if (when.tech) return ec.tech.includes(when.tech);
  if (when.relic) return ec.relics.includes(when.relic);
  if (when.flag) return ec.story.flags.includes(when.flag);
  if (when.depthM !== undefined) return ec.collect.maxDepth >= when.depthM;
  return ec.story.flags.includes('completed'); // {completed:true}
}

export const currentMission = (ec) => MISSIONS[ec.story.mission] || null;

export class Story {
  /** @param {import('../core/EventBus.js').EventBus} bus @param {any} economy */
  constructor(bus, economy) {
    this.bus = bus; this.economy = economy;
    const flag = (name) => { const f = economy.story.flags; if (!f.includes(name)) f.push(name); this.sync(); };
    bus.on(EV.SOLD, () => flag('sold'));
    bus.on(EV.PULSE, (p) => { if (!p.sheltered) flag('pulse'); });
    bus.on(EV.CRAFTED, (id) => { if (id === ITEM.EXOTIC_ALLOY) flag('exotic'); });
    bus.on(EV.CORE_DENIED, () => flag('core_denied'));
    bus.on(EV.COMPLETED, () => flag('completed'));
    for (const e of [EV.TECH_UNLOCKED, EV.RELIC_FOUND, EV.DEPTH_CHANGED]) bus.on(e, () => this.sync());
  }

  sync(silent = false) {
    const ec = this.economy, s = ec.story;
    for (const e of LOG_ENTRIES) {
      if (s.seen.includes(e.id) || !met(e.when, ec)) continue;
      s.seen.push(e.id);
      if (silent) continue;
      this.bus.emit(EV.LOG_ENTRY, { id: e.id });
      if (!e.modal) this.bus.emit(EV.TOAST, { text: `New log entry: ${e.title}`, kind: 'info' });
    }
    for (let m = currentMission(ec); m && met(m.when, ec); m = currentMission(ec)) {
      ec.credits += STORY.REWARD_BY_CHAPTER[m.chapter - 1];
      this.bus.emit(EV.CREDITS_CHANGED, ec.credits);
      this.bus.emit(EV.MISSION_DONE, { id: m.id });
      if (!silent) this.bus.emit(EV.TOAST, { text: `Objective complete: ${m.text}`, kind: 'good' });
      s.mission++;
    }
  }

  markRead(id) { if (!this.economy.story.read.includes(id)) this.economy.story.read.push(id); }

  pendingModals() {
    const s = this.economy.story;
    return s.seen.map((id) => LOG_ENTRIES.find((e) => e.id === id)).filter((e) => e && e.modal && !s.read.includes(e.id));
  }
}
