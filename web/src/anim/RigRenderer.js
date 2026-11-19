/**
 * @module anim/RigRenderer
 * Composes a posed rig + outfit into one 96x96 canvas (nearest, angles snapped to the rig's step).
 * Helpers are pure; canvas creation is lazy so the module imports in node.
 */
import { WEAR_KINDS } from './Outfit.js';

const OUTLINE = '#1a1d24';
const PICK_SCALE = 0.7;

/** @typedef {{bone:number, layer:number, kind:'part'|'wear'|'pick'|'jetpack', sprite:string|null, pivot:[number,number], color:string, tint:boolean, rect:[number,number,number,number]}} DrawItem rect = [start, length, width, lateral offset] along the bone */

export function snapAngle(rad, stepDeg) {
  const s = stepDeg * Math.PI / 180;
  return Math.round(rad / s) * s;
}

/** @param {import('./Rig.js').Rig} rig @param {any} outfit @param {{id:string, parts:any}[]} items @returns {DrawItem[]} */
export function buildDrawList(rig, outfit, items) {
  /** @type {DrawItem[]} */ const list = [];
  rig.bones.forEach((b, i) => list.push({ bone: i, layer: b.layer, kind: 'part', sprite: b.sprite ?? null, pivot: b.pivot ?? [0, 0], color: b.color, tint: false, rect: [0, b.length, b.width, 0] }));
  for (const k of WEAR_KINDS) {
    const item = outfit[k] && items.find((it) => it.id === outfit[k]);
    if (!item) continue;
    for (const name in item.parts) {
      const i = rig.index.get(name); if (i === undefined) continue;
      const part = item.parts[name]; const b = rig.bones[i];
      list.push({ bone: i, layer: b.layer + 0.5, kind: 'wear', sprite: part.sprite, pivot: part.pivot, color: outfit.colors[k], tint: part.tint, rect: part.rect || [0, b.length, b.width, 0] });
    }
  }
  const t = /** @type {number} */ (rig.index.get('torso')); const h = /** @type {number} */ (rig.index.get('handF'));
  list.push({ bone: t, layer: rig.bones[t].layer - 0.5, kind: 'jetpack', sprite: null, pivot: [0, 0], color: '#6b7280', tint: false, rect: [5, 24, 15, -14] });
  list.push({ bone: h, layer: rig.bones[h].layer - 0.25, kind: 'pick', sprite: null, pivot: [0, 0], color: '#ffffff', tint: false, rect: [0, 0, 0, 0] });
  return list.map((d, i) => [d, i]).sort((a, b) => /** @type {any} */ (a[0]).layer - /** @type {any} */ (b[0]).layer || /** @type {any} */ (a[1]) - /** @type {any} */ (b[1])).map((x) => /** @type {DrawItem} */ (x[0]));
}

/** Rig px of empty margin on each side of the canvas, so a swung pick reaching past the 96px box is not cut off. */
export const PAD = 48;

export class RigRenderer {
  /** @param {import('./Rig.js').Rig} rig @param {any[]} items @param {Map<string, HTMLImageElement>} images */
  constructor(rig, items, images) {
    this.rig = rig; this.items = items; this.images = images;
    /** @type {HTMLCanvasElement|null} */ this.canvas = null;
    /** @type {Map<string, HTMLCanvasElement>} */ this.tinted = new Map();
  }

  _tint(sprite, color) {
    const key = `${sprite}|${color}`;
    let c = this.tinted.get(key);
    if (c) return c;
    const img = /** @type {HTMLImageElement} */ (this.images.get(sprite));
    c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
    g.imageSmoothingEnabled = false;
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'multiply'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(img, 0, 0);
    this.tinted.set(key, c);
    return c;
  }

  /** @param {import('./Rig.js').WorldPose} world @param {any} outfit @param {{sprite:HTMLCanvasElement|null, angle:number, color:string}} pick @param {HTMLImageElement|null} [pack] backpack sprite drawn instead of the grey box */
  render(world, outfit, pick, pack = null) {
    const rig = this.rig;
    if (!this.canvas) {
      this.canvas = document.createElement('canvas'); this.canvas.width = this.canvas.height = rig.canvas + 2 * PAD;
    }
    const ctx = /** @type {CanvasRenderingContext2D} */ (this.canvas.getContext('2d'));
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, PAD, PAD);
    ctx.clearRect(-PAD, -PAD, rig.canvas + 2 * PAD, rig.canvas + 2 * PAD);
    for (const d of buildDrawList(rig, outfit, this.items)) {
      ctx.save();
      ctx.translate(Math.round(world.x[d.bone]), Math.round(world.y[d.bone]));
      if (d.kind === 'pick') {
        ctx.rotate(pick.angle);
        ctx.scale(PICK_SCALE, PICK_SCALE); // art was drawn too big next to the 84px body
        if (pick.sprite) ctx.drawImage(pick.sprite, -3, -pick.sprite.height / 2); // grip at the left-middle
        ctx.restore(); continue;
      }
      ctx.rotate(snapAngle(world.a[d.bone], rig.angleStep));
      if (d.kind === 'jetpack' && pack) {
        // Upright backpack sprite (back on the left): undo the torso's rest angle, hang it behind the spine.
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(pack, -24, -17 - pack.naturalHeight / 2);
        ctx.restore(); continue;
      }
      const img = d.sprite && this.images.get(d.sprite);
      if (img) ctx.drawImage(d.tint ? this._tint(d.sprite, d.color) : img, -d.pivot[0], -d.pivot[1]);
      else {
        const [s, len, w, off = 0] = d.rect;
        ctx.fillStyle = OUTLINE; ctx.fillRect(s - 1, off - w / 2 - 1, len + 2, w + 2);
        ctx.fillStyle = d.color; ctx.fillRect(s, off - w / 2, len, w);
      }
      ctx.restore();
    }
    return this.canvas;
  }
}
