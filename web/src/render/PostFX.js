/**
 * @module render/PostFX
 * Screen-space effects: heat shimmer near magma, depth-based colour grading, vignette,
 * low-energy pulse and film grain. Everything is cached; nothing allocates per frame.
 */
import { POSTFX } from '../config.js';
import { createCanvas, get2D, rgbStr } from './canvas.js';

export class PostFX {
  constructor() {
    this.w = 1; this.h = 1;
    this.vignette = createCanvas(1, 1);
    this.lowVignette = createCanvas(1, 1);
    this.grain = createCanvas(POSTFX.GRAIN_SIZE, POSTFX.GRAIN_SIZE);
    this._bakeGrain();
    /** @type {CanvasPattern|null} */
    this.grainPattern = null;
    this.grainEnabled = true;
    this.shimmerEnabled = true;
    this.reducedFlashing = false;
    this.grades = [];
    const g = POSTFX.GRADES;
    const stops = [0, 0.35, 0.6, 1];
    for (let k = 0; k < POSTFX.GRADE_STEPS; k++) {
      const d = k / (POSTFX.GRADE_STEPS - 1);
      let s = 0;
      while (s < stops.length - 2 && d > stops[s + 1]) s++;
      const t = (d - stops[s]) / (stops[s + 1] - stops[s]);
      const a = g[s]; const b = g[s + 1];
      this.grades.push(rgbStr(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t));
    }
    this.seed = 1;
  }

  _bakeGrain() {
    const s = POSTFX.GRAIN_SIZE;
    const g = get2D(this.grain);
    const img = g.createImageData(s, s);
    for (let i = 0; i < s * s; i++) {
      const v = (Math.random() * 255) | 0;
      img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }

  /** @param {number} w @param {number} h device px */
  resize(w, h) {
    this.w = Math.max(1, w); this.h = Math.max(1, h);
    this._bakeVignette(this.vignette, '0,0,0', POSTFX.VIGNETTE);
    this._bakeVignette(this.lowVignette, '200,20,20', 0.6);
    this.grainPattern = null;
  }

  _bakeVignette(c, rgb, strength) {
    c.width = this.w; c.height = this.h;
    const g = get2D(c);
    const r = Math.hypot(this.w, this.h) / 2;
    const grad = g.createRadialGradient(this.w / 2, this.h / 2, r * 0.45, this.w / 2, this.h / 2, r);
    grad.addColorStop(0, `rgba(${rgb},0)`);
    grad.addColorStop(1, `rgba(${rgb},${strength})`);
    g.fillStyle = grad;
    g.fillRect(0, 0, this.w, this.h);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx main context
   * @param {HTMLCanvasElement} canvas
   * @param {{depth:number, time:number, scale:number, energyFrac:number, lowThreshold:number}} s
   */
  render(ctx, canvas, s) {
    let calls = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    // Heat shimmer (mantle)
    if (this.shimmerEnabled && s.depth > POSTFX.SHIMMER_START) {
      const k = Math.min(1, (s.depth - POSTFX.SHIMMER_START) / (1 - POSTFX.SHIMMER_START));
      const n = POSTFX.SHIMMER_STRIPS;
      const sh = Math.ceil(this.h / n);
      for (let i = 0; i < n; i++) {
        const y = i * sh;
        const off = Math.round(Math.sin(s.time * 3 + i * 0.7) * POSTFX.SHIMMER_AMP * s.scale * k);
        if (off === 0) continue;
        ctx.drawImage(canvas, 0, y, this.w, sh, off, y, this.w, sh);
        calls++;
      }
    }
    // Depth grade
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = POSTFX.GRADE_ALPHA * 2;
    ctx.fillStyle = this.grades[Math.max(0, Math.min(POSTFX.GRADE_STEPS - 1, Math.round(s.depth * (POSTFX.GRADE_STEPS - 1))))];
    ctx.fillRect(0, 0, this.w, this.h);
    calls++;
    // Vignette
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(/** @type {any} */ (this.vignette), 0, 0);
    calls++;
    if (s.energyFrac < s.lowThreshold) {
      ctx.globalAlpha = this.reducedFlashing ? 0.4 : 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(s.time * 6));
      ctx.drawImage(/** @type {any} */ (this.lowVignette), 0, 0);
      calls++;
    }
    // Film grain
    if (this.grainEnabled) {
      if (!this.grainPattern) this.grainPattern = ctx.createPattern(/** @type {any} */ (this.grain), 'repeat');
      this.seed = (this.seed * 16807) % 2147483647;
      const ox = this.seed % POSTFX.GRAIN_SIZE; const oy = (this.seed >> 8) % POSTFX.GRAIN_SIZE;
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = POSTFX.GRAIN_ALPHA * 2;
      ctx.fillStyle = /** @type {CanvasPattern} */ (this.grainPattern);
      ctx.setTransform(1, 0, 0, 1, -ox, -oy);
      ctx.fillRect(ox, oy, this.w, this.h);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      calls++;
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    return calls;
  }
}
