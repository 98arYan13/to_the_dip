/**
 * @module systems/Power
 * Camp power pool (economy.power). The generator auto-burns stash fuel when a draw needs it,
 * cheapest sell-value-per-power first, never above the Generator level's capacity.
 */
import { POWER, ORES } from '../config.js';

/** @param {{buildings:Record<string,number>}} ec */
export const powerCap = (ec) => POWER.CAP[Math.max(1, Math.min(POWER.CAP.length, ec.buildings.generator || 1)) - 1];

/** Fuels the current Generator may burn, cheapest per power first. */
const fuelsFor = (ec) => POWER.FUELS.filter((f) => f.gen <= (ec.buildings.generator || 1))
  .sort((a, b) => /** @type {any} */ (ORES[a.id]).price / a.power - /** @type {any} */ (ORES[b.id]).price / b.power);

/**
 * Burn stash fuel until the pool holds `need` (or would overflow the cap). @returns {number} units burned
 * @param {any} ec @param {number} [need]
 */
export function refuel(ec, need = Infinity) {
  const cap = powerCap(ec);
  let burned = 0;
  for (const f of fuelsFor(ec)) {
    while (ec.power < need && ec.stash[f.id] > 0 && ec.power + f.power <= cap) { ec.stash[f.id]--; ec.power += f.power; burned++; }
  }
  return burned;
}

/** Take up to `amount` power, burning fuel as needed (in cap-sized chunks). @returns {number} power granted */
export function drawPower(ec, amount) {
  let got = 0;
  for (;;) {
    const take = Math.min(amount - got, ec.power);
    ec.power -= take; got += take;
    if (got >= amount || !refuel(ec, amount - got)) return got;
  }
}

/** Power a draw could reach: pool + burnable stash fuel, minus stash units reserved for other uses. */
export function availablePower(ec, reserved = /** @type {Record<number, number>} */ ({})) {
  let p = ec.power;
  for (const f of fuelsFor(ec)) p += Math.max(0, ec.stash[f.id] - (reserved[f.id] || 0)) * f.power;
  return p;
}
