/**
 * @module anim/Outfit
 * What the player wears (one wearable id + one colour per slot). Pure.
 */
export const WEAR_KINDS = ['hat', 'shirt', 'pants', 'boots', 'gloves'];

export function defaultOutfit() {
  return {
    hat: 'helmet', shirt: 'shirt_basic', pants: 'pants_basic', boots: 'boots_basic', gloves: /** @type {string|null} */ (null),
    colors: { hat: '#e8e2d0', shirt: '#d0662a', pants: '#2d3340', boots: '#1a1d24', gloves: '#6b4a2b' },
  };
}

/** Load-safe outfit: unknown/mismatched ids and malformed colours fall back to the defaults. @param {any} raw @param {{id:string, kind:string}[]} items */
export function sanitizeOutfit(raw, items) {
  const out = /** @type {any} */ (defaultOutfit());
  if (!raw || typeof raw !== 'object') return out;
  for (const k of WEAR_KINDS) {
    const v = raw[k];
    if (v === null || items.some((it) => it.id === v && it.kind === k)) out[k] = v;
    const c = raw.colors?.[k];
    if (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)) out.colors[k] = c;
  }
  return out;
}
