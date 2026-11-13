/**
 * @module core/EventBus
 * Typed pub/sub used to decouple systems. Event names live in EV.
 * Tile-level events pass a plain tile index (number) to avoid allocations.
 */

export const EV = Object.freeze({
  TILE_CHANGED: 'tile:changed',          // payload: tile index
  TILE_DISCOVERED: 'tile:discovered',    // payload: tile index
  RADAR_TILE: 'radar:tile',              // payload: tile index (radar lit state changed)
  MINE_HIT: 'mine:hit',                  // payload: MineHit (reused object)
  MINE_BLOCKED: 'mine:blocked',          // payload: MineHit (reused object)
  BLOCK_BROKEN: 'block:broken',          // payload: MineHit (reused object)
  ORE_COLLECTED: 'ore:collected',        // payload: ore id
  CARGO_CHANGED: 'cargo:changed',
  CARGO_FULL: 'cargo:full',
  CREDITS_CHANGED: 'credits:changed',    // payload: credits
  ENERGY_CHANGED: 'energy:changed',      // payload: {value,max}
  LOW_ENERGY: 'energy:low',
  HARD_LANDING: 'player:hardLanding',    // payload: {damage, tiles, vy}
  HP_CHANGED: 'player:hp',               // payload: hp
  PLAYER_DEAD: 'player:dead',            // payload: cause string
  SWING: 'player:swing',
  RESCUE: 'energy:rescue',
  LADDER_STEP: 'player:ladderStep',     // a rung climbed
  DEPTH_CHANGED: 'depth:changed',        // payload: {meters, layer}
  UPGRADE_BOUGHT: 'upgrade:bought',      // payload: {kind, level}
  CONSUMABLES_CHANGED: 'consumables:changed',
  CONSUMABLE_USED: 'consumable:used',    // payload: kind
  RADAR_PULSE: 'radar:pulse',            // payload: {x,y,radius}
  DYNAMITE_THROWN: 'dynamite:thrown',    // payload: {x,y}
  EXPLOSION: 'explosion',                // payload: {x,y}
  TELEPORT_START: 'teleport:start',
  TELEPORT: 'teleport',                  // payload: {x,y}
  TOAST: 'toast',                        // payload: {text, kind}
  HINT: 'hint',                          // payload: string
  SHOP_OPEN: 'shop:open',
  SHOP_CLOSE: 'shop:close',
  SOLD: 'shop:sold',                     // payload: {total}
  PURCHASE_FAILED: 'shop:fail',
  PAUSE_CHANGED: 'pause:changed',        // payload: boolean
  SETTINGS_CHANGED: 'settings:changed',  // payload: settings object
  SAVED: 'save:done',
  HOVER_TILE: 'hover:tile',              // payload: tile index or -1
  PROMPT: 'prompt',                      // payload: string|null
  FOOTSTEP: 'footstep',                  // payload: material id
  PICKUP: 'pickup',                      // payload: ore id
  ORE_DROPPED: 'ore:dropped',
  NEW_GAME: 'game:new',
  STATION_FULL: 'station:full',
  QUAKE_WARN: 'quake:warn',              // payload: {strength}
  QUAKE: 'quake',                        // payload: {strength}
  COMPLETED: 'game:completed',           // the Core was stabilized
  ACHIEVEMENT: 'achievement',            // payload: {id}
  TILE_WARN: 'tile:warn',                // payload: {x,y} unstable tile cracking
  TILE_FELL: 'tile:fell',                // payload: {x,y} new position
  TILE_CRUSH: 'tile:crush',              // payload: {x,y} a falling tile landed on the player
});

/**
 * @typedef {Object} MineHit
 * @property {number} i tile index
 * @property {number} x tile x
 * @property {number} y tile y
 * @property {number} type tile type
 * @property {number} ore ore id
 * @property {number} nx impact normal x
 * @property {number} ny impact normal y
 * @property {number} stage crack stage 0..4
 * @property {string} hint requirement hint (blocked only)
 */

export class EventBus {
  constructor() {
    /** @type {Map<string, Function[]>} */
    this.map = new Map();
  }

  /**
   * @param {string} type
   * @param {(payload:any)=>void} fn
   * @returns {() => void} unsubscribe
   */
  on(type, fn) {
    let list = this.map.get(type);
    if (!list) { list = []; this.map.set(type, list); }
    list.push(fn);
    return () => this.off(type, fn);
  }

  /** @param {string} type @param {Function} fn */
  off(type, fn) {
    const list = this.map.get(type);
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }

  /** @param {string} type @param {any} [payload] */
  emit(type, payload) {
    const list = this.map.get(type);
    if (!list) return;
    for (let i = 0; i < list.length; i++) list[i](payload);
  }
}
