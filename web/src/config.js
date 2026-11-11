/**
 * @module config
 * Single source of truth for every tunable number in the game.
 * Nothing outside this file should contain gameplay/balance/audio/render constants.
 */

/** Tile type ids (stored in World.tileType). */
export const TILE = Object.freeze({
  AIR: 0, SOIL: 1, LIMESTONE: 2, GRANITE: 3, BASALT: 4, MANTLE: 5, BEDROCK: 6, WATER: 7, MAGMA: 8,
});

/** Ore ids (stored in World.oreType), ordered by real-world value. */
export const ORE = Object.freeze({
  NONE: 0, COAL: 1, IRON: 2, COPPER: 3, SILVER: 4, PLATINUM: 5, GOLD: 6, DIAMOND: 7,
});

/** Bit flags (stored in World.flags). */
export const FLAG = Object.freeze({
  DISCOVERED: 1, RADAR_LIT: 2, DIRTY: 4, SOLID: 8, FUNGI: 16, MOSS: 32,
});

export const WORLD = Object.freeze({
  W: 64,
  H: 256,
  TILE_PX: 32,
  SURFACE_ROWS: 6,
  CHUNK: 16,
  METERS_PER_TILE: 2,
  BAND_NOISE_AMP: 3,
  BAND_NOISE_FREQ: 0.08,
  CAVE_FREQ_X: 0.085,
  CAVE_FREQ_Y: 0.12,
  CAVE_OCTAVES: 4,
  CAVE_THRESHOLD_TOP: 0.36,
  CAVE_THRESHOLD_BOTTOM: 0.24,
  CAVE_MIN_DEPTH: 5,
  WATER_FREQ: 0.11,
  WATER_THRESHOLD: 0.12,
  MAGMA_FREQ_X: 0.06,
  MAGMA_FREQ_Y: 0.045,
  MAGMA_WIDTH: 0.035,
  FUNGI_CHANCE: 0.22,
  MOSS_CHANCE: 0.2,
  /** Fraction of host-rock tiles that become ore, per host band material id. */
  BAND_ORE_FRACTION: Object.freeze({ 1: 0.06, 2: 0.07, 3: 0.07, 4: 0.08, 5: 0.09 }),
  ORE_DEPTH_BIAS: 0.35,
  ORE_ATTEMPT_MULT: 20,
  BASE_CAMP: Object.freeze({ SPAWN_X: 29, SHOP_X: 24, STATION_X: 36, SHAFT_X: 31, INTERACT_RANGE: 2.2 }),
  TOP_LIMIT_PX: -200,
});

/**
 * Materials indexed by TILE id.
 * band: nominal depth band [start, end] as a fraction of underground rows.
 */
export const MATERIALS = Object.freeze([
  { id: 0, key: 'AIR', name: 'Open Air', hp: 0, tier: 0, solid: false, sfx: 'none' },
  { id: 1, key: 'SOIL', name: 'Topsoil & Clay', layer: 'Topsoil', hp: 2, tier: 1, solid: true, band: [0, 0.15], sfx: 'soil',
    colors: { base: '#7b5434', dark: '#4f3220', light: '#a2744a', accent: '#5c3d24', extra: '#3b2a1a' } },
  { id: 2, key: 'LIMESTONE', name: 'Limestone', layer: 'Sedimentary Layers', hp: 6, tier: 2, solid: true, band: [0.15, 0.35], sfx: 'limestone',
    colors: { base: '#c49a52', dark: '#957034', light: '#e0bd7c', accent: '#a98243', extra: '#efe0bc' } },
  { id: 3, key: 'GRANITE', name: 'Granite', layer: 'Crust', hp: 14, tier: 3, solid: true, band: [0.35, 0.55], sfx: 'granite',
    colors: { base: '#8a909a', dark: '#5f646e', light: '#b3b8c1', accent: '#3b3e45', extra: '#c99a96' } },
  { id: 4, key: 'BASALT', name: 'Basalt', layer: 'Deep Crust', hp: 24, tier: 4, solid: true, band: [0.55, 0.78], sfx: 'basalt',
    colors: { base: '#34363f', dark: '#1f2027', light: '#4c4f5b', accent: '#262830', extra: '#5a5e6c' } },
  { id: 5, key: 'MANTLE', name: 'Mantle Rock (Obsidian)', layer: 'Mantle', hp: 40, tier: 5, solid: true, band: [0.78, 1], sfx: 'mantle',
    colors: { base: '#17131b', dark: '#0b090d', light: '#3f3550', accent: '#ff6a1f', extra: '#ffc14a' } },
  { id: 6, key: 'BEDROCK', name: 'Bedrock', layer: 'Bedrock', hp: 65535, tier: 99, solid: true, sfx: 'clink',
    colors: { base: '#2a2a31', dark: '#18181d', light: '#3d3d46', accent: '#4a4a55', extra: '#101014' } },
  { id: 7, key: 'WATER', name: 'Water Seep', hp: 0, tier: 0, solid: false, sfx: 'none',
    colors: { base: '#2b6f8f', dark: '#1b4a63', light: '#5fb4d6', accent: '#9fe2ff', extra: '#173a4d' } },
  { id: 8, key: 'MAGMA', name: 'Magma Channel', hp: 0, tier: 0, solid: false, sfx: 'none',
    colors: { base: '#ff5a12', dark: '#7a1c08', light: '#ffb340', accent: '#ffe08a', extra: '#3a0d04' } },
]);

/** Ores indexed by ORE id. weight = relative abundance within a host band (also drives vein count). */
export const ORES = Object.freeze([
  null,
  { id: 1, key: 'COAL', name: 'Coal', price: 5, tier: 1, hosts: [1, 2], weight: 10, vein: [4, 8], glint: 0.0, pitch: 0,
    colors: { base: '#1c1a1e', light: '#3a3740', spec: '#55525d', dark: '#0a090b' }, glow: null },
  { id: 2, key: 'IRON', name: 'Iron Ore', price: 12, tier: 2, hosts: [2, 3], weight: 7, vein: [3, 7], glint: 0.2, pitch: 520,
    colors: { base: '#8a4b2e', light: '#b86a3d', spec: '#e09a6a', dark: '#4a2414' }, glow: '#c0603a' },
  { id: 3, key: 'COPPER', name: 'Copper Ore', price: 25, tier: 2, hosts: [2, 3], weight: 4, vein: [3, 6], glint: 0.3, pitch: 660,
    colors: { base: '#c8692a', light: '#ec9550', spec: '#5fb39a', dark: '#6a3412' }, glow: '#e07a3a' },
  { id: 4, key: 'SILVER', name: 'Silver Ore', price: 60, tier: 3, hosts: [3, 4], weight: 5, vein: [2, 5], glint: 0.5, pitch: 880,
    colors: { base: '#a9afb8', light: '#eef2f7', spec: '#ffffff', dark: '#5d636c' }, glow: '#cfd8e8' },
  { id: 5, key: 'PLATINUM', name: 'Platinum Ore', price: 140, tier: 4, hosts: [4, 5], weight: 2, vein: [2, 4], glint: 0.65, pitch: 990,
    colors: { base: '#c3ced8', light: '#eaf3fb', spec: '#ffffff', dark: '#6c7884' }, glow: '#bfe0ff' },
  { id: 6, key: 'GOLD', name: 'Gold', price: 300, tier: 4, hosts: [4, 5], weight: 1, vein: [1, 4], glint: 0.8, pitch: 1175,
    colors: { base: '#e2a91c', light: '#ffd84a', spec: '#fff6b0', dark: '#8a5a06' }, glow: '#ffcc33' },
  { id: 7, key: 'DIAMOND', name: 'Diamond', price: 750, tier: 6, hosts: [5], weight: 0.5, vein: [1, 2], glint: 1.0, pitch: 1568,
    colors: { base: '#7fe8ff', light: '#e8fdff', spec: '#ffffff', dark: '#2a8aa8' }, glow: '#8ff4ff', crystal: true },
]);

/** Ore tiles are tougher than plain host rock. */
export const ORE_HP_MUL = 1.5;

/** Pickaxes: index = tier - 1. */
export const PICKAXES = Object.freeze([
  { tier: 1, name: 'Bronze Pickaxe', short: 'Bronze', cost: 0, damage: 1, swing: 0.30, color: '#c58a45' },
  { tier: 2, name: 'Iron Pickaxe', short: 'Iron', cost: 300, damage: 2, swing: 0.27, color: '#8d9096' },
  { tier: 3, name: 'Steel Pickaxe', short: 'Steel', cost: 1200, damage: 3, swing: 0.24, color: '#b9c3cf' },
  { tier: 4, name: 'Titanium Pickaxe', short: 'Titanium', cost: 4000, damage: 5, swing: 0.21, color: '#d7dde8' },
  { tier: 5, name: 'Tungsten Carbide Pickaxe', short: 'Tungsten Carbide', cost: 12000, damage: 8, swing: 0.19, color: '#646a7a' },
  { tier: 6, name: 'Diamond-Tipped Pickaxe', short: 'Diamond-Tipped', cost: 35000, damage: 12, swing: 0.17, color: '#9ff4ff' },
]);

/** Non-pickaxe upgrades. Level 0 is starting gear. */
export const UPGRADES = Object.freeze({
  jetpack: { name: 'Jetpack', levels: [
    { cost: 0, thrust: 1900, maxUp: 220, drain: 4 },
    { cost: 800, thrust: 2300, maxUp: 280, drain: 3.4 },
    { cost: 3000, thrust: 2800, maxUp: 340, drain: 2.8 },
    { cost: 9000, thrust: 3400, maxUp: 420, drain: 2.2 },
  ] },
  suit: { name: 'Suit Core', levels: [
    { cost: 0, maxEnergy: 100, passive: 0.35, heatResist: 0 },
    { cost: 1000, maxEnergy: 180, passive: 0.32, heatResist: 0.25 },
    { cost: 5000, maxEnergy: 300, passive: 0.29, heatResist: 0.5 },
    { cost: 15000, maxEnergy: 500, passive: 0.26, heatResist: 0.75 },
  ] },
  radar: { name: 'Radar', levels: [
    { cost: 0, radius: 8, duration: 6, headlamp: 190 },
    { cost: 700, radius: 12, duration: 9, headlamp: 240 },
    { cost: 3500, radius: 16, duration: 12, headlamp: 290 },
    { cost: 11000, radius: 22, duration: 16, headlamp: 350 },
  ] },
  cargo: { name: 'Cargo Hold', levels: [
    { cost: 0, slots: 10 },
    { cost: 400, slots: 20 },
    { cost: 2500, slots: 35 },
    { cost: 9000, slots: 60 },
  ] },
});

export const CONSUMABLES = Object.freeze({
  dynamite: { name: 'Dynamite', short: 'Dynamite', price: 100, slot: 1, start: 2 },
  teleporter: { name: 'Portable Teleporter', short: 'Warp', price: 250, slot: 2, start: 0 },
  cell: { name: 'Reserve Energy Cell', short: 'Cell', price: 80, slot: 3, start: 1, energy: 75 },
});

export const ECONOMY = Object.freeze({
  START_CREDITS: 0,
  /** Units of one ore type that fit in a single cargo slot. */
  STACK_SIZE: 2,
});

/** Balance model used by tests/economy.test.js. */
export const BALANCE = Object.freeze({
  PACKING_EFFICIENCY: 0.85,
  /** Average cargo slots a player is expected to own while using tier N (index N-1). */
  ASSUMED_CARGO_SLOTS_BY_TIER: [10, 20, 20, 20, 35, 35],
  /** Host band (material id) a player at tier N mostly mines. */
  FOCUS_BAND_BY_TIER: [1, 2, 3, 4, 5, 5],
  TRIPS_MIN: 3,
  TRIPS_MAX: 5,
});

export const PHYSICS = Object.freeze({
  GRAVITY: 1100,
  WALK_SPEED: 150,
  GROUND_ACCEL: 1500,
  GROUND_FRICTION: 1700,
  AIR_ACCEL: 700,
  MAX_FALL: 640,
  PLAYER_W: 18,
  PLAYER_H: 28,
  MAX_STEP_PX: 10,
  EPS: 0.001,
  FOOTSTEP_DIST: 26,
});

export const DYNAMITE = Object.freeze({
  FUSE: 2.5,
  THROW_SPEED: 430,
  THROW_UP_BIAS: 120,
  RESTITUTION: 0.45,
  GROUND_FRICTION: 0.8,
  SIZE: 8,
  RADIUS: 1,
  MAX_ACTIVE: 8,
  FLASH_RATE_START: 3,
  FLASH_RATE_END: 14,
  SHOCKWAVE_TIME: 0.5,
  SHOCKWAVE_RADIUS: 96,
});

export const MINING = Object.freeze({
  REACH: 76,
  HINT_COOLDOWN: 1.5,
  CRACK_STAGES: [0.25, 0.5, 0.75, 0.9],
  RECOIL_PX: 2,
  RECOIL_TIME: 0.09,
  HIT_STOP_FRAMES: 2,
  DEBRIS_MIN: 12,
  DEBRIS_MAX: 20,
  FIRST_SWING_FRAC: 0.6,
  MAX_DAMAGED_TRACKED: 512,
});

export const PICKUPS = Object.freeze({ MAX: 64, SIZE: 10, BOUNCE: 0.3, MAGNET: 26, LIFETIME: 600 });

export const ENERGY = Object.freeze({
  MINING_DRAIN_PER_HIT: 0.08,
  MANTLE_HEAT_MULT: 1.6,
  LOW_THRESHOLD: 0.2,
  LOW_BEEP_INTERVAL: 2.2,
  RESCUE_ENERGY_FRAC: 0.3,
  RESCUE_CARGO_LOSS: 0.5,
  STATION_RATE: 80,
  RADAR_COST: 8,
});

export const RADAR = Object.freeze({ COOLDOWN: 6, RING_SPEED: 520 });
export const TELEPORT = Object.freeze({ CHANNEL_TIME: 0.9, VORTEX_RATE: 140 });

export const CAMERA = Object.freeze({
  OMEGA: 7.5,
  MAX_SHAKE: 12,
  MAX_ROT_SHAKE: 0,
  TRAUMA_DECAY: 1.4,
  TRAUMA_HIT: 0.08,
  TRAUMA_CLINK: 0.04,
  TRAUMA_BREAK: 0.18,
  TRAUMA_EXPLOSION: 0.85,
  SHAKE_FREQ: 22,
  LOOK_AHEAD: 0.18,
  TOP_MARGIN: 170,
  VIEW_HEIGHT_TARGET: 540,
});

export const RENDER = Object.freeze({
  MAX_CHUNK_REBUILDS: 3,
  ATLAS_VARIANTS: 6,
  ORE_VARIANTS: 4,
  ATLAS_COLS: 16,
  REVEAL_FADE: 2.5,
  REVEAL_INTERVAL: 4,
  REVEAL_NEAR: 1.6,
  BACKWALL_BRIGHTNESS: 0.32,
  UNDERGROUND_BG: '#07070b',
  FOG_COLOR: '#000000',
  GLINT_SIZE: 5,
});

export const QUALITY = Object.freeze({
  PRESETS: Object.freeze({
    low: { lightScale: 0.25, bloom: false, particleCap: 1200, rays: 48, shimmer: false, grain: false },
    medium: { lightScale: 0.5, bloom: true, particleCap: 2200, rays: 96, shimmer: false, grain: true },
    high: { lightScale: 0.5, bloom: true, particleCap: 3000, rays: 160, shimmer: true, grain: true },
  }),
  AUTO_SAMPLE_SEC: 3,
  AUTO_HIGH_MS: 7,
  AUTO_MED_MS: 11,
});

export const LIGHTING = Object.freeze({
  PLAYER_RADIUS: 150,
  PLAYER_COLOR: '#ffb070',
  PLAYER_INTENSITY: 1.0,
  CONE_HALF_ANGLE: 0.44,
  CONE_INNER_FRAC: 0.55,
  CONE_COLOR: '#fff1d6',
  CONE_OUTER_ALPHA: 0.55,
  CONE_WALL_BLEED: 10,
  FLICKER: 0.06,
  FLICKER_FREQ: 13,
  AMBIENT_SURFACE: [226, 206, 188],
  AMBIENT_DEEP: [24, 22, 30],
  AMBIENT_FADE_ROWS: 10,
  AMBIENT_STEPS: 64,
  ORE_GLOW_RADIUS: 22,
  FUNGI_COLOR: '#2fe0b0',
  FUNGI_RADIUS: 30,
  MAGMA_COLOR: '#ff5a1a',
  MAGMA_RADIUS: 44,
  MAGMA_PULSE: 1.3,
  BLOOM_ALPHA: 0.75,
  BLOOM_DOWNSCALE: 4,
  EXPLOSION_COLOR: '#ffcf8a',
  EXPLOSION_RADIUS: 240,
  EXPLOSION_TIME: 0.4,
  BEACON_RADIUS: 54,
  GLOW_PARTICLE_RADIUS: 16,
  MAX_GLOW_PARTICLES: 160,
  SPRITE_SIZE: 128,
  RADAR_COLOR: '#3ff0ff',
});

export const PARTICLES = Object.freeze({
  DEFAULT_CAP: 3000,
  GRAVITY: 900,
  BEAM_DUST_RATE: 10,
  DRIP_RATE: 0.9,
  EMBER_RATE: 7,
  JET_RATE: 70,
  MAX_COLORS: 128,
});

export const POSTFX = Object.freeze({
  VIGNETTE: 0.55,
  GRAIN_ALPHA: 0.05,
  GRAIN_SIZE: 128,
  GRADE_ALPHA: 0.16,
  GRADES: [[255, 176, 112], [110, 150, 220], [120, 200, 190], [255, 64, 24]],
  GRADE_STEPS: 48,
  SHIMMER_STRIPS: 24,
  SHIMMER_AMP: 1.5,
  SHIMMER_START: 0.74,
  LOW_ENERGY_PULSE: 0.25,
});

export const SURFACE = Object.freeze({
  SKY_TOP: '#0d1b3d',
  SKY_MID: '#3b3f72',
  SKY_HORIZON: '#f2a35e',
  MOUNTAIN: '#2c2c4e',
  HILL: '#22223a',
  TREE: '#14141e',
  CLOUD: '#c9a3a6',
  CLOUD_COUNT: 8,
  BIRD_INTERVAL: [9, 20],
  BIRD_COUNT: [4, 7],
  MOTES: 28,
  GRASS: '#5d8a3a',
  GRASS_DARK: '#3c5e25',
  BEACON_SHOP: '#ffb347',
  BEACON_STATION: '#3ff0ff',
  BEACON_RIG: '#ff4040',
  LAYER_PARALLAX: [0.12, 0.3, 0.55],
  SKY_EXTRA_PX: 220,
});

export const AUDIO = Object.freeze({
  MASTER: 0.8, MUSIC: 0.45, SFX: 0.85, UI: 0.6, AMBIENCE: 0.5,
  MAX_VOICES: Object.freeze({ sfx: 28, ui: 6, ambience: 10 }),
  PITCH_JITTER: 0.05,
  GAIN_JITTER: 0.15,
  DUCK_DB: 4,
  DUCK_TIME: 1.2,
  HEAR_RADIUS: 900,
  PAN_RANGE: 500,
  NOISE_SECONDS: 2,
  REVERB: Object.freeze({ TUNNEL_SEC: 1.1, TUNNEL_DECAY: 3.4, OPEN_SEC: 3.0, OPEN_DECAY: 1.8, SEND: 0.22, FADE: 0.5 }),
  COMPRESSOR: Object.freeze({ threshold: -14, knee: 12, ratio: 4, attack: 0.004, release: 0.2 }),
  SOFTCLIP: 1.6,
  MATERIAL: Object.freeze({
    soil: { noiseLo: 300, noiseHi: 800, thump: 80, thumpEnd: 42, dur: 0.18, gain: 0.7 },
    limestone: { tri: 620, triEnd: 300, noiseLo: 1000, noiseHi: 1800, pebbles: 4, pebbleHz: 4200, dur: 0.16, gain: 0.6 },
    granite: { carrier: 440, ratio: 1.414, index: 900, bp: 2500, q: 8, dur: 0.22, gain: 0.55 },
    basalt: { carrier: 250, ratio: 1.37, index: 650, bp: 1500, q: 7, dur: 0.4, gain: 0.62 },
    mantle: { glass: [2300, 3450, 5200], hiss: 5200, dur: 0.5, gain: 0.5 },
    clink: { partials: [3200, 4700, 6100], decay: 0.4, gain: 0.32 },
  }),
  FOOTSTEP_HZ: Object.freeze({ 0: 700, 1: 420, 2: 1200, 3: 2000, 4: 1500, 5: 2600, 6: 1800 }),
  JET_BP: 900,
  JET_GAIN: 0.22,
  LOW_BEEP_HZ: 440,
  MUSIC: Object.freeze({
    ROOT_SURFACE_MIDI: 45,
    ROOT_DEEP_MIDI: 33,
    CUTOFF_SURFACE: 1900,
    CUTOFF_DEEP: 320,
    BEAT: 0.62,
    LEAD_PROB: 0.5,
    SCALE: [0, 3, 5, 7, 10],
    DISSONANT: [1, 6],
    DISSONANCE_START: 0.78,
    LOOKAHEAD: 0.25,
    TICK_MS: 25,
    SUB_MAX: 0.32,
    DRONE_GAIN: 0.11,
    LEAD_GAIN: 0.07,
    LEAD_DECAY: 3.5,
    DELAY_TIME: 0.43,
    DELAY_FB: 0.42,
    LFO_HZ: 0.05,
    LFO_DEPTH: 0.35,
    DETUNE: 1.004,
  }),
});

export const SAVE = Object.freeze({
  KEY: 'jttdote.save',
  SETTINGS_KEY: 'jttdote.settings',
  VERSION: 2,
  AUTOSAVE_SEC: 15,
  EXPLOSION_BLOCK_SEC: 1.5,
});

export const SETTINGS_DEFAULT = Object.freeze({
  master: 0.8, music: 0.45, sfx: 0.85, ambience: 0.5,
  quality: 'auto', shake: true, reducedFlashing: false, muted: false,
});

/** Action map. Raw key codes live only here. 'Mouse0' = left button. */
export const KEYBINDS = Object.freeze({
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jet: ['KeyW', 'Space', 'ArrowUp'],
  mine: ['Mouse0'],
  radar: ['KeyR'],
  slot1: ['Digit1'],
  slot2: ['Digit2'],
  slot3: ['Digit3'],
  interact: ['KeyE'],
  pause: ['Escape'],
  debug: ['F3'],
});

export const GAMEPAD = Object.freeze({
  DEADZONE: 0.25,
  AIM_DIST: 80,
  BUTTONS: Object.freeze({ jet: 0, radar: 2, interact: 3, mine: 7, slot1: 14, slot2: 12, slot3: 15, pause: 9 }),
});

export const UI = Object.freeze({
  TOAST_TIME: 2.6,
  TOAST_MAX: 4,
  COUNTER_TIME: 0.8,
  MINIMAP_W: 140,
  MINIMAP_H: 180,
  MINIMAP_SCALE: 2,
  PLAYER_BLINK: 0.5,
  DEBUG_GRAPH_W: 200,
  DEBUG_GRAPH_H: 60,
  DEBUG_TEXT_INTERVAL: 0.25,
});

export const LOOP = Object.freeze({ STEP: 1 / 60, MAX_STEPS: 5, MAX_FRAME_DT: 0.25 });

export const DEBUG = Object.freeze({ LOG: false });
