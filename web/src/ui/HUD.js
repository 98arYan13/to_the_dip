/**
 * @module ui/HUD
 * DOM/CSS heads-up display. Updated only from events (never per frame).
 */
import { EV } from '../core/EventBus.js';
import { CONSUMABLES, MATERIALS, ORES, TILE, FLAG, ENERGY } from '../config.js';
import { canMine, requirementHint } from '../systems/Mining.js';

export class HUD {
  /**
   * @param {HTMLElement} root
   * @param {import('../core/EventBus.js').EventBus} bus
   * @param {{economy:any, energy:any, getWorld:()=>any, onSave:()=>void, onReset:()=>void, onMute:()=>boolean, onSettings:()=>void}} d
   */
  constructor(root, bus, d) {
    this.d = d;
    this.bus = bus;
    root.innerHTML = `
      <div class="panel stats">
        <div class="row energy"><span class="lbl">ENERGY</span><div class="bar"><div class="fill"></div></div><span class="val e-val">100</span></div>
        <div class="row"><span class="lbl">SUIT</span><span class="val hp-val">100%</span></div>
        <div class="row"><span class="lbl">CARGO</span><span class="val cargo-val">0 kg</span></div>
        <div class="row"><span class="lbl">CREDITS</span><span class="val credits-val">$0</span></div>
        <div class="row"><span class="lbl">DEPTH</span><span class="val depth-val">0 m</span></div>
        <div class="row layer-val">Surface · Base Camp</div>
        <div class="row pick"><span class="pick-icon"></span><span class="pick-name">Bronze Pickaxe</span></div>
      </div>
      <div class="right">
        <div class="minimap-wrap"></div>
        <div class="buttons">
          <button class="btn" data-act="save" title="Save game">Save</button>
          <button class="btn" data-act="mute" title="Mute audio">Mute</button>
          <button class="btn" data-act="settings" title="Settings (Esc)">Menu</button>
          <button class="btn danger" data-act="reset" title="New game / reset world">Reset</button>
        </div>
      </div>
      <div class="prompt hidden"></div>
      <div class="slots">
        <div class="slot" data-slot="dynamite"><kbd>1</kbd><span class="s-name">${CONSUMABLES.dynamite.short}</span><span class="s-count">×0</span></div>
        <div class="slot" data-slot="teleporter"><kbd>2</kbd><span class="s-name">${CONSUMABLES.teleporter.short}</span><span class="s-count">×0</span></div>
        <div class="slot" data-slot="cell"><kbd>3</kbd><span class="s-name">${CONSUMABLES.cell.short}</span><span class="s-count">×0</span></div>
        <div class="slot radar-slot"><kbd>R</kbd><span class="s-name">Radar</span><span class="s-count r-cd">ready</span></div>
      </div>
      <div class="tooltip hidden"></div>`;
    const q = (s) => /** @type {HTMLElement} */ (root.querySelector(s));
    this.el = {
      energyRow: q('.energy'), fill: q('.fill'), eVal: q('.e-val'), cargo: q('.cargo-val'), hp: q('.hp-val'), credits: q('.credits-val'),
      depth: q('.depth-val'), layer: q('.layer-val'), pickIcon: q('.pick-icon'), pickName: q('.pick-name'),
      prompt: q('.prompt'), tooltip: q('.tooltip'), radarCd: q('.r-cd'), minimapWrap: q('.minimap-wrap'),
      mute: q('[data-act="mute"]'),
    };
    root.querySelectorAll('.btn').forEach((b) => b.addEventListener('click', (ev) => {
      const act = /** @type {HTMLElement} */ (ev.currentTarget).dataset.act;
      /** @type {HTMLElement} */ (ev.currentTarget).blur();
      if (act === 'save') d.onSave();
      else if (act === 'reset') d.onReset();
      else if (act === 'settings') d.onSettings();
      else if (act === 'mute') this.setMuted(d.onMute());
    }));
    this.slotCounts = {};
    root.querySelectorAll('.slot[data-slot]').forEach((s) => { this.slotCounts[/** @type {HTMLElement} */ (s).dataset.slot] = s.querySelector('.s-count'); });

    bus.on(EV.ENERGY_CHANGED, () => this.refreshEnergy());
    bus.on(EV.CARGO_CHANGED, () => this.refreshCargo());
    bus.on(EV.HP_CHANGED, (hp) => { this.el.hp.textContent = `${Math.round(hp)}%`; this.el.hp.classList.toggle('full', hp < 35); });
    bus.on(EV.UPGRADE_BOUGHT, () => { this.refreshPick(); this.refreshCargo(); this.refreshEnergy(); });
    bus.on(EV.CREDITS_CHANGED, () => this.refreshCredits());
    bus.on(EV.CONSUMABLES_CHANGED, () => this.refreshSlots());
    bus.on(EV.DEPTH_CHANGED, (p) => { this.el.depth.textContent = `${p.meters} m`; this.el.layer.textContent = p.layer; });
    bus.on(EV.PROMPT, (text) => { this.el.prompt.textContent = text || ''; this.el.prompt.classList.toggle('hidden', !text); });
    bus.on(EV.HOVER_TILE, (i) => this.refreshTooltip(i));
    this.mouseX = 0; this.mouseY = 0;
    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX; this.mouseY = e.clientY;
      this.el.tooltip.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 14}px)`;
    });
    this.refreshAll();
  }

  get minimapParent() { return this.el.minimapWrap; }

  refreshAll() {
    this.refreshEnergy(); this.refreshCargo(); this.refreshCredits(); this.refreshPick(); this.refreshSlots();
  }

  refreshEnergy() {
    const e = this.d.energy;
    const f = Math.max(0, Math.min(1, e.value / e.max));
    this.el.fill.style.width = `${(f * 100).toFixed(1)}%`;
    this.el.eVal.textContent = `${Math.ceil(e.value)}/${e.max}`;
    this.el.energyRow.classList.toggle('low', f < ENERGY.LOW_THRESHOLD);
  }

  refreshCargo() {
    const ec = this.d.economy;
    this.el.cargo.textContent = `${ec.cargoWeight.toFixed(1)}/${ec.capacity} kg · speed ${Math.round(ec.speedMult * 100)}%`;
    this.el.cargo.classList.toggle('full', ec.loadFrac >= 0.95);
  }

  refreshCredits() { this.el.credits.textContent = `$${this.d.economy.credits.toLocaleString('en-US')}`; }

  refreshPick() {
    const p = this.d.economy.pickaxe;
    this.el.pickIcon.style.background = p.color;
    this.el.pickName.textContent = `${p.name} (T${p.tier})`;
  }

  refreshSlots() {
    const c = this.d.economy.consumables;
    for (const k of Object.keys(this.slotCounts)) this.slotCounts[k].textContent = `×${c[k]}`;
  }

  /** @param {number} cd seconds remaining */
  setRadarCooldown(cd) {
    const txt = cd > 0 ? `${cd.toFixed(0)}s` : 'ready';
    if (this.el.radarCd.textContent !== txt) this.el.radarCd.textContent = txt;
  }

  setMuted(m) { this.el.mute.textContent = m ? 'Unmute' : 'Mute'; }

  refreshTooltip(i) {
    const tt = this.el.tooltip;
    const w = this.d.getWorld();
    if (i < 0 || !w || !(w.flags[i] & FLAG.DISCOVERED)) { tt.classList.add('hidden'); return; }
    const t = w.tileType[i];
    if (t === TILE.AIR) { tt.classList.add('hidden'); return; }
    const ore = w.oreType[i];
    const m = MATERIALS[t];
    const name = ore ? `${/** @type {any} */ (ORES[ore]).name} in ${m.name}` : m.name;
    let status = '';
    if (m.solid) {
      const ok = canMine(t, ore, this.d.economy.pickTier);
      status = ok ? '<span class="ok">Mineable</span>' : `<span class="no">${requirementHint(t, ore)}</span>`;
    } else status = '<span class="muted">Not solid</span>';
    tt.innerHTML = `<b>${name}</b><br>${status}`;
    tt.classList.remove('hidden');
  }
}
