/**
 * @module systems/MindGoal
 * Tessera's final sequence: greeted by the Mind, then hold three siphon nodes for NODE_S each while pulses arrive.
 * Death or leaving resets only the node in progress; completed nodes and the coolant level persist in economy.mind.
 */
import { MIND_GOAL, WORLD, PLANETS } from '../config.js';
import { EV } from '../core/EventBus.js';
import { mindChamber, mindNodes } from '../world/Zones.js';

export class MindGoal {
  /** @param {{W:number,H:number,planet?:string}} world @param {import('../core/EventBus.js').EventBus} bus @param {any} economy */
  constructor(world, bus, economy) {
    this.world = world; this.bus = bus; this.economy = economy;
    this.hold = 0; this.activeNode = -1; this.pulseAcc = 0; this.denied = false; this.warned = false;
    /** Called every PULSE_EVERY_S while the sequence runs. */ this.onPulse = () => {};
    /** Called with the total number of raised coolant rows. */ this.onRaiseCoolant = (_rows) => {};
    bus.on(EV.PLAYER_DEAD, () => { this.hold = 0; this.activeNode = -1; });
  }

  /** 0..1 progress of the node in progress. */
  get progress() { return this.hold / MIND_GOAL.NODE_S; }

  /** Re-apply the saved coolant level (load, or arriving on Tessera). */
  reapply() { if (this.world.planet === 'tessera' && this.economy.mind.coolant) this.onRaiseCoolant(this.economy.mind.coolant); }

  inChamber(px, py) {
    if (this.world.planet !== 'tessera') return false;
    const c = mindChamber(this.world.W, this.world.H); const x = px / WORLD.TILE_PX; const y = py / WORLD.TILE_PX;
    return x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h;
  }

  update(dt, px, py) {
    const ec = this.economy; const m = ec.mind;
    if (ec.finished || !this.inChamber(px, py)) { this.hold = 0; this.activeNode = -1; this.pulseAcc = 0; this.denied = this.warned = false; return; }
    if (!ec.relics.includes('origin_core')) {
      this.hold = 0; this.activeNode = -1;
      if (!this.denied) { this.denied = true; this.bus.emit(EV.HINT, 'The Mind does not open.'); }
      return;
    }
    if (!m.greeted) {
      m.greeted = true;
      if (!ec.story.flags.includes('mind_greeted')) ec.story.flags.push('mind_greeted');
      this.bus.emit(EV.MIND_GREETING);
      return;
    }
    this.pulseAcc += dt;
    if (this.pulseAcc >= MIND_GOAL.PULSE_EVERY_S) { this.pulseAcc = 0; this.onPulse(); }
    const T = WORLD.TILE_PX; const nodes = mindNodes(this.world.W, this.world.H);
    const near = nodes.findIndex((n, i) => !m.nodes.includes(i) && Math.hypot(px / T - (n.x + 0.5), py / T - (n.y + 0.5)) <= MIND_GOAL.NODE_RANGE);
    if (near !== this.activeNode) { this.hold = 0; this.activeNode = near; }
    if (near < 0) return;
    if (!ec.tech.includes('heat_suit_3')) {
      this.hold = 0;
      if (!this.warned) { this.warned = true; this.bus.emit(EV.HINT, 'The chamber heat is too much. You need Heat Suit III.'); }
      return;
    }
    this.hold += dt;
    if (this.hold < MIND_GOAL.NODE_S) return;
    m.nodes.push(near); m.coolant += MIND_GOAL.COOLANT_ROWS;
    this.hold = 0; this.activeNode = -1;
    this.onRaiseCoolant(m.coolant);
    if (m.nodes.length >= nodes.length) { ec.finished = true; this.bus.emit(EV.FINISHED); }
  }
}
