/**
 * @module render/TileArt
 * Procedural pixel textures for every material, ore, crack stage and edge overlay,
 * baked once at startup into a single atlas canvas.
 */
import { WORLD, TILE, ORE, FLAG, MATERIALS, ORES, RENDER, SURFACE, isOre } from '../config.js';
import { RNG, hash2 } from '../core/RNG.js';
import { createNoise2D, fbm } from '../core/Noise.js';
import { createCanvas, get2D, hexToRgb } from './canvas.js';

const T = WORLD.TILE_PX;
const N = T * T * 4;
const SOLID_TYPES = [TILE.SOIL, TILE.LIMESTONE, TILE.GRANITE, TILE.BASALT, TILE.MANTLE, TILE.BEDROCK, TILE.MAGMA, TILE.WATER, TILE.CORE, TILE.SAND];
const BAND_TYPES = [TILE.SOIL, TILE.LIMESTONE, TILE.GRANITE, TILE.BASALT, TILE.MANTLE, TILE.CORE];

/** Small RGBA painter for one 32×32 cell. */
class Cell {
  constructor() { this.d = new Uint8ClampedArray(N); }
  clear() { this.d.fill(0); }
  set(x, y, r, g, b, a = 255) {
    if (x < 0 || y < 0 || x >= T || y >= T) return;
    const o = (y * T + x) * 4;
    this.d[o] = r; this.d[o + 1] = g; this.d[o + 2] = b; this.d[o + 3] = a;
  }
  /** Alpha-blend a colour over the existing pixel. */
  blend(x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= T || y >= T) return;
    const o = (y * T + x) * 4;
    const d = this.d;
    const sa = a / 255;
    const da = d[o + 3] / 255;
    const oa = sa + da * (1 - sa);
    if (oa <= 0) return;
    d[o] = (r * sa + d[o] * da * (1 - sa)) / oa;
    d[o + 1] = (g * sa + d[o + 1] * da * (1 - sa)) / oa;
    d[o + 2] = (b * sa + d[o + 2] * da * (1 - sa)) / oa;
    d[o + 3] = oa * 255;
  }
  alphaAt(x, y) {
    if (x < 0 || y < 0 || x >= T || y >= T) return 0;
    return this.d[(y * T + x) * 4 + 3];
  }
}

/** @param {number[]} c @param {number} f */
function sh(c, f) { return [c[0] * f, c[1] * f, c[2] * f]; }
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

export class TileArt {
  /** @param {number} seed */
  constructor(seed = 1) {
    this.seed = seed;
    this.V = RENDER.ATLAS_VARIANTS;
    this.OV = RENDER.ORE_VARIANTS;
    this.cols = RENDER.ATLAS_COLS;
    this.cellCount = 0;
    /** @type {Record<number, number[]>} */ this.mat = {};
    /** @type {Record<number, number[]>} */ this.back = {};
    /** @type {Record<number, number[]>} */ this.ore = {};
    /** @type {number[]} */ this.crack = [];
    /** @type {number[]} */ this.rim = [];
    /** @type {number[]} */ this.ao = [];
    /** @type {number[]} */ this.grass = [];
    /** @type {number[]} */ this.moss = [];
    /** @type {number[]} */ this.fungi = [];
    this.sparkle = 0;
    const total = SOLID_TYPES.length * this.V + BAND_TYPES.length * this.V + ORES.filter((o, i) => isOre(i)).length * this.OV + 4 + 4 + 4 + this.V * 3 + 1;
    const rows = Math.ceil(total / this.cols);
    this.canvas = createCanvas(this.cols * T, rows * T);
    this.ctx = get2D(this.canvas);
    this.cell = new Cell();
    this.drawCalls = 0;
    this._bake();
  }

  /**
   * Overlay hand-drawn tiles (web/public/tiles, cut by tools/crop_tiles.py) onto the procedural
   * material/ore cells once they load. Missing images keep the procedural art.
   * @param {() => void} onChange called after each image is drawn into the atlas
   */
  loadImages(onChange) {
    const put = (name, cells) => {
      const img = new Image();
      img.onload = () => { for (const c of cells) this.ctx.drawImage(img, this.sx(c), this.sy(c), T, T); onChange(); };
      img.src = `tiles/${name}.png`;
    };
    for (const t of SOLID_TYPES) {
      const tiles = MATERIALS[t].tiles;
      if (tiles) tiles.forEach((name, k) => put(name, this.mat[t].filter((_, v) => v % tiles.length === k)));
    }
    for (let o = 1; o < ORES.length; o++) { const t = /** @type {any} */ (ORES[o]).tile; if (t) put(t, this.ore[o]); }
  }

  _alloc() { return this.cellCount++; }
  sx(c) { return (c % this.cols) * T; }
  sy(c) { return Math.floor(c / this.cols) * T; }

  /** @param {number} c */
  _commit(c) {
    const img = new ImageData(this.cell.d, T, T);
    this.ctx.putImageData(img, this.sx(c), this.sy(c));
    this.cell = new Cell();
  }

  _bake() {
    for (const t of SOLID_TYPES) {
      this.mat[t] = [];
      for (let v = 0; v < this.V; v++) {
        const c = this._alloc();
        this._paintMaterial(t, v, true);
        this._commit(c);
        this.mat[t].push(c);
      }
    }
    for (const t of BAND_TYPES) {
      this.back[t] = [];
      for (let v = 0; v < this.V; v++) {
        const c = this._alloc();
        this._paintMaterial(t, v + 50, false);
        this._toBackwall();
        this._commit(c);
        this.back[t].push(c);
      }
    }
    for (let o = 1; o < ORES.length; o++) {
      this.ore[o] = [];
      if (!isOre(o)) continue; // materials never sit in the world
      for (let v = 0; v < this.OV; v++) {
        const c = this._alloc();
        this._paintOre(o, v);
        this._commit(c);
        this.ore[o].push(c);
      }
    }
    const crackPts = this._crackPattern();
    for (let s = 1; s <= 4; s++) {
      const c = this._alloc();
      this._paintCrack(crackPts, s);
      this._commit(c);
      this.crack.push(c);
    }
    for (let dir = 0; dir < 4; dir++) { const c = this._alloc(); this._paintRim(dir); this._commit(c); this.rim.push(c); }
    for (let dir = 0; dir < 4; dir++) { const c = this._alloc(); this._paintAO(dir); this._commit(c); this.ao.push(c); }
    for (let v = 0; v < this.V; v++) {
      let c = this._alloc(); this._paintGrass(v); this._commit(c); this.grass.push(c);
      c = this._alloc(); this._paintMoss(v); this._commit(c); this.moss.push(c);
      c = this._alloc(); this._paintFungi(v); this._commit(c); this.fungi.push(c);
    }
    this.sparkle = this._alloc();
    this._paintSparkle();
    this._commit(this.sparkle);
  }

  /**
   * @param {number} type @param {number} v variant @param {boolean} bevel
   */
  _paintMaterial(type, v, bevel) {
    const m = MATERIALS[type];
    const col = {
      base: hexToRgb(m.colors.base), dark: hexToRgb(m.colors.dark), light: hexToRgb(m.colors.light),
      accent: hexToRgb(m.colors.accent), extra: hexToRgb(m.colors.extra),
    };
    const rng = new RNG(hash2(type, v, this.seed + 77));
    const n1 = createNoise2D(type * 131 + v * 17 + 1);
    const n2 = createNoise2D(type * 977 + v * 29 + 5);
    const cell = this.cell;
    const colOff = rng.int(0, 7);
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const n = fbm(n1, (x + v * 37) * 0.15, (y + v * 11) * 0.15, 3);
        let shade = 1 + n * 0.22 + (rng.float() - 0.5) * 0.08;
        let c = col.base;
        let a = 255;
        switch (type) {
          case TILE.SOIL: {
            const k = fbm(n2, x * 0.3, y * 0.3, 2);
            if (k > 0.32) c = col.dark; else if (k < -0.38) c = col.light; else if (k > 0.18) c = col.accent;
            break;
          }
          case TILE.LIMESTONE: {
            const s = Math.sin((y + n * 5) * 0.9 + v);
            if (s > 0.86) c = col.dark; else if (s < -0.93) c = col.light; else if (s > 0.6) c = col.accent;
            break;
          }
          case TILE.GRANITE: {
            const r = rng.float();
            if (r < 0.08) c = col.accent; else if (r < 0.13) c = hexToRgb('#dde1e6'); else if (r < 0.16) c = col.extra;
            break;
          }
          case TILE.BASALT: {
            const seam = (x + colOff + Math.floor(n * 3)) % 8 === 0;
            const joint = (y + ((Math.floor((x + colOff) / 8) * 7) % 11)) % 11 === 0;
            if (seam || joint) c = col.dark; else if (rng.float() < 0.04) c = col.extra;
            break;
          }
          case TILE.MANTLE: {
            if (((x + y + Math.floor(n * 6)) % 13) === 0) c = col.light;
            const r = 1 - Math.abs(fbm(n2, x * 0.09 + v, y * 0.09, 3));
            if (r > 0.975) { c = col.extra; shade = 1; } else if (r > 0.94) { c = col.accent; shade = 1; }
            break;
          }
          case TILE.SAND: {
            const r = rng.float();
            if (r < 0.1) c = col.light; else if (r < 0.2) c = col.accent; else if (r < 0.23) c = col.extra;
            if (((y + Math.floor(n * 4)) % 6) === 0) c = col.dark;
            break;
          }
          case TILE.BEDROCK: {
            if (((x - y) & 7) === 0) c = col.light; else if (rng.float() < 0.06) c = col.dark;
            break;
          }
          case TILE.MAGMA: {
            const t = (fbm(n2, x * 0.12 + v, y * 0.12, 3) + 1) * 0.5;
            c = t < 0.35 ? mix(col.dark, col.base, t / 0.35) : t < 0.7 ? mix(col.base, col.light, (t - 0.35) / 0.35) : mix(col.light, col.accent, (t - 0.7) / 0.3);
            if (fbm(n1, x * 0.2, y * 0.2, 2) > 0.38) c = col.dark;
            shade = 1;
            break;
          }
          case TILE.WATER: {
            a = 150;
            if (Math.abs(Math.sin(x * 0.5 + n * 4 + y * 0.2)) > 0.95) { c = col.light; a = 190; }
            if (y === 0) { c = col.accent; a = 200; }
            break;
          }
          default: break;
        }
        if (bevel && type !== TILE.WATER && type !== TILE.MAGMA) {
          if (x === 0 || y === 0) shade *= 1.08;
          else if (x === T - 1 || y === T - 1) shade *= 0.9;
        }
        const cc = sh(c, shade);
        cell.set(x, y, cc[0], cc[1], cc[2], a);
      }
    }

    // Features
    if (type === TILE.SOIL) {
      const roots = rng.int(0, 2);
      const rc = col.extra;
      for (let r = 0; r < roots; r++) {
        let x = rng.int(3, 28); let y = 0;
        const len = rng.int(10, 20);
        for (let s = 0; s < len; s++) {
          cell.set(x, y, rc[0], rc[1], rc[2]);
          y++; x += rng.int(-1, 1);
        }
      }
      const pebbles = rng.int(2, 4);
      for (let p = 0; p < pebbles; p++) this._blob(rng.int(3, 28), rng.int(3, 28), rng.range(1, 2), [154, 138, 116]);
    } else if (type === TILE.LIMESTONE && v % 3 === 0) {
      // Ammonite fossil
      const cx = rng.int(9, 22); const cy = rng.int(9, 22);
      const fc = col.extra; const dc = col.dark;
      for (let a = 0; a < Math.PI * 4.2; a += 0.12) {
        const r = 1 + a * 0.55;
        const px = Math.round(cx + Math.cos(a) * r);
        const py = Math.round(cy + Math.sin(a) * r);
        cell.set(px, py, fc[0], fc[1], fc[2]);
        cell.set(px + 1, py + 1, dc[0], dc[1], dc[2]);
      }
    } else if (type === TILE.LIMESTONE && v % 3 === 1) {
      const fc = col.extra;
      for (let s = 0; s < 4; s++) { const x = rng.int(3, 28); const y = rng.int(3, 28); cell.set(x, y, fc[0], fc[1], fc[2]); cell.set(x + 1, y, fc[0], fc[1], fc[2]); }
    }
  }

  _blob(cx, cy, r, c) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const dx = x - cx; const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) {
        const f = dx + dy < 0 ? 1.15 : 0.85;
        this.cell.set(x, y, c[0] * f, c[1] * f, c[2] * f);
      }
    }
  }

  _toBackwall() {
    const d = this.cell.d;
    const b = RENDER.BACKWALL_BRIGHTNESS;
    for (let o = 0; o < N; o += 4) {
      const l = (d[o] + d[o + 1] + d[o + 2]) / 3;
      d[o] = (d[o] * 0.7 + l * 0.3) * b;
      d[o + 1] = (d[o + 1] * 0.7 + l * 0.3) * b;
      d[o + 2] = (d[o + 2] * 0.7 + l * 0.3) * b * 1.1;
      d[o + 3] = 255;
    }
  }

  _paintOre(o, v) {
    const ore = /** @type {any} */ (ORES[o]);
    const base = hexToRgb(ore.colors.base); const light = hexToRgb(ore.colors.light);
    const spec = hexToRgb(ore.colors.spec); const dark = hexToRgb(ore.colors.dark);
    const rng = new RNG(hash2(o, v, this.seed + 991));
    const cell = this.cell;
    const blobs = ore.crystal ? rng.int(2, 3) : rng.int(3, 5);
    for (let k = 0; k < blobs; k++) {
      const cx = rng.int(6, 25); const cy = rng.int(6, 25);
      const r = o === ORE.COAL ? rng.range(2.6, 4.2) : ore.crystal ? rng.range(2.8, 4) : rng.range(1.7, 3.3);
      for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
        for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
          const dx = x - cx; const dy = y - cy;
          const d = ore.crystal ? Math.abs(dx) + Math.abs(dy) * 0.8 : Math.sqrt(dx * dx + dy * dy);
          if (d > r) continue;
          let c;
          if (ore.crystal) {
            c = dx <= 0 && dy <= 0 ? light : dx > 0 && dy > 0 ? dark : base;
            if (dx === 0 || dy === 0) c = mix(c, spec, 0.4);
          } else {
            const lt = (-dx - dy) / (r * 1.4);
            c = lt > 0.45 ? light : lt < -0.4 ? dark : base;
            if (o === ORE.COPPER && rng.float() < 0.22) c = spec;
          }
          cell.set(x, y, c[0], c[1], c[2], 255);
        }
      }
      if (o !== ORE.COAL && o !== ORE.COPPER) {
        const sx = Math.round(cx - r * 0.4); const sy = Math.round(cy - r * 0.4);
        cell.set(sx, sy, spec[0], spec[1], spec[2]);
      }
    }
    // outline
    const copy = new Uint8ClampedArray(cell.d);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      if (copy[(y * T + x) * 4 + 3] > 0) continue;
      const nb = (xx, yy) => xx >= 0 && yy >= 0 && xx < T && yy < T && copy[(yy * T + xx) * 4 + 3] > 0;
      if (nb(x - 1, y) || nb(x + 1, y) || nb(x, y - 1) || nb(x, y + 1)) cell.set(x, y, 0, 0, 0, 95);
    }
    if (ore.glint >= 0.5) {
      const sparks = ore.crystal ? 3 : 1;
      for (let s = 0; s < sparks; s++) {
        const x = rng.int(4, 27); const y = rng.int(4, 27);
        if (cell.alphaAt(x, y) < 200) continue;
        cell.set(x, y, 255, 255, 255);
        cell.blend(x - 1, y, 255, 255, 255, 140); cell.blend(x + 1, y, 255, 255, 255, 140);
        cell.blend(x, y - 1, 255, 255, 255, 140); cell.blend(x, y + 1, 255, 255, 255, 140);
      }
    }
  }

  /** Branching crack pattern; points are ordered so stages can reveal progressively. */
  _crackPattern() {
    const rng = new RNG(hash2(3, 7, this.seed + 404));
    /** @type {number[]} */
    const pts = [];
    const walk = (x, y, ang, len, depth) => {
      for (let s = 0; s < len; s++) {
        x += Math.cos(ang); y += Math.sin(ang);
        ang += rng.range(-0.5, 0.5);
        const px = Math.round(x); const py = Math.round(y);
        if (px < 1 || py < 1 || px > T - 2 || py > T - 2) return;
        pts.push(px, py);
        if (depth < 2 && rng.chance(0.12)) walk(x, y, ang + rng.range(-1.2, 1.2), Math.floor(len * 0.5), depth + 1);
      }
    };
    const rays = 5;
    for (let r = 0; r < rays; r++) walk(16 + rng.range(-2, 2), 16 + rng.range(-2, 2), (r / rays) * Math.PI * 2 + rng.range(-0.4, 0.4), rng.int(8, 15), 0);
    return pts;
  }

  _paintCrack(pts, stage) {
    const fracs = [0.3, 0.55, 0.8, 1];
    const count = Math.floor((pts.length / 2) * fracs[stage - 1]);
    for (let k = 0; k < count; k++) {
      const x = pts[k * 2]; const y = pts[k * 2 + 1];
      this.cell.set(x, y, 12, 9, 8, 215);
      if (this.cell.alphaAt(x + 1, y + 1) === 0) this.cell.set(x + 1, y + 1, 255, 255, 255, 40);
    }
  }

  /** Exposed-face bevel. dir 0=top,1=right,2=bottom,3=left. */
  _paintRim(dir) {
    for (let k = 0; k < 4; k++) {
      for (let s = 0; s < T; s++) {
        let x, y;
        if (dir === 0) { x = s; y = k; } else if (dir === 1) { x = T - 1 - k; y = s; } else if (dir === 2) { x = s; y = T - 1 - k; } else { x = k; y = s; }
        if (dir === 0) {
          if (k === 0) this.cell.set(x, y, 255, 255, 255, 70);
          else if (k === 1) this.cell.set(x, y, 255, 255, 255, 25);
        } else {
          const a = [120, 75, 40, 18][k];
          this.cell.set(x, y, 0, 0, 0, a);
        }
      }
    }
  }

  /** Ambient occlusion on open-air backwall next to solid. */
  _paintAO(dir) {
    const depth = 9;
    for (let k = 0; k < depth; k++) {
      const a = Math.round(170 * Math.pow(1 - k / depth, 2));
      for (let s = 0; s < T; s++) {
        let x, y;
        if (dir === 0) { x = s; y = k; } else if (dir === 1) { x = T - 1 - k; y = s; } else if (dir === 2) { x = s; y = T - 1 - k; } else { x = k; y = s; }
        this.cell.set(x, y, 0, 0, 0, a);
      }
    }
  }

  _paintGrass(v) {
    const rng = new RNG(hash2(v, 1, this.seed + 12));
    const g = hexToRgb(SURFACE.GRASS); const gd = hexToRgb(SURFACE.GRASS_DARK);
    for (let x = 0; x < T; x++) {
      const h = rng.int(3, 6);
      for (let y = 0; y < h; y++) {
        const c = y === 0 ? sh(g, 1.25) : y < h - 1 ? g : gd;
        this.cell.set(x, y, c[0], c[1], c[2]);
      }
      if (rng.chance(0.15)) this.cell.set(x, h, gd[0], gd[1], gd[2]);
    }
    for (let f = 0; f < 2; f++) if (rng.chance(0.5)) {
      const x = rng.int(2, 29);
      this.cell.set(x, 1, 240, 200, 90); this.cell.set(x, 0, 255, 230, 120);
    }
  }

  _paintMoss(v) {
    const rng = new RNG(hash2(v, 2, this.seed + 13));
    for (let y = 0; y < 8; y++) for (let x = 0; x < T; x++) {
      if (rng.float() < 0.55 * (1 - y / 8)) {
        const c = rng.chance(0.5) ? [79, 122, 58] : [111, 154, 74];
        this.cell.set(x, y, c[0], c[1], c[2], 230);
      }
    }
  }

  _paintFungi(v) {
    const rng = new RNG(hash2(v, 3, this.seed + 14));
    const cap = hexToRgb('#2fe0b0'); const bright = hexToRgb('#b8fff0');
    const count = rng.int(2, 3);
    for (let k = 0; k < count; k++) {
      const x = rng.int(4, 27);
      const stem = rng.int(2, 3);
      for (let s = 0; s < stem; s++) this.cell.set(x, 4 - s + 2, 200, 220, 210);
      const w = rng.int(1, 2);
      for (let dx = -w; dx <= w; dx++) this.cell.set(x + dx, 3 - stem + 2, cap[0], cap[1], cap[2]);
      this.cell.set(x, 2 - stem + 2, bright[0], bright[1], bright[2]);
    }
    for (let k = 0; k < 6; k++) this.cell.set(rng.int(1, 30), rng.int(1, 30), cap[0], cap[1], cap[2], 160);
  }

  _paintSparkle() {
    const c = 16;
    for (let k = -5; k <= 5; k++) {
      const a = Math.round(255 * (1 - Math.abs(k) / 6));
      this.cell.set(c + k, c, 255, 255, 255, a);
      this.cell.set(c, c + k, 255, 255, 255, a);
    }
    this.cell.set(c - 1, c - 1, 255, 255, 255, 120); this.cell.set(c + 1, c + 1, 255, 255, 255, 120);
    this.cell.set(c - 1, c + 1, 255, 255, 255, 120); this.cell.set(c + 1, c - 1, 255, 255, 255, 120);
  }

  /** @param {CanvasRenderingContext2D} ctx */
  blit(ctx, c, dx, dy) {
    ctx.drawImage(/** @type {any} */ (this.canvas), this.sx(c), this.sy(c), T, T, dx, dy, T, T);
    this.drawCalls++;
  }

  drawLadder(ctx, dx, dy) {
    ctx.fillStyle = '#8a5a2b'; ctx.fillRect(dx + 6, dy, 3, 32); ctx.fillRect(dx + 23, dy, 3, 32);
    ctx.fillStyle = '#b98046'; for (let k = 3; k < 32; k += 8) ctx.fillRect(dx + 6, dy + k, 20, 3);
  }

  /**
   * Draw one tile (used by chunk rebuilds).
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('../world/World.js').World} w
   */
  drawTile(ctx, w, x, y, dx, dy) {
    const i = y * w.W + x;
    const t = w.tileType[i];
    const h = hash2(x, y, w.seed);
    const v = h % this.V;
    if (t === TILE.AIR || t === TILE.WATER || t === TILE.LADDER) {
      if (y < WORLD.SURFACE_ROWS) { if (t === TILE.LADDER) this.drawLadder(ctx, dx, dy); return; } // ladder dropped in the sky
      const b = w.band[i] || TILE.SOIL;
      this.blit(ctx, this.back[b][v], dx, dy);
      if (t === TILE.WATER) this.blit(ctx, this.mat[TILE.WATER][v], dx, dy);
      if (t === TILE.LADDER) this.drawLadder(ctx, dx, dy);
      if (w.isSolid(x, y - 1)) this.blit(ctx, this.ao[0], dx, dy);
      if (w.isSolid(x + 1, y)) this.blit(ctx, this.ao[1], dx, dy);
      if (w.isSolid(x, y + 1)) this.blit(ctx, this.ao[2], dx, dy);
      if (w.isSolid(x - 1, y)) this.blit(ctx, this.ao[3], dx, dy);
      return;
    }
    if (t === TILE.MAGMA) { this.blit(ctx, this.mat[TILE.MAGMA][v], dx, dy); return; }
    this.drawSolid(ctx, w, i, dx, dy, v);
    if (!w.isSolid(x, y - 1)) {
      this.blit(ctx, this.rim[0], dx, dy);
      if (t === TILE.SOIL && y === WORLD.SURFACE_ROWS) this.blit(ctx, this.grass[v], dx, dy);
    }
    if (!w.isSolid(x + 1, y)) this.blit(ctx, this.rim[1], dx, dy);
    if (!w.isSolid(x, y + 1)) this.blit(ctx, this.rim[2], dx, dy);
    if (!w.isSolid(x - 1, y)) this.blit(ctx, this.rim[3], dx, dy);
    const f = w.flags[i];
    if (f & FLAG.MOSS) this.blit(ctx, this.moss[v], dx, dy);
    if (f & FLAG.FUNGI) this.blit(ctx, this.fungi[v], dx, dy);
    if (f & FLAG.UNSTABLE) this.blit(ctx, this.crack[2], dx, dy);
  }

  /** Material + ore only (also used for the recoil redraw). */
  drawSolid(ctx, w, i, dx, dy, v = -1) {
    const t = w.tileType[i];
    if (!this.mat[t]) return;
    if (v < 0) v = hash2(i % w.W, (i / w.W) | 0, w.seed) % this.V;
    this.blit(ctx, this.mat[t][v], dx, dy);
    const o = w.oreType[i];
    if (o) this.blit(ctx, this.ore[o][(v + o) % this.OV], dx, dy);
  }

  /** @param {number} stage 1..4 */
  drawCrack(ctx, stage, dx, dy) { this.blit(ctx, this.crack[stage - 1], dx, dy); }
}
