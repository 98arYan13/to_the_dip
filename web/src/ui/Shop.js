/**
 * @module ui/Shop
 * Base camp terminal modal: Sell Cargo, Stash, Craft (buildings + Workshop equipment), Tech, Shop, Camp, Contracts, Awards.
 * Keyboard (Tab/Arrows/Enter/Esc) and mouse navigable. Pauses the simulation while open.
 */
import { EV } from '../core/EventBus.js';
import { UI, CONSUMABLES, ORES, DYNAMITE, ERAS } from '../config.js';
import { CAMP_BUILDINGS, ACHIEVEMENTS, oreIcon } from '../config.js';

/** Item icon (or colour swatch when there is no art) before an ore/material name. */
const swatch = (o) => { const src = oreIcon(o); return src ? `<img class="swatch icon" src="${src}" alt="">` : `<span class="swatch" style="background:${/** @type {any} */ (ORES[o]).colors.light}"></span>`; };
import { renderTech, eraTechs } from './TechScreen.js';
import { renderCraft } from './CraftScreen.js';
import { renderLog, markLogRead, hasUnread } from './LogScreen.js';
import { renderContracts } from './ContractsScreen.js';
import { rollContracts, dayNumber, acceptContract, turnIn } from '../systems/Contracts.js';
import { unlockTech, canUnlock, eraReached } from '../systems/Tech.js';
import { craft, upgradeBuilding } from '../systems/Crafting.js';
import { saleLines, cargoValue } from '../systems/Economy.js';

const TABS = ['log', 'sell', 'stash', 'craft', 'tech', 'shop', 'camp', 'contracts', 'awards'];

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
    /** Craft sub-tab. */
    this.building = 'furnace';
    /** @type {{era:number, selected:string|null}} */
    this.techView = { era: 1, selected: null };
    this.el = document.createElement('div');
    this.el.className = 'modal shop hidden';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'Base Camp Terminal');
    this.el.innerHTML = `
      <div class="modal-box">
        <header><h2>EXPEDITION BASE CAMP · TERMINAL</h2><span class="shop-credits">$0</span><button class="btn close" title="Close (Esc)">✕</button></header>
        <nav class="tabs" role="tablist">
          <button class="tab" data-tab="log" role="tab">Log</button>
          <button class="tab" data-tab="sell" role="tab">Sell Cargo</button>
          <button class="tab" data-tab="stash" role="tab">Stash</button>
          <button class="tab" data-tab="craft" role="tab">Craft</button>
          <button class="tab" data-tab="tech" role="tab">Tech</button>
          <button class="tab" data-tab="shop" role="tab">Shop</button>
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
      else if (this.tab === 'tech' && this._techKey(e.code || ({ '[': 'BracketLeft', ']': 'BracketRight' })[e.key] || e.key)) { e.preventDefault(); e.stopPropagation(); }
      else if (!this.only && (e.code === 'ArrowRight' || e.code === 'ArrowLeft')) {
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

  /** @param {{tab?:string, building?:string, only?:string}} [opts] only: show just that tab (field camp → stash) */
  show(opts = {}) {
    if (this.open) return;
    this.open = true;
    this.only = opts.only || null;
    if (opts.building) this.building = opts.building;
    this.el.querySelectorAll('.tab').forEach((t) => t.classList.toggle('hidden', !!this.only && /** @type {HTMLElement} */ (t).dataset.tab !== this.only));
    this.shownCredits = this.economy.credits;
    this.creditsEl.textContent = `$${this.shownCredits.toLocaleString('en-US')}`;
    this.el.classList.remove('hidden');
    const era = eraReached(this.economy);
    this.techView = { era, selected: (eraTechs(era).find((t) => canUnlock(this.economy, t.id).ok) || eraTechs(era)[0]).id };
    this.setTab(this.only || opts.tab || (this.economy.cargoUnits > 0 ? 'sell' : 'craft'));
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
    this.el.querySelector('[data-tab="log"]')?.classList.toggle('unread', this.tab !== 'log' && hasUnread(this.economy));
    if (this.tab === 'log') { this.body.innerHTML = renderLog(this.economy); markLogRead(this.economy); }
    else if (this.tab === 'sell') this._renderSell();
    else if (this.tab === 'stash') this._renderStash();
    else if (this.tab === 'craft') this.body.innerHTML = renderCraft(this.economy, this.building);
    else if (this.tab === 'tech') this.body.innerHTML = renderTech(this.economy, this.techView);
    else if (this.tab === 'camp') this._renderCamp();
    else if (this.tab === 'contracts') this.body.innerHTML = renderContracts(this.economy, this._offers());
    else if (this.tab === 'awards') this._renderAwards();
    else this._renderConsumables();
    this.body.querySelectorAll('button[data-key]').forEach((b) => b.addEventListener('click', () => this._onAction(/** @type {HTMLElement} */ (b).dataset.key || '')));
    if (focusedKey) /** @type {HTMLElement|null} */ (this.body.querySelector(`[data-key="${focusedKey}"]`))?.focus();
  }

  /** Tech tab keys: [ / ] switch era, arrows move the selection, Enter unlocks. @returns {boolean} handled */
  _techKey(code) {
    const v = this.techView;
    if (code === 'BracketLeft' || code === 'BracketRight') {
      v.era = Math.max(1, Math.min(ERAS.length, v.era + (code === 'BracketRight' ? 1 : -1)));
      v.selected = eraTechs(v.era)[0].id;
    } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(code)) {
      const list = eraTechs(v.era); const i = list.findIndex((t) => t.id === v.selected);
      v.selected = list[(i + (code === 'ArrowRight' || code === 'ArrowDown' ? 1 : -1) + list.length) % list.length].id;
    } else if (code === 'Enter' || code === 'NumpadEnter') {
      // Other focused buttons (era tabs, Unlock) keep their own Enter = click.
      const focus = /** @type {HTMLElement|null} */ (document.activeElement)?.dataset?.key;
      if (focus && !focus.startsWith('techsel:')) return false;
      if (v.selected) this._onAction(`tech:${v.selected}`);
    } else return false;
    this.render();
    return true;
  }

  _onAction(key) {
    const [kind, id, times] = key.split(':');
    if (kind === 'sell') {
      const r = this.economy.sellAll();
      if (r.total > 0) this.bus.emit(EV.TOAST, { text: `Sold cargo for $${r.total.toLocaleString('en-US')}`, kind: 'good' });
    } else if (kind === 'dep') this.economy.deposit();
    else if (kind === 'wd') this.economy.withdraw(+id, 1);
    else if (kind === 'ss') this.economy.sellFromStash(+id, 1);
    else if (kind === 'ssa') this.economy.sellFromStash(+id, Infinity);
    else if (kind === 'tech') {
      const r = unlockTech(this.economy, id);
      if (!r.ok) this.bus.emit(EV.PURCHASE_FAILED, r.reason);
    } else if (kind === 'techsel') this.techView.selected = id;
    else if (kind === 'era') { this.techView.era = +id; this.techView.selected = eraTechs(+id)[0].id; }
    else if (kind === 'bsel') this.building = id;
    else if (kind === 'craft') { const r = craft(this.economy, id, +times || 1); if (!r.ok) this.bus.emit(EV.PURCHASE_FAILED, r.reason); }
    else if (kind === 'eq') this.economy.craftUpgrade(id);
    else if (kind === 'bld' || kind === 'bupg') { const r = upgradeBuilding(this.economy, id); if (!r.ok) this.bus.emit(EV.PURCHASE_FAILED, r.reason); }
    else if (kind === 'acc') { const c = this._offers().find((o) => o.id === id); if (c) acceptContract(this.economy, c); }
    else if (kind === 'ti') { const r = turnIn(this.economy, id); if (!r.ok) this.bus.emit(EV.PURCHASE_FAILED, r.reason); }
    else if (kind === 'buy') this.economy.buyConsumable(id);
    if (this.open) this.render(); // power/building changes emit no event
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
        <tbody>${lines.map((l) => `<tr><td>${swatch(l.ore)}${l.name}</td><td>${l.count}</td><td>$${l.price.toLocaleString('en-US')}</td><td>$${l.total.toLocaleString('en-US')}</td></tr>`).join('')}</tbody>
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
      rows.push(`<tr><td>${swatch(o)}${ore.name}</td><td>${ec.stash[o]}</td>
        <td><button class="btn" data-key="wd:${o}">Take 1</button> <button class="btn" data-key="ss:${o}">Sell 1</button> <button class="btn" data-key="ssa:${o}">Sell all</button></td></tr>`);
    }
    this.body.innerHTML = `<button class="btn primary" data-key="dep:all" ${ec.cargoUnits ? '' : 'disabled'}>Deposit all cargo</button>`
      + (rows.length ? `<table class="sell-table"><thead><tr><th>Ore</th><th>Stored</th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table>` : '<p class="empty">Stash is empty. Deposited ore can be sold or spent on upgrades.</p>');
  }

  _offers() { return rollContracts(this.hooks.seed(), dayNumber(), this.economy.pickTier); }

  _renderCamp() {
    const ec = this.economy;
    const price = (c) => [c.cash ? `$${c.cash.toLocaleString('en-US')}` : '', ...Object.entries(c.ores || {}).map(([o, n]) => `${n}× ${/** @type {any} */ (ORES[+o]).name}`)].filter(Boolean).join(' + ');
    const b = CAMP_BUILDINGS.shop; const lvl = ec.buildings.shop || 0; const max = lvl >= b.levels.length;
    const nextCost = max ? null : b.levels[lvl].cost;
    this.body.innerHTML = `<div class="up-row"><div class="up-info"><div class="up-name">${b.name} <span class="lvl">Lv ${lvl}/${b.levels.length}</span></div>
        <div class="up-stats">Better sell prices${max ? '' : ` · next ${price(nextCost)}`}</div></div>
        <div class="up-buy">${max ? '<span class="maxed">MAX</span>' : `<button class="btn ${ec.canAfford(nextCost) ? 'primary' : ''}" data-key="bld:shop" ${ec.canAfford(nextCost) ? '' : 'disabled'}>Upgrade</button>`}</div></div>`
      + `<p class="empty">Processing buildings (Generator, Furnace, Refinery, Lab, Workshop) are in the Craft tab.<br>Field charging stations: unlock the tech, then press G underground (${ec.stations.length} placed).</p>`;
  }

  _renderAwards() {
    const own = this.economy.achievements;
    this.body.innerHTML = ACHIEVEMENTS.map((a) => `<div class="up-row"><div class="up-info"><div class="up-name">${own.includes(a.id) ? '★ ' + a.name : '☆ ???'}</div><div class="up-stats">${own.includes(a.id) ? a.desc : a.desc.replace(/\d[\d,]*/g, '?')}</div></div></div>`).join('');
  }

  _renderConsumables() {
    const ec = this.economy;
    const desc = {
      dynamite: 'Thrown explosive, 2.5 s fuse, 3×3 blast. Breaks rock up to your pickaxe tier + 1.',
      cell: `Instantly restores ${CONSUMABLES.cell.frac * 100}% of battery energy.`,
      ladder: 'Place on open air (aim + key); it falls to the ground below. Climb with W / S.',
      campKit: 'Pitch underground in a cleared 4×4 space with a solid floor. Rest there to heal and reach your stash.',
      bigBomb: `Thrown explosive with a ${DYNAMITE.BIG_RADIUS * 2 + 1}×${DYNAMITE.BIG_RADIUS * 2 + 1} blast.`,
    };
    this.body.innerHTML = Object.entries(CONSUMABLES).filter(([, c]) => !c.tech || ec.tech.includes(c.tech)).map(([k, c]) => {
      const check = ec.canBuyConsumable(k);
      return `<div class="up-row">
        <div class="up-info"><div class="up-name">${c.name} <span class="lvl">[${c.slot}] owned ${ec.consumables[k]}/${ec.consumableCap(k)}</span></div><div class="up-stats">${/** @type {any} */ (desc)[k]}</div></div>
        <div class="up-buy"><button class="btn ${check.ok ? 'primary' : ''}" data-key="buy:${k}" ${check.ok ? '' : 'disabled'}>$${c.price}</button>${check.ok ? '' : `<div class="reason">${check.reason}</div>`}</div>
      </div>`;
    }).join('');
  }
}
