/**
 * @module systems/Economy
 * Cargo, credits, upgrades and consumables. The rules are pure functions (unit-tested);
 * the Economy class wraps them with state and events.
 */
import { ORES, PICKAXES, UPGRADES, CONSUMABLES, ECONOMY, BALANCE, ENERGY } from '../config.js';

const cents = (v) => Math.round(v * 100) / 100;
import { EV } from '../core/EventBus.js';

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

/** Sell value of a cargo array. */
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

/** Cost of the next level, or -1 if maxed. */
export function nextUpgradeCost(kind, level) {
  const levels = upgradeLevels(kind);
  return level + 1 < levels.length ? levels[level + 1].cost : -1;
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

/** Full trips at tier N needed to afford the tier N+1 pickaxe (Infinity at max tier). */
export function tripsToAffordNext(tier) {
  if (tier >= PICKAXES.length) return Infinity;
  return PICKAXES[tier].cost / expectedTripIncome(tier);
}

/** Fresh economy state. */
export function createEconomyState() {
  /** @type {Record<string, number>} */
  const consumables = {};
  for (const [k, c] of Object.entries(CONSUMABLES)) consumables[k] = c.start;
  return {
    credits: ECONOMY.START_CREDITS,
    cargo: new Array(ORES.length).fill(0),
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
    for (let o = 0; o < ORES.length; o++) this.cargo[o] = s.cargo[o] || 0;
    this.levels = { ...createEconomyState().levels, ...s.levels };
    this.consumables = { ...createEconomyState().consumables, ...s.consumables };
  }

  toJSON() {
    return { credits: this.credits, cargo: Array.from(this.cargo), levels: { ...this.levels }, consumables: { ...this.consumables } };
  }

  get pickTier() { return this.levels.pickaxe + 1; }
  get pickaxe() { return PICKAXES[this.levels.pickaxe]; }
  get jetpack() { return UPGRADES.jetpack.levels[this.levels.jetpack]; }
  get rig() { return UPGRADES.rig.levels[this.levels.rig]; }
  get radar() { return UPGRADES.radar.levels[this.levels.radar]; }
  get capacity() { return this.rig.capacity; }
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
    const total = cargoValue(this.cargo);
    if (total <= 0) return { total: 0, lines };
    this.cargo.fill(0);
    this.credits = cents(this.credits + total);
    this.bus.emit(EV.CARGO_CHANGED);
    this.bus.emit(EV.CREDITS_CHANGED, this.credits);
    this.bus.emit(EV.SOLD, { total });
    return { total, lines };
  }

  /** @param {string} kind @returns {{ok:boolean, reason?:string}} */
  canBuyUpgrade(kind) {
    const cost = nextUpgradeCost(kind, this.levels[kind]);
    if (cost < 0) return { ok: false, reason: 'Maxed out' };
    if (this.credits < cost) return { ok: false, reason: `Need $${(cost - this.credits).toLocaleString('en-US')} more` };
    return { ok: true };
  }

  /** @param {string} kind */
  buyUpgrade(kind) {
    const check = this.canBuyUpgrade(kind);
    if (!check.ok) { this.bus.emit(EV.PURCHASE_FAILED, check.reason); return check; }
    this.credits = cents(this.credits - nextUpgradeCost(kind, this.levels[kind]));
    this.levels[kind]++;
    this.bus.emit(EV.CREDITS_CHANGED, this.credits);
    this.bus.emit(EV.UPGRADE_BOUGHT, { kind, level: this.levels[kind] });
    if (kind === 'rig') this.bus.emit(EV.CARGO_CHANGED);
    return check;
  }

  /** @param {string} kind */
  canBuyConsumable(kind) {
    const c = /** @type {any} */ (CONSUMABLES)[kind];
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

  /** Apply emergency-rescue cargo loss. @returns {number} units lost */
  applyRescueLoss() {
    const lost = rescueLoss(this.cargo);
    let total = 0;
    for (let o = 1; o < this.cargo.length; o++) { this.cargo[o] -= lost[o]; total += lost[o]; }
    this.bus.emit(EV.CARGO_CHANGED);
    return total;
  }
}
