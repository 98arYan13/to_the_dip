/**
 * @module ui/Shop
 * Base camp terminal modal with three tabs: Sell Cargo, Upgrades, Consumables.
 * Keyboard (Tab/Arrows/Enter/Esc) and mouse navigable. Pauses the simulation while open.
 */
import { EV } from '../core/EventBus.js';
import { UI, PICKAXES, UPGRADES, CONSUMABLES, MATERIALS, ORES, CONTRACTS, DYNAMITE } from '../config.js';
import { CAMP_BUILDINGS, ACHIEVEMENTS } from '../config.js';
import { renderTech } from './TechScreen.js';
import { renderContracts } from './ContractsScreen.js';
import { upgradeBuilding } from '../systems/Camp.js';
import { rollContracts, dayNumber, acceptContract, turnIn } from '../systems/Contracts.js';
import { unlockTech } from '../systems/Tech.js';
import { UPGRADE_KINDS, upgradeLevels, nextUpgradeCost, saleLines, cargoValue } from '../systems/Economy.js';

const TABS = ['sell', 'stash', 'upgrades', 'tech', 'consumables', 'camp', 'contracts', 'awards'];

export class Shop {
  /**
   * @param {HTMLElement} root
   * @param {import('../core/EventBus.js').EventBus} bus
   * @param {import('../systems/Economy.js').Economy} economy
   * @param {{onClose:()=>void, click:()=>void, seed:()=>number}} hooks
   */
  constructor(root, bus, economy, hooks) {
    this.bus = bus;
    this.economy = economy;
    this.hooks = hooks;
    this.open = false;
    this.tab = 'sell';
    this.shownCredits = 0;
    this.el = document.createElement('div');
    this.el.className = 'modal shop hidden';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'Base Camp Terminal');
    this.el.innerHTML = `
      <div class="modal-box">
        <header><h2>EXPEDITION BASE CAMP · TERMINAL</h2><span class="shop-credits">$0</span><button class="btn close" title="Close (Esc)">✕</button></header>
        <nav class="tabs" role="tablist">
          <button class="tab" data-tab="sell" role="tab">Sell Cargo</button>
          <button class="tab" data-tab="stash" role="tab">Stash</button>
          <button class="tab" data-tab="upgrades" role="tab">Upgrades</button>
          <button class="tab" data-tab="tech" role="tab">Tech</button>
          <button class="tab" data-tab="consumables" role="tab">Consumables</button>
          <button class="tab" data-tab="camp" role="tab">Camp</button>
          <button class="tab" data-tab="contracts" role="tab">Contracts</button>
          <button class="tab" data-tab="awards" role="tab">Awards</button>
        </nav>
        <section class="tab-body"></section>
        <footer class="hint-line">Tab / ←→ to navigate · Enter to buy · Esc to close</footer>
      </div>`;
    root.appendChild(this.el);
    this.body = /** @type {HTMLElement} */ (this.el.querySelector('.tab-body'));
    this.creditsEl = /** @type {HTMLElement} */ (this.el.querySelector('.shop-credits'));
    this.el.querySelector('.close')?.addEventListener('click', () => this.close());
    this.el.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => { this.hooks.click(); this.setTab(/** @type {HTMLElement} */ (t).dataset.tab || 'sell'); }));
    this.el.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' || e.code === 'KeyE') { e.preventDefault(); e.stopPropagation(); this.close(); }
      else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
        const k = TABS.indexOf(this.tab) + (e.code === 'ArrowRight' ? 1 : -1);
        this.setTab(TABS[(k + TABS.length) % TABS.length]);
        e.preventDefault(); e.stopPropagation();
      } else e.stopPropagation();
    });
    const rerender = () => { if (this.open) this.render(); };
    bus.on(EV.CREDITS_CHANGED, () => { if (this.open) this.animateCredits(); rerender(); });
    bus.on(EV.CARGO_CHANGED, rerender);
    bus.on(EV.CONSUMABLES_CHANGED, rerender);
    bus.on(EV.UPGRADE_BOUGHT, rerender);
  }

  show() {
    if (this.open) return;
    this.open = true;
    this.shownCredits = this.economy.credits;
    this.creditsEl.textContent = `$${this.shownCredits.toLocaleString('en-US')}`;
    this.el.classList.remove('hidden');
    this.setTab(this.economy.cargoUnits > 0 ? 'sell' : 'upgrades');
    this.bus.emit(EV.SHOP_OPEN);
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.el.classList.add('hidden');
    this.bus.emit(EV.SHOP_CLOSE);
    this.hooks.onClose();
  }

  setTab(tab) {
    this.tab = tab;
    this.el.querySelectorAll('.tab').forEach((t) => {
      const on = /** @type {HTMLElement} */ (t).dataset.tab === tab;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
    });
    this.render();
    const first = /** @type {HTMLElement|null} */ (this.body.querySelector('button:not([disabled])') || this.el.querySelector('.tab.active'));
    first?.focus();
  }

  animateCredits() {
    const from = this.shownCredits; const to = this.economy.credits;
    const start = performance.now();
    const dur = UI.COUNTER_TIME * 1000;
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      this.shownCredits = Math.round(from + (to - from) * e);
      this.creditsEl.textContent = `$${this.shownCredits.toLocaleString('en-US')}`;
      if (t < 1 && this.open) requestAnimationFrame(step); else this.shownCredits = to;
    };
    requestAnimationFrame(step);
    this.creditsEl.classList.remove('flash'); void this.creditsEl.offsetWidth; this.creditsEl.classList.add('flash');
  }

  render() {
    const focusedKey = /** @type {HTMLElement|null} */ (document.activeElement)?.dataset?.key;
    if (this.tab === 'sell') this._renderSell();
    else if (this.tab === 'stash') this._renderStash();
    else if (this.tab === 'upgrades') this._renderUpgrades();
    else if (this.tab === 'tech') this.body.innerHTML = renderTech(this.economy);
    else if (this.tab === 'camp') this._renderCamp();
    else if (this.tab === 'contracts') this.body.innerHTML = renderContracts(this.economy, this._offers());
    else if (this.tab === 'awards') this._renderAwards();
    else this._renderConsumables();
    this.body.querySelectorAll('button[data-key]').forEach((b) => b.addEventListener('click', () => this._onAction(/** @type {HTMLElement} */ (b).dataset.key || '')));
    if (focusedKey) /** @type {HTMLElement|null} */ (this.body.querySelector(`[data-key="${focusedKey}"]`))?.focus();
  }

  _onAction(key) {
    const [kind, id] = key.split(':');
    if (kind === 'sell') {
      const r = this.economy.sellAll();
      if (r.total > 0) this.bus.emit(EV.TOAST, { text: `Sold cargo for $${r.total.toLocaleString('en-US')}`, kind: 'good' });
    } else if (kind === 'dep') this.economy.deposit();
    else if (kind === 'wd') this.economy.withdraw(+id, 1);
    else if (kind === 'ss') this.economy.sellFromStash(+id, 1);
    else if (kind === 'ssa') this.economy.sellFromStash(+id, Infinity);
    else if (kind === 'tech') unlockTech(this.economy, id);
    else if (kind === 'bld') { const r = upgradeBuilding(this.economy, id); if (!r.ok) this.bus.emit(EV.PURCHASE_FAILED, r.reason); }
    else if (kind === 'acc') { const c = this._offers().find((o) => o.id === id); if (c) acceptContract(this.economy, c); }
    else if (kind === 'ti') { const r = turnIn(this.economy, id); if (!r.ok) this.bus.emit(EV.PURCHASE_FAILED, r.reason); }
    else if (kind === 'up') this.economy.buyUpgrade(id);
    else if (kind === 'buy') this.economy.buyConsumable(id);
  }

  _renderSell() {
    const lines = saleLines(this.economy.cargo);
    const total = Math.round(cargoValue(this.economy.cargo) * this.economy.sellMul * 100) / 100;
    if (!lines.length) {
      this.body.innerHTML = '<p class="empty">Cargo hold is empty. Head back down and dig!</p>';
      return;
    }
    this.body.innerHTML = `
      <table class="sell-table">
        <thead><tr><th>Ore</th><th>Qty</th><th>Price</th><th>Value</th></tr></thead>
        <tbody>${lines.map((l) => `<tr><td><span class="swatch" style="background:${/** @type {any} */ (ORES[l.ore]).colors.light}"></span>${l.name}</td><td>${l.count}</td><td>$${l.price.toLocaleString('en-US')}</td><td>$${l.total.toLocaleString('en-US')}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="3">Total</td><td>$${total.toLocaleString('en-US')}</td></tr></tfoot>
      </table>
      <button class="btn primary" data-key="sell:all">Sell All Cargo · $${total.toLocaleString('en-US')}</button>`;
  }

  _renderStash() {
    const ec = this.economy;
    const rows = [];
    for (let o = 1; o < ORES.length; o++) {
      if (!ec.stash[o]) continue;
      const ore = /** @type {any} */ (ORES[o]);
      rows.push(`<tr><td><span class="swatch" style="background:${ore.colors.light}"></span>${ore.name}</td><td>${ec.stash[o]}</td>
        <td><button class="btn" data-key="wd:${o}">Take 1</button> <button class="btn" data-key="ss:${o}">Sell 1</button> <button class="btn" data-key="ssa:${o}">Sell all</button></td></tr>`);
    }
    this.body.innerHTML = `<button class="btn primary" data-key="dep:all" ${ec.cargoUnits ? '' : 'disabled'}>Deposit all cargo</button>`
      + (rows.length ? `<table class="sell-table"><thead><tr><th>Ore</th><th>Stored</th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table>` : '<p class="empty">Stash is empty. Deposited ore can be sold or spent on upgrades.</p>');
  }

  _renderUpgrades() {
    const ec = this.economy;
    const rows = UPGRADE_KINDS.map((kind) => {
      const lvl = ec.levels[kind];
      const levels = upgradeLevels(kind);
      const cost = ec.upgradeCost(kind);
      const max = cost < 0;
      const check = ec.canBuyUpgrade(kind);
      const name = kind === 'pickaxe' ? 'Pickaxe / Drill' : /** @type {any} */ (UPGRADES)[kind].name;
      const cur = describe(kind, levels[lvl]);
      const next = max ? '' : describe(kind, levels[lvl + 1]);
      let extra = '';
      if (kind === 'pickaxe' && !max) extra = `<div class="unlocks">Unlocks: ${unlocksFor(lvl + 2)}</div>`;
      return `<div class="up-row">
        <div class="up-info"><div class="up-name">${name} <span class="lvl">${kind === 'pickaxe' ? PICKAXES[lvl].short : `Lv ${lvl + 1}/${levels.length}`}</span></div>
          <div class="up-stats">${cur}${max ? '' : ` <span class="arrow">→</span> <span class="next">${next}</span>`}</div>${extra}</div>
        <div class="up-buy">${max ? '<span class="maxed">MAX</span>' : `<button class="btn ${check.ok ? 'primary' : ''}" data-key="up:${kind}" ${check.ok ? '' : 'disabled'}>${kind === 'pickaxe' ? PICKAXES[lvl + 1].short + ' · ' : ''}$${cost.toLocaleString('en-US')}</button>${check.ok ? '' : `<div class="reason">${check.reason}</div>`}`}</div>
      </div>`;
    });
    this.body.innerHTML = rows.join('');
  }

  _offers() { return rollContracts(this.hooks.seed(), dayNumber(), this.economy.pickTier); }

  _renderCamp() {
    const ec = this.economy;
    const price = (c) => [c.cash ? `$${c.cash.toLocaleString('en-US')}` : '', ...Object.entries(c.ores || {}).map(([o, n]) => `${n}× ${/** @type {any} */ (ORES[+o]).name}`)].filter(Boolean).join(' + ');
    this.body.innerHTML = Object.entries(CAMP_BUILDINGS).map(([id, b]) => {
      const lvl = ec.buildings[id] || 0; const max = lvl >= b.levels.length;
      const nextCost = max ? null : b.levels[lvl].cost;
      return `<div class="up-row"><div class="up-info"><div class="up-name">${b.name} <span class="lvl">Lv ${lvl}/${b.levels.length}</span></div>
        <div class="up-stats">${id === 'shop' ? 'Better sell prices' : 'Cheaper upgrades'}${max ? '' : ` · next ${price(nextCost)}`}</div></div>
        <div class="up-buy">${max ? '<span class="maxed">MAX</span>' : `<button class="btn ${ec.canAfford(nextCost) ? 'primary' : ''}" data-key="bld:${id}" ${ec.canAfford(nextCost) ? '' : 'disabled'}>Upgrade</button>`}</div></div>`;
    }).join('') + `<p class="empty">Field charging stations: unlock the tech, then press G underground (${ec.stations.length} placed).</p>`;
  }

  _renderAwards() {
    const own = this.economy.achievements;
    this.body.innerHTML = ACHIEVEMENTS.map((a) => `<div class="up-row"><div class="up-info"><div class="up-name">${own.includes(a.id) ? '★ ' + a.name : '☆ ???'}</div><div class="up-stats">${own.includes(a.id) ? a.desc : a.desc.replace(/\d[\d,]*/g, '?')}</div></div></div>`).join('');
  }

  _renderConsumables() {
    const ec = this.economy;
    const desc = {
      dynamite: 'Thrown explosive, 2.5 s fuse, 3×3 blast. Breaks rock up to your pickaxe tier + 1.',
      teleporter: 'Warps you safely to base camp, keeping all cargo.',
      cell: `Instantly restores ${CONSUMABLES.cell.frac * 100}% of battery energy.`,
      ladder: 'Place on open air next to rock (aim + key). Climb with W / S.',
      bigBomb: `Thrown explosive with a ${DYNAMITE.BIG_RADIUS * 2 + 1}×${DYNAMITE.BIG_RADIUS * 2 + 1} blast.`,
    };
    this.body.innerHTML = Object.entries(CONSUMABLES).filter(([, c]) => !c.tech || ec.tech.includes(c.tech)).map(([k, c]) => {
      const check = ec.canBuyConsumable(k);
      return `<div class="up-row">
        <div class="up-info"><div class="up-name">${c.name} <span class="lvl">[${c.slot}] owned ×${ec.consumables[k]}</span></div><div class="up-stats">${/** @type {any} */ (desc)[k]}</div></div>
        <div class="up-buy"><button class="btn ${check.ok ? 'primary' : ''}" data-key="buy:${k}" ${check.ok ? '' : 'disabled'}>$${c.price}</button>${check.ok ? '' : `<div class="reason">${check.reason}</div>`}</div>
      </div>`;
    }).join('');
  }
}

/** @param {string} kind @param {any} l */
function describe(kind, l) {
  switch (kind) {
    case 'pickaxe': return `DMG ${l.damage} · ${(1 / l.swing).toFixed(1)} swings/s${l.powered ? ' · uses battery' : ''}`;
    case 'jetpack': return `Thrust ${l.thrust} · Climb ${l.maxUp} · Drain ${l.drain}/s`;
    case 'rig': return `${l.name} · ${l.capacity} kg · ${l.maxEnergy} energy · Drill ${l.eff}x (${l.zone})`;
    case 'radar': return `Radius ${l.radius} · ${l.duration}s · Lamp ${l.headlamp}`;
    default: return '';
  }
}

/** Materials and ores first minable at `tier`. */
function unlocksFor(tier) {
  const mats = MATERIALS.filter((m) => m.solid && m.tier === tier).map((m) => m.name);
  const ores = ORES.filter((o) => o && o.tier === tier).map((o) => /** @type {any} */ (o).name);
  return [...mats, ...ores].join(', ') || '—';
}
