/**
 * @module ui/TechScreen
 * HTML for the Tech tab: tech tree grouped by branch with cost, requirement and locked/owned state.
 */
import { TECH, ORES } from '../config.js';
import { canUnlock } from '../systems/Tech.js';

/** @param {any} ec economy */
export function renderTech(ec) {
  const price = (c) => [c.cash ? `$${c.cash.toLocaleString('en-US')}` : '', ...Object.entries(c.ores || {}).map(([o, n]) => `${n}× ${/** @type {any} */ (ORES[+o]).name}`)].filter(Boolean).join(' + ');
  return ['suit', 'jet', 'tools', 'camp'].map((b) => `<h3>${b.toUpperCase()}</h3>` + TECH.filter((t) => t.branch === b).map((t) => {
      const owned = ec.tech.includes(t.id);
      const check = canUnlock(ec, t.id);
      return `<div class="up-row"><div class="up-info"><div class="up-name">${t.name}${owned ? ' <span class="maxed">OWNED</span>' : ''}</div>
        <div class="up-stats">${price(t.cost)}${t.requires.length ? ` · needs ${t.requires.join(', ')}` : ''}</div></div>
        <div class="up-buy">${owned ? '' : `<button class="btn ${check.ok ? 'primary' : ''}" data-key="tech:${t.id}" ${check.ok ? '' : 'disabled'}>Unlock</button>${check.ok ? '' : `<div class="reason">${check.reason}</div>`}`}</div></div>`;
    }).join('')).join('');
}
