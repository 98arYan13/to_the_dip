/**
 * @module ui/BackpackPanel
 * Tab toggles a grid of backpack slots: one stack per ore/material with its icon, count and weight.
 * Slot count comes from the rig level (economy.slots); empty slots show as dim boxes.
 */
import { ORES, oreIcon } from '../config.js';
import { EV } from '../core/EventBus.js';
import { usedSlots } from '../systems/Economy.js';

export class BackpackPanel {
  /** @param {HTMLElement} root @param {import('../core/EventBus.js').EventBus} bus @param {any} economy */
  constructor(root, bus, economy) {
    this.economy = economy;
    this.open = false;
    this.el = document.createElement('div');
    this.el.className = 'backpack hidden';
    this.el.setAttribute('aria-label', 'Backpack');
    root.appendChild(this.el);
    bus.on(EV.CARGO_CHANGED, () => { if (this.open) this.render(); });
  }

  toggle() {
    this.open = !this.open;
    this.el.classList.toggle('hidden', !this.open);
    if (this.open) this.render();
  }

  render() {
    const ec = this.economy;
    const slots = Number.isFinite(ec.slots) ? ec.slots : usedSlots(ec.cargo);
    const cells = [];
    for (let o = 1; o < ec.cargo.length; o++) {
      const n = ec.cargo[o]; if (!n) continue;
      const ore = /** @type {any} */ (ORES[o]); const src = oreIcon(o);
      const pic = src ? `<img src="${src}" alt="">` : `<span class="dot" style="background:${ore.colors.light}"></span>`;
      cells.push(`<div class="bp-slot" title="${ore.name} — ${(n * ore.kg).toFixed(1)} kg">${pic}<span class="bp-n">${n}</span></div>`);
    }
    while (cells.length < slots) cells.push('<div class="bp-slot empty"></div>');
    this.el.innerHTML = `<header>BACKPACK <span>${usedSlots(ec.cargo)}/${slots} slots · ${ec.cargoWeight.toFixed(1)}/${ec.capacity} kg</span> <kbd>Tab</kbd></header><div class="bp-grid">${cells.join('')}</div>`;
  }
}
