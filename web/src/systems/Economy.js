/**
 * @module systems/Economy
 * Cargo, credits, upgrades and consumables. The rules are pure functions (unit-tested);
 * the Economy class wraps them with state and events.
 */
import { ORES, PICKAXES, UPGRADES, CONSUMABLES, ECONOMY, BALANCE, ENERGY, CAMP_BUILDINGS, START_BUILDINGS, POWER, ORE, ITEM, TECH, RENDER, WORLD, isOre } from '../config.js';

const cents = (v) => Math.round(v * 100) / 100;
import { EV } from '../core/EventBus.js';
import { techStat, isUnlocked, eraPickTier } from './Tech.js';

/** Upgrade kinds in shop order. */
export const UPGRADE_KINDS = Object.freeze(['pickaxe', 'rig', 'jetpack', 'radar']);

/** @param {string} kind @returns {any[]} */
export function upgradeLevels(kind) {
  return kind === 'pickaxe' ? /** @type {any[]} */ (PICKAXES) : /** @type {any} */ (UPGRADES)[kind].levels;
}

/** W_total: cargo weight in kg. */
export function cargoWeight(cargo) {
  let w = 0;
  for (let o = 1; o < cargo.length; o++) w += cargo[o] * /** @type {any} */ (ORES[o]).kg;
  return w;
}

/** Can one more block of `ore` fit under `capacity` kg? */
export function canAddOre(cargo, ore, capacity) {
  return cargoWeight(cargo) + /** @type {any} */ (ORES[ore]).kg <= capacity + 1e-9;
}

/** Speed_mult = 1 - 0.4 * (W/C)^2 — applied to walking, climbing and swing speed. */
export function loadSpeedMult(weight, capacity) {
  const f = Math.min(1, weight / capacity);
  return 1 - ENERGY.LOAD_SLOW * f * f;
}

/** Total units in cargo. */
export function cargoUnits(cargo) {
  let u = 0;
  for (let o = 1; o < cargo.length; o++) u += cargo[o];
  return u;
}

/** Sell value of a cargo or stash array. */
export function cargoValue(cargo) {
  let v = 0;
  for (let o = 1; o < cargo.length; o++) v += cargo[o] * /** @type {any} */ (ORES[o]).price;
  return cents(v);
}

/**
 * Itemized sale lines sorted by value (desc).
 * @returns {{ore:number, name:string, count:number, price:number, total:number}[]}
 */
export function saleLines(cargo) {
  const lines = [];
  for (let o = 1; o < cargo.length; o++) {
    if (!cargo[o]) continue;
    const ore = /** @type {any} */ (ORES[o]);
    lines.push({ ore: o, name: ore.name, count: cargo[o], price: ore.price, total: cents(cargo[o] * ore.price) });
  }
  lines.sort((a, b) => b.total - a.total);
  return lines;
}

/**
 * Emergency-rescue loss: each stack loses `frac`, rounded per stack.
 * @param {ArrayLike<number>} cargo
 * @returns {number[]} units lost per ore id
 */
export function rescueLoss(cargo, frac = ENERGY.RESCUE_CARGO_LOSS) {
  const lost = new Array(cargo.length).fill(0);
  for (let o = 1; o < cargo.length; o++) lost[o] = Math.round(cargo[o] * frac);
  return lost;
}

/** Pickaxe tier → damage/swing record. */
export function pickaxeForTier(tier) { return PICKAXES[Math.max(1, Math.min(PICKAXES.length, tier)) - 1]; }

/**
 * Value per kg of a cargo filled with ores mineable at `tier` in a host band, mixed by abundance.
 * @param {number} tier @param {number} band material id
 */
export function weightedValuePerKg(tier, band) {
  let kg = 0; let v = 0;
  for (let o = 1; o < ORES.length; o++) {
    const ore = /** @type {any} */ (ORES[o]);
    if (!ore.hosts.includes(band) || ore.tier > tier) continue;
    kg += ore.weight * ore.kg; v += ore.weight * ore.price;
  }
  return kg > 0 ? v / kg : 0;
}

/** Expected income of one full trip while owning pickaxe `tier` (and rig level tier-1). */
export function expectedTripIncome(tier) {
  const capacity = UPGRADES.rig.levels[tier - 1].capacity;
  const band = BALANCE.FOCUS_BAND_BY_TIER[tier - 1];
  return capacity * BALANCE.PACKING_EFFICIENCY * weightedValuePerKg(tier, band);
}

/** Trips of income a tech costs at its era: (cash + market value of its items) / expected trip income. */
export function techTrips(techId) {
  const t = /** @type {any} */ (TECH.find((x) => x.id === techId));
  let v = t.cost.cash || 0;
  for (const [o, n] of Object.entries(t.cost.ores || {})) v += n * /** @type {any} */ (ORES[+o]).price;
  return v / expectedTripIncome(eraPickTier(t.era));
}

/** Fresh economy state. */
export function createEconomyState() {
  /** @type {Record<string, number>} */
  const consumables = {};
  for (const [k, c] of Object.entries(CONSUMABLES)) consumables[k] = c.start;
  return {
    credits: ECONOMY.START_CREDITS,
    cargo: new Array(ORES.length).fill(0),
    stash: new Array(ORES.length).fill(0).map((_, o) => (o === ORE.COAL ? POWER.START_COAL : 0)),
    tech: /** @type {string[]} */ ([]),
    buildings: /** @type {Record<string, number>} */ ({ ...START_BUILDINGS }),
    /** Camp power pool (systems/Power.js). */
    power: POWER.START,
    stations: /** @type {{x:number,y:number}[]} */ ([]),
    /** Placed field camps (bottom-left tiles); kept on death, cleared on New Map. */
    fieldCamps: /** @type {{x:number,y:number}[]} */ ([]),
    contracts: { active: /** @type {any[]} */ ([]), done: /** @type {string[]} */ ([]) },
    achievements: /** @type {string[]} */ ([]),
    collect: { ore: /** @type {Record<number,number>} */ ({}), maxDepth: 0 },
    completed: false,
    levels: { pickaxe: 0, rig: 0, jetpack: 0, radar: 0 },
    consumables,
  };
}

export class Economy {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   * @param {ReturnType<typeof createEconomyState>} [state]
   */
  constructor(bus, state) {
    this.bus = bus;
    this.load(state || createEconomyState());
  }

  /** @param {ReturnType<typeof createEconomyState>} s */
  load(s) {
    this.credits = s.credits;
    this.cargo = new Uint16Array(ORES.length);
    this.tech = [...(s.tech || [])];
    this.buildings = { ...START_BUILDINGS, ...(s.buildings || {}) };
    this.power = s.power ?? 0;
    this.stations = (s.stations || []).map((p) => ({ ...p }));
    this.fieldCamps = (s.fieldCamps || []).map((p) => ({ ...p }));
    this.contracts = { active: [...(s.contracts?.active || [])], done: [...(s.contracts?.done || [])] };
    this.achievements = [...(s.achievements || [])];
    this.collect = { ore: { ...(s.collect?.ore || {}) }, maxDepth: s.collect?.maxDepth || 0 };
    this.completed = !!s.completed;
    this.stash = new Uint16Array(ORES.length);
    for (let o = 0; o < ORES.length; o++) { this.cargo[o] = s.cargo[o] || 0; this.stash[o] = s.stash?.[o] || 0; }
    this.levels = { ...createEconomyState().levels, ...s.levels };
    this.consumables = { ...createEconomyState().consumables, ...s.consumables };
  }

  toJSON() {
    return { credits: this.credits, cargo: Array.from(this.cargo), stash: Array.from(this.stash), tech: [...this.tech], buildings: { ...this.buildings }, power: this.power, stations: this.stations.map((p) => ({ ...p })), fieldCamps: this.fieldCamps.map((p) => ({ ...p })), contracts: { active: [...this.contracts.active], done: [...this.contracts.done] }, achievements: [...this.achievements], collect: { ore: { ...this.collect.ore }, maxDepth: this.collect.maxDepth }, completed: this.completed, levels: { ...this.levels }, consumables: { ...this.consumables } };
  }

  /** State for a fresh map that keeps progress (cash, stash, tech, buildings, gear, power, consumables). */
  newMapState() {
    const s = this.toJSON();
    const consumables = { ...s.consumables, ladder: Math.max(s.consumables.ladder, CONSUMABLES.ladder.start) };
    return { ...s, consumables, cargo: s.cargo.map(() => 0), stations: [], fieldCamps: [], contracts: { active: [], done: s.contracts.done }, completed: false };
  }

  /** Dev override: tier 1..6, or 0 for the owned tool. Not saved. */
  devPick = 0;
  get pickTier() { return this.devPick || this.levels.pickaxe + 1; }
  get pickaxe() { return PICKAXES[this.pickTier - 1]; }
  get jetpack() { return UPGRADES.jetpack.levels[this.levels.jetpack]; }
  get rig() { return UPGRADES.rig.levels[this.levels.rig]; }
  get radar() { return UPGRADES.radar.levels[this.levels.radar]; }
  /** Headlamp range (px): radar level, scaled by tech. */
  /** Headlamp range in px: 2 tiles at base, capped at RENDER.HEADLAMP_MAX_TILES even with the LED tech. */
  get headlamp() { return Math.min(this.stat('headlamp', this.radar.headlamp), RENDER.HEADLAMP_MAX_TILES * WORLD.TILE_PX); }
  get capacity() { return this.stat('capacity', this.rig.capacity); }
  /** @param {string} name @param {number} base */
  get sellMul() { const l = this.buildings.shop || 0; return l ? CAMP_BUILDINGS.shop.levels[l - 1].effect.sellMul : 1; }
  get hasJetpack() { return this.levels.jetpack > 0; }
  /** Next level record of an equipment kind, or undefined if maxed. @param {string} kind */
  nextUpgrade(kind) { return upgradeLevels(kind)[this.levels[kind] + 1]; }
  stat(name, base) { return techStat(this.tech, name, base); }
  get cargoWeight() { return cargoWeight(this.cargo); }
  /** W_total / C_max, 0..1. */
  get loadFrac() { return Math.min(1, this.cargoWeight / this.capacity); }
  get speedMult() { return loadSpeedMult(this.cargoWeight, this.capacity); }
  get cargoUnits() { return cargoUnits(this.cargo); }

  /** Try to store one ore unit. @returns {boolean} */
  addOre(ore) {
    if (!canAddOre(this.cargo, ore, this.capacity)) {
      this.bus.emit(EV.CARGO_FULL);
      return false;
    }
    this.cargo[ore]++;
    this.bus.emit(EV.ORE_COLLECTED, ore);
    this.bus.emit(EV.CARGO_CHANGED);
    return true;
  }

  /** Sell everything. @returns {{total:number, lines:ReturnType<typeof saleLines>}} */
  sellAll() {
    const lines = saleLines(this.cargo);
    const total = cents(cargoValue(this.cargo) * this.sellMul);
    if (total <= 0) return { total: 0, lines };
    this.cargo.fill(0);
    this.credits = cents(this.credits + total);
    this.bus.emit(EV.CARGO_CHANGED);
    this.bus.emit(EV.CREDITS_CHANGED, this.credits);
    this.bus.emit(EV.SOLD, { total });
    return { total, lines };
  }

  /** Equipment is crafted from materials only, one level at a time. @param {string} kind @returns {{ok:boolean, reason?:string}} */
  canCraftUpgrade(kind) {
    const next = this.nextUpgrade(kind);
    if (!next) return { ok: false, reason: 'Maxed out' };
    if (!isUnlocked(this, next.tech)) return { ok: false, reason: `Requires ${TECH.find((t) => t.id === next.tech)?.name || next.tech}` };
    if ((this.buildings.workshop || 0) < next.workshop) return { ok: false, reason: `Needs Workshop level ${next.workshop}` };
    if (!this.canAfford({ ores: next.recipe })) return { ok: false, reason: 'Not enough materials' };
    return { ok: true };
  }

  /** @param {string} kind */
  craftUpgrade(kind) {
    const check = this.canCraftUpgrade(kind);
    if (!check.ok) { this.bus.emit(EV.PURCHASE_FAILED, check.reason); return check; }
    this.pay({ ores: this.nextUpgrade(kind).recipe });
    this.levels[kind]++;
    this.bus.emit(EV.UPGRADE_BOUGHT, { kind, level: this.levels[kind] });
    if (kind === 'rig') this.bus.emit(EV.CARGO_CHANGED);
    return check;
  }

  /** @param {string} kind */
  canBuyConsumable(kind) {
    const c = /** @type {any} */ (CONSUMABLES)[kind];
    if (c.tech && !this.tech.includes(c.tech)) return { ok: false, reason: 'Requires tech' };
    if (this.credits < c.price) return { ok: false, reason: `Need $${(c.price - this.credits).toLocaleString('en-US')} more` };
    return { ok: true };
  }

  /** @param {string} kind */
  buyConsumable(kind) {
    const check = this.canBuyConsumable(kind);
    if (!check.ok) { this.bus.emit(EV.PURCHASE_FAILED, check.reason); return check; }
    this.credits = cents(this.credits - /** @type {any} */ (CONSUMABLES)[kind].price);
    this.consumables[kind]++;
    this.bus.emit(EV.CREDITS_CHANGED, this.credits);
    this.bus.emit(EV.CONSUMABLES_CHANGED);
    return check;
  }

  /** Spend one consumable. @returns {boolean} */
  useConsumable(kind) {
    if (this.consumables[kind] <= 0) return false;
    this.consumables[kind]--;
    this.bus.emit(EV.CONSUMABLES_CHANGED);
    return true;
  }

  /** Crafted Warp Charges carried or stored (the portable teleporter's ammo). */
  get warpCharges() { return this.cargo[ITEM.WARP_CHARGE] + this.stash[ITEM.WARP_CHARGE]; }

  /** Spend one warp charge, cargo first. @returns {boolean} */
  useWarpCharge() {
    const W = ITEM.WARP_CHARGE;
    if (this.cargo[W] > 0) this.cargo[W]--;
    else if (this.stash[W] > 0) this.stash[W]--;
    else return false;
    this.bus.emit(EV.CARGO_CHANGED);
    return true;
  }

  /** Move cargo into the home stash (all ores, or just `ore`). */
  deposit(ore = 0) {
    const cap = this.stat('stashCap', ECONOMY.STASH_CAP);
    for (let o = 1; o < this.cargo.length; o++) if (!ore || o === ore) { const n = Math.min(this.cargo[o], Math.max(0, cap - this.stash[o])); this.stash[o] += n; this.cargo[o] -= n; }
    this.bus.emit(EV.CARGO_CHANGED);
  }

  /** Take up to n units of `ore` from the stash into cargo, as far as capacity allows. @returns {number} moved */
  withdraw(ore, n) {
    let moved = 0;
    while (moved < n && this.stash[ore] > 0 && canAddOre(this.cargo, ore, this.capacity)) { this.stash[ore]--; this.cargo[ore]++; moved++; }
    if (moved) this.bus.emit(EV.CARGO_CHANGED);
    return moved;
  }

  /** Sell up to n units of `ore` from the stash. @returns {number} credits earned */
  sellFromStash(ore, n) {
    const k = Math.min(n, this.stash[ore]);
    if (k <= 0) return 0;
    const total = cents(k * /** @type {any} */ (ORES[ore]).price * this.sellMul);
    this.stash[ore] -= k;
    this.credits = cents(this.credits + total);
    this.bus.emit(EV.CARGO_CHANGED);
    this.bus.emit(EV.CREDITS_CHANGED, this.credits);
    return total;
  }

  /** @param {{cash?:number, ores?:Record<number,number>}} cost */
  canAfford(cost) {
    if ((cost.cash || 0) > this.credits) return false;
    return Object.entries(cost.ores || {}).every(([o, n]) => this.stash[+o] + this.cargo[+o] >= n);
  }

  /** Pay cash plus ores (stash first, then cargo). Changes nothing and returns false if unaffordable. */
  pay(cost) {
    if (!this.canAfford(cost)) return false;
    this.credits = cents(this.credits - (cost.cash || 0));
    for (const [o, n] of Object.entries(cost.ores || {})) {
      const fromStash = Math.min(n, this.stash[+o]);
      this.stash[+o] -= fromStash; this.cargo[+o] -= n - fromStash;
    }
    this.bus.emit(EV.CARGO_CHANGED);
    this.bus.emit(EV.CREDITS_CHANGED, this.credits);
    return true;
  }

  /** Death: the run's loot (cargo + consumables) is lost; credits, upgrades and stash are kept. */
  applyDeath() {
    for (let o = 1; o < this.cargo.length; o++) if (isOre(o)) this.cargo[o] = 0; // materials & consumables are kept
    this.bus.emit(EV.CARGO_CHANGED);
  }

  /** Apply emergency-rescue cargo loss. @returns {number} units lost */
  applyRescueLoss() {
    const lost = rescueLoss(this.cargo);
    let total = 0;
    for (let o = 1; o < this.cargo.length; o++) { this.cargo[o] -= lost[o]; total += lost[o]; }
    this.bus.emit(EV.CARGO_CHANGED);
    return total;
  }
}
