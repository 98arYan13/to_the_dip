/**
 * @module ui/TechScreen
 * HTML for the Tech tab: era tabs, a small left-to-right graph of the era's techs, and a side panel
 * with have/need costs, reverse-looked-up unlocks and the Unlock button.
 */
import { TECH, ERAS, ORES, CAMP_BUILDINGS, PICKAXES, UPGRADES, CONSUMABLES } from '../config.js';
import { canUnlock, unlocksOf, eraReached } from '../systems/Tech.js';

const NODE_W = 132; const NODE_H = 30; const COL_GAP = 40; const ROW_GAP = 12;
const byId = (id) => /** @type {any} */ (TECH.find((t) => t.id === id));
const money = (n) => `$${n.toLocaleString('en-US')}`;

/** Techs of an era in display order. @param {number} era */
export const eraTechs = (era) => TECH.filter((t) => t.era === era);

/** Column of a tech inside its era: longest chain of in-era prerequisites. */
function depth(t) {
  const inEra = t.requires.map(byId).filter((r) => r.era === t.era);
  return inEra.length ? 1 + Math.max(...inEra.map(depth)) : 0;
}

/** Node positions (px) for an era's graph. @returns {Map<string,{x:number,y:number}>} */
function layout(era) {
  const rows = /** @type {number[]} */ ([]);
  const pos = new Map();
  for (const t of eraTechs(era)) {
    const c = depth(t); rows[c] = (rows[c] || 0);
    pos.set(t.id, { x: c * (NODE_W + COL_GAP), y: rows[c] * (NODE_H + ROW_GAP) });
    rows[c]++;
  }
  return pos;
}

/** One human line per thing a tech unlocks. */
function unlockLines(t) {
  const out = unlocksOf(t.id).map((u) => {
    if (u.kind === 'recipe') return `Recipe: ${/** @type {any} */ (ORES.find((o) => o && o.key.toLowerCase() === u.id))?.name || u.id}`;
    if (u.kind === 'building') { const b = /** @type {any} */ (CAMP_BUILDINGS)[u.id]; return `${b.name} ${u.level}: ${b.levels[/** @type {number} */ (u.level) - 1].name}`; }
    if (u.kind === 'equipment') {
      const l = /** @type {number} */ (u.level);
      return u.id === 'pickaxe' ? PICKAXES[l].name : `${/** @type {any} */ (UPGRADES)[u.id].name} level ${l}`;
    }
    return /** @type {any} */ (CONSUMABLES)[u.id]?.name || u.id;
  });
  const e = t.effect;
  if (e?.stat) out.push(`${e.stat} ${e.add ? `+${e.add}` : `×${e.mul}`}`);
  if (e?.unlock && e.unlock !== 'coming_soon') out.push(t.name);
  if (e?.unlock === 'coming_soon') out.push('Coming in a future update');
  return out;
}

/**
 * @param {any} ec economy
 * @param {{era:number, selected:string|null}} view
 */
export function renderTech(ec, view) {
  const reached = eraReached(ec);
  const tabs = ERAS.map((e) => {
    const done = e.n < reached; const locked = e.n > reached;
    return `<button class="btn era-tab${e.n === view.era ? ' primary' : ''}" data-key="era:${e.n}">${e.n} ${e.name}${done ? ' ✓' : locked ? ' 🔒' : ''}</button>`;
  }).join('');

  const pos = layout(view.era);
  let w = 0; let h = 0;
  for (const p of pos.values()) { w = Math.max(w, p.x + NODE_W); h = Math.max(h, p.y + NODE_H); }
  const lines = eraTechs(view.era).flatMap((t) => t.requires.filter((r) => pos.has(r)).map((r) => {
    const a = /** @type {any} */ (pos.get(r)); const b = /** @type {any} */ (pos.get(t.id));
    return `<line x1="${a.x + NODE_W}" y1="${a.y + NODE_H / 2}" x2="${b.x}" y2="${b.y + NODE_H / 2}"/>`;
  })).join('');
  const nodes = eraTechs(view.era).map((t) => {
    const p = /** @type {any} */ (pos.get(t.id));
    const cls = ec.tech.includes(t.id) ? 'owned' : canUnlock(ec, t.id).ok ? 'can' : 'locked';
    return `<button class="tech-node ${cls}${t.id === view.selected ? ' sel' : ''}${t.key ? ' key' : ''}" style="left:${p.x}px;top:${p.y}px;width:${NODE_W}px;height:${NODE_H}px" data-key="techsel:${t.id}">${t.key ? '★ ' : ''}${t.name}</button>`;
  }).join('');

  const t = view.selected ? byId(view.selected) : null;
  let panel = '<p class="empty">Select a tech.</p>';
  if (t) {
    const owned = ec.tech.includes(t.id);
    const check = canUnlock(ec, t.id);
    const have = (o) => ec.stash[o] + ec.cargo[o];
    const row = (label, ok, txt) => `<div class="need ${ok ? 'ok' : 'no'}">${label}<span>${txt}</span></div>`;
    const costs = [row('Cash', ec.credits >= t.cost.cash, `${money(Math.floor(ec.credits))} / ${money(t.cost.cash)}`),
      ...Object.entries(t.cost.ores).map(([o, n]) => row(/** @type {any} */ (ORES[+o]).name, have(+o) >= n, `${have(+o)} / ${n}`))].join('');
    panel = `<div class="up-name">${t.name}${owned ? ' <span class="maxed">OWNED</span>' : ''}</div>
      <div class="up-stats">${t.desc}</div>
      ${t.requires.length ? `<div class="up-stats">Requires: ${t.requires.map((r) => byId(r).name).join(', ')}</div>` : ''}
      <div class="needs">${costs}</div>
      <div class="unlocks">Unlocks: ${unlockLines(t).join(' · ') || '—'}</div>
      ${owned ? '' : `<button class="btn ${check.ok ? 'primary' : ''}" data-key="tech:${t.id}" ${check.ok ? '' : 'disabled'}>Unlock</button>${check.ok ? '' : `<div class="reason">${check.reason}</div>`}`}`;
  }
  return `<div class="era-tabs">${tabs}</div>
    <div class="tech-wrap"><div class="tech-graph" style="width:${w}px;height:${h}px"><svg width="${w}" height="${h}">${lines}</svg>${nodes}</div>
    <div class="tech-panel">${panel}</div></div>
    <div class="up-stats">[ / ] switch era · arrows select · Enter unlocks</div>`;
}
