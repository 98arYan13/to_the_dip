/**
 * @module ui/StoryModal
 * Generic story pop-up (intro, relic decoded). Same markup as Ending; closes on button, Enter or Escape.
 */
export class StoryModal {
  /** @param {HTMLElement} root @param {{onClose:()=>void}} hooks */
  constructor(root, hooks) {
    this.open = false;
    this.el = document.createElement('div');
    this.el.className = 'modal story hidden';
    this.el.setAttribute('role', 'dialog');
    this.el.innerHTML = '<div class="modal-box"><header><h2></h2></header><section class="tab-body"><div class="story-text"></div><button class="btn primary" data-close></button></section></div>';
    root.appendChild(this.el);
    this.h2 = /** @type {HTMLElement} */ (this.el.querySelector('h2'));
    this.text = /** @type {HTMLElement} */ (this.el.querySelector('.story-text'));
    this.btn = /** @type {HTMLElement} */ (this.el.querySelector('[data-close]'));
    const close = () => { this.open = false; this.el.classList.add('hidden'); hooks.onClose(); };
    this.btn.addEventListener('click', close);
    window.addEventListener('keydown', (e) => {
      if (this.open && (e.key === 'Enter' || e.key === 'Escape')) { e.preventDefault(); e.stopPropagation(); close(); }
    }, true);
  }

  show(title, text, buttonLabel = 'Continue') {
    this.h2.textContent = title;
    this.text.replaceChildren(...text.split(/\n\s*\n/).map((p) => { const el = document.createElement('p'); el.textContent = p; return el; }));
    this.btn.textContent = buttonLabel;
    this.open = true; this.el.classList.remove('hidden'); this.btn.focus();
  }
}
