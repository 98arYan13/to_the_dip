/**
 * @module main
 * Bootstrap and dependency wiring. Systems communicate through the EventBus or explicit
 * references injected here; nothing is global.
 */
import {
  WORLD, TILE, FLAG, CAMP_BUILDINGS, MATERIALS, PHYSICS, CAMERA, MINING, ENERGY, RADAR, TELEPORT, CONSUMABLES, GAMEPAD,
  PARTICLES, QUALITY, SAVE, SETTINGS_DEFAULT, PICKAXES, RELICS, PLANETS, underM, planetGravity,
} from './config.js';
import { EventBus, EV } from './core/EventBus.js';
import { GameLoop } from './core/GameLoop.js';
import { Input } from './core/Input.js';
import { randomSeed, RNG } from './core/RNG.js';
import { log } from './core/log.js';
import { World } from './world/World.js';
import { clearOwnedRelics, hasRuins, planRuins, relicIdAt } from './world/Ruins.js';
import { Visibility } from './world/Visibility.js';
import { ChunkCache } from './world/ChunkCache.js';
import { Player } from './entities/Player.js';
import { DynamiteSystem } from './entities/Dynamite.js';
import { PickupSystem } from './entities/Pickup.js';
import { Physics } from './systems/Physics.js';
import { Mining, canMine, isCampGround } from './systems/Mining.js';
import { Energy } from './systems/Energy.js';
import { Collapse } from './systems/Hazards/Collapse.js';
import { Fluids } from './systems/Hazards/Fluids.js';
import { Gas } from './systems/Hazards/Gas.js';
import { Quake } from './systems/Hazards/Quake.js';
import { Pulse } from './systems/Hazards/Pulse.js';
import { CoreGoal } from './systems/CoreGoal.js';
import { MindGoal } from './systems/MindGoal.js';
import { Collectibles } from './systems/Collectibles.js';
import { Story } from './systems/Story.js';
import { FallingLadders, pickUpLadder } from './systems/Items.js';
import { placeChargeStation, nearStation, placeFieldCamp, nearFieldCamp } from './systems/Camp.js';
import { dailySeed, dailyScore, dateKey } from './systems/Daily.js';
import { goalChamber, inZone, mindChamber } from './world/Zones.js';
import { Ending } from './ui/Ending.js';
import { MIND_PAGES, ENDING_PAGES, FINAL_LINE } from './story.js';
import { StoryModal } from './ui/StoryModal.js';
import { TravelScreen } from './ui/TravelScreen.js';
import { ElevatorScreen } from './ui/ElevatorScreen.js';
import { placeStop, stops } from './systems/Elevator.js';
import { launch, has as hasEffect } from './systems/Travel.js';
import { Economy, createEconomyState } from './systems/Economy.js';
import { Renderer } from './render/Renderer.js';
import { Camera } from './render/Camera.js';
import { TileArt } from './render/TileArt.js';
import { Lighting } from './render/Lighting.js';
import { Particles } from './render/Particles.js';
import { Background } from './render/Background.js';
import { PostFX } from './render/PostFX.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { Music } from './audio/Music.js';
import { SaveMenu, slotKey, dailyBests } from './ui/SaveMenu.js';
import { DevPanel } from './ui/DevPanel.js';
import { SFX, Ambience } from './audio/SFX.js';
import { HUD } from './ui/HUD.js';
import { Minimap } from './ui/Minimap.js';
import { Shop } from './ui/Shop.js';
import { Settings } from './ui/Settings.js';
import { Toast } from './ui/Toast.js';
import { SaveSystem } from './save/SaveSystem.js';
import { DebugOverlay } from './debug/DebugOverlay.js';

const T = WORLD.TILE_PX;
const SURFACE_PX = WORLD.SURFACE_ROWS * T;
/** Underground depth in px of a world. @param {{H:number}} w */
const undergroundPx = (w) => (w.H - 1 - WORLD.SURFACE_ROWS) * T;

/** localStorage with a graceful in-memory fallback. */
function safeStorage() {
  try {
    const k = '__depths_probe__';
    localStorage.setItem(k, '1'); localStorage.removeItem(k);
    return localStorage;
  } catch {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  }
}

function loadSettings(storage) {
  try {
    const raw = storage.getItem(SAVE.SETTINGS_KEY);
    return raw ? { ...SETTINGS_DEFAULT, ...JSON.parse(raw) } : { ...SETTINGS_DEFAULT };
  } catch { return { ...SETTINGS_DEFAULT }; }
}

function boot() {
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game'));
  const hudRoot = /** @type {HTMLElement} */ (document.getElementById('hud'));
  const splash = /** @type {HTMLElement} */ (document.getElementById('splash'));
  const bus = new EventBus();
  const storage = safeStorage();
  const storedSlot = storage.getItem(SAVE.SLOT_KEY);
  let slot = storedSlot === null || Number.isNaN(Number(storedSlot)) ? 1 : Number(storedSlot);
  const saves = new SaveSystem(storage, slotKey(slot));
  let settingsValues = loadSettings(storage);

  // ---------- World & simulation ----------
  const loaded = saves.load();
  let seed = loaded.ok ? loaded.data.seed : slot === 0 ? dailySeed() : randomSeed();
  const carry = loaded.ok ? null : saves.takeCarry();
  const planet = loaded.ok ? loaded.data.economy.planet ?? 'earth' : carry?.planet ?? 'earth';
  let world = loaded.ok ? new World(loaded.data.world) : World.generate(seed, planet);
  const economy = new Economy(bus, loaded.ok ? loaded.data.economy : carry || createEconomyState());
  if (!loaded.ok) clearOwnedRelics(world, economy.relics); // a new map starts without relics the player already holds
  if (economy.planet !== 'earth' && !economy.story.flags.includes(`landed_${economy.planet}`)) economy.story.flags.push(`landed_${economy.planet}`);
  const vis = new Visibility(world, bus);
  const physics = new Physics(world);
  const pickups = new PickupSystem(physics, bus);
  pickups.economy = economy;
  const mining = new Mining(world, bus, economy, vis, pickups);
  const energy = new Energy(bus, economy);
  const player = new Player({ physics, mining, energy, economy, bus });
  const dynamites = new DynamiteSystem(physics, mining, bus);
  const fallingLadders = new FallingLadders(world, bus);
  const collapse = new Collapse(world, bus);
  collapse.markAll();
  const fluids = new Fluids(world, bus);
  const gas = new Gas(world, bus, player);
  gas.mining = mining; /** @type {any} */ (mining).gas = gas;
  gas.hasMask = () => economy.tech.includes('gas_mask');
  const quake = new Quake(world, bus, collapse, new RNG((seed ^ 0x9e37) >>> 0), economy);
  const pulse = new Pulse(bus, new RNG((seed ^ 0x5eed) >>> 0), economy);
  pulse.onDrain = (f) => energy.drain(f * energy.max);
  const coreGoal = new CoreGoal(world, bus, economy);
  coreGoal.onQuake = () => quake.trigger(0.8);
  coreGoal.onFail = () => player.die('core heat');
  const mindGoal = new MindGoal(world, bus, economy);
  mindGoal.onPulse = () => pulse.trigger();
  mindGoal.onRaiseCoolant = (rows) => fluids.raiseRows(mindChamber(world.W, world.H), rows);
  mindGoal.reapply(); // a loaded mid-sequence save
  new Collectibles(bus, economy, {
    ruinRect: (layer) => (world.planet === 'earth' ? planRuins(world.genSeed, world.W, world.H, PLANETS.earth).find((r) => r.layer === layer) : undefined), // layer achievements are Earth's
    waterIn: (r) => { let n = 0; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (world.tileType[y * world.W + x] === TILE.WATER) n++; return n; },
  });
  const story = new Story(bus, economy); story.sync(loaded.ok); // silent for loaded saves: catch up without a toast flood
  collapse.crush = (x, y) => {
    const tx0 = Math.floor(player.x / T); const tx1 = Math.floor((player.x + player.w - 1) / T);
    const ty0 = Math.floor(player.y / T); const ty1 = Math.floor((player.y + player.h - 1) / T);
    return x >= tx0 && x <= tx1 && y >= ty0 && y <= ty1;
  };
  if (loaded.ok && loaded.data.player) {
    const p = loaded.data.player;
    player.placeAt(p.x, p.y);
    energy.value = Math.min(energy.max, p.energy);
    if (typeof p.hp === 'number') player.hp = p.hp;
    if (p.outfit) player.outfit = p.outfit; // sanitized once the wearable list loads (Renderer)
  }

  // ---------- Rendering ----------
  const particles = new Particles();
  particles.init();
  particles.world = world;
  const art = new TileArt(1);
  const chunks = new ChunkCache(world, art);
  art.loadImages(() => chunks.markAllDirty());
  const camera = new Camera();
  camera.worldH = world.H; pulse.underM = underM(world.H);
  const background = new Background();
  background.economy = economy;
  const lighting = new Lighting();
  const postfx = new PostFX();
  const renderer = new Renderer(canvas, { world, art, chunks, vis, mining, particles, background, lighting, postfx, camera, player, dynamites, fallingLadders, pickups, economy, energy });
  camera.snap(player.cx, player.cy);

  // ---------- Audio ----------
  const audio = new AudioEngine();
  const sfx = new SFX(audio);
  const music = new Music(audio);
  const ambience = new Ambience(audio);
  sfx.bind(bus, () => world);

  // ---------- UI ----------
  const input = new Input(window, canvas);
  /** Zoom in (+1) / out (-1): wheel or +/- keys; the camera re-clamps to the new view size. */
  const setZoom = (step) => { renderer.zoomBy(step); camera.update(0, player.cx, player.cy); };
  canvas.addEventListener('wheel', (e) => { if (!g.started) return; e.preventDefault(); setZoom(e.deltaY < 0 ? 1 : -1); }, { passive: false });
  const hud = new HUD(hudRoot, bus, {
    economy, energy, getWorld: () => world,
    onSave: () => saveGame(true),
    onSlots: () => openSlots(),
    onDev: () => devPanel.toggle(),
    onMusic: () => { settingsValues = { ...settingsValues, musicOn: settingsValues.musicOn === false }; applySettings(settingsValues); return settingsValues.musicOn; },
    onMute: () => { settingsValues.muted = !settingsValues.muted; applySettings(settingsValues); return settingsValues.muted; },
    onSettings: () => openSettings(),
  });
  hud.setMuted(settingsValues.muted);
  bus.emit(EV.HP_CHANGED, player.hp);
  const toast = new Toast(hudRoot);
  const minimap = new Minimap(hud.minimapParent, bus, economy, () => world.genSeed);
  minimap.setWorld(world);
  const storyModal = new StoryModal(hudRoot, { onClose: () => { if (!showStory()) { input.clear(); if (!shop.open) canvas.focus(); } } });
  const pages = /** @type {{title:string,text:string}[]} */ ([]); let afterPages = /** @type {(()=>void)|null} */ (null);
  const showStory = () => {
    if (storyModal.open) return true;
    const page = pages.shift();
    if (page) { storyModal.show(page.title, page.text, pages.length ? 'Continue' : 'Close'); return true; }
    if (afterPages) { const f = afterPages; afterPages = null; f(); return true; }
    const e = story.pendingModals()[0]; if (!e) return false;
    const relic = e.when.relic ? RELICS.find((r) => r.id === e.when.relic) : null;
    story.markRead(e.id); // marked on show: a reload mid-modal must not replay it
    storyModal.show(relic ? `RELIC DECODED — ${relic.name}` : 'THE DEEP SIGNAL', e.text, e.id === 'intro' ? 'Begin' : 'Continue');
    return true;
  };
  const ending = new Ending(hudRoot, { onClose: () => { input.clear(); canvas.focus(); } });
  const shop = new Shop(hudRoot, bus, economy, { seed: () => seed, onClose: () => { input.clear(); canvas.focus(); }, click: () => sfx.uiClick() });
  const travelScreen = new TravelScreen(hudRoot, economy, {
    onClose: () => { input.clear(); canvas.focus(); },
    onTravel: (dest) => {
      const st = launch(economy, dest); if (!st) return;
      saves.setCarry(st); saves.clear(); restart();
    },
  });
  const fade = document.createElement('div');
  fade.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .3s;z-index:50';
  hudRoot.appendChild(fade);
  const elevatorScreen = new ElevatorScreen(hudRoot, economy, {
    here: () => ({ y: Math.floor((player.feetY - 1) / WORLD.TILE_PX) }),
    onClose: () => { input.clear(); canvas.focus(); },
    world: () => world,
    onRide: (to, seconds) => { // a pause: update is gated by g.riding until the teleport lands
      const token = ++g.rideToken; g.riding = true; fade.style.opacity = '1';
      setTimeout(() => {
        if (token !== g.rideToken) return;
        player.x = to.x * WORLD.TILE_PX + (WORLD.TILE_PX - player.w) / 2; player.y = (to.y + 1) * WORLD.TILE_PX - player.h;
        player.vx = 0; player.vy = 0; player.prevX = player.x; player.prevY = player.y; player.unbrakedFallPx = 0;
        camera.snap(player.cx, player.cy); fade.style.opacity = '0'; g.riding = false; input.clear();
      }, 300 + Math.min(seconds, 3) * 100);
    },
  });
  const settings = new Settings(hudRoot, settingsValues, {
    onChange: (s) => { settingsValues = s; applySettings(s); },
    onClose: () => { input.clear(); },
    onNewGame: () => { settings.close(); openSlots(); },
  });
  const saveMenu = new SaveMenu(hudRoot, storage, {
    active: () => slot,
    onSave: (n) => { switchSlot(n); saveGame(true); },
    onLoad: (n) => { saveGame(true); switchSlot(n); restart(); },
    onNew: (n) => { saveGame(true); switchSlot(n); saves.clear(); restart(); },
    onNewMap: () => { saves.setCarry(economy.newMapState()); saves.clear(); restart(); },
    onClose: () => { input.clear(); canvas.focus(); },
  });
  const devPanel = new DevPanel(hudRoot, {
    onAction: (a) => {
      const tx = Math.floor(player.cx / T); const ty = Math.floor(player.cy / T);
      if (a === 'gas') { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) gas.spawn(tx + dx, ty + dy); }
      else if (a === 'quake') { quake.focus.x = tx; quake.focus.y = ty; quake.trigger(1); }
      else if (a === 'cash') { economy.credits += 100000; bus.emit(EV.CREDITS_CHANGED, economy.credits); }
      else if (a === 'mats') { for (let o = 1; o < economy.stash.length; o++) economy.stash[o] += 50; bus.emit(EV.CARGO_CHANGED); }
      else if (a === 'ruin') { // next ruin whose relic isn't owned; carve a pocket left of it
        const r = planRuins(world.genSeed, world.W, world.H, PLANETS[world.planet]).find((q) => !economy.relics.includes(relicIdAt(world.planet, q.y + q.h - 2, world.H)));
        if (r) { const px = r.x - 3; const py = r.y + r.h - 2; for (let dy = -2; dy <= 0; dy++) for (let dx = -1; dx <= 1; dx++) world.clear(world.idx(px + dx, py + dy)); player.placeAt(px * T, (py + 1) * T - player.h); camera.snap(player.cx, player.cy); }
      }
      else if (a === 'core') { const c = goalChamber(world.W, world.H, PLANETS[world.planet]); if (!c) return; player.placeAt((c.x + c.w / 2) * T, (c.y + c.h - 1) * T - player.h); camera.snap(player.cx, player.cy); }
      canvas.focus();
    },
    onChange: (s) => {
      const god = s.on && s.god;
      economy.devPick = s.on ? (god ? PICKAXES.length : s.pick) : 0;
      player.god = god; energy.god = god; mining.god = god;
      renderer.devReveal = s.on && s.reveal;
      hud.refreshAll();
      canvas.focus();
    },
  });
  const debug = new DebugOverlay(hudRoot);
  devPanel.hooks.onOutfit = (o) => { player.outfit = JSON.parse(JSON.stringify(o)); };
  renderer.onRigReady = (items, o) => devPanel.setOutfitItems(items, o);
  if (renderer.rigA) devPanel.setOutfitItems(renderer.rigA.items, player.outfit);

  if (!loaded.ok && loaded.error) toast.show('Save data was corrupted — starting a new expedition.', 'bad');

  // ---------- State ----------
  const g = { riding: false, rideToken: 0,
    started: false, tabHidden: false, hitStop: 0, time: 0, radarCd: 0, warpTimer: -1,
    lastMeters: -1, lastLayer: '', prompt: '', hover: -2, aimX: 0, aimY: 0,
    jetAcc: 0, dustAcc: 0, dripAcc: 0, emberAcc: 0, vortexAcc: 0,
    quality: 'high', autoSamples: 0, autoAccum: 0, autoDone: false,
    depth01: 0,
  };
  const st = { aimX: 0, aimY: 0, depth: 0, headlamp: 200 };
  const depthPayload = { meters: 0, layer: '' };
  const dbg = { fps: 0, frameMs: 0, updateMs: 0, renderMs: 0, drawCalls: 0, particles: 0, particleCap: 0, voices: 0, chunkRebuilds: 0, totalRebuilds: 0, quality: '', seed: 0, tile: '' };

  function applyQuality(name) {
    g.quality = name;
    const q = /** @type {any} */ (QUALITY.PRESETS)[name];
    lighting.setQuality(q);
    particles.setCap(q.particleCap);
    postfx.shimmerEnabled = q.shimmer;
    postfx.grainEnabled = q.grain;
  }

  function applySettings(s) {
    audio.setVolumes({ master: s.master, music: s.musicOn === false ? 0 : s.music, sfx: s.sfx, ambience: s.ambience });
    audio.setMuted(s.muted);
    hud.setMuted(s.muted);
    hud.setMusic(s.musicOn !== false);
    camera.shakeEnabled = s.shake;
    lighting.reducedFlashing = s.reducedFlashing;
    postfx.reducedFlashing = s.reducedFlashing;
    document.body.classList.toggle('reduced-flashing', !!s.reducedFlashing);
    player.fallMult = s.fallSpeedMult;
    player.hardLandingTiles = s.hardLandingTiles;
    if (s.quality === 'auto') { if (g.autoDone) applyQuality(g.quality); else applyQuality('high'); }
    else applyQuality(s.quality);
    try { storage.setItem(SAVE.SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
  }
  applySettings(settingsValues);

  const getState = () => ({ seed, player: { x: player.x, y: player.y, energy: energy.value, hp: player.hp, outfit: player.outfit }, economy: economy.toJSON(), world });

  function saveGame(manual) {
    if (dynamites.active.length > 0 && !manual) return;
    if (slot === 0) {
      try { const b = dailyBests(storage); b[dateKey()] = Math.max(b[dateKey()] || 0, dailyScore(economy)); storage.setItem(`${SAVE.KEY}.dailybest`, JSON.stringify(b)); } catch { /* ignore */ }
    }
    if (saves.save(getState())) { if (manual) bus.emit(EV.SAVED); }
    else if (manual) toast.show('Saving failed (storage unavailable)', 'bad');
  }

  function setWorld(w) {
    world = w;
    camera.worldH = w.H; pulse.underM = underM(w.H);
    // Saves from before MINING.HP_MULT store untouched tiles at the old max HP: scale them up.
    for (let i = 0; i < w.tileHP.length; i++) {
      const max = w.maxHP(i);
      if (max && max < 65535 && w.tileHP[i] * MINING.HP_MULT === max) w.tileHP[i] = max;
    }
    // Saves from before the camp foundation existed may have holes under the buildings: refill them.
    const bc = WORLD.BASE_CAMP;
    for (let y = WORLD.SURFACE_ROWS; y < WORLD.SURFACE_ROWS + bc.PAD_DEPTH; y++) {
      for (let x = bc.PAD_X0; x <= bc.PAD_X1; x++) {
        const i = y * w.W + x;
        if (MATERIALS[w.tileType[i]].solid) continue;
        w.tileType[i] = TILE.SOIL; w.oreType[i] = 0; w.tileHP[i] = w.maxHP(i);
        w.flags[i] |= FLAG.SOLID | FLAG.DIRTY | FLAG.DISCOVERED;
      }
    }
    collapse.setWorld(w); fluids.setWorld(w); gas.setWorld(w); quake.world = w; coreGoal.world = w; mindGoal.world = w; mindGoal.reapply();
    vis.setWorld(w); physics.world = w; mining.setWorld(w); chunks.setWorld(w);
    particles.world = w; renderer.setWorld(w); minimap.setWorld(w);
  }

  function warpHome(msg, kind) {
    player.spawn();
    camera.snap(player.cx, player.cy);
    for (let k = 0; k < 40; k++) particles.vortex(player.cx, player.cy);
    if (msg) toast.show(msg, kind);
  }

  function switchSlot(n) {
    slot = n; saves.key = slotKey(n);
    try { storage.setItem(SAVE.SLOT_KEY, String(n)); } catch { /* ignore */ }
  }

  /** Reload into the active slot; the unload autosave is skipped so it can't overwrite that slot. */
  function restart() { g.started = false; location.reload(); }

  function openSlots() { if (!shop.open && !settings.open) { saveMenu.show(); input.clear(); } }

  function openSettings() { if (!shop.open && !saveMenu.open) { settings.show(); input.clear(); } }

  // ---------- Event wiring ----------
  bus.on(EV.TILE_CHANGED, (i) => chunks.markTileDirty(i));
  bus.on(EV.MINE_HIT, (h) => {
    particles.impact(h.x * T + T / 2 + h.nx * T / 2, h.y * T + T / 2 + h.ny * T / 2, h.nx, h.ny, h.type, false);
    camera.addTrauma(CAMERA.TRAUMA_HIT);
  });
  bus.on(EV.MINE_BLOCKED, (h) => {
    particles.impact(h.x * T + T / 2 + h.nx * T / 2, h.y * T + T / 2 + h.ny * T / 2, h.nx, h.ny, h.type, true);
    camera.addTrauma(CAMERA.TRAUMA_CLINK);
  });
  bus.on(EV.BLOCK_BROKEN, (h) => {
    const n = MINING.DEBRIS_MIN + Math.floor(Math.random() * (MINING.DEBRIS_MAX - MINING.DEBRIS_MIN + 1));
    particles.debris(h.x * T + T / 2, h.y * T + T / 2, h.type, h.ore, n);
    camera.addTrauma(CAMERA.TRAUMA_BREAK);
    g.hitStop = MINING.HIT_STOP_FRAMES;
  });
  bus.on(EV.TILE_WARN, (t) => {
    particles.debris(t.x * T + T / 2, t.y * T + T, TILE.SOIL, 0, 2);
    camera.addTrauma(0.04);
    sfx.rumble(0.2);
  });
  bus.on(EV.TILE_CRUSH, () => player.die('crushed'));
  let lastHP = player.hp;
  bus.on(EV.HP_CHANGED, (hp) => { if (hp < lastHP) postfx.hurt = 1; lastHP = hp; });
  bus.on(EV.SWING, () => gas.onPlayerMine());
  bus.on(EV.QUAKE_WARN, () => { camera.addTrauma(0.3); sfx.rumble(0.3); }); // foreshock, main quake follows after WARN_S
  bus.on(EV.QUAKE, (q) => { camera.addTrauma(0.4 + 0.6 * q.strength); sfx.rumble(0.8 + 0.2 * q.strength); });
  bus.on(EV.COMPLETED, () => { ending.show(); input.clear(); });
  bus.on(EV.MIND_GREETING, () => { pages.push(...MIND_PAGES); showStory(); input.clear(); });
  bus.on(EV.FINISHED, () => {
    pages.push(...ENDING_PAGES); afterPages = () => { ending.show({ title: 'THE SEED IS SILENT — FOR GOOD', text: FINAL_LINE }); input.clear(); };
    saveGame(false); showStory(); input.clear();
  });
  bus.on(EV.HINT, (text) => toast.show(text, 'warn'));
  bus.on(EV.CARGO_FULL, () => toast.show('Cargo hold full! Ore dropped on the ground.', 'warn'));
  bus.on(EV.EXPLOSION, (p) => {
    particles.explosion(p.x, p.y);
    lighting.flash(p.x, p.y);
    renderer.shockwave(p.x, p.y);
    camera.addTrauma(CAMERA.TRAUMA_EXPLOSION);
  });
  bus.on(EV.TOAST, (t) => toast.show(t.text, t.kind));
  bus.on(EV.STATION_FULL, () => toast.show('Suit energy fully recharged', 'good'));
  bus.on(EV.SAVED, () => toast.show('Game Saved', 'good'));
  bus.on(EV.ORE_COLLECTED, (ore) => particles.pickupSparkle(player.cx, player.cy, ore));
  bus.on(EV.SHOP_OPEN, () => { saveGame(false); showStory(); });
  showStory();
  if (loaded.ok && !hasRuins(world) && economy.relics.length < 5 && !economy.story.flags.includes('no_ruins_notice')) {
    economy.story.flags.push('no_ruins_notice');
    toast.show('Signals detected — start a New Map to find alien ruins.', 'info');
  }
  bus.on(EV.PURCHASE_FAILED, (reason) => toast.show(reason, 'warn'));
  bus.on(EV.UPGRADE_BOUGHT, (u) => {
    if (u.kind === 'rig') energy.refill();
    energy.report();
    if (u.kind === 'pickaxe') toast.show(`${economy.pickaxe.name} acquired!`, 'good');
  });
  bus.on(EV.HARD_LANDING, (h) => {
    camera.addTrauma(Math.min(1, 0.3 + h.damage / 60));
    toast.show(`Hard landing! Suit -${h.damage}%`, 'warn');
  });
  bus.on(EV.PLAYER_DEAD, (cause) => {
    g.rideToken++; g.riding = false; fade.style.opacity = '0';
    pulse.reset();
    economy.applyDeath();
    energy.refill();
    dynamites.clear();
    g.warpTimer = -1;
    bus.emit(EV.TELEPORT_START);
    player.setHP(PHYSICS.SUIT_HP);
    warpHome(`You died (${cause})! Ores lost, the rest of your pack kept.`, 'bad');
  });
  bus.on(EV.CORE_DENIED, () => toast.show('The machine does not answer. You need its key.', 'warn'));
  bus.on(EV.RELIC_FOUND, (p) => toast.show(`Relic recovered: ${RELICS.find((r) => r.id === p.id)?.name} — decode it at camp`, 'good'));
  bus.on(EV.RESCUE, () => {
    const lost = economy.applyRescueLoss();
    dynamites.clear();
    g.warpTimer = -1;
    bus.emit(EV.TELEPORT_START);
    energy.setFrac(ENERGY.RESCUE_ENERGY_FRAC);
    energy.rescuePending = false;
    warpHome(`Emergency Rescue Teleport! Suit depleted — lost ${lost} ore unit${lost === 1 ? '' : 's'}.`, 'bad');
  });

  input.onPress((a) => {
    if (!g.started) return;
    if (a === 'debug') debug.toggle();
    else if (a === 'dev') devPanel.toggle();
    else if (a === 'zoomIn' || a === 'zoomOut') setZoom(a === 'zoomIn' ? 1 : -1);
    else if (a === 'pause') {
      if (minimap.big) minimap.toggleBig(false);
      else if (travelScreen.open) travelScreen.close();
      else if (elevatorScreen.open) elevatorScreen.close();
      else if (shop.open) shop.close();
      else if (saveMenu.open) saveMenu.close();
      else if (settings.open) settings.close();
      else openSettings();
    } else if (a === 'interact') {
      if (settings.open || saveMenu.open || travelScreen.open || elevatorScreen.open) return;
      if (shop.open) shop.close();
      else if (g.prompt === 'lift') { elevatorScreen.show(); input.clear(); }
      else if (g.prompt === 'pad') { travelScreen.show(); input.clear(); }
      else if (g.prompt === 'shop') { shop.show(); input.clear(); }
      else if (g.prompt.startsWith('bld:')) { shop.show({ tab: 'craft', building: g.prompt.slice(4) }); input.clear(); }
      else if (g.prompt === 'camp') { player.setHP(PHYSICS.SUIT_HP); shop.show({ only: 'stash' }); input.clear(); } // rest heals, not energy
    }
  });

  // ---------- Update ----------
  function useSlots() {
    const c = economy.consumables;
    if (input.wasPressed('radar')) {
      if (pulse.stun > 0) toast.show('Electronics offline', 'warn');
      else if (g.radarCd > 0) toast.show('Radar recharging…', 'info');
      else if (energy.value <= ENERGY.RADAR_COST) toast.show('Not enough energy for radar', 'warn');
      else {
        const r = { ...economy.radar, radius: economy.stat('radarRange', economy.radar.radius) };
        energy.drain(ENERGY.RADAR_COST);
        g.radarCd = RADAR.COOLDOWN;
        vis.radarPulse(player.cx, player.cy, r.radius, r.duration, RADAR.RING_SPEED);
        lighting.radarStart(player.cx, player.cy, r.radius * T);
        bus.emit(EV.RADAR_PULSE);
      }
    }
    if (input.wasPressed('slot1')) {
      if (c.dynamite <= 0) toast.show('No dynamite — buy some at the Trading Post', 'warn');
      else if (dynamites.throw(player.cx, player.cy, g.aimX, g.aimY)) { economy.useConsumable('dynamite'); bus.emit(EV.CONSUMABLE_USED, 'dynamite'); }
    }
    if (input.wasPressed('slot6')) {
      const r = placeFieldCamp(economy, world, Math.floor(player.cx / T) - 1, Math.floor((player.feetY - 1) / T));
      toast.show(r.ok ? 'Field camp pitched' : r.reason, r.ok ? 'good' : 'warn');
    }
    if (input.wasPressed('slot5')) {
      if (c.bigBomb <= 0) toast.show('No big bombs — unlock the recipe in Tech, buy at the Trading Post', 'warn');
      else if (dynamites.throw(player.cx, player.cy, g.aimX, g.aimY, true)) { economy.useConsumable('bigBomb'); bus.emit(EV.CONSUMABLE_USED, 'bigBomb'); }
    }
    if (input.wasPressed('slot4')) {
      const lx = Math.floor(g.aimX / T); const ly = Math.floor(g.aimY / T);
      if (Math.hypot(g.aimX - player.cx, g.aimY - player.cy) <= 5 * T && pickUpLadder(world, bus, lx, ly)) {
        economy.consumables.ladder++; bus.emit(EV.CONSUMABLES_CHANGED);
      } else if (c.ladder <= 0) toast.show('No ladders — buy some at the Trading Post', 'warn');
      else if (Math.hypot(g.aimX - player.cx, g.aimY - player.cy) > 5 * T) toast.show('Too far to place', 'info');
      else if (fallingLadders.drop( Math.floor(g.aimX / T), Math.floor(g.aimY / T))) economy.useConsumable('ladder');
      else toast.show('Ladders need an open air tile', 'info');
    }
    if (input.wasPressed('station')) {
      const r = placeChargeStation(economy, world, Math.floor(player.cx / T), Math.floor((player.feetY - 1) / T));
      toast.show(r.ok ? 'Charging station placed' : r.reason, r.ok ? 'good' : 'warn');
      if (r.ok) { bus.emit(EV.CARGO_CHANGED); bus.emit(EV.CREDITS_CHANGED, economy.credits); }
    }
    if (input.wasPressed('place_stop')) {
      const r = placeStop(economy, world, Math.floor(player.cx / T), Math.floor((player.feetY - 1) / T));
      toast.show(r.ok ? 'Elevator stop placed' : r.reason, r.ok ? 'good' : 'warn');
      if (r.ok) { bus.emit(EV.CARGO_CHANGED); bus.emit(EV.CREDITS_CHANGED, economy.credits); }
    }
    if (input.wasPressed('slot2')) {
      if (economy.warpCharges <= 0) toast.show('No warp charges — craft them in the Isotope Lab', 'warn');
      else if (player.feetY <= SURFACE_PX + 2) toast.show('Already at the surface', 'info');
      else if (g.warpTimer < 0) {
        economy.useWarpCharge();
        g.warpTimer = TELEPORT.CHANNEL_TIME;
        bus.emit(EV.TELEPORT_START);
        bus.emit(EV.CONSUMABLE_USED, 'teleporter');
      }
    }
    if (input.wasPressed('slot3')) {
      if (c.cell <= 0) toast.show('No energy cells left', 'warn');
      else if (energy.value >= energy.max - 0.5) toast.show('Energy already full', 'info');
      else {
        economy.useConsumable('cell');
        energy.add(CONSUMABLES.cell.frac * energy.max);
        particles.electric(player.cx, player.cy);
        bus.emit(EV.CONSUMABLE_USED, 'cell');
      }
    }
  }

  function ambientParticles(dt, underground, inMantle) {
    if (player.jetting) {
      g.jetAcc += dt * PARTICLES.JET_RATE;
      while (g.jetAcc >= 1) { g.jetAcc--; particles.jet(player.x + (player.facing > 0 ? 0 : player.w), player.y + player.h - 4); }
    }
    if (!underground) return;
    const range = economy.headlamp;
    g.dustAcc += dt * PARTICLES.BEAM_DUST_RATE;
    while (g.dustAcc >= 1) {
      g.dustAcc--;
      const a = Math.atan2(g.aimY - player.cy, g.aimX - player.cx) + (Math.random() - 0.5) * 0.7;
      const d = Math.random() * range * 0.8;
      particles.beamDust(player.cx + Math.cos(a) * d, player.cy + Math.sin(a) * d);
    }
    g.dripAcc += dt * PARTICLES.DRIP_RATE;
    if (g.dripAcc >= 1) {
      g.dripAcc = 0;
      const tx = Math.floor(player.cx / T) + Math.floor((Math.random() - 0.5) * 20);
      const ty = Math.floor(player.cy / T) + Math.floor((Math.random() - 0.5) * 12);
      if (world.isSolid(tx, ty) && world.inBounds(tx, ty + 1) && !world.isSolid(tx, ty + 1) && world.band[ty * world.W + tx] >= TILE.LIMESTONE) {
        particles.drip(tx * T + 4 + Math.random() * (T - 8), (ty + 1) * T);
      }
    }
    if (inMantle) {
      g.emberAcc += dt * PARTICLES.EMBER_RATE;
      while (g.emberAcc >= 1) {
        g.emberAcc--;
        const tx = Math.floor(player.cx / T) + Math.floor((Math.random() - 0.5) * 24);
        const ty = Math.floor(player.cy / T) + Math.floor((Math.random() - 0.5) * 14);
        if (world.inBounds(tx, ty) && world.tileType[ty * world.W + tx] === TILE.MAGMA) particles.embers(tx * T + T / 2, ty * T + T / 2, 1);
      }
    }
  }

  function update(dt) {
    if (!g.started || g.tabHidden || g.riding || shop.open || travelScreen.open || elevatorScreen.open || settings.open || saveMenu.open || ending.open || storyModal.open) { input.endStep(); return; }
    if (g.hitStop > 0) { g.hitStop--; return; }
    input.pollGamepad();
    g.time += dt;

    // Aim
    if (input.usingPad) {
      const len = Math.hypot(input.padAimX, input.padAimY) || 1;
      g.aimX = player.cx + (input.padAimX / len) * GAMEPAD.AIM_DIST;
      g.aimY = player.cy + (input.padAimY / len) * GAMEPAD.AIM_DIST;
    } else {
      g.aimX = renderer.screenToWorldX(input.mouseX);
      g.aimY = renderer.screenToWorldY(input.mouseY);
    }

    if (g.warpTimer >= 0) {
      g.warpTimer -= dt;
      g.vortexAcc += dt * TELEPORT.VORTEX_RATE;
      while (g.vortexAcc >= 1) { g.vortexAcc--; particles.vortex(player.cx, player.cy); }
      player.prevX = player.x; player.prevY = player.y;
      if (g.warpTimer < 0) warpHome('Warped to base camp. Cargo intact.', 'good');
    } else {
      player.update(dt, input, g.aimX, g.aimY);
      useSlots();
    }
    if (g.radarCd > 0) g.radarCd = Math.max(0, g.radarCd - dt);

    pickups.update(dt, player, planetGravity(economy.planet));
    dynamites.update(dt, PHYSICS.GRAVITY * planetGravity(economy.planet));
    fallingLadders.update(dt, PHYSICS.GRAVITY * player.fallMult * planetGravity(economy.planet), PHYSICS.MAX_FALL * Math.sqrt(player.fallMult * planetGravity(economy.planet))); // same fall speed as the player
    particles.update(dt);
    mining.update(dt);
    collapse.update(dt);
    fluids.update(dt);
    gas.update(dt);
    lighting.update(dt, RADAR.RING_SPEED);
    vis.update(dt, player.cx, player.cy, economy.headlamp, Math.atan2(g.aimY - player.cy, g.aimX - player.cx));

    // Depth / layer
    const ptx = Math.max(0, Math.min(world.W - 1, Math.floor(player.cx / T)));
    const pty = Math.max(0, Math.min(world.H - 1, Math.floor(player.cy / T)));
    const band = world.band[pty * world.W + ptx];
    const onSurface = player.feetY <= SURFACE_PX + 2;
    const inMantle = band === TILE.MANTLE && !onSurface;
    g.depth01 = Math.max(0, Math.min(1, (player.feetY - SURFACE_PX) / undergroundPx(world)));
    const meters = Math.max(0, Math.floor((player.feetY - SURFACE_PX) / T)) * WORLD.METERS_PER_TILE;
    const layer = onSurface || band === TILE.AIR ? 'Surface · Expedition Base Camp' : `${MATERIALS[band].layer}`;
    if (meters !== g.lastMeters || layer !== g.lastLayer) {
      g.lastMeters = meters; g.lastLayer = layer;
      depthPayload.meters = meters; depthPayload.layer = layer;
      bus.emit(EV.DEPTH_CHANGED, depthPayload);
    }

    // Base camp interactions
    const bc = WORLD.BASE_CAMP;
    const nearShop = onSurface && Math.abs(player.cx / T - (bc.SHOP_X + 0.5)) < bc.INTERACT_RANGE;
    const atStation = onSurface && Math.abs(player.cx / T - (bc.STATION_X + 0.5)) < bc.INTERACT_RANGE;
    const atCamp = !onSurface && nearFieldCamp(economy, player.cx, player.cy);
    let bld = ''; let bd = bc.INTERACT_RANGE;
    if (onSurface) for (const [id, x] of Object.entries(bc.BUILDING_SLOTS)) { if (id === 'launch_pad' && !hasEffect(economy, 'launch_pad')) continue; const d = Math.abs(player.cx / T - (x + 0.5)); if (d < bd) { bd = d; bld = id; } }
    const nearLift = hasEffect(economy, 'elevator') && stops(economy).some((s) => Math.abs(player.cx / T - (s.x + 0.5)) < 1.2 && Math.abs((player.feetY - 1) / T - s.y) < 2);
    const prompt = nearLift ? 'lift' : nearShop ? 'shop' : atStation ? 'station' : bld === 'launch_pad' ? 'pad' : bld ? `bld:${bld}` : atCamp ? 'camp' : '';
    if (prompt !== g.prompt) {
      g.prompt = prompt;
      bus.emit(EV.PROMPT, prompt === 'shop' ? '[E] Open Trading Post terminal' : prompt === 'station' ? 'Recharging suit energy…' : prompt === 'camp' ? '[E] Rest at camp (heal, open stash)' : prompt === 'lift' ? '[E] Cargo elevator' : prompt === 'pad' ? '[E] Launch pad' : bld ? `[E] ${/** @type {any} */ (CAMP_BUILDINGS)[bld].name}` : null);
    }
    energy.depthM = meters;
    quake.focus.x = ptx; quake.focus.y = pty;
    quake.update(dt, g.depth01);
    if (quake.shake > 0) camera.addTrauma(quake.shake * dt);
    pulse.rate = inZone(world, 'fabricator_hall', ptx, pty) ? 2 : 1; // gap halves inside the fabricator hall
    pulse.update(dt, meters, onSurface || nearShop || atCamp);
    player.gearOffline = pulse.stun > 0;
    coreGoal.update(dt, player.cx, player.cy);
    mindGoal.update(dt, player.cx, player.cy);
    hud.setSiphon(mindGoal.hudText(player.cx, player.cy));
    const atField = nearStation(economy, player.cx, player.cy);
    energy.update(dt, { jetting: player.jetting, atStation: atStation || atField, onSurface, coldTrap: inZone(world, 'cold_trap', ptx, pty) });
    player.burn(dt, world, g.depth01);
    hud.setTemp(player.temp);
    const dev = devPanel.state;
    if (dev.on && (dev.lockEnergy || dev.god) && energy.value < energy.max) energy.refill();
    if (dev.on && (dev.lockHp || dev.god) && player.hp < PHYSICS.SUIT_HP) player.setHP(PHYSICS.SUIT_HP);
    if (atStation && player.hp < PHYSICS.SUIT_HP) player.setHP(PHYSICS.SUIT_HP); // station also repairs the suit

    camera.update(dt, player.cx + player.vx * CAMERA.LOOK_AHEAD, player.cy);
    background.update(dt, camera.x - camera.viewW / 2, camera.y - camera.viewH / 2, camera.viewW, particles);
    ambientParticles(dt, !onSurface, inMantle);

    // Audio
    if (audio.ready) {
      audio.listenerX = player.cx; audio.listenerY = player.cy;
      sfx.setJet(player.jetting ? 1 : 0);
      audio.setDepth(onSurface ? 0 : g.depth01 + 0.02);
      music.setContext({ planet: economy.planet ?? 'earth', depth01: g.depth01, onSurface, nearRuin: false, relics: 0, finaleLevel: 0 });
      ambience.update(dt, g.depth01, onSurface);
    }

    // Autosave (never during explosions)
    const calm = dynamites.active.length === 0 && dynamites.lastExplosionAge > SAVE.EXPLOSION_BLOCK_SEC;
    saves.tick(dt, calm, getState);

    input.endStep();
  }

  // ---------- Render ----------
  function render(alpha, frameDt) {
    // Hover tooltip (emits only on change)
    let hover = -1;
    if (input.mouseInside && !input.usingPad) {
      const tx = Math.floor(renderer.screenToWorldX(input.mouseX) / T);
      const ty = Math.floor(renderer.screenToWorldY(input.mouseY) / T);
      if (world.inBounds(tx, ty)) hover = ty * world.W + tx;
    }
    if (hover !== g.hover) {
      g.hover = hover;
      renderer.hoverTile = hover;
      renderer.hoverMineable = hover >= 0 && !isCampGround(hover % world.W, (hover / world.W) | 0) && canMine(world.tileType[hover], world.oreType[hover], economy.pickTier);
      bus.emit(EV.HOVER_TILE, hover);
    }
    st.aimX = g.aimX; st.aimY = g.aimY; st.depth = g.depth01; st.headlamp = economy.headlamp;
    renderer.render(alpha, frameDt, st);
    minimap.draw(frameDt, Math.floor(player.cx / T), Math.floor(player.cy / T), vis, economy.pickTier);
    hud.setRadarCooldown(g.radarCd);
    hud.setPulse(pulse.warn, pulse.stun);

    // Auto quality
    if (settingsValues.quality === 'auto' && !g.autoDone && g.started && !document.hidden) {
      g.autoAccum += loop.updateMs + loop.renderMs;
      g.autoSamples++;
      if (g.autoSamples * frameDt >= QUALITY.AUTO_SAMPLE_SEC && g.autoSamples > 60) {
        const avg = g.autoAccum / g.autoSamples;
        g.autoDone = true;
        applyQuality(avg <= QUALITY.AUTO_HIGH_MS ? 'high' : avg <= QUALITY.AUTO_MED_MS ? 'medium' : 'low');
        settings.setAutoPreset(g.quality);
        log('auto quality', g.quality, avg.toFixed(2));
      }
    }

    dbg.fps = loop.fps; dbg.frameMs = loop.frameMs; dbg.updateMs = loop.updateMs; dbg.renderMs = loop.renderMs;
    dbg.drawCalls = renderer.drawCalls; dbg.particles = particles.count; dbg.particleCap = particles.cap;
    dbg.voices = audio.voiceCount; dbg.chunkRebuilds = chunks.rebuildsThisFrame; dbg.totalRebuilds = chunks.totalRebuilds;
    dbg.quality = g.quality; dbg.seed = seed;
    dbg.tile = debug.visible ? `player tile ${Math.floor(player.cx / T)},${Math.floor(player.cy / T)}` : '';
    debug.update(frameDt, dbg);
  }

  const loop = new GameLoop({ update, render });

  // ---------- Platform events ----------
  const onResize = () => renderer.resize();
  window.addEventListener('resize', onResize);
  const watchDpr = () => {
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener('change', () => { onResize(); watchDpr(); }, { once: true });
  };
  watchDpr();
  document.addEventListener('visibilitychange', () => {
    g.tabHidden = document.hidden;
    if (document.hidden) input.clear();
    else audio.resume();
  });
  window.addEventListener('beforeunload', () => { if (g.started) saveGame(false); });

  // ---------- Splash / start ----------
  const start = () => {
    if (g.started) return;
    audio.init();
    applySettings(settingsValues);
    music.start();
    ambience.start();
    g.started = true;
    splash.classList.add('hidden');
    canvas.focus();
    bus.emit(EV.DEPTH_CHANGED, { meters: 0, layer: 'Surface · Expedition Base Camp' });
    toast.show(loaded.ok ? 'Expedition resumed. Welcome back!' : 'Welcome to base camp. Dig deep, return to sell.', 'info');
  };
  splash.addEventListener('click', start);
  splash.addEventListener('keydown', (e) => { if (e.code === 'Enter' || e.code === 'Space') start(); });
  /** @type {HTMLElement|null} */ (splash.querySelector('button'))?.focus();
  loop.start();
}

boot();
