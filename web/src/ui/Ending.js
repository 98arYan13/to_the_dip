/**
 * @module ui/Ending
 * Victory screen shown once when the Core is stabilized; closing it keeps the game running (post-game digging).
 */
import { LOG_ENTRIES } from '../story.js';

export class Ending {
  /** @param {HTMLElement} root @param {{onClose:()=>void}} hooks */
  constructor(root, hooks) {
    this.open = false;
    this.el = document.createElement('div');
    this.el.className = 'modal hidden';
    this.el.setAttribute('role', 'dialog');
    this.el.innerHTML = `<div class="modal-box"><header><h2>THE SEED IS SILENT</h2></header>
      <section class="tab-body"><p class="end-text">${LOG_ENTRIES.find((e) => e.id === 'ending')?.text ?? ''}</p>
      <p class="end-note">Reward: $100,000. Keep digging — every depth is yours now.</p>
      <button class="btn primary" data-close>Keep digging</button></section></div>`;
    root.appendChild(this.el);
    this.el.querySelector('[data-close]')?.addEventListener('click', () => { this.close(); hooks.onClose(); });
  }

  /** @param {{title:string,text:string}} [custom] replaces the Core text (Tessera's ending, no cash reward) */
  show(custom) {
    if (custom) {
      this.el.querySelector('h2').textContent = custom.title;
      this.el.querySelector('.end-text').textContent = custom.text;
      this.el.querySelector('.end-note').textContent = 'Keep digging — every depth is yours now.';
    }
    this.open = true; this.el.classList.remove('hidden'); /** @type {HTMLElement} */ (this.el.querySelector('button'))?.focus(); }
  close() { this.open = false; this.el.classList.add('hidden'); }
}
