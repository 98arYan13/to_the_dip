/**
 * @module systems/Physics
 * Axis-separated swept AABB vs tile grid. Movement is sub-stepped so no step exceeds
 * MAX_STEP_PX (< half a tile), which rules out tunnelling.
 */
import { PHYSICS, WORLD } from '../config.js';

/**
 * @typedef {Object} Body
 * @property {number} x left (px) @property {number} y top (px)
 * @property {number} w @property {number} h
 * @property {number} vx @property {number} vy
 * @property {boolean} onGround @property {boolean} hitX @property {boolean} hitY
 * @property {number} impactVX @property {number} impactVY
 */

export class Physics {
  /** @param {import('../world/World.js').World} world */
  constructor(world) { this.world = world; }

  /**
   * Move a body by its velocity for dt seconds, resolving tile collisions.
   * @param {Body} b @param {number} dt
   */
  move(b, dt) {
    b.onGround = false; b.hitX = false; b.hitY = false;
    b.impactVX = 0; b.impactVY = 0;
    const dx = b.vx * dt;
    const dy = b.vy * dt;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / PHYSICS.MAX_STEP_PX));
    const sx = dx / steps; const sy = dy / steps;
    for (let s = 0; s < steps; s++) {
      if (!b.hitX) this._moveX(b, sx);
      if (!b.hitY) this._moveY(b, sy);
    }
    if (b.y < WORLD.TOP_LIMIT_PX) { b.y = WORLD.TOP_LIMIT_PX; if (b.vy < 0) b.vy = 0; }
  }

  /** True if the body's AABB overlaps any solid tile. */
  overlapsSolid(x, y, w, h) {
    const T = WORLD.TILE_PX; const E = PHYSICS.EPS;
    const x0 = Math.floor(x / T); const x1 = Math.floor((x + w - E) / T);
    const y0 = Math.floor(y / T); const y1 = Math.floor((y + h - E) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.world.isSolid(tx, ty)) return true;
    return false;
  }

  _moveX(b, dx) {
    if (dx === 0) return;
    const T = WORLD.TILE_PX; const E = PHYSICS.EPS; const w = this.world;
    b.x += dx;
    const y0 = Math.floor(b.y / T); const y1 = Math.floor((b.y + b.h - E) / T);
    if (dx > 0) {
      const tx = Math.floor((b.x + b.w - E) / T);
      for (let ty = y0; ty <= y1; ty++) if (w.isSolid(tx, ty)) { b.x = tx * T - b.w; b.hitX = true; break; }
    } else {
      const tx = Math.floor(b.x / T);
      for (let ty = y0; ty <= y1; ty++) if (w.isSolid(tx, ty)) { b.x = (tx + 1) * T; b.hitX = true; break; }
    }
    if (b.hitX) { b.impactVX = b.vx; b.vx = 0; }
  }

  _moveY(b, dy) {
    if (dy === 0) return;
    const T = WORLD.TILE_PX; const E = PHYSICS.EPS; const w = this.world;
    b.y += dy;
    const x0 = Math.floor(b.x / T); const x1 = Math.floor((b.x + b.w - E) / T);
    if (dy > 0) {
      const ty = Math.floor((b.y + b.h - E) / T);
      for (let tx = x0; tx <= x1; tx++) if (w.isSolid(tx, ty)) { b.y = ty * T - b.h; b.hitY = true; b.onGround = true; break; }
    } else {
      const ty = Math.floor(b.y / T);
      for (let tx = x0; tx <= x1; tx++) if (w.isSolid(tx, ty)) { b.y = (ty + 1) * T; b.hitY = true; break; }
    }
    if (b.hitY) { b.impactVY = b.vy; b.vy = 0; }
  }

  /** Probe one pixel below the body to see whether it stands on ground. */
  grounded(b) {
    return this.overlapsSolid(b.x, b.y + b.h, b.w, 1);
  }
}
