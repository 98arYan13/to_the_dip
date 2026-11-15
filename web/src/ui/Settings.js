/**
 * @module ui/Settings
 * Pause/settings modal: volume sliders, quality preset, screen shake, reduced flashing,
 * keybind reference, resume / new game. Settings are persisted by the caller.
 */
import { KEYBINDS, SETTINGS_DEFAULT } from '../config.js';

const LABELS = {
  left: 'Walk left', right: 'Walk right', jet: 'Jetpack', mine: 'Mine (hold)', radar: 'Radar',
  slot1: 'Dynamite', slot2: 'Teleporter', slot3: 'Energy cell', interact: 'Base camp terminal', pause: 'Pause / settings', debug: 'Debug overlay', zoomIn: 'Zoom in', zoomOut: 'Zoom out',
};

/** @param {string} code */
function prettyKey(code) {
  const special = { Mouse0: 'Left Mouse', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Space', Escape: 'Esc' };
  if (/** @type {any} */ (special)[code]) return /** @type {any} */ (special)[code];
  return code.replace(/^Key/, '').replace(/^Digit/, '');
}

export class Settings {
  /**
   * @param {HTMLElement} root
   * @param {typeof SETTINGS_DEFAULT} initial
   * @param {{onChange:(s:any)=>void, onClose:()=>void, onNewGame:()=>void}} hooks
   */
  constructor(root, initial, hooks) {
    this.s = { ...SETTINGS_DEFAULT, ...initial };
    this.hooks = hooks;
    this.open = false;
    this.el = document.createElement('div');
    this.el.className = 'modal settings hidden';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'Settings');
    const slider = (key, label) => `<label class="srow"><span>${label}</span><input type="range" min="0" max="1" step="0.01" data-k="${key}"><output data-o="${key}"></output></label>`;
    this.el.innerHTML = `
      <div class="modal-box">
        <header><h2>PAUSED · SETTINGS</h2><button class="btn close" title="Resume (Esc)">✕</button></header>
        <section class="settings-body">
          <div class="col">
            <h3>Audio</h3>
            ${slider('master', 'Master')}${slider('music', 'Music')}${slider('sfx', 'SFX')}${slider('ambience', 'Ambience')}
            <h3>Video</h3>
            <label class="srow"><span>Quality</span><select data-k="quality"><option value="auto">Auto</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select><output data-o="quality"></output></label>
            <h3>Gameplay</h3>
            <label class="srow"><span>Fall speed</span><input type="range" min="0.4" max="2" step="0.05" data-k="fallSpeedMult"><output data-o="fallSpeedMult"></output></label>
            <label class="srow"><span>Hard landing</span><input type="range" min="1.5" max="10" step="0.5" data-k="hardLandingTiles"><output data-o="hardLandingTiles"></output></label>
            <h3>Display</h3>
            <label class="srow check"><input type="checkbox" data-k="shake"><span>Screen shake</span></label>
            <label class="srow check"><input type="checkbox" data-k="reducedFlashing"><span>Reduced flashing</span></label>
          </div>
          <div class="col">
            <h3>Controls</h3>
            <table class="keys">${Object.entries(KEYBINDS).map(([a, codes]) => `<tr><td>${/** @type {any} */ (LABELS)[a] || a}</td><td>${codes.map((c) => `<kbd>${prettyKey(c)}</kbd>`).join(' ')}</td></tr>`).join('')}
              <tr><td>Aim</td><td><kbd>Mouse</kbd></td></tr></table>
          </div>
        </section>
        <footer><button class="btn primary resume">Resume</button><button class="btn danger newgame">New Game</button></footer>
      </div>`;
    root.appendChild(this.el);
    this.el.querySelector('.close')?.addEventListener('click', () => this.close());
    this.el.querySelector('.resume')?.addEventListener('click', () => this.close());
    this.el.querySelector('.newgame')?.addEventListener('click', () => this.hooks.onNewGame());
    this.el.querySelectorAll('[data-k]').forEach((inp) => {
      const el = /** @type {HTMLInputElement} */ (inp);
      el.addEventListener('input', () => this._read(el));
      el.addEventListener('change', () => this._read(el));
    });
    this.el.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); this.close(); }
      else e.stopPropagation();
    });
    this._sync();
  }

  get values() { return this.s; }

  /** @param {HTMLInputElement} el */
  _read(el) {
    const k = el.dataset.k || '';
    const v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? parseFloat(el.value) : el.value;
    /** @type {any} */ (this.s)[k] = v;
    this._sync();
    this.hooks.onChange(this.s);
  }

  /** Show the active auto-selected preset next to the select. @param {string} preset */
  setAutoPreset(preset) { this.autoPreset = preset; this._sync(); }

  _sync() {
    this.el.querySelectorAll('[data-k]').forEach((inp) => {
      const el = /** @type {HTMLInputElement} */ (inp);
      const v = /** @type {any} */ (this.s)[el.dataset.k || ''];
      if (el.type === 'checkbox') el.checked = !!v; else el.value = String(v);
    });
    this.el.querySelectorAll('output[data-o]').forEach((o) => {
      const k = /** @type {HTMLElement} */ (o).dataset.o || '';
      if (k === 'quality') o.textContent = this.s.quality === 'auto' && this.autoPreset ? `(${this.autoPreset})` : '';
      else if (k === 'fallSpeedMult') o.textContent = `${this.s.fallSpeedMult.toFixed(2)}x`;
      else if (k === 'hardLandingTiles') o.textContent = `${this.s.hardLandingTiles.toFixed(1)} tiles`;
      else o.textContent = `${Math.round(/** @type {any} */ (this.s)[k] * 100)}%`;
    });
  }

  show() {
    if (this.open) return;
    this.open = true;
    this.el.classList.remove('hidden');
    /** @type {HTMLElement|null} */ (this.el.querySelector('.resume'))?.focus();
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.el.classList.add('hidden');
    this.hooks.onClose();
  }
}
