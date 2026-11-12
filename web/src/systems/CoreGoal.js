/**
 * @module systems/CoreGoal
 * Reaching the Core chamber starts a timed stabilize sequence (heat + quakes). Survive HOLD_S with the heat suit to win.
 */
import { CORE_GOAL, WORLD } from '../config.js';
import { EV } from '../core/EventBus.js';
import { coreChamber } from '../world/Zones.js';

export class CoreGoal {
  /** @param {import('../world/World.js').World} world @param {import('../core/EventBus.js').EventBus} bus @param {any} economy */
  constructor(world, bus, economy) {
    this.world = world; this.bus = bus; this.economy = economy;
    this.hold = 0; this.quakeAcc = 0;
    /** Optional: called every QUAKE_EVERY_S while holding. */ this.onQuake = () => {};
    /** Called when the sequence kills the player (no heat suit). */ this.onFail = () => {};
    bus.on(EV.PLAYER_DEAD, () => { this.hold = 0; });
  }

  /** 0..1 progress of the current hold. */
  get progress() { return this.hold / CORE_GOAL.HOLD_S; }

  inChamber(px, py) {
    const c = coreChamber(this.world.W, this.world.H); const T = WORLD.TILE_PX;
    const x = px / T; const y = py / T;
    return x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h;
  }

  update(dt, px, py) {
    if (!this.inChamber(px, py)) { this.hold = 0; return; }
    if (!this.economy.tech.includes('heat_suit')) { this.hold = 0; this.onFail(); return; }
    this.hold += dt;
    this.quakeAcc += dt;
    if (this.quakeAcc >= CORE_GOAL.QUAKE_EVERY_S) { this.quakeAcc = 0; this.onQuake(); }
    if (this.hold >= CORE_GOAL.HOLD_S) this.complete();
  }

  complete() {
    this.hold = 0;
    if (this.economy.completed) return; // reward once; keep digging
    this.economy.completed = true;
    this.economy.credits += CORE_GOAL.REWARD_CASH;
    this.bus.emit(EV.CREDITS_CHANGED, this.economy.credits);
    this.bus.emit(EV.COMPLETED);
  }
}
