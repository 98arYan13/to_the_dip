/**
 * @module systems/Collectibles
 * Listens to game events and awards achievements once; progress lives in the economy (survives death).
 */
import { ACHIEVEMENTS } from '../config.js';
import { EV } from '../core/EventBus.js';

export class Collectibles {
  /** @param {import('../core/EventBus.js').EventBus} bus @param {any} economy */
  constructor(bus, economy) {
    this.bus = bus; this.economy = economy;
    bus.on(EV.ORE_COLLECTED, (ore) => this.handle('ore', { ore }));
    bus.on(EV.DEPTH_CHANGED, (p) => this.handle('depth', { meters: p.meters }));
    bus.on(EV.COMPLETED, () => this.handle('completed', {}));
  }

  /** @param {'ore'|'depth'|'completed'} event @param {{ore?:number, meters?:number}} p */
  handle(event, p) {
    const c = this.economy.collect;
    if (event === 'ore' && p.ore) c.ore[p.ore] = (c.ore[p.ore] || 0) + 1;
    if (event === 'depth') c.maxDepth = Math.max(c.maxDepth, p.meters || 0);
    for (const a of ACHIEVEMENTS) {
      if (this.economy.achievements.includes(a.id) || a.test.event !== event) continue;
      const t = /** @type {any} */ (a.test);
      const ok = event === 'ore' ? c.ore[t.ore] >= t.count && p.ore === t.ore : event === 'depth' ? c.maxDepth >= t.depthM : true;
      if (!ok) continue;
      this.economy.achievements.push(a.id);
      this.bus.emit(EV.ACHIEVEMENT, { id: a.id });
      this.bus.emit(EV.TOAST, { text: `Achievement: ${a.name}`, kind: 'good' });
    }
  }
}
