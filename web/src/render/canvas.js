/**
 * @module render/canvas
 * Canvas helpers: OffscreenCanvas with HTMLCanvasElement fallback, colour parsing.
 */

/**
 * @param {number} w @param {number} h
 * @returns {OffscreenCanvas|HTMLCanvasElement}
 */
export function createCanvas(w, h) {
  w = Math.max(1, Math.ceil(w));
  h = Math.max(1, Math.ceil(h));
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** @param {OffscreenCanvas|HTMLCanvasElement} c @returns {CanvasRenderingContext2D} */
export function get2D(c, opts) {
  const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d', opts));
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

/** @param {string} hex '#rrggbb' @returns {[number,number,number]} */
export function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** @returns {string} */
export function rgbStr(r, g, b, a = 1) {
  return a >= 1 ? `rgb(${r | 0},${g | 0},${b | 0})` : `rgba(${r | 0},${g | 0},${b | 0},${a})`;
}

/**
 * Bake a radial light sprite (colour → transparent).
 * @param {string} color @param {number} size
 */
export function makeRadialSprite(color, size, coreStop = 0.0) {
  const c = createCanvas(size, size);
  const g = get2D(c);
  const [r, gg, b] = hexToRgb(color);
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, rgbStr(r, gg, b, 1));
  grad.addColorStop(Math.max(0.01, coreStop), rgbStr(r, gg, b, 0.85));
  grad.addColorStop(0.45, rgbStr(r, gg, b, 0.35));
  grad.addColorStop(1, rgbStr(r, gg, b, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}
