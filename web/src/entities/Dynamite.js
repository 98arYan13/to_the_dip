/**
 * @module entities/Dynamite
 * Thrown physics projectile with bounce, a flashing 2.5 s fuse and a tier-gated 3×3 blast.
 */
import { DYNAMITE, WORLD } from '../config.js';
import { EV } from '../core/EventBus.js';
import { Pool } from '../core/Pool.js';

export class Dynamite {
  constructor() {
    this.x = 0; this.y = 0; this.w = DYNAMITE.SIZE; this.h = DYNAMITE.SIZE;
    this.vx = 0; this.vy = 0; this.prevX = 0; this.prevY = 0;
    this.onGround = false; this.hitX = false; this.hitY = false; this.impactVX = 0; this.impactVY = 0;
    this.fuse = 0; this.rot = 0; this.big = false;
  }
}

export class DynamiteSystem {
  /**
   * @param {import('../systems/Physics.js').Physics} physics
   * @param {import('../systems/Mining.js').Mining} mining
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(physics, mining, bus) {
    this.physics = physics;
    this.mining = mining;
    this.bus = bus;
    this.pool = new Pool(() => new Dynamite(), DYNAMITE.MAX_ACTIVE);
    /** @type {Dynamite[]} */
    this.active = [];
    this.lastExplosionAge = Infinity;
    this.payload = { x: 0, y: 0 };
  }

  /** Throw from (x,y) toward aim point. @returns {boolean} */
  throw(x, y, aimX, aimY, big = false) {
    if (this.active.length >= DYNAMITE.MAX_ACTIVE) return false;
    const d = this.pool.acquire();
    let dx = aimX - x; let dy = aimY - y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= len; dy /= len;
    d.x = x - d.w / 2; d.y = y - d.h / 2;
    d.prevX = d.x; d.prevY = d.y;
    d.vx = dx * DYNAMITE.THROW_SPEED;
    d.vy = dy * DYNAMITE.THROW_SPEED - DYNAMITE.THROW_UP_BIAS;
    d.fuse = DYNAMITE.FUSE; d.big = big;
    d.rot = 0;
    this.active.push(d);
    this.payload.x = x; this.payload.y = y;
    this.bus.emit(EV.DYNAMITE_THROWN, this.payload);
    return true;
  }

  /** @param {number} dt @param {number} gravity */
  update(dt, gravity) {
    this.lastExplosionAge += dt;
    for (let k = this.active.length - 1; k >= 0; k--) {
      const d = this.active[k];
      d.prevX = d.x; d.prevY = d.y;
      d.vy += gravity * dt;
      const vx = d.vx; const vy = d.vy;
      this.physics.move(d, dt);
      if (d.hitX) d.vx = -vx * DYNAMITE.RESTITUTION;
      if (d.hitY) {
        d.vy = Math.abs(vy) > 60 ? -vy * DYNAMITE.RESTITUTION : 0;
        d.vx *= DYNAMITE.GROUND_FRICTION;
      }
      d.rot += d.vx * dt * 0.08;
      d.fuse -= dt;
      if (d.fuse <= 0) {
        this._detonate(d);
        this.active[k] = this.active[this.active.length - 1];
        this.active.pop();
        this.pool.release(d);
      }
    }
  }

  /** @param {Dynamite} d */
  _detonate(d) {
    const T = WORLD.TILE_PX;
    const cx = d.x + d.w / 2; const cy = d.y + d.h / 2;
    this.mining.blast(Math.floor(cx / T), Math.floor(cy / T), d.big ? DYNAMITE.BIG_RADIUS : DYNAMITE.RADIUS, d.big);
    this.lastExplosionAge = 0;
    this.payload.x = cx; this.payload.y = cy;
    this.bus.emit(EV.EXPLOSION, this.payload);
  }

  clear() {
    for (const d of this.active) this.pool.release(d);
    this.active.length = 0;
  }
}
