/**
 * @module ui/HUD
 * DOM/CSS heads-up display. Updated only from events (never per frame).
 */
import { EV } from '../core/EventBus.js';
import { CONSUMABLES, MATERIALS, ORES, TILE, FLAG, ENERGY, PHYSICS, UPGRADES } from '../config.js';
import { currentMission } from '../systems/Story.js';
import { canMine, requirementHint, isCampGround, CAMP_HINT } from '../systems/Mining.js';

export class HUD {
  /**
   * @param {HTMLElement} root
   * @param {import('../core/EventBus.js').EventBus} bus
   * @param {{economy:any, energy:any, getWorld:()=>any, onSave:()=>void, onSlots:()=>void, onDev:()=>void, onMusic:()=>boolean, onMute:()=>boolean, onSettings:()=>void}} d
   */
  constructor(root, bus, d) {
    this.d = d;
    this.bus = bus;
    root.innerHTML = `
      <div class="panel stats">
        <div class="row energy"><span class="lbl">ENERGY</span><div class="bar"><div class="fill"></div></div><span class="val e-val">100</span></div>
        <div class="row health"><span class="lbl">HEALTH</span><div class="bar"><div class="hp-fill"></div></div><span class="val hp-val">100</span></div>
        <div class="row"><span class="lbl">CARGO</span><span class="val cargo-val">0 kg</span></div>
        <div class="row"><span class="lbl">CREDITS</span><span class="val credits-val">$0</span></div>
        <div class="row"><span class="lbl">TEMP</span><span class="val temp-val">15 °C</span></div>
        <div class="row"><span class="lbl">DEPTH</span><span class="val depth-val">0 m</span></div>
        <div class="row mission-val"></div>
        <div class="row siphon-val hidden"></div>
        <div class="row layer-val">Surface · Base Camp</div>
        <div class="row pick"><span class="pick-icon"></span><span class="pick-name">Bronze Pickaxe</span></div>
      </div>
      <div class="right">
        <div class="minimap-wrap"></div>
        <div class="buttons">
          <button class="btn" data-act="save" title="Save game">Save</button>
          <button class="btn" data-act="mute" title="Mute audio">Mute</button>
          <button class="btn" data-act="music" title="Toggle music">Music: on</button>
          <button class="btn" data-act="settings" title="Settings (Esc)">Menu</button>
          <button class="btn" data-act="dev" title="Developer options (F4)">Dev</button>
          <button class="btn" data-act="slots" title="Save slots, load, new game">Slots</button>
        </div>
      </div>
      <div class="prompt hidden"></div>
      <div class="pulse-banner hidden"></div><div class="pulse-flash"></div>
      <div class="slots">
        <div class="slot" data-slot="dynamite"><kbd>1</kbd><img class="s-icon" src="icons/dynamite.png" alt=""><span class="s-name">${CONSUMABLES.dynamite.short}</span><span class="s-count">×0</span></div>
        <div class="slot" data-slot="warp"><kbd>2</kbd><img class="s-icon" src="icons/warp.png" alt=""><span class="s-name">Warp</span><span class="s-count">×0</span></div>
        <div class="slot" data-slot="cell"><kbd>3</kbd><img class="s-icon" src="icons/cell.png" alt=""><span class="s-name">${CONSUMABLES.cell.short}</span><span class="s-count">×0</span></div>
        <div class="slot" data-slot="ladder"><kbd>4</kbd><img class="s-icon" src="icons/ladder.png" alt=""><span class="s-name">${CONSUMABLES.ladder.short}</span><span class="s-count">×0</span></div>
        <div class="slot" data-slot="bigBomb"><kbd>5</kbd><img class="s-icon" src="icons/bigBomb.png" alt=""><span class="s-name">${CONSUMABLES.bigBomb.short}</span><span class="s-count">×0</span></div>
        <div class="slot" data-slot="campKit"><kbd>6</kbd><img class="s-icon" src="icons/campKit.png" alt=""><span class="s-name">${CONSUMABLES.campKit.short}</span><span class="s-count">×0</span></div>
        <div class="slot radar-slot"><kbd>R</kbd><img class="s-icon" src="icons/radar.png" alt=""><span class="s-name">Radar</span><span class="s-count r-cd">ready</span></div>
      </div>
      <div class="tooltip hidden"></div>`;
    const q = (s) => /** @type {HTMLElement} */ (root.querySelector(s));
    this.el = {
      energyRow: q('.energy'), fill: q('.fill'), eVal: q('.e-val'), cargo: q('.cargo-val'), hp: q('.hp-val'), hpFill: q('.hp-fill'), healthRow: q('.health'), credits: q('.credits-val'),
      depth: q('.depth-val'), temp: q('.temp-val'), layer: q('.layer-val'), mission: q('.mission-val'), siphon: q('.siphon-val'), pickIcon: q('.pick-icon'), pickName: q('.pick-name'),
      prompt: q('.prompt'), pulseBanner: q('.pulse-banner'), pulseFlash: q('.pulse-flash'), tooltip: q('.tooltip'), radarCd: q('.r-cd'), minimapWrap: q('.minimap-wrap'),
      mute: q('[data-act="mute"]'), music: q('[data-act="music"]'),
    };
    root.querySelectorAll('.btn').forEach((b) => b.addEventListener('click', (ev) => {
      const act = /** @type {HTMLElement} */ (ev.currentTarget).dataset.act;
      /** @type {HTMLElement} */ (ev.currentTarget).blur();
      if (act === 'save') d.onSave();
      else if (act === 'slots') d.onSlots();
      else if (act === 'dev') d.onDev();
      else if (act === 'music') this.setMusic(d.onMusic());
      else if (act === 'settings') d.onSettings();
      else if (act === 'mute') this.setMuted(d.onMute());
    }));
    this.slotCounts = {};
    root.querySelectorAll('.slot[data-slot]').forEach((s) => { this.slotCounts[/** @type {HTMLElement} */ (s).dataset.slot] = s.querySelector('.s-count'); });

    bus.on(EV.ENERGY_CHANGED, () => this.refreshEnergy());
    bus.on(EV.CARGO_CHANGED, () => { this.refreshCargo(); this.refreshSlots(); });
    bus.on(EV.HP_CHANGED, (hp) => { this.el.hp.textContent = `${Math.round(hp)}`; this.el.hpFill.style.width = `${hp}%`; this.el.healthRow.classList.toggle('low', hp < 35); });
    bus.on(EV.UPGRADE_BOUGHT, () => { this.refreshPick(); this.refreshCargo(); this.refreshEnergy(); });
    bus.on(EV.CREDITS_CHANGED, () => this.refreshCredits());
    bus.on(EV.CONSUMABLES_CHANGED, () => this.refreshSlots());
    bus.on(EV.DEPTH_CHANGED, (p) => { this.el.depth.textContent = `${p.meters} m`; this.el.layer.textContent = p.layer; });
    bus.on(EV.PROMPT, (text) => { this.el.prompt.textContent = text || ''; this.el.prompt.classList.toggle('hidden', !text); });
    bus.on(EV.PULSE, (p) => { if (p.sheltered) return; const f = this.el.pulseFlash; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); });
    bus.on(EV.HOVER_TILE, (i) => this.refreshTooltip(i));
    this.mouseX = 0; this.mouseY = 0;
    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX; this.mouseY = e.clientY;
      this.el.tooltip.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 14}px)`;
    });
    this.setMission();
    bus.on(EV.MISSION_DONE, () => this.setMission());
    bus.on(EV.FINISHED, () => this.setMission());
    this.refreshAll();
  }

  setMission() {
    const m = currentMission(this.d.economy);
    this.el.mission.textContent = this.d.economy.finished ? '▸ All objectives complete' : m ? `▸ ${m.text}` : '';
  }

  /** Final sequence readout (`Siphons 1/3 · 45%`); null hides it. @param {string|null} text */
  setSiphon(text) { this.el.siphon.textContent = text ?? ''; this.el.siphon.classList.toggle('hidden', !text); }

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

  /** @param {number} t °C */
  setTemp(t) {
    const r = Math.round(t / 5) * 5;
    if (r === this._temp) return;
    this._temp = r;
    this.el.temp.textContent = `${r} °C${this.d.economy.stat('heatResist', 0) > 0 ? ' ♨' : ''}${this.d.economy.tech.includes('magma_boots') ? ' ▲' : ''}`;
    this.el.temp.style.color = t >= PHYSICS.HEAT_SAFE_T * 0.8 ? '#ff5a4a' : '';
  }

  refreshCredits() { this.el.credits.textContent = `$${this.d.economy.credits.toLocaleString('en-US')}`; }

  refreshPick() {
    const ec = this.d.economy; const p = ec.pickaxe;
    this.el.pickIcon.style.background = p.color;
    const tool = ec.tool && ec.tool !== 'pick' ? /** @type {any} */ (UPGRADES)[ec.tool].name : p.name;
    this.el.pickName.textContent = `${tool} (T${p.tier}) · Q`;
  }

  refreshSlots() {
    const c = this.d.economy.consumables;
    for (const k of Object.keys(this.slotCounts)) this.slotCounts[k].textContent = `×${k === 'warp' ? this.d.economy.warpCharges : c[k]}`;
  }

  /** @param {number} cd seconds remaining */
  setRadarCooldown(cd) {
    const txt = cd > 0 ? `${cd.toFixed(0)}s` : 'ready';
    if (this.el.radarCd.textContent !== txt) this.el.radarCd.textContent = txt;
  }

  /** @param {number} warn seconds until the pulse (<0 none) @param {number} stun seconds of electronics outage */
  setPulse(warn, stun) {
    const txt = warn >= 0 ? `PULSE INCOMING — ${Math.ceil(warn)} s` : stun > 0 ? 'Electronics offline' : '';
    const b = this.el.pulseBanner;
    if (b.textContent !== txt) { b.textContent = txt; b.classList.toggle('hidden', !txt); }
  }

  setMusic(on) { this.el.music.textContent = on ? 'Music: on' : 'Music: off'; }

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
      const camp = isCampGround(i % w.W, (i / w.W) | 0);
      const ok = !camp && canMine(t, ore, this.d.economy.pickTier);
      status = ok ? '<span class="ok">Mineable</span>' : `<span class="no">${camp ? CAMP_HINT : requirementHint(t, ore)}</span>`;
    } else status = '<span class="muted">Not solid</span>';
    tt.innerHTML = `<b>${name}</b><br>${status}`;
    tt.classList.remove('hidden');
  }
}
