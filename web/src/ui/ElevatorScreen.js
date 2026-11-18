/**
 * @module ui/ElevatorScreen
 * Cargo elevator modal: one button per other stop. Closes on Esc / E / the close button.
 */
import { stops, ride } from '../systems/Elevator.js';

export class ElevatorScreen {
  /** @param {HTMLElement} root @param {any} economy @param {{onRide:(to:{x:number,y:number}, seconds:number)=>void, onClose:()=>void, here:()=>{y:number}}} hooks */
  constructor(root, economy, hooks) {
    this.economy = economy; this.hooks = hooks; this.open = false;
    this.el = document.createElement('div');
    this.el.className = 'modal shop hidden';
    this.el.setAttribute('role', 'dialog');
    this.el.innerHTML = '<div class="modal-box"><header><h2>CARGO ELEVATOR</h2><button class="btn close" title="Close (Esc)">✕</button></header><section class="tab-body"></section></div>';
    root.appendChild(this.el);
    this.body = /** @type {HTMLElement} */ (this.el.querySelector('.tab-body'));
    this.el.querySelector('.close')?.addEventListener('click', () => this.close());
    this.body.addEventListener('click', (e) => {
      const b = /** @type {HTMLElement} */ (e.target).closest('[data-stop]');
      if (!b) return;
      const to = stops(this.economy)[+(/** @type {HTMLElement} */ (b).dataset.stop || 0)];
      const r = ride(this.economy, this.hooks.here(), to);
      if (r.ok) { this.close(); this.hooks.onRide(to, r.seconds); } else this.show(r.reason);
    });
    window.addEventListener('keydown', (e) => { if (this.open && (e.key === 'Escape' || e.key === 'e')) { e.preventDefault(); e.stopPropagation(); this.close(); } }, true);
  }

  show(note = '') {
    const here = this.hooks.here();
    this.body.innerHTML = (note ? `<p class="empty">${note}</p>` : '') + stops(this.economy).map((s, i) => {
      const cur = Math.abs(s.y - here.y) < 3;
      return `<div class="up-row"><div class="up-info"><div class="up-name">${s.label}</div></div><div class="up-buy"><button class="btn primary" data-stop="${i}"${cur ? ' disabled' : ''}>${cur ? 'Here' : 'Ride'}</button></div></div>`;
    }).join('');
    this.open = true; this.el.classList.remove('hidden');
  }

  close() { this.open = false; this.el.classList.add('hidden'); this.hooks.onClose(); }
}
