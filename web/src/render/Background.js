/**
 * @module render/Background
 * Surface dusk sky, 3-layer parallax (mountains, hills, trees), drifting clouds, bird flocks,
 * floating pollen, and the Expedition Base Camp buildings with animated beacons.
 */
import { SURFACE, WORLD, CAMERA } from '../config.js';
import { RNG } from '../core/RNG.js';
import { createNoise2D, fbm } from '../core/Noise.js';
import { createCanvas, get2D, hexToRgb } from './canvas.js';

const T = WORLD.TILE_PX;
const GROUND = WORLD.SURFACE_ROWS * T;
const LAYER_W = 1024;

export class Background {
  constructor(seed = 7) {
    this.rng = new RNG(seed);
    this.time = 0;
    this.sky = this._makeSky();
    this.layers = [
      this._makeLayer(SURFACE.MOUNTAIN, 150, 0.004, 0.9, 11, false),
      this._makeLayer(SURFACE.HILL, 95, 0.008, 0.6, 23, false),
      this._makeLayer(SURFACE.TREE, 70, 0.02, 0.25, 37, true),
    ];
    this.cloudSprites = [this._makeCloud(1), this._makeCloud(2), this._makeCloud(3)];
    this.clouds = [];
    for (let k = 0; k < SURFACE.CLOUD_COUNT; k++) {
      this.clouds.push({ x: this.rng.range(0, LAYER_W * 2), y: this.rng.range(-CAMERA.TOP_MARGIN, GROUND - 140), s: this.rng.int(0, 2), speed: this.rng.range(4, 12) });
    }
    this.birdTimer = this.rng.range(SURFACE.BIRD_INTERVAL[0], SURFACE.BIRD_INTERVAL[1]) * 0.3;
    this.flock = { active: false, x: 0, y: 0, dir: 1, n: 0, speed: 0 };
    this.pollenTimer = 0;
    const bc = WORLD.BASE_CAMP;
    /** Beacons consumed by Lighting. */
    this.beacons = [
      { x: (bc.SHOP_X + 0.5) * T, y: GROUND - 74, color: SURFACE.BEACON_SHOP, phase: 0, on: 1 },
      { x: (bc.STATION_X + 0.5) * T, y: GROUND - 58, color: SURFACE.BEACON_STATION, phase: 1.3, on: 1 },
      { x: (bc.SHAFT_X + 1) * T, y: GROUND - 124, color: SURFACE.BEACON_RIG, phase: 2.1, on: 1 },
    ];
  }

  _makeSky() {
    const h = 256;
    const c = createCanvas(1, h);
    const g = get2D(c);
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, SURFACE.SKY_TOP);
    grad.addColorStop(0.55, SURFACE.SKY_MID);
    grad.addColorStop(1, SURFACE.SKY_HORIZON);
    g.fillStyle = grad;
    g.fillRect(0, 0, 1, h);
    return c;
  }

  _makeLayer(color, height, freq, rough, seed, trees) {
    const c = createCanvas(LAYER_W, height);
    const g = get2D(c);
    const n = createNoise2D(seed);
    g.fillStyle = color;
    if (!trees) {
      for (let x = 0; x < LAYER_W; x++) {
        // seamless: blend noise at x and x - LAYER_W
        const t = x / LAYER_W;
        const a = fbm(n, x * freq, 0.5, 4) * (1 - t) + fbm(n, (x - LAYER_W) * freq, 0.5, 4) * t;
        const top = Math.round(height * (0.35 + a * rough * 0.6));
        g.fillRect(x, Math.max(0, top), 1, height - top);
      }
    } else {
      const rng = new RNG(seed);
      g.fillRect(0, height - 8, LAYER_W, 8);
      for (let x = 4; x < LAYER_W - 8; x += rng.int(10, 26)) {
        const th = rng.int(26, height - 6);
        const tw = rng.int(8, 14);
        // pine silhouette made of stacked triangles (pixel rows)
        for (let y = 0; y < th; y++) {
          const w = Math.max(1, Math.round((y / th) * tw * (0.7 + 0.3 * ((y % 9) / 9))));
          g.fillRect(x - Math.floor(w / 2) + 6, height - 6 - th + y, w, 1);
        }
        g.fillRect(x + 5, height - 8, 2, 4);
      }
    }
    return c;
  }

  _makeCloud(seed) {
    const w = 120; const h = 40;
    const c = createCanvas(w, h);
    const g = get2D(c);
    const rng = new RNG(seed * 91);
    const [r, gg, b] = hexToRgb(SURFACE.CLOUD);
    for (let k = 0; k < 9; k++) {
      const cx = rng.range(20, w - 20); const cy = rng.range(14, h - 10);
      const rx = rng.range(10, 26); const ry = rng.range(6, 11);
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
        const dy = (y - cy) / ry;
        const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - dy * dy)));
        const shade = y > cy ? 0.82 : 1;
        g.fillStyle = `rgba(${(r * shade) | 0},${(gg * shade) | 0},${(b * shade) | 0},0.55)`;
        g.fillRect(Math.round(cx - half), y, half * 2, 1);
      }
    }
    return c;
  }

  /**
   * @param {number} dt
   * @param {number} camL @param {number} camT @param {number} viewW
   * @param {import('./Particles.js').Particles} particles
   */
  update(dt, camL, camT, viewW, particles) {
    this.time += dt;
    for (const c of this.clouds) {
      c.x += c.speed * dt;
      if (c.x > LAYER_W * 2) c.x -= LAYER_W * 2 + 120;
    }
    for (const b of this.beacons) b.on = 0.5 + 0.5 * Math.sin(this.time * 3 + b.phase) > 0.35 ? 1 : 0.25;
    const surfaceVisible = camT < GROUND;
    // Birds
    if (!this.flock.active) {
      this.birdTimer -= dt;
      if (this.birdTimer <= 0 && surfaceVisible) {
        const f = this.flock;
        f.active = true; f.dir = this.rng.chance(0.5) ? 1 : -1;
        f.x = f.dir > 0 ? camL - 60 : camL + viewW + 60;
        f.y = this.rng.range(Math.max(-CAMERA.TOP_MARGIN + 20, camT + 20), GROUND - 120);
        f.n = this.rng.int(SURFACE.BIRD_COUNT[0], SURFACE.BIRD_COUNT[1]);
        f.speed = this.rng.range(40, 70);
        this.birdTimer = this.rng.range(SURFACE.BIRD_INTERVAL[0], SURFACE.BIRD_INTERVAL[1]);
      }
    } else {
      const f = this.flock;
      f.x += f.dir * f.speed * dt;
      if (f.x < camL - 300 || f.x > camL + viewW + 300) f.active = false;
    }
    // Pollen / dust motes
    if (surfaceVisible) {
      this.pollenTimer -= dt;
      if (this.pollenTimer <= 0) {
        this.pollenTimer = 1 / SURFACE.MOTES;
        particles.pollen(camL + this.rng.range(0, viewW), this.rng.range(Math.max(camT, -CAMERA.TOP_MARGIN), GROUND - 4));
      }
    }
  }

  get birdsActive() { return this.flock.active; }

  /**
   * Draw (ctx in world transform). Returns draw calls.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx, camL, camT, viewW, viewH) {
    let calls = 0;
    if (camT >= GROUND) return 0;
    const skyTop = -SURFACE.SKY_EXTRA_PX;
    ctx.drawImage(/** @type {any} */ (this.sky), 0, 0, 1, 256, camL - 1, skyTop, viewW + 2, GROUND - skyTop); calls++;
    // clouds (slow parallax)
    for (const c of this.clouds) {
      const x = camL - ((camL * 0.1) % (LAYER_W * 2)) + c.x - LAYER_W * 0.5;
      ctx.drawImage(/** @type {any} */ (this.cloudSprites[c.s]), Math.round(x), Math.round(c.y + (camT + CAMERA.TOP_MARGIN) * 0.05)); calls++;
    }
    // parallax layers
    for (let k = 0; k < this.layers.length; k++) {
      const layer = this.layers[k];
      const f = SURFACE.LAYER_PARALLAX[k];
      const off = ((camL * f) % LAYER_W + LAYER_W) % LAYER_W;
      const y = GROUND - layer.height + 2;
      for (let x = camL - off; x < camL + viewW; x += LAYER_W) { ctx.drawImage(/** @type {any} */ (layer), Math.round(x), y); calls++; }
    }
    // birds
    if (this.flock.active) {
      const f = this.flock;
      ctx.fillStyle = SURFACE.TREE;
      for (let b = 0; b < f.n; b++) {
        const row = Math.ceil(b / 2); const side = b % 2 ? -1 : 1;
        const bx = f.x - f.dir * row * 10; const by = f.y + side * row * 6;
        const flap = Math.sin(this.time * 10 + b) > 0 ? -1 : 1;
        ctx.fillRect(Math.round(bx) - 3, Math.round(by) + flap, 3, 1);
        ctx.fillRect(Math.round(bx), Math.round(by), 1, 1);
        ctx.fillRect(Math.round(bx) + 1, Math.round(by) + flap, 3, 1);
        calls += 3;
      }
    }
    calls += this._drawBaseCamp(ctx);
    return calls;
  }

  /** @param {CanvasRenderingContext2D} ctx */
  _drawBaseCamp(ctx) {
    const bc = WORLD.BASE_CAMP;
    let calls = 0;
    const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); calls++; };
    // Trading Post
    const sx = (bc.SHOP_X - 1) * T; const sw = 3 * T;
    r(sx + 4, GROUND - 56, sw - 8, 56, '#5a3b22');
    for (let p = 0; p < 6; p++) r(sx + 4, GROUND - 56 + p * 9, sw - 8, 1, '#3e2716');
    r(sx - 2, GROUND - 64, sw + 4, 8, '#7c2f22');
    r(sx + 6, GROUND - 72, sw - 12, 8, '#8f3a2a');
    r(sx + 12, GROUND - 40, 18, 14, '#ffcf7a');
    r(sx + 20, GROUND - 40, 2, 14, '#5a3b22');
    r(sx + 54, GROUND - 34, 18, 34, '#2c1c10');
    r(sx + 10, GROUND - 54, sw - 20, 10, '#e8d7b0');
    ctx.fillStyle = '#3a2614';
    ctx.font = '7px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText('TRADING POST', sx + 13, GROUND - 53); calls++;
    // Energy Recharge Station
    const ex = (bc.STATION_X - 0.5) * T;
    r(ex + 6, GROUND - 52, 36, 52, '#39414f');
    r(ex + 10, GROUND - 46, 28, 18, '#0d2b33');
    const glow = 0.5 + 0.5 * Math.sin(this.time * 2.2);
    r(ex + 13, GROUND - 43, Math.round(22 * glow) + 1, 4, '#3ff0ff');
    r(ex + 13, GROUND - 36, 22, 2, '#1d8a99');
    r(ex + 4, GROUND - 6, 40, 6, '#2a303b');
    r(ex + 22, GROUND - 58, 4, 6, '#9aa4b5');
    // Drilling rig over the shaft entrance
    const rx = bc.SHAFT_X * T;
    const top = GROUND - 120;
    ctx.fillStyle = '#6b6f7a';
    ctx.fillRect(rx + 4, top, 3, 120); ctx.fillRect(rx + 57, top, 3, 120); calls += 2;
    for (let y = top; y < GROUND; y += 16) {
      ctx.fillRect(rx + 4, y, 56, 2); calls++;
      for (let k = 0; k < 16; k += 2) { ctx.fillRect(rx + 6 + k * 3.2, y + k, 3, 1); calls++; }
    }
    r(rx + 26, top - 4, 12, 4, '#9a9fab');
    r(rx + 30, top, 4, 110 - ((this.time * 20) % 30), '#40444d');
    // Beacons
    for (const b of this.beacons) r(b.x - 2, b.y - 2, 4, 4, b.on > 0.5 ? b.color : '#333');
    return calls;
  }
}

export const GROUND_PX = GROUND;
