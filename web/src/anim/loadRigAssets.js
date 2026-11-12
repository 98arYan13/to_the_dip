/**
 * @module anim/loadRigAssets
 * Fetches rig.json, anims.json, wearables.json and wearable sprites. Resolves null (never throws) on any failure
 * so the game can fall back to the old sheet.
 */
import { loadRig } from './Rig.js';

/** @returns {Promise<{rig:import('./Rig.js').Rig, clips:any, items:any[], images:Map<string, HTMLImageElement>}|null>} */
export async function loadRigAssets(fetchFn = fetch, base = 'rig/') {
  try {
    const get = async (/** @type {string} */ n) => {
      const r = await fetchFn(base + n);
      if (!r.ok) throw new Error(`${n}: HTTP ${r.status}`);
      return r.json();
    };
    const [rigData, clips, wear] = await Promise.all([get('rig.json'), get('anims.json'), get('wearables.json')]);
    const rig = loadRig(rigData);
    const items = wear.items;
    /** @type {Map<string, HTMLImageElement>} */ const images = new Map();
    if (typeof Image !== 'undefined') {
      const names = new Set();
      for (const it of items) for (const b in it.parts) if (it.parts[b].sprite) names.add(it.parts[b].sprite);
      await Promise.all([...names].map((n) => new Promise((res, rej) => {
        const i = new Image(); i.onload = () => { images.set(n, i); res(0); }; i.onerror = () => rej(new Error(`sprite ${n}`)); i.src = base + n;
      })));
    }
    return { rig, clips, items, images };
  } catch (e) {
    console.warn('rig assets unavailable, using sprite sheet:', e);
    return null;
  }
}
