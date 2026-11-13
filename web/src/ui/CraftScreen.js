/**
 * @module ui/CraftScreen
 * HTML for the Craft tab: one sub-tab per processing building with its level/upgrade row and recipes;
 * the Generator shows the power pool, the Workshop crafts equipment (next level of each item).
 */
import { RECIPES, CAMP_BUILDINGS, ORES, POWER, PICKAXES, UPGRADES, TECH } from '../config.js';
import { canCraft, canUpgradeBuilding } from '../systems/Crafting.js';
import { powerCap } from '../systems/Power.js';
import { UPGRADE_KINDS } from '../systems/Economy.js';

export const CRAFT_BUILDINGS = Object.freeze(['generator', 'furnace', 'refinery', 'lab', 'workshop']);
const name = (o) => /** @type {any} */ (ORES[+o]).name;
const techName = (id) => TECH.find((t) => t.id === id)?.name || id;

/** "2 Iron Ore (5) + 2 Coal (9)" with have-counts coloured by enough/short. */
function items(ec, ores) {
  return Object.entries(ores || {}).map(([o, n]) => {
    const have = ec.stash[+o] + ec.cargo[+o];
    return `${n} ${name(o)} <span class="${have >= n ? 'ok' : 'no'}">(${have})</span>`;
  }).join(' + ');
}

const btn = (key, label, check) => `<button class="btn ${check.ok ? 'primary' : ''}" data-key="${key}" ${check.ok ? '' : 'disabled'} title="${check.ok ? '' : check.reason}">${label}</button>`;

function header(ec, id) {
  const b = /** @type {any} */ (CAMP_BUILDINGS)[id];
  const lvl = ec.buildings[id] || 0;
  const next = b.levels[lvl];
  const cur = lvl ? `${b.levels[lvl - 1].name} (level ${lvl}/${b.levels.length})` : 'Not built';
  const check = canUpgradeBuilding(ec, id);
  const needs = next ? [items(ec, next.cost.ores), next.tech ? `tech ${techName(next.tech)}` : '', next.needs ? `${/** @type {any} */ (CAMP_BUILDINGS)[next.needs.building].name} ${next.needs.level}` : ''].filter(Boolean).join(' · ') : '';
  return `<div class="up-row"><div class="up-info"><div class="up-name">${b.name} <span class="lvl">${cur}</span></div>
    <div class="up-stats">${next ? `Next: ${next.name} — ${needs}` : 'Fully upgraded'}</div></div>
    <div class="up-buy">${next ? `${btn(`bupg:${id}`, lvl ? 'Upgrade' : 'Build', check)}${check.ok ? '' : `<div class="reason">${check.reason}</div>`}` : '<span class="maxed">MAX</span>'}</div></div>`;
}

function recipeRows(ec, id) {
  return RECIPES.filter((r) => r.building === id).map((r) => {
    const c1 = canCraft(ec, r.id, 1); const c10 = canCraft(ec, r.id, 10);
    const out = Object.keys(r.out)[0];
    return `<div class="up-row"><div class="up-info"><div class="up-name">${name(out)} <span class="lvl">stash ${ec.stash[+out]}</span></div>
      <div class="up-stats">← ${items(ec, r.in)} · ⚡${r.power}</div></div>
      <div class="up-buy">${btn(`craft:${r.id}:1`, '×1', c1)} ${btn(`craft:${r.id}:10`, '×10', c10)}${c1.ok ? '' : `<div class="reason">${c1.reason}</div>`}</div></div>`;
  }).join('');
}

function generatorInfo(ec) {
  const lvl = ec.buildings.generator || 1;
  const fuels = POWER.FUELS.map((f) => `${name(f.id)} ${ec.stash[f.id]} (⚡${f.power}${f.gen > lvl ? `, needs level ${f.gen}` : ''})`).join(' · ');
  return `<div class="up-row"><div class="up-info"><div class="up-name">Power ⚡${Math.floor(ec.power)} / ${powerCap(ec)}</div>
    <div class="up-stats">Burns stash fuel automatically when crafting or charging: ${fuels}</div></div></div>`;
}

function equipmentRows(ec) {
  return UPGRADE_KINDS.map((kind) => {
    const levels = kind === 'pickaxe' ? PICKAXES : /** @type {any} */ (UPGRADES)[kind].levels;
    const lvl = ec.levels[kind]; const next = levels[lvl + 1];
    const label = (l, i) => (kind === 'pickaxe' || kind === 'rig' ? l.name : `${/** @type {any} */ (UPGRADES)[kind].name} ${i ? `Lv ${i}` : l.name || 'basic'}`);
    const check = ec.canCraftUpgrade(kind);
    return `<div class="up-row"><div class="up-info"><div class="up-name">${label(levels[lvl], lvl)}${next ? ` <span class="arrow">→</span> <span class="next">${label(next, lvl + 1)}</span>` : ''}</div>
      <div class="up-stats">${next ? `${items(ec, next.recipe)} · ${techName(next.tech)} · Workshop ${next.workshop}` : 'Best available'}</div></div>
      <div class="up-buy">${next ? `${btn(`eq:${kind}`, 'Craft', check)}${check.ok ? '' : `<div class="reason">${check.reason}</div>`}` : '<span class="maxed">MAX</span>'}</div></div>`;
  }).join('');
}

/** @param {any} ec economy @param {string} building */
export function renderCraft(ec, building) {
  const tabs = CRAFT_BUILDINGS.map((id) => `<button class="btn${id === building ? ' primary' : ''}" data-key="bsel:${id}">${/** @type {any} */ (CAMP_BUILDINGS)[id].name}</button>`).join(' ');
  const body = header(ec, building) + (building === 'generator' ? generatorInfo(ec) : '') + (building === 'workshop' ? equipmentRows(ec) : recipeRows(ec, building));
  return `<div class="era-tabs">${tabs}</div>${body}`;
}
