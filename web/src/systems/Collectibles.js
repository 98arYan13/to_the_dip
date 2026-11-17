/**
 * @module systems/Collectibles
 * Listens to game events and awards achievements once; progress lives in the economy (survives death).
 */
import { ACHIEVEMENTS, WORLD } from '../config.js';
import { EV } from '../core/EventBus.js';

export class Collectibles {
  /** @param {import('../core/EventBus.js').EventBus} bus @param {any} economy @param {{ruinRect:(layer:number)=>{x:number,y:number,w:number,h:number}, waterIn:(r:any)=>number}} ctx */
  constructor(bus, economy, ctx) {
    this.bus = bus; this.economy = economy; this.ctx = ctx;
    bus.on(EV.ORE_COLLECTED, (ore) => this.handle('ore', { ore }));
    bus.on(EV.DEPTH_CHANGED, (p) => this.handle('depth', { meters: p.meters }));
    bus.on(EV.COMPLETED, () => this.handle('completed', {}));
    bus.on(EV.RELIC_FOUND, (p) => this.handle('relic', { id: p.id }));
    bus.on(EV.PULSE, (p) => this.handle('pulse', { sheltered: p.sheltered }));
    bus.on(EV.TECH_UNLOCKED, () => this.handle('tech', {}));
    bus.on(EV.EXPLOSION, (p) => { // payload is in pixels
      const r = this.ctx.ruinRect(2); if (!r) return; const x = p.x / WORLD.TILE_PX; const y = p.y / WORLD.TILE_PX;
      if (x >= r.x - 2 && x <= r.x + r.w + 2 && y >= r.y - 2 && y <= r.y + r.h + 2 && !this.economy.story.flags.includes('hall_exploded')) this.economy.story.flags.push('hall_exploded');
    });
  }

  dry() { const r = this.ctx.ruinRect(1); return !r || this.ctx.waterIn(r) === 0; }

  /** @param {'ore'|'depth'|'completed'|'relic'|'pulse'|'tech'} event @param {{ore?:number, meters?:number, id?:string, sheltered?:boolean}} p */
  handle(event, p) {
    const c = this.economy.collect;
    if (event === 'ore' && p.ore) c.ore[p.ore] = (c.ore[p.ore] || 0) + 1;
    if (event === 'depth') c.maxDepth = Math.max(c.maxDepth, p.meters || 0);
    if (event === 'pulse' && !p.sheltered) c.pulses = (c.pulses || 0) + 1;
    for (const a of ACHIEVEMENTS) {
      if (this.economy.achievements.includes(a.id) || a.test.event !== event) continue;
      const t = /** @type {any} */ (a.test);
      const ok = event === 'ore' ? c.ore[t.ore] >= t.count && p.ore === t.ore
        : event === 'depth' ? c.maxDepth >= t.depthM
        : event === 'relic' ? (t.count ? this.economy.relics.filter((r) => r !== 'seed_core').length >= t.count
          : p.id === t.id && !(t.unlessFlag && this.economy.story.flags.includes(t.unlessFlag)) && (!t.dry || this.dry()))
        : event === 'pulse' ? c.pulses >= t.count
        : event === 'tech' ? this.economy.stat(t.stat, 0) >= t.min
        : true;
      if (!ok) continue;
      this.economy.achievements.push(a.id);
      this.bus.emit(EV.ACHIEVEMENT, { id: a.id });
      this.bus.emit(EV.TOAST, { text: `Achievement: ${a.name}`, kind: 'good' });
    }
  }
}
