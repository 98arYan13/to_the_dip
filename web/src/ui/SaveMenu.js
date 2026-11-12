/**
 * @module ui/SaveMenu
 * Save-slot picker: save into, load from, or start a new game in one of SAVE.SLOTS slots.
 * Risky actions need a second click on the same button (no window.confirm: it is blocked in some embeds).
 */
import { SAVE, WORLD } from '../config.js';
import { dateKey } from '../systems/Daily.js';

/** localStorage key for slot n (slot 1 keeps the pre-slot key so old saves stay in slot 1). */
export const slotKey = (n) => (n === 0 ? `${SAVE.KEY}.daily.${dateKey()}` : n === 1 ? SAVE.KEY : `${SAVE.KEY}.${n}`);

/** Best daily scores by date. @param {any} storage */
export function dailyBests(storage) { try { return JSON.parse(storage.getItem(`${SAVE.KEY}.dailybest`) || '{}'); } catch { return {}; } }

export class SaveMenu {
  /**
   * @param {HTMLElement} root
   * @param {any} storage
   * @param {{active:()=>number, onSave:(n:number)=>void, onLoad:(n:number)=>void, onNew:(n:number)=>void, onClose:()=>void}} hooks
   */
  constructor(root, storage, hooks) {
    this.storage = storage; this.hooks = hooks; this.open = false; this.armed = '';
    this.el = document.createElement('div');
    this.el.className = 'modal hidden';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'Save slots');
    this.el.innerHTML = `<div class="modal-box"><header><h2>SAVE SLOTS</h2><button class="btn close" title="Close (Esc)">✕</button></header>
      <section class="tab-body slots-body"></section><footer>Autosave writes to the active slot every ${SAVE.AUTOSAVE_SEC}s.</footer></div>`;
    root.appendChild(this.el);
    this.body = /** @type {HTMLElement} */ (this.el.querySelector('.slots-body'));
    this.el.querySelector('.close')?.addEventListener('click', () => this.close());
    this.body.addEventListener('click', (ev) => {
      const b = /** @type {HTMLElement} */ (ev.target).closest('button');
      if (!b) return;
      const n = Number(b.dataset.slot); const act = b.dataset.act || '';
      const id = `${act}${n}`;
      const overwrite = act === 'save' && n !== this.hooks.active() && this._has(n);
      if ((act !== 'save' || overwrite) && this.armed !== id) { this.armed = id; this.render(); return; }
      this.armed = '';
      if (act === 'save') { this.hooks.onSave(n); this.render(); }
      else if (act === 'load') this.hooks.onLoad(n);
      else if (act === 'new') this.hooks.onNew(n);
    });
  }

  _has(n) { try { return !!this.storage.getItem(slotKey(n)); } catch { return false; } }

  _meta(n) {
    try { return JSON.parse(this.storage.getItem(slotKey(n) + '.meta') || 'null'); } catch { return null; }
  }

  render() {
    const active = this.hooks.active();
    let html = '';
    for (let n = 1; n <= SAVE.SLOTS; n++) {
      const m = this._meta(n);
      const has = this._has(n);
      const info = !has ? 'Empty' : m
        ? `${Math.max(0, Math.round(m.depthTiles)) * WORLD.METERS_PER_TILE} m · $${Number(m.credits).toLocaleString('en-US')} · ${new Date(m.t).toLocaleString()}`
        : 'Saved game';
      const btn = (act, label, danger) => `<button class="btn${danger ? ' danger' : ''}" data-act="${act}" data-slot="${n}">${this.armed === act + n ? 'Sure?' : label}</button>`;
      html += `<div class="up-row"><div><div class="up-name">Slot ${n}${n === active ? ' <span class="lvl">(active)</span>' : ''}</div><div class="up-stats">${info}</div></div>
        <div class="up-buy">${btn('save', 'Save here', false)} ${has && n !== active ? btn('load', 'Load', false) : ''} ${btn('new', 'New game', true)}</div></div>`;
    }
    const best = dailyBests(this.storage)[dateKey()];
    const dHas = this._has(0);
    html += `<div class="up-row"><div><div class="up-name">Daily Challenge ${dateKey()}${active === 0 ? ' <span class="lvl">(active)</span>' : ''}</div><div class="up-stats">Same world for everyone today · base equipment · separate save${best ? ` · best ${best}` : ''}</div></div>
      <div class="up-buy"><button class="btn primary" data-act="${dHas ? 'load' : 'new'}" data-slot="0">${this.armed === (dHas ? 'load0' : 'new0') ? 'Sure?' : dHas ? 'Resume' : 'Play'}</button></div></div>`;
    this.body.innerHTML = html;
  }

  show() { this.armed = ''; this.render(); this.el.classList.remove('hidden'); this.open = true; }
  close() { if (!this.open) return; this.el.classList.add('hidden'); this.open = false; this.hooks.onClose(); }
}
