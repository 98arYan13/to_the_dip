/**
 * @module ui/Ending
 * Victory screen shown once when the Core is stabilized; closing it keeps the game running (post-game digging).
 */
export class Ending {
  /** @param {HTMLElement} root @param {{onClose:()=>void}} hooks */
  constructor(root, hooks) {
    this.open = false;
    this.el = document.createElement('div');
    this.el.className = 'modal hidden';
    this.el.setAttribute('role', 'dialog');
    this.el.innerHTML = `<div class="modal-box"><header><h2>THE CORE IS STABLE</h2></header>
      <section class="tab-body"><p>The heart of the world settles. The tremors fade, and the way back up is quiet.</p>
      <p>Reward: $100,000. Keep digging — every depth is yours now.</p>
      <button class="btn primary" data-close>Keep digging</button></section></div>`;
    root.appendChild(this.el);
    this.el.querySelector('[data-close]')?.addEventListener('click', () => { this.close(); hooks.onClose(); });
  }

  show() { this.open = true; this.el.classList.remove('hidden'); /** @type {HTMLElement} */ (this.el.querySelector('button'))?.focus(); }
  close() { this.open = false; this.el.classList.add('hidden'); }
}
