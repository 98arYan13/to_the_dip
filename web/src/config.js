/**
 * @module config
 * Single source of truth for every tunable number in the game.
 * Nothing outside this file should contain gameplay/balance/audio/render constants.
 */

/** Tile type ids (stored in World.tileType). */
export const TILE = Object.freeze({
  AIR: 0, SOIL: 1, LIMESTONE: 2, GRANITE: 3, BASALT: 4, MANTLE: 5, BEDROCK: 6, WATER: 7, MAGMA: 8,
});

/** Ore ids (stored in World.oreType), in the design-table rank order. */
export const ORE = Object.freeze({
  NONE: 0, COAL: 1, IRON: 2, LEAD: 3, ZINC: 4, COPPER: 5, NICKEL: 6, LITHIUM: 7, TIN: 8, COBALT: 9, FOSSIL: 10,
  URANIUM: 11, LAPIS: 12, SILVER: 13, BLACK_OPAL: 14, PLATINUM: 15, GOLD: 16, METEORITE: 17, RHODIUM: 18, RUBY: 19, DIAMOND: 20,
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
  METERS_PER_TILE: 8,
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
  { id: 1, key: 'SOIL', name: 'Topsoil & Clay', layer: 'Topsoil', hp: 2, tier: 1, hard: 0.5, solid: true, band: [0, 0.15], sfx: 'soil',
    tiles: ['clay-01_0', 'clay-01_1', 'clay-01_3', 'sand-and-dirts_1'],
    colors: { base: '#7b5434', dark: '#4f3220', light: '#a2744a', accent: '#5c3d24', extra: '#3b2a1a' } },
  { id: 2, key: 'LIMESTONE', name: 'Limestone', layer: 'Sedimentary Layers', hp: 6, tier: 2, hard: 0.8, solid: true, band: [0.15, 0.35], sfx: 'limestone',
    tiles: ['stone-01_1', 'stone-01_0', 'stone-02_1'],
    colors: { base: '#c49a52', dark: '#957034', light: '#e0bd7c', accent: '#a98243', extra: '#efe0bc' } },
  { id: 3, key: 'GRANITE', name: 'Granite', layer: 'Crust', hp: 14, tier: 3, hard: 1.2, solid: true, band: [0.35, 0.55], sfx: 'granite',
    tiles: ['stone-02_2'],
    colors: { base: '#8a909a', dark: '#5f646e', light: '#b3b8c1', accent: '#3b3e45', extra: '#c99a96' } },
  { id: 4, key: 'BASALT', name: 'Basalt', layer: 'Deep Crust', hp: 24, tier: 4, hard: 1.6, solid: true, band: [0.55, 0.78], sfx: 'basalt',
    tiles: ['stone-02_3'],
    colors: { base: '#34363f', dark: '#1f2027', light: '#4c4f5b', accent: '#262830', extra: '#5a5e6c' } },
  { id: 5, key: 'MANTLE', name: 'Mantle Rock (Obsidian)', layer: 'Mantle', hp: 40, tier: 5, hard: 2.2, solid: true, band: [0.78, 1], sfx: 'mantle',
    colors: { base: '#17131b', dark: '#0b090d', light: '#3f3550', accent: '#ff6a1f', extra: '#ffc14a' } },
  { id: 6, key: 'BEDROCK', name: 'Bedrock', layer: 'Bedrock', hp: 65535, tier: 99, solid: true, sfx: 'clink',
    colors: { base: '#2a2a31', dark: '#18181d', light: '#3d3d46', accent: '#4a4a55', extra: '#101014' } },
  { id: 7, key: 'WATER', name: 'Water Seep', hp: 0, tier: 0, solid: false, sfx: 'none',
    colors: { base: '#2b6f8f', dark: '#1b4a63', light: '#5fb4d6', accent: '#9fe2ff', extra: '#173a4d' } },
  { id: 8, key: 'MAGMA', name: 'Magma Channel', hp: 0, tier: 0, solid: false, sfx: 'none',
    colors: { base: '#ff5a12', dark: '#7a1c08', light: '#ffb340', accent: '#ffe08a', extra: '#3a0d04' } },
]);

/**
 * Ores indexed by ORE id. kg = cargo weight per block (ore + protective matrix), hard = H_mat,
 * perKg = value per kg of cargo, price = perKg * kg per block. weight = relative abundance within a host band.
 */
export const ORES = Object.freeze([
  null,
  { id: 1, key: 'COAL', name: 'Coal', kg: 5.0, hard: 1.0, perKg: 0.14, price: 0.7, tier: 1, hosts: [1, 2], weight: 10, vein: [4, 8], glint: 0.0, pitch: 0,
    colors: { base: '#2a282d', light: '#55525d', spec: '#ffffff', dark: '#151416' }, glow: null, tile: 'iron-coal-copper-zinc_1' },
  { id: 2, key: 'IRON', name: 'Iron Ore', kg: 6.0, hard: 1.5, perKg: 0.16, price: 0.96, tier: 1, hosts: [1, 2], weight: 8, vein: [3, 7], glint: 0.2, pitch: 520,
    colors: { base: '#8a4b2e', light: '#e09a4a', spec: '#ffffff', dark: '#452517' }, glow: '#c0603a', tile: 'iron-coal-copper-zinc_0' },
  { id: 3, key: 'LEAD', name: 'Lead', kg: 4.5, hard: 1.4, perKg: 0.94, price: 4.23, tier: 1, hosts: [1, 2], weight: 6, vein: [3, 6], glint: 0.2, pitch: 480,
    colors: { base: '#4a5a72', light: '#8aa0c0', spec: '#ffffff', dark: '#252d39' }, glow: null, tile: 'lead-nickel-lithium-lead_0' },
  { id: 4, key: 'ZINC', name: 'Zinc', kg: 3.5, hard: 1.8, perKg: 1.57, price: 5.5, tier: 1, hosts: [1, 2], weight: 4, vein: [3, 6], glint: 0.3, pitch: 600,
    colors: { base: '#9aa59a', light: '#e2f0e2', spec: '#ffffff', dark: '#4d524d' }, glow: null, tile: 'iron-coal-copper-zinc_3' },
  { id: 5, key: 'COPPER', name: 'Copper Ore', kg: 3.0, hard: 2.0, perKg: 3.94, price: 11.82, tier: 2, hosts: [2, 3], weight: 7, vein: [3, 6], glint: 0.3, pitch: 660,
    colors: { base: '#c8692a', light: '#ec9550', spec: '#ffffff', dark: '#643415' }, glow: '#e07a3a', tile: 'iron-coal-copper-zinc_2' },
  { id: 6, key: 'NICKEL', name: 'Nickel', kg: 3.0, hard: 2.5, perKg: 5.6, price: 16.8, tier: 2, hosts: [2, 3], weight: 6, vein: [3, 6], glint: 0.3, pitch: 700,
    colors: { base: '#9a9a4a', light: '#e0d880', spec: '#ffffff', dark: '#4d4d25' }, glow: null, tile: 'lead-nickel-lithium-lead_1' },
  { id: 7, key: 'LITHIUM', name: 'Lithium', kg: 1.5, hard: 1.6, perKg: 13.5, price: 20.25, tier: 2, hosts: [2, 3], weight: 3, vein: [2, 5], glint: 0.5, pitch: 820,
    colors: { base: '#c08aa8', light: '#f4c8e0', spec: '#ffffff', dark: '#604554' }, glow: '#f0a0d0', tile: 'lead-nickel-lithium-lead_2' },
  { id: 8, key: 'TIN', name: 'Tin', kg: 2.5, hard: 2.2, perKg: 10.05, price: 25.12, tier: 2, hosts: [2, 3], weight: 4, vein: [2, 5], glint: 0.4, pitch: 760,
    colors: { base: '#9aa4b8', light: '#e8eef8', spec: '#ffffff', dark: '#4d525c' }, glow: null, tile: 'lead-nickel-lithium-lead_3' },
  { id: 9, key: 'COBALT', name: 'Cobalt', kg: 2.8, hard: 3.2, perKg: 10.09, price: 28.25, tier: 3, hosts: [3, 4], weight: 6, vein: [3, 6], glint: 0.4, pitch: 740,
    colors: { base: '#1f4fa8', light: '#5a9aff', spec: '#ffffff', dark: '#0f2754' }, glow: '#3a7aff', tile: 'cobalt-fossil-uranium-lapis_0' },
  { id: 10, key: 'FOSSIL', name: 'Fossil', kg: 4.0, hard: 1.2, perKg: 16.5, price: 66.0, tier: 2, hosts: [2, 3], weight: 2, vein: [1, 2], glint: 0.0, pitch: 0,
    colors: { base: '#b8ac90', light: '#e8dcc0', spec: '#ffffff', dark: '#5c5648' }, glow: null, tile: 'cobalt-fossil-uranium-lapis_1', fragile: true },
  { id: 11, key: 'URANIUM', name: 'Uranium', kg: 5.5, hard: 4.5, perKg: 16.24, price: 89.32, tier: 3, hosts: [3, 4], weight: 4, vein: [2, 5], glint: 0.3, pitch: 560,
    colors: { base: '#3a8a1a', light: '#8aff3a', spec: '#ffffff', dark: '#1d450d' }, glow: '#7aff2a', tile: 'cobalt-fossil-uranium-lapis_2' },
  { id: 12, key: 'LAPIS', name: 'Lapis Lazuli', kg: 1.2, hard: 3.0, perKg: 101.33, price: 121.6, tier: 3, hosts: [3, 4], weight: 2, vein: [2, 4], glint: 0.6, pitch: 940,
    colors: { base: '#1a2a8a', light: '#4a6aff', spec: '#ffffff', dark: '#0d1545' }, glow: '#3a5aff', tile: 'cobalt-fossil-uranium-lapis_3' },
  { id: 13, key: 'SILVER', name: 'Silver Ore', kg: 2.0, hard: 2.8, perKg: 81.41, price: 162.82, tier: 3, hosts: [3, 4], weight: 3, vein: [2, 5], glint: 0.5, pitch: 880,
    colors: { base: '#7a8088', light: '#eef2f7', spec: '#ffffff', dark: '#3d4044' }, glow: '#cfd8e8', tile: 'sliver-black-opal-platinum-gold_0' },
  { id: 14, key: 'BLACK_OPAL', name: 'Black Opal', kg: 0.8, hard: 3.5, perKg: 384.38, price: 307.5, tier: 4, hosts: [4, 5], weight: 1.5, vein: [1, 3], glint: 0.9, pitch: 1320,
    colors: { base: '#1a1a3a', light: '#3ae0c0', spec: '#ffffff', dark: '#0d0d1d' }, glow: '#4af0d0', tile: 'sliver-black-opal-platinum-gold_1', fragile: true },
  { id: 15, key: 'PLATINUM', name: 'Platinum Ore', kg: 2.5, hard: 5.5, perKg: 174.72, price: 436.8, tier: 4, hosts: [4, 5], weight: 3, vein: [2, 4], glint: 0.65, pitch: 990,
    colors: { base: '#a8b0b8', light: '#eaf3fb', spec: '#ffffff', dark: '#54585c' }, glow: '#bfe0ff', tile: 'sliver-black-opal-platinum-gold_2' },
  { id: 16, key: 'GOLD', name: 'Gold', kg: 2.2, hard: 3.0, perKg: 310.55, price: 683.21, tier: 4, hosts: [4, 5], weight: 2, vein: [1, 4], glint: 0.8, pitch: 1175,
    colors: { base: '#c8900c', light: '#ffd84a', spec: '#ffffff', dark: '#644806' }, glow: '#ffcc33', tile: 'sliver-black-opal-platinum-gold_3' },
  { id: 17, key: 'METEORITE', name: 'Meteorite', kg: 7.0, hard: 7.5, perKg: 125.0, price: 875.0, tier: 5, hosts: [4, 5], weight: 2, vein: [1, 3], glint: 0.3, pitch: 420,
    colors: { base: '#c0d8f0', light: '#ffffff', spec: '#ffffff', dark: '#606c78' }, glow: '#a0d0ff', tile: 'meteorit-rhodium-ruby-diamond_0' },
  { id: 18, key: 'RHODIUM', name: 'Rhodium', kg: 1.8, hard: 6.5, perKg: 593.06, price: 1067.51, tier: 5, hosts: [5], weight: 2, vein: [1, 3], glint: 0.7, pitch: 1250,
    colors: { base: '#3a2a2a', light: '#ff7a2a', spec: '#ffffff', dark: '#1d1515' }, glow: '#ff6a1a', tile: 'meteorit-rhodium-ruby-diamond_1' },
  { id: 19, key: 'RUBY', name: 'Ruby & Emerald', kg: 0.6, hard: 8.0, perKg: 2600.0, price: 1560.0, tier: 5, hosts: [5], weight: 1, vein: [1, 2], glint: 0.95, pitch: 1400,
    colors: { base: '#c01a3a', light: '#3ae07a', spec: '#ffffff', dark: '#600d1d' }, glow: '#ff3a6a', tile: 'meteorit-rhodium-ruby-diamond_2' },
  { id: 20, key: 'DIAMOND', name: 'Diamond', kg: 0.5, hard: 10.0, perKg: 5000.0, price: 2500.0, tier: 6, hosts: [5], weight: 0.5, vein: [1, 2], glint: 1.0, pitch: 1568,
    colors: { base: '#7fe8ff', light: '#e8fdff', spec: '#ffffff', dark: '#3f747f' }, glow: '#8ff4ff', tile: 'meteorit-rhodium-ruby-diamond_3', crystal: true },
]);

/** Ore tiles are tougher than plain host rock. */
export const ORE_HP_MUL = 1.5;

/** Pickaxes: index = tier - 1. */
export const PICKAXES = Object.freeze([
  { tier: 1, name: 'Bronze Pickaxe', short: 'Bronze', cost: 0, damage: 1, swing: 0.30, color: '#c58a45' },
  { tier: 2, name: 'Iron Pickaxe', short: 'Iron', cost: 50, damage: 2, swing: 0.27, color: '#8d9096' },
  { tier: 3, name: 'Steel Pickaxe', short: 'Steel', cost: 700, damage: 3, swing: 0.24, color: '#b9c3cf' },
  { tier: 4, name: 'Titanium Pickaxe', short: 'Titanium', cost: 8000, damage: 5, swing: 0.21, color: '#d7dde8' },
  { tier: 5, name: 'Tungsten Carbide Pickaxe', short: 'Tungsten Carbide', cost: 75000, damage: 8, swing: 0.19, color: '#646a7a' },
  { tier: 6, name: 'Diamond-Tipped Pickaxe', short: 'Diamond-Tipped', cost: 560000, damage: 12, swing: 0.17, color: '#9ff4ff' },
]);

/** Non-pickaxe upgrades. Level 0 is starting gear. */
export const UPGRADES = Object.freeze({
  jetpack: { name: 'Jetpack', levels: [
    { cost: 0, thrust: 1900, maxUp: 220, drain: 1 },
    { cost: 150, thrust: 2300, maxUp: 280, drain: 0.85 },
    { cost: 2000, thrust: 2800, maxUp: 340, drain: 0.7 },
    { cost: 30000, thrust: 3400, maxUp: 420, drain: 0.55 },
  ] },
  radar: { name: 'Radar', levels: [
    { cost: 0, radius: 8, duration: 6, headlamp: 190 },
    { cost: 120, radius: 12, duration: 9, headlamp: 240 },
    { cost: 1500, radius: 16, duration: 12, headlamp: 290 },
    { cost: 20000, radius: 22, duration: 16, headlamp: 350 },
  ] },
  /** Backpack + battery tiers: capacity kg (C_max), max energy, drill efficiency (eta_rig). */
  rig: { name: 'Cargo & Battery Rig', levels: [
    { cost: 0, name: 'Canvas Sack & Lead-Acid', zone: '0-100m', capacity: 35, maxEnergy: 100, eff: 1.0 },
    { cost: 30, name: 'Reinforced Frame & NiCad', zone: '100-300m', capacity: 75, maxEnergy: 250, eff: 1.3 },
    { cost: 420, name: 'Exo-Carrier & Li-Ion Pack', zone: '300-600m', capacity: 150, maxEnergy: 600, eff: 1.8 },
    { cost: 4800, name: 'Hydraulic Rig & Micro-Fission', zone: '600-1,000m', capacity: 300, maxEnergy: 1500, eff: 2.5 },
    { cost: 45000, name: 'Mag-Lev Pod & Isotope Core', zone: '1,000-1,500m', capacity: 600, maxEnergy: 4000, eff: 3.5 },
    { cost: 336000, name: 'Quantum Warp Cargo & Plasma', zone: '1,500m+', capacity: 1200, maxEnergy: 10000, eff: 5.0 },
  ] },
});

export const CONSUMABLES = Object.freeze({
  dynamite: { name: 'Dynamite', short: 'Dynamite', price: 15, slot: 1, start: 2 },
  teleporter: { name: 'Portable Teleporter', short: 'Warp', price: 40, slot: 2, start: 0 },
  cell: { name: 'Reserve Energy Cell', short: 'Cell', price: 10, slot: 3, start: 1, frac: 0.4 },
});

export const ECONOMY = Object.freeze({
  START_CREDITS: 0,
});

/** Balance model used by tests/economy.test.js. */
export const BALANCE = Object.freeze({
  PACKING_EFFICIENCY: 0.85,
  /** A player at pickaxe tier N is assumed to own rig level N-1. */
  /** Host band (material id) a player at tier N mostly mines. */
  FOCUS_BAND_BY_TIER: [1, 2, 3, 4, 5, 5],
  TRIPS_MIN: 3,
  TRIPS_MAX: 5,
});

export const PHYSICS = Object.freeze({
  GRAVITY: 650,
  WALK_SPEED: 150,
  GROUND_ACCEL: 1500,
  GROUND_FRICTION: 1700,
  AIR_ACCEL: 700,
  MAX_FALL: 400,
  PLAYER_W: 18,
  PLAYER_H: 28,
  MAX_STEP_PX: 10,
  EPS: 0.001,
  FOOTSTEP_DIST: 26,
  /** Hard landing: damage = max(MIN, round((tiles - threshold) * PER_TILE * sqrt(fallMult))). */
  HARD_LANDING_MIN_DMG: 5,
  HARD_LANDING_DMG_PER_TILE: 18,
  SUIT_HP: 100,
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
  /** E_base: energy to break a block of hardness 1 at the surface. */
  BLOCK_BASE: 2,
  /** E_idle/sec = IDLE_BASE * (1 + D/IDLE_DEPTH) * (1 + IDLE_LOAD * W/C). */
  IDLE_BASE: 0.2,
  IDLE_DEPTH: 300,
  IDLE_LOAD: 0.5,
  /** E_block depth term: (1 + D/BLOCK_DEPTH). */
  BLOCK_DEPTH: 500,
  /** Speed_mult = 1 - LOAD_SLOW * (W/C)^2. */
  LOAD_SLOW: 0.4,
  LOW_THRESHOLD: 0.2,
  LOW_BEEP_INTERVAL: 2.2,
  RESCUE_ENERGY_FRAC: 0.3,
  RESCUE_CARGO_LOSS: 0.5,
  /** Station recharge, fraction of max energy per second. */
  STATION_RATE: 0.35,
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
    clink: { partials: [3200, 4700, 6100], decay: 0.4, gain: 0.32 },
  }),
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
  VERSION: 3,
  AUTOSAVE_SEC: 15,
  EXPLOSION_BLOCK_SEC: 1.5,
});

export const SETTINGS_DEFAULT = Object.freeze({
  master: 0.8, music: 0.45, sfx: 0.85, ambience: 0.5,
  quality: 'auto', shake: true, reducedFlashing: false, muted: false,
  /** Scales gravity (x) and terminal fall speed (sqrt x). */
  fallSpeedMult: 1,
  /** Unbraked fall distance (tiles) before a landing hurts. */
  hardLandingTiles: 5,
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
