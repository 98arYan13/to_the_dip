/**
 * @module ui/ContractsScreen
 * HTML for the Contracts tab: active contracts to turn in and today's offers.
 */
import { ORES, CONTRACTS } from '../config.js';

/** @param {any} ec economy @param {{id:string, ore:number, qty:number, rewardCash:number}[]} offers */
export function renderContracts(ec, offers) {
  if (!ec.tech.includes('contracts_terminal')) return '<p class="empty">Unlock "Contracts Terminal" in the Tech tab.</p>';
  const name = (o) => /** @type {any} */ (ORES[o]).name;
    const active = ec.contracts.active.map((c) => `<div class="up-row"><div class="up-info"><div class="up-name">${c.qty}× ${name(c.ore)}</div><div class="up-stats">Reward $${c.rewardCash.toLocaleString('en-US')} · ore from stash, then cargo</div></div>
      <div class="up-buy"><button class="btn primary" data-key="ti:${c.id}">Turn in</button></div></div>`).join('');
    const open = offers.filter((o) => !ec.contracts.done.includes(o.id) && !ec.contracts.active.some((a) => a.id === o.id))
      .map((c) => `<div class="up-row"><div class="up-info"><div class="up-name">${c.qty}× ${name(c.ore)}</div><div class="up-stats">Reward $${c.rewardCash.toLocaleString('en-US')}</div></div>
      <div class="up-buy"><button class="btn" data-key="acc:${c.id}">Accept</button></div></div>`).join('');
    return `<h3>ACTIVE (${ec.contracts.active.length}/${CONTRACTS.MAX_ACTIVE})</h3>${active || '<p class="empty">None.</p>'}<h3>TODAY'S OFFERS</h3>${open || '<p class="empty">All taken today.</p>'}`;
}
