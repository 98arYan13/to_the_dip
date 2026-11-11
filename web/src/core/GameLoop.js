/**
 * @module core/GameLoop
 * Fixed-timestep loop: 60 Hz updates, interpolated rendering, bounded catch-up.
 */
import { LOOP } from '../config.js';

export class GameLoop {
  /**
   * @param {{update:(dt:number)=>void, render:(alpha:number, frameDt:number)=>void}} hooks
   */
  constructor(hooks) {
    this.update = hooks.update;
    this.render = hooks.render;
    this.step = LOOP.STEP;
    this.acc = 0;
    this.last = 0;
    this.running = false;
    this.rafId = 0;
    this.updateMs = 0;
    this.renderMs = 0;
    this.frameMs = 16.7;
    this.fps = 60;
    this._frame = this._frame.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.rafId = requestAnimationFrame(this._frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  /** @param {number} ts */
  _frame(ts) {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this._frame);
    let dt = (ts - this.last) / 1000;
    this.last = ts;
    if (dt > LOOP.MAX_FRAME_DT) dt = LOOP.MAX_FRAME_DT;
    if (dt < 0) dt = 0;
    this.frameMs = this.frameMs * 0.9 + dt * 1000 * 0.1;
    this.fps = this.frameMs > 0 ? 1000 / this.frameMs : 0;

    this.acc += dt;
    let steps = 0;
    const t0 = performance.now();
    while (this.acc >= this.step && steps < LOOP.MAX_STEPS) {
      this.update(this.step);
      this.acc -= this.step;
      steps++;
    }
    if (steps >= LOOP.MAX_STEPS) this.acc = 0;
    const t1 = performance.now();
    this.render(this.acc / this.step, dt);
    const t2 = performance.now();
    this.updateMs = this.updateMs * 0.9 + (t1 - t0) * 0.1;
    this.renderMs = this.renderMs * 0.9 + (t2 - t1) * 0.1;
  }
}
