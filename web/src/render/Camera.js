/**
 * @module render/Camera
 * Critically damped spring follow and trauma-based screen shake (shake = trauma²).
 */
import { CAMERA, WORLD } from '../config.js';
import { createNoise2D } from '../core/Noise.js';

/**
 * Screen px per world px: the integer base scale for this canvas height times the zoom multiplier.
 * @param {number} canvasH backing-store height @param {number} zoom
 */
export function viewScale(canvasH, zoom) {
  const base = Math.max(1, Math.round(canvasH / CAMERA.VIEW_HEIGHT_TARGET));
  return Math.max(0.5, base * zoom);
}

export class Camera {
  constructor() {
    /** Centre position in world px. */
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.prevX = 0; this.prevY = 0;
    this.trauma = 0;
    this.shakeEnabled = true;
    this.shakeX = 0; this.shakeY = 0;
    this.time = 0;
    this.noise = createNoise2D(4242);
    /** View size in world px (set by Renderer). */
    this.viewW = 960; this.viewH = 540;
  }

  /** @param {number} amount 0..1 */
  addTrauma(amount) { this.trauma = Math.min(1, this.trauma + amount); }

  snap(x, y) { this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.prevX = x; this.prevY = y; }

  /**
   * @param {number} dt @param {number} tx @param {number} ty target centre
   */
  update(dt, tx, ty) {
    this.prevX = this.x; this.prevY = this.y;
    const w = CAMERA.OMEGA;
    // Critically damped spring: a = w²(target - x) - 2w v
    const ax = w * w * (tx - this.x) - 2 * w * this.vx;
    const ay = w * w * (ty - this.y) - 2 * w * this.vy;
    this.vx += ax * dt; this.vy += ay * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this._clamp();
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - CAMERA.TRAUMA_DECAY * dt);
    const s = this.shakeEnabled ? this.trauma * this.trauma * CAMERA.MAX_SHAKE : 0;
    const f = this.time * CAMERA.SHAKE_FREQ;
    this.shakeX = s * this.noise(f, 0.5);
    this.shakeY = s * this.noise(0.5, f + 100);
  }

  _clamp() {
    const T = WORLD.TILE_PX;
    const hw = this.viewW / 2; const hh = this.viewH / 2;
    const minX = hw; const maxX = WORLD.W * T - hw;
    this.x = maxX < minX ? (WORLD.W * T) / 2 : Math.min(maxX, Math.max(minX, this.x));
    const minY = -CAMERA.TOP_MARGIN + hh; const maxY = WORLD.H * T - hh;
    this.y = Math.min(maxY, Math.max(minY, this.y));
  }

  /** Interpolated top-left of the view in world px. */
  left(alpha) { return this.prevX + (this.x - this.prevX) * alpha - this.viewW / 2 + this.shakeX; }
  top(alpha) { return this.prevY + (this.y - this.prevY) * alpha - this.viewH / 2 + this.shakeY; }
}
