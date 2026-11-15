/**
 * @module ui/Minimap
 * ImageData-backed minimap (1 px per tile). Single pixels are updated on tile events; the
 * buffer is uploaded at most once per frame and copied to the HUD canvas centred on the player.
 */
import { UI, WORLD, TILE, FLAG, MATERIALS, ORES, SURFACE } from '../config.js';
import { hexToRgb, createCanvas, get2D } from '../render/canvas.js';
import { EV } from '../core/EventBus.js';
import { requiredTier } from '../systems/Mining.js';

export class Minimap {
  /**
   * @param {HTMLElement} parent
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(parent, bus) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'minimap';
    this.canvas.width = UI.MINIMAP_W;
    this.canvas.height = UI.MINIMAP_H;
    parent.appendChild(this.canvas);
    /** Enlarged view (click the minimap to toggle). */
    this.big = false;
    this.canvas.title = 'Click to enlarge';
    this.canvas.addEventListener('click', () => this.toggleBig());
    this.ctx = /** @type {CanvasRenderingContext2D} */ (this.canvas.getContext('2d'));
    this.ctx.imageSmoothingEnabled = false;
    this.buf = createCanvas(WORLD.W, WORLD.H);
    this.bctx = get2D(this.buf);
    this.img = this.bctx.createImageData(WORLD.W, WORLD.H);
    this.dirty = true;
    this.matRGB = MATERIALS.map((m) => (m.colors ? hexToRgb(m.colors.base) : [0, 0, 0]));
    this.oreRGB = ORES.map((o) => (o ? hexToRgb(o.colors.light) : [0, 0, 0]));
    this.oreCss = ORES.map((o) => (o ? o.colors.light : '#fff'));
    this.time = 0;
    /** @type {import('../world/World.js').World|null} */
    this.world = null;
    bus.on(EV.TILE_CHANGED, (i) => this.updateTile(i));
    bus.on(EV.TILE_DISCOVERED, (i) => this.updateTile(i));
  }

  /** Switch between the corner minimap and the enlarged one. */
  toggleBig(big = !this.big) {
    this.big = big;
    this.canvas.width = big ? UI.MINIMAP_BIG_W : UI.MINIMAP_W;
    this.canvas.height = big ? UI.MINIMAP_BIG_H : UI.MINIMAP_H;
    this.canvas.classList.toggle('big', big);
    this.canvas.title = big ? 'Click to shrink' : 'Click to enlarge';
    this.ctx.imageSmoothingEnabled = false;
  }

  /** @param {import('../world/World.js').World} world */
  setWorld(world) {
    this.world = world;
    for (let i = 0; i < world.W * world.H; i++) this.updateTile(i);
  }

  /** Recompute one pixel. */
  updateTile(i) {
    const w = this.world; if (!w) return;
    const d = this.img.data;
    const o = i * 4;
    const f = w.flags[i];
    const y = (i / w.W) | 0;
    let r = 0, g = 0, b = 0;
    if (y < WORLD.SURFACE_ROWS) { const c = hexToRgb(SURFACE.SKY_MID); r = c[0] * 0.6; g = c[1] * 0.6; b = c[2] * 0.6; }
    else if (f & FLAG.DISCOVERED) {
      const t = w.tileType[i];
      if (t === TILE.AIR) { r = 18; g = 16; b = 20; }
      else if (t === TILE.MAGMA) { r = 120; g = 30; b = 10; }
      else if (t === TILE.WATER) { r = 30; g = 70; b = 100; }
      else {
        const ore = w.oreType[i];
        const c = ore ? this.oreRGB[ore] : this.matRGB[t];
        const k = ore ? 0.8 : 0.55;
        r = c[0] * k; g = c[1] * k; b = c[2] * k;
      }
    }
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
    this.dirty = true;
  }

  /**
   * @param {number} dt
   * @param {number} ptx @param {number} pty player tile coords
   * @param {import('../world/Visibility.js').Visibility} vis
   * @param {number} pickTier
   */
  draw(dt, ptx, pty, vis, pickTier) {
    const w = this.world; if (!w) return;
    this.time += dt;
    if (this.dirty) { this.bctx.putImageData(this.img, 0, 0); this.dirty = false; }
    const s = this.big ? UI.MINIMAP_BIG_SCALE : UI.MINIMAP_SCALE;
    const W = this.canvas.width; const H = this.canvas.height;
    const vw = W / s; const vh = H / s;
    let sx = Math.round(ptx - vw / 2); let sy = Math.round(pty - vh / 2);
    sx = Math.max(0, Math.min(w.W - vw, sx));
    sy = Math.max(-4, Math.min(w.H - vh, sy));
    const ctx = this.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(/** @type {any} */ (this.buf), sx, Math.max(0, sy), vw, vh - Math.max(0, -sy), 0, Math.max(0, -sy) * s, W, H - Math.max(0, -sy) * s);
    // radar dots
    for (let k = 0; k < vis.radarCount; k++) {
      const i = vis.radarList[k];
      if (!(w.flags[i] & FLAG.RADAR_LIT)) continue;
      const x = i % w.W; const y = (i / w.W) | 0;
      const ore = w.oreType[i];
      if (!ore) continue;
      const locked = pickTier < requiredTier(w.tileType[i], ore);
      ctx.globalAlpha = locked ? 0.35 : 0.6 + 0.4 * Math.sin(this.time * 6 + i);
      ctx.fillStyle = this.oreCss[ore];
      ctx.fillRect((x - sx) * s - 1, (y - sy) * s - 1, 3, 3);
    }
    ctx.globalAlpha = 1;
    // base camp beacon
    const by = (WORLD.SURFACE_ROWS - 1 - sy) * s;
    if (by >= 0 && by < H) {
      ctx.fillStyle = Math.sin(this.time * 4) > 0 ? SURFACE.BEACON_SHOP : '#663';
      ctx.fillRect((WORLD.BASE_CAMP.SHOP_X - sx) * s - 1, by - 1, 3, 3);
      ctx.fillStyle = SURFACE.BEACON_STATION;
      ctx.fillRect((WORLD.BASE_CAMP.STATION_X - sx) * s - 1, by - 1, 3, 3);
    }
    // player
    if (Math.floor(this.time / UI.PLAYER_BLINK) % 2 === 0) {
      ctx.fillStyle = '#3ff0ff';
      ctx.fillRect((ptx - sx) * s - 1, (pty - sy) * s - 2, 3, 4);
    }
  }
}
