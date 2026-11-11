/**
 * @module world/ChunkCache
 * Pre-renders 16×16-tile chunks to offscreen canvases. Only dirty, visible chunks are rebuilt,
 * with a per-frame budget (never-built visible chunks are always built so nothing pops in).
 */
import { WORLD, RENDER, FLAG } from '../config.js';
import { createCanvas, get2D } from '../render/canvas.js';

export class ChunkCache {
  /**
   * @param {import('./World.js').World} world
   * @param {import('../render/TileArt.js').TileArt} art
   */
  constructor(world, art) {
    this.art = art;
    this.size = WORLD.CHUNK;
    this.px = this.size * WORLD.TILE_PX;
    this.rebuildsThisFrame = 0;
    this.totalRebuilds = 0;
    this.setWorld(world);
  }

  /** @param {import('./World.js').World} world */
  setWorld(world) {
    this.world = world;
    this.cw = Math.ceil(world.W / this.size);
    this.ch = Math.ceil(world.H / this.size);
    if (!this.canvases || this.canvases.length !== this.cw * this.ch) {
      /** @type {(OffscreenCanvas|HTMLCanvasElement|null)[]} */
      this.canvases = new Array(this.cw * this.ch).fill(null);
      /** @type {(CanvasRenderingContext2D|null)[]} */
      this.contexts = new Array(this.cw * this.ch).fill(null);
    }
    this.dirty = new Uint8Array(this.cw * this.ch).fill(1);
    this.built = new Uint8Array(this.cw * this.ch);
  }

  /** Mark the chunk(s) containing a tile and its neighbours dirty (edge overlays depend on neighbours). */
  markTileDirty(i) {
    const w = this.world;
    const x = i % w.W; const y = (i / w.W) | 0;
    w.flags[i] |= FLAG.DIRTY;
    const s = this.size;
    const cx0 = Math.max(0, Math.floor((x - 1) / s)); const cx1 = Math.min(this.cw - 1, Math.floor((x + 1) / s));
    const cy0 = Math.max(0, Math.floor((y - 1) / s)); const cy1 = Math.min(this.ch - 1, Math.floor((y + 1) / s));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) this.dirty[cy * this.cw + cx] = 1;
  }

  markAllDirty() { this.dirty.fill(1); }

  /**
   * Rebuild visible chunks as needed. Tile range is inclusive.
   * @returns {number} rebuilds performed
   */
  update(tx0, ty0, tx1, ty1, maxRebuilds = RENDER.MAX_CHUNK_REBUILDS) {
    this.rebuildsThisFrame = 0;
    const s = this.size;
    const cx0 = Math.max(0, Math.floor(tx0 / s)); const cx1 = Math.min(this.cw - 1, Math.floor(tx1 / s));
    const cy0 = Math.max(0, Math.floor(ty0 / s)); const cy1 = Math.min(this.ch - 1, Math.floor(ty1 / s));
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const ci = cy * this.cw + cx;
        if (!this.built[ci]) this._rebuild(cx, cy);
        else if (this.dirty[ci] && this.rebuildsThisFrame < maxRebuilds) this._rebuild(cx, cy);
      }
    }
    return this.rebuildsThisFrame;
  }

  _rebuild(cx, cy) {
    const ci = cy * this.cw + cx;
    let c = this.canvases[ci];
    let g = this.contexts[ci];
    if (!c) {
      c = createCanvas(this.px, this.px);
      g = get2D(c);
      this.canvases[ci] = c;
      this.contexts[ci] = g;
    }
    const ctx = /** @type {CanvasRenderingContext2D} */ (g);
    ctx.clearRect(0, 0, this.px, this.px);
    const w = this.world;
    const T = WORLD.TILE_PX;
    const x0 = cx * this.size; const y0 = cy * this.size;
    for (let ty = 0; ty < this.size; ty++) {
      const y = y0 + ty;
      if (y >= w.H) break;
      for (let tx = 0; tx < this.size; tx++) {
        const x = x0 + tx;
        if (x >= w.W) break;
        this.art.drawTile(ctx, w, x, y, tx * T, ty * T);
        w.flags[y * w.W + x] &= ~FLAG.DIRTY;
      }
    }
    this.dirty[ci] = 0;
    this.built[ci] = 1;
    this.rebuildsThisFrame++;
    this.totalRebuilds++;
  }

  /**
   * Draw visible chunks in world coordinates (ctx already transformed).
   * @param {CanvasRenderingContext2D} ctx
   * @returns {number} draw calls
   */
  draw(ctx, tx0, ty0, tx1, ty1) {
    const s = this.size;
    const cx0 = Math.max(0, Math.floor(tx0 / s)); const cx1 = Math.min(this.cw - 1, Math.floor(tx1 / s));
    const cy0 = Math.max(0, Math.floor(ty0 / s)); const cy1 = Math.min(this.ch - 1, Math.floor(ty1 / s));
    let calls = 0;
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const c = this.canvases[cy * this.cw + cx];
        if (!c) continue;
        ctx.drawImage(/** @type {any} */ (c), cx * this.px, cy * this.px);
        calls++;
      }
    }
    return calls;
  }
}
