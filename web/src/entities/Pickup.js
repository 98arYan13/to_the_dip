/**
 * @module entities/Pickup
 * Ore items dropped on the ground when cargo is full. Collected on touch when space frees up.
 */
import { PICKUPS, PHYSICS } from '../config.js';
import { EV } from '../core/EventBus.js';
import { Pool } from '../core/Pool.js';
import { canAddOre } from '../systems/Economy.js';

class Item {
  constructor() {
    this.x = 0; this.y = 0; this.w = PICKUPS.SIZE; this.h = PICKUPS.SIZE;
    this.vx = 0; this.vy = 0; this.prevX = 0; this.prevY = 0;
    this.onGround = false; this.hitX = false; this.hitY = false; this.impactVX = 0; this.impactVY = 0;
    this.ore = 0; this.age = 0;
  }
}

export class PickupSystem {
  /**
   * @param {import('../systems/Physics.js').Physics} physics
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(physics, bus) {
    this.physics = physics;
    this.bus = bus;
    this.pool = new Pool(() => new Item(), 16);
    /** @type {Item[]} */
    this.active = [];
    /** @type {import('../systems/Economy.js').Economy|null} */
    this.economy = null;
  }

  spawn(x, y, ore) {
    if (this.active.length >= PICKUPS.MAX) {
      const old = this.active.shift();
      if (old) this.pool.release(old);
    }
    const p = this.pool.acquire();
    p.x = x - p.w / 2; p.y = y - p.h / 2; p.prevX = p.x; p.prevY = p.y;
    p.vx = (Math.random() - 0.5) * 80; p.vy = -120;
    p.ore = ore; p.age = 0;
    this.active.push(p);
    this.bus.emit(EV.ORE_DROPPED, ore);
  }

  /**
   * @param {number} dt
   * @param {{x:number,y:number,w:number,h:number}} player
   */
  update(dt, player, gravity = 1) {
    const m = PICKUPS.MAGNET;
    for (let k = this.active.length - 1; k >= 0; k--) {
      const p = this.active[k];
      p.prevX = p.x; p.prevY = p.y;
      p.age += dt;
      p.vy += PHYSICS.GRAVITY * gravity * dt;
      const vy = p.vy;
      this.physics.move(p, dt);
      if (p.hitY) { p.vy = Math.abs(vy) > 80 ? -vy * PICKUPS.BOUNCE : 0; p.vx *= 0.7; }
      if (p.hitX) p.vx = -p.vx * 0.5;
      const touching = p.x < player.x + player.w + m && p.x + p.w > player.x - m && p.y < player.y + player.h + m && p.y + p.h > player.y - m;
      let remove = p.age > PICKUPS.LIFETIME;
      if (touching && p.age > 0.4 && this.economy && canAddOre(this.economy.cargo, p.ore, this.economy.capacity, this.economy.slots) && this.economy.addOre(p.ore)) {
        this.bus.emit(EV.PICKUP, p.ore);
        remove = true;
      }
      if (remove) {
        this.active[k] = this.active[this.active.length - 1];
        this.active.pop();
        this.pool.release(p);
      }
    }
  }

  clear() {
    for (const p of this.active) this.pool.release(p);
    this.active.length = 0;
  }
}
