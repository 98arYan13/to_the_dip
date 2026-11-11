/**
 * @module ui/DevPanel
 * Developer overrides (F4 or the Dev button): pick any digging tool, lock health/energy full,
 * reveal the whole map. Nothing here is saved; turning dev mode off restores the real state.
 */
import { PICKAXES } from '../config.js';

export class DevPanel {
  /**
   * @param {HTMLElement} root
   * @param {{onChange:(s:{on:boolean, pick:number, lockHp:boolean, lockEnergy:boolean, reveal:boolean})=>void}} hooks
   */
  constructor(root, hooks) {
    this.hooks = hooks;
    /** pick 0 = the tool you own. */
    this.state = { on: false, pick: 0, lockHp: false, lockEnergy: false, reveal: false };
    this.el = document.createElement('div');
    this.el.className = 'panel dev hidden';
    const opts = PICKAXES.map((p) => `<option value="${p.tier}">${p.tier}. ${p.name}</option>`).join('');
    this.el.innerHTML = `<b>DEV</b>
      <label class="srow check"><input type="checkbox" data-k="on"><span>Dev mode</span></label>
      <label class="srow"><span>Tool</span><select data-k="pick"><option value="0">Owned</option>${opts}</select></label>
      <label class="srow check"><input type="checkbox" data-k="lockHp"><span>Lock health full</span></label>
      <label class="srow check"><input type="checkbox" data-k="lockEnergy"><span>Lock energy full</span></label>
      <label class="srow check"><input type="checkbox" data-k="reveal"><span>Reveal all tiles</span></label>`;
    root.appendChild(this.el);
    this.el.addEventListener('change', (ev) => {
      const t = /** @type {HTMLInputElement} */ (ev.target);
      const k = t.dataset.k; if (!k) return;
      /** @type {any} */ (this.state)[k] = k === 'pick' ? Number(t.value) : t.checked;
      this.hooks.onChange(this.state);
    });
  }

  /** Effective overrides: all off unless the master switch is on. */
  get active() { return this.state.on; }

  toggle() { this.el.classList.toggle('hidden'); }
}
