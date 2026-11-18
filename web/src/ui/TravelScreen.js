/**
 * @module ui/TravelScreen
 * Launch pad modal: one button per destination. Closes on Esc / E / the close button.
 */
import { ORES } from '../config.js';
import { destinations, canTravel } from '../systems/Travel.js';

export class TravelScreen {
  /** @param {HTMLElement} root @param {any} economy @param {{onTravel:(dest:string)=>void, onClose:()=>void}} hooks */
  constructor(root, economy, hooks) {
    this.economy = economy; this.hooks = hooks; this.open = false;
    this.el = document.createElement('div');
    this.el.className = 'modal shop hidden';
    this.el.setAttribute('role', 'dialog');
    this.el.innerHTML = '<div class="modal-box"><header><h2>LAUNCH PAD</h2><button class="btn close" title="Close (Esc)">✕</button></header><section class="tab-body"></section></div>';
    root.appendChild(this.el);
    this.body = /** @type {HTMLElement} */ (this.el.querySelector('.tab-body'));
    this.el.querySelector('.close')?.addEventListener('click', () => this.close());
    this.body.addEventListener('click', (e) => {
      const b = /** @type {HTMLElement} */ (e.target).closest('[data-dest]');
      if (b) this.hooks.onTravel(/** @type {HTMLElement} */ (b).dataset.dest || '');
    });
    window.addEventListener('keydown', (e) => { if (this.open && (e.key === 'Escape' || e.key === 'e')) { e.preventDefault(); e.stopPropagation(); this.close(); } }, true);
  }

  show() {
    const ec = this.economy;
    this.body.innerHTML = destinations(ec).map((d) => {
      const cost = Object.entries(d.cost).map(([o, n]) => `${n}× ${ORES[+o].name}`).join(', ') || 'Free';
      const c = canTravel(ec, d.id);
      const btn = d.known ? `<button class="btn primary" data-dest="${d.id}"${c.ok ? '' : ' disabled'}>${d.current ? 'Here' : 'Launch'}</button>` : '';
      return `<div class="up-row"><div class="up-info"><div class="up-name">${d.known ? d.name : '???'}</div><div class="up-stats">${d.known ? `${cost}${c.ok || d.current ? '' : ` · ${c.reason}`}` : 'Unknown destination'}</div></div><div class="up-buy">${btn}</div></div>`;
    }).join('');
    this.open = true; this.el.classList.remove('hidden');
  }

  close() { this.open = false; this.el.classList.add('hidden'); this.hooks.onClose(); }
}
