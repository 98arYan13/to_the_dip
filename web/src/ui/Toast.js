/**
 * @module ui/Toast
 * Non-blocking notifications. Identical messages are throttled.
 */
import { UI } from '../config.js';

export class Toast {
  /** @param {HTMLElement} root */
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'toasts';
    root.appendChild(this.el);
    /** @type {Map<string, number>} */
    this.recent = new Map();
  }

  /**
   * @param {string} text
   * @param {'info'|'good'|'warn'|'bad'} [kind]
   */
  show(text, kind = 'info') {
    const now = performance.now();
    const last = this.recent.get(text);
    if (last !== undefined && now - last < UI.TOAST_TIME * 1000) return;
    this.recent.set(text, now);
    while (this.el.children.length >= UI.TOAST_MAX) this.el.firstElementChild?.remove();
    const t = document.createElement('div');
    t.className = `toast toast-${kind}`;
    t.textContent = text;
    this.el.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => {
      t.classList.remove('in');
      t.classList.add('out');
      setTimeout(() => t.remove(), 400);
    }, UI.TOAST_TIME * 1000);
  }
}
