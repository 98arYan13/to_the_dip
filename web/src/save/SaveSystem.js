/**
 * @module save/SaveSystem
 * Versioned, compressed, migratable saves in localStorage.
 * The world grid is RLE-compressed and base64-encoded per typed array, with an FNV-1a checksum.
 * The codec functions are pure and unit-tested.
 */
import { SAVE, WORLD, FLAG } from '../config.js';
import { computeBandStarts, bandMaterialAt } from '../world/WorldGen.js';

/** RLE as (count ≤ 255, value) byte pairs. @param {Uint8Array} bytes */
export function rleEncode(bytes) {
  const out = new Uint8Array(bytes.length * 2 + 2);
  let o = 0;
  let i = 0;
  while (i < bytes.length) {
    const v = bytes[i];
    let run = 1;
    while (i + run < bytes.length && bytes[i + run] === v && run < 255) run++;
    out[o++] = run; out[o++] = v;
    i += run;
  }
  return out.slice(0, o);
}

/** @param {Uint8Array} rle @param {number} length expected decoded length */
export function rleDecode(rle, length) {
  const out = new Uint8Array(length);
  let o = 0;
  for (let i = 0; i + 1 < rle.length; i += 2) {
    const run = rle[i]; const v = rle[i + 1];
    if (o + run > length) throw new Error('RLE overflow');
    out.fill(v, o, o + run);
    o += run;
  }
  if (o !== length) throw new Error('RLE length mismatch');
  return out;
}

/** @param {Uint8Array} u8 */
export function toBase64(u8) {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, /** @type {any} */ (u8.subarray(i, i + CH)));
  return btoa(s);
}

/** @param {string} b64 */
export function fromBase64(b64) {
  const s = atob(b64);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}

/** FNV-1a 32-bit over several byte arrays. @param {Uint8Array[]} arrays */
export function checksum(arrays) {
  let h = 0x811c9dc5;
  for (const a of arrays) for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** @param {ArrayBufferView} v */
const bytesOf = (v) => new Uint8Array(v.buffer, v.byteOffset, v.byteLength);

/**
 * Encode a world's grid. Transient flags (radar, dirty) are stripped.
 * @param {{W:number,H:number,tileType:Uint8Array,tileHP:Uint16Array,oreType:Uint8Array,flags:Uint8Array}} w
 */
export function encodeWorld(w) {
  const flags = new Uint8Array(w.flags);
  for (let i = 0; i < flags.length; i++) flags[i] &= ~(FLAG.RADAR_LIT | FLAG.DIRTY);
  const hp = bytesOf(w.tileHP);
  const parts = [w.tileType, hp, w.oreType, flags];
  return {
    W: w.W, H: w.H,
    tileType: toBase64(rleEncode(w.tileType)),
    tileHP: toBase64(rleEncode(hp)),
    oreType: toBase64(rleEncode(w.oreType)),
    flags: toBase64(rleEncode(flags)),
    sum: checksum(parts),
  };
}

/**
 * Decode a world grid; throws on corruption.
 * @param {ReturnType<typeof encodeWorld>} e @param {number} seed
 */
export function decodeWorld(e, seed) {
  const n = e.W * e.H;
  const tileType = rleDecode(fromBase64(e.tileType), n);
  const hpBytes = rleDecode(fromBase64(e.tileHP), n * 2);
  const oreType = rleDecode(fromBase64(e.oreType), n);
  const flags = rleDecode(fromBase64(e.flags), n);
  if (checksum([tileType, hpBytes, oreType, flags]) !== e.sum) throw new Error('World checksum mismatch');
  const tileHP = new Uint16Array(hpBytes.buffer.slice(0));
  // Band map is deterministic from the seed and not stored.
  const starts = computeBandStarts(seed, e.W, e.H);
  const band = new Uint8Array(n);
  for (let y = 0; y < e.H; y++) for (let x = 0; x < e.W; x++) band[y * e.W + x] = bandMaterialAt(starts, x, y, e.W);
  return { W: e.W, H: e.H, seed, tileType, tileHP, oreType, flags, band };
}

/**
 * Migration pipeline: each step upgrades a save object by one version.
 * v1 → v2: settings moved out of the save; economy.levels gained `radar` and `cargo`.
 * @param {any} save
 */
export function migrate(save) {
  let s = save;
  while (s.version < SAVE.VERSION) {
    const from = s.version;
    if (from === 1) {
      s = { ...s, version: 2 };
      delete s.settings;
      s.economy = { ...s.economy, levels: { radar: 0, cargo: 0, ...(s.economy?.levels || {}) } };
    } else throw new Error(`No migration from v${from}`);
  }
  return s;
}

/**
 * Build a save object.
 * @param {{seed:number, player:any, economy:any, world:any}} state
 */
export function serialize(state) {
  return JSON.stringify({
    version: SAVE.VERSION,
    seed: state.seed,
    player: state.player,
    economy: state.economy,
    world: encodeWorld(state.world),
  });
}

/**
 * Parse, migrate and validate a save string. Throws on corruption.
 * @param {string} str
 */
export function deserialize(str) {
  let s = JSON.parse(str);
  if (!s || typeof s.version !== 'number' || typeof s.seed !== 'number') throw new Error('Malformed save');
  if (s.version > SAVE.VERSION) throw new Error('Save from a newer version');
  s = migrate(s);
  if (s.world.W !== WORLD.W || s.world.H !== WORLD.H) throw new Error('World size mismatch');
  return { version: s.version, seed: s.seed >>> 0, player: s.player, economy: s.economy, world: decodeWorld(s.world, s.seed >>> 0) };
}

export class SaveSystem {
  /**
   * @param {Storage|{getItem:Function,setItem:Function,removeItem:Function}} storage
   * @param {string} [key]
   */
  constructor(storage, key = SAVE.KEY) {
    this.storage = storage;
    this.key = key;
    this.timer = 0;
  }

  /** @returns {boolean} */
  save(state) {
    try {
      this.storage.setItem(this.key, serialize(state));
      this.timer = 0;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * @returns {{ok:true, data:ReturnType<typeof deserialize>}|{ok:false, error:string|null}}
   * error is null when no save exists.
   */
  load() {
    let raw = null;
    try { raw = this.storage.getItem(this.key); } catch { return { ok: false, error: 'Storage unavailable' }; }
    if (!raw) return { ok: false, error: null };
    try { return { ok: true, data: deserialize(raw) }; }
    catch (e) { return { ok: false, error: /** @type {Error} */ (e).message }; }
  }

  clear() { try { this.storage.removeItem(this.key); } catch { /* ignore */ } }

  /**
   * Throttled autosave tick.
   * @param {number} dt @param {boolean} allowed @param {() => any} getState
   * @returns {boolean} saved this tick
   */
  tick(dt, allowed, getState) {
    this.timer += dt;
    if (this.timer < SAVE.AUTOSAVE_SEC || !allowed) return false;
    return this.save(getState());
  }
}
