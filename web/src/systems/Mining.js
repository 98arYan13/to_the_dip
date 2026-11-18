/**
 * @module systems/Mining
 * Damage, tier gating, cracks and drops. Gating rules are pure functions (unit-tested).
 */
import { TILE, ORE, MATERIALS, ORES, PICKAXES, MINING, WORLD, DYNAMITE, PLANETS } from '../config.js';
import { EV } from '../core/EventBus.js';
import { relicIdAt } from '../world/Ruins.js';

/** Ground under the base camp buildings stays solid so the camp and spawn point never float. */
export function isCampGround(x, y) {
  const b = WORLD.BASE_CAMP;
  return x >= b.PAD_X0 && x <= b.PAD_X1 && y >= WORLD.SURFACE_ROWS && y < WORLD.SURFACE_ROWS + b.PAD_DEPTH;
}

/** Required pickaxe tier for a tile: max(hostRock.tier, ore.tier). */
export function requiredTier(type, ore) {
  const m = MATERIALS[type];
  if (!m || !m.solid) return 0;
  const o = ore ? /** @type {any} */ (ORES[ore]).tier : 0;
  return Math.max(m.tier, o);
}

/** Can the pickaxe of `pickTier` damage this tile? Bedrock never. */
export function canMine(type, ore, pickTier) {
  if (type === TILE.BEDROCK) return false;
  const m = MATERIALS[type];
  if (!m || !m.solid) return false;
  return pickTier >= requiredTier(type, ore);
}

/** Damage per hit (0 if gated). */
export function hitDamage(type, ore, pickTier) {
  if (!canMine(type, ore, pickTier)) return 0;
  return PICKAXES[pickTier - 1].damage;
}

/** Crack stage 0..4 from remaining HP. */
export function crackStage(hp, maxHp) {
  if (maxHp <= 0 || hp >= maxHp) return 0;
  const dmg = 1 - hp / maxHp;
  const s = MINING.CRACK_STAGES;
  if (dmg >= s[3]) return 4;
  if (dmg >= s[2]) return 3;
  if (dmg >= s[1]) return 2;
  if (dmg >= s[0]) return 1;
  return 0;
}

/** Human-readable gating hint, e.g. "Requires Steel Pickaxe". */
export function requirementHint(type, ore) {
  if (type === TILE.BEDROCK) return 'Bedrock is indestructible';
  if (type === TILE.ALIEN_HULL) return 'Alien hull — only a Big Bomb breaks it';
  const t = requiredTier(type, ore);
  if (ore === ORE.DIAMOND) return 'Only diamond cuts diamond: requires Diamond-Tipped Drill';
  return `Requires ${PICKAXES[Math.min(PICKAXES.length, t) - 1].name}`;
}

export const CAMP_HINT = 'Base camp foundation — dig outside the camp';

export const DYN_KEEP = 0;
export const DYN_DESTROY = 1;
export const DYN_COLLECT = 2;

/**
 * Dynamite outcome for one tile. Host rock breaks only up to pickTier+1;
 * ores are collected only when the pickaxe meets their tier, otherwise the tile stays (exposed).
 * Never bypasses the diamond gate or bedrock.
 * @returns {0|1|2}
 */
export function dynamiteOutcome(type, ore, pickTier, big = false) {
  const m = MATERIALS[type];
  if (type === TILE.RELIC) return DYN_KEEP;
  if (type === TILE.ALIEN_HULL) return big ? DYN_DESTROY : DYN_KEEP;
  if (!m || !m.solid || type === TILE.BEDROCK) return DYN_KEEP;
  if (m.tier > pickTier + 1) return DYN_KEEP;
  if (type === TILE.CORE && pickTier < m.tier) return DYN_KEEP; // the Core needs the tier-6 drill, no bomb shortcut
  if (ore) {
    const ot = /** @type {any} */ (ORES[ore]).tier;
    if (pickTier < ot) return DYN_KEEP;
    return DYN_COLLECT;
  }
  return DYN_DESTROY;
}

export class Mining {
  /**
   * @param {import('../world/World.js').World} world
   * @param {import('../core/EventBus.js').EventBus} bus
   * @param {import('./Economy.js').Economy} economy
   * @param {import('../world/Visibility.js').Visibility} vis
   * @param {{spawn:(x:number,y:number,ore:number)=>void}} pickups
   */
  constructor(world, bus, economy, vis, pickups) {
    this.world = world;
    this.bus = bus;
    this.economy = economy;
    this.vis = vis;
    this.pickups = pickups;
    this.hintCooldown = 0;
    /** Damaged tile indices (for crack overlays). */
    this.damaged = new Int32Array(MINING.MAX_DAMAGED_TRACKED);
    this.damagedCount = 0;
    this.recoilTile = -1;
    this.recoilTimer = 0;
    this.recoilNX = 0; this.recoilNY = 0;
    /** @type {import('../core/EventBus.js').MineHit} */
    this.hit = { i: 0, x: 0, y: 0, type: 0, ore: 0, nx: 0, ny: 0, stage: 0, hint: '' };
  }

  /** @param {import('../world/World.js').World} world */
  setWorld(world) { this.world = world; this.damagedCount = 0; this.recoilTile = -1; }

  update(dt) {
    if (this.hintCooldown > 0) this.hintCooldown -= dt;
    if (this.recoilTimer > 0) { this.recoilTimer -= dt; if (this.recoilTimer <= 0) this.recoilTile = -1; }
  }

  /**
   * First solid tile along the aim ray within reach.
   * @returns {number} tile index or -1
   */
  findTarget(cx, cy, aimX, aimY) {
    let dx = aimX - cx; let dy = aimY - cy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return -1;
    dx /= len; dy /= len;
    const max = Math.min(MINING.REACH, len + WORLD.TILE_PX * 0.5);
    const d = this.world.raycast(cx, cy, dx, dy, max);
    if (d >= max) return -1;
    return this.world.lastHit;
  }

  /**
   * Apply one pickaxe hit.
   * @param {number} i tile index @param {number} fromX @param {number} fromY striker position
   * @returns {'blocked'|'hit'|'broken'|'none'}
   */
  strike(i, fromX, fromY) {
    const w = this.world;
    const type = w.tileType[i];
    if (!MATERIALS[type].solid) return 'none';
    const ore = w.oreType[i];
    const T = w.T;
    const x = i % w.W; const y = (i / w.W) | 0;
    const h = this.hit;
    let nx = fromX - (x * T + T / 2); let ny = fromY - (y * T + T / 2);
    const nl = Math.sqrt(nx * nx + ny * ny) || 1;
    nx /= nl; ny /= nl;
    if (Math.abs(nx) > Math.abs(ny)) { nx = Math.sign(nx); ny = 0; } else { ny = Math.sign(ny); nx = 0; }
    h.i = i; h.x = x; h.y = y; h.type = type; h.ore = ore; h.nx = nx; h.ny = ny; h.hint = '';
    const tier = this.economy.pickTier;
    const camp = isCampGround(x, y);
    let dmg = camp ? 0 : hitDamage(type, ore, tier);
    if (this.god && dmg > 0) dmg = w.tileHP[i]; // god mode: one hit breaks anything breakable
    if (dmg <= 0) {
      h.stage = crackStage(w.tileHP[i], w.maxHP(i));
      if (this.hintCooldown <= 0) {
        h.hint = camp ? CAMP_HINT : requirementHint(type, ore);
        this.hintCooldown = MINING.HINT_COOLDOWN;
        this.bus.emit(EV.HINT, h.hint);
      }
      this.bus.emit(EV.MINE_BLOCKED, h);
      return 'blocked';
    }
    const hp = Math.max(0, w.tileHP[i] - dmg);
    w.tileHP[i] = hp;
    this.recoilTile = i; this.recoilTimer = MINING.RECOIL_TIME; this.recoilNX = -nx; this.recoilNY = -ny;
    if (hp <= 0) { this.breakTile(i, true); return 'broken'; }
    this._trackDamaged(i);
    h.stage = crackStage(hp, w.maxHP(i));
    this.bus.emit(EV.MINE_HIT, h);
    return 'hit';
  }

  _trackDamaged(i) {
    for (let k = 0; k < this.damagedCount; k++) if (this.damaged[k] === i) return;
    if (this.damagedCount < this.damaged.length) this.damaged[this.damagedCount++] = i;
  }

  _untrack(i) {
    for (let k = 0; k < this.damagedCount; k++) {
      if (this.damaged[k] === i) { this.damaged[k] = this.damaged[--this.damagedCount]; return; }
    }
  }

  /**
   * Destroy a tile and collect (or drop) its ore.
   * @param {number} i @param {boolean} collectOre
   */
  breakTile(i, collectOre) {
    const w = this.world;
    const h = this.hit;
    const type = w.tileType[i];
    const ore = w.oreType[i];
    const x = i % w.W; const y = (i / w.W) | 0;
    w.clear(i);
    if (type === TILE.RELIC) {
      const planetId = w.planet ?? 'earth';
      const id = relicIdAt(planetId, y, w.H);
      if (id && !this.economy.relics.includes(id)) { this.economy.relics.push(id); this.bus.emit(EV.RELIC_FOUND, { id }); }
      if (id && PLANETS[planetId].goal === 'relic') this.economy.done[planetId] = true; // Moon/Mars: taking the relic finishes the world
    }
    this._untrack(i);
    if (this.recoilTile === i) this.recoilTile = -1;
    if (ore && collectOre && !this.economy.addOre(ore)) {
      this.pickups.spawn(x * w.T + w.T / 2, y * w.T + w.T / 2, ore);
    }
    h.i = i; h.x = x; h.y = y; h.type = type; h.ore = ore; h.stage = 0;
    this.vis.revealAround(x, y);
    this.bus.emit(EV.TILE_CHANGED, i);
    this.bus.emit(EV.BLOCK_BROKEN, h);
  }

  /**
   * Dynamite blast centred on tile (tx, ty).
   * @returns {number} tiles destroyed
   */
  blast(tx, ty, r = DYNAMITE.RADIUS, big = false) {
    const w = this.world;
    const tier = this.economy.pickTier;
    let n = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = tx + dx; const y = ty + dy;
      if (!w.inBounds(x, y)) continue;
      const i = y * w.W + x;
      if (this.gas && !this.gas.exploding && w.gas[i] > 0) this.gas.explodeAt(x, y);
      const out = isCampGround(x, y) ? DYN_KEEP : dynamiteOutcome(w.tileType[i], w.oreType[i], tier, big);
      if (out === DYN_KEEP) { if (w.oreType[i]) this.vis.revealAround(x, y); continue; }
      this.breakTile(i, out === DYN_COLLECT);
      n++;
    }
    return n;
  }

  /** Crack stage for a tracked damaged tile. */
  stageOf(i) { return crackStage(this.world.tileHP[i], this.world.maxHP(i)); }
}
