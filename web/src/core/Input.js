/**
 * @module core/Input
 * Action-mapped input (keyboard, mouse, optional gamepad). Game logic only sees action names.
 */
import { KEYBINDS, GAMEPAD } from '../config.js';

export class Input {
  /**
   * @param {Window} win
   * @param {HTMLCanvasElement} canvas
   * @param {Record<string,string[]>} [bindings]
   */
  constructor(win, canvas, bindings = KEYBINDS) {
    this.bindings = bindings;
    /** @type {Map<string,string[]>} */
    this.codeToActions = new Map();
    this.actions = Object.keys(bindings);
    /** @type {Record<string,number>} */
    this.held = Object.create(null);
    /** @type {Record<string,boolean>} */
    this.pressed = Object.create(null);
    /** @type {Record<string,boolean>} */
    this.pad = Object.create(null);
    /** @type {Record<string,boolean>} */
    this.padPrev = Object.create(null);
    for (const a of this.actions) {
      this.held[a] = 0; this.pressed[a] = false; this.pad[a] = false; this.padPrev[a] = false;
      for (const code of bindings[a]) {
        if (!this.codeToActions.has(code)) this.codeToActions.set(code, []);
        /** @type {string[]} */ (this.codeToActions.get(code)).push(a);
      }
    }
    /** @type {Set<string>} */
    this.heldCodes = new Set();
    /** @type {((action:string)=>void)[]} */
    this.pressListeners = [];
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseInside = false;
    this.padAimX = 0;
    this.padAimY = 0;
    this.padMoveX = 0;
    this.usingPad = false;
    this.canvas = canvas;

    win.addEventListener('keydown', (e) => {
      if (isFormTarget(e.target)) return;
      if (this.codeToActions.has(e.code)) e.preventDefault();
      this._down(e.code);
    });
    win.addEventListener('keyup', (e) => this._up(e.code));
    canvas.addEventListener('mousedown', (e) => { this.usingPad = false; this._down('Mouse' + e.button); });
    win.addEventListener('mouseup', (e) => this._up('Mouse' + e.button));
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left;
      this.mouseY = e.clientY - r.top;
      this.mouseInside = true;
      this.usingPad = false;
    });
    canvas.addEventListener('mouseleave', () => { this.mouseInside = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    win.addEventListener('blur', () => this.clear());
  }

  /** Subscribe to immediate (per-event) action presses, e.g. for UI toggles. */
  onPress(fn) { this.pressListeners.push(fn); }

  /** @param {string} code */
  _down(code) {
    if (this.heldCodes.has(code)) return;
    const acts = this.codeToActions.get(code);
    if (!acts) return;
    this.heldCodes.add(code);
    for (const a of acts) {
      this.held[a]++;
      this.pressed[a] = true;
      for (const fn of this.pressListeners) fn(a);
    }
  }

  /** @param {string} code */
  _up(code) {
    if (!this.heldCodes.has(code)) return;
    this.heldCodes.delete(code);
    const acts = this.codeToActions.get(code);
    if (!acts) return;
    for (const a of acts) this.held[a] = Math.max(0, this.held[a] - 1);
  }

  clear() {
    this.heldCodes.clear();
    for (const a of this.actions) { this.held[a] = 0; this.pressed[a] = false; }
  }

  /** @param {string} action */
  isDown(action) { return this.held[action] > 0 || this.pad[action]; }

  /** True if pressed since last endStep(). @param {string} action */
  wasPressed(action) { return this.pressed[action]; }

  /** Call after each fixed update step. */
  endStep() {
    for (const a of this.actions) this.pressed[a] = false;
  }

  /** Poll the first gamepad (optional). */
  pollGamepad() {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : null;
    const gp = pads && pads[0];
    if (!gp) return;
    const dz = GAMEPAD.DEADZONE;
    const lx = gp.axes[0] || 0;
    this.padMoveX = Math.abs(lx) > dz ? lx : 0;
    const ax = gp.axes[2] || 0;
    const ay = gp.axes[3] || 0;
    if (Math.abs(ax) > dz || Math.abs(ay) > dz) {
      this.padAimX = ax; this.padAimY = ay; this.usingPad = true;
    }
    for (const a of this.actions) this.padPrev[a] = this.pad[a];
    this.pad.left = this.padMoveX < 0;
    this.pad.right = this.padMoveX > 0;
    for (const [action, idx] of Object.entries(GAMEPAD.BUTTONS)) {
      const b = gp.buttons[idx];
      this.pad[action] = !!(b && b.pressed);
    }
    for (const a of this.actions) {
      if (this.pad[a] && !this.padPrev[a]) {
        this.pressed[a] = true;
        this.usingPad = true;
        for (const fn of this.pressListeners) fn(a);
      }
    }
  }
}

/** @param {EventTarget|null} t */
function isFormTarget(t) {
  if (!t || !(/** @type {any} */ (t)).tagName) return false;
  const tag = /** @type {HTMLElement} */ (t).tagName;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
}
