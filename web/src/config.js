/**
 * @module config
 * Single source of truth for every tunable number in the game.
 * Nothing outside this file should contain gameplay/balance/audio/render constants.
 */

/** Tile type ids (stored in World.tileType). */
export const TILE = Object.freeze({
  AIR: 0, SOIL: 1, LIMESTONE: 2, GRANITE: 3, BASALT: 4, MANTLE: 5, BEDROCK: 6, WATER: 7, MAGMA: 8, CORE: 9, SAND: 10, LADDER: 11,
});

/** Ore ids (stored in World.oreType), in the design-table rank order. */
export const ORE = Object.freeze({
  NONE: 0, COAL: 1, IRON: 2, LEAD: 3, ZINC: 4, COPPER: 5, NICKEL: 6, LITHIUM: 7, TIN: 8, COBALT: 9, FOSSIL: 10,
  URANIUM: 11, LAPIS: 12, SILVER: 13, BLACK_OPAL: 14, PLATINUM: 15, GOLD: 16, METEORITE: 17, RHODIUM: 18, RUBY: 19, DIAMOND: 20,
  TUNGSTEN: 21, // appended last so saved oreType ids stay valid
});

/** Bit flags (stored in World.flags). */
export const FLAG = Object.freeze({
  DISCOVERED: 1, RADAR_LIT: 2, DIRTY: 4, SOLID: 8, FUNGI: 16, MOSS: 32, UNSTABLE: 64,
});

/** Hazard tunables. */
export const HAZARD = Object.freeze({
  COLLAPSE: Object.freeze({ WARN_S: 1.2, STEP_S: 0.08, PULSE_S: 0.3, MAX_PER_TICK: 24 }),
  /** Fluid cells hold 0..MAX units; one flow step per FLOW_S (magma every MAGMA_EVERY-th step). */
  FLUID: Object.freeze({ MAX: 8, FLOW_S: 0.1, MAGMA_EVERY: 3, MAX_PER_TICK: 300 }),
  /** Rare and deep only: a small foreshock, WARN_S of calm, then the main quake. Only rock with hard <= WEAK_MAX_HARD falls. */
  QUAKE: Object.freeze({ SAFE_DEPTH_M: 600, WARN_S: 4, MIN_GAP_S: 180, MAX_GAP_S: 420, RADIUS: 12, BASE_N: 3, MAX_N: 14, SHAKE_DECAY: 1.5, WEAK_MAX_HARD: 1.2 }),
});

/** Toxic/explosive gas: per-tile concentration 0..MAX in open air; sealed pockets until a wall breaks. */
export const GAS = Object.freeze({ MAX: 8, STEP_S: 0.25, DPS: 6, EXPLODE_R: 2, MAX_CHAIN_PER_TICK: 40, MAX_PER_TICK: 400 });

/** Designed zones (world/Zones.js). BANDS are depth fractions of the underground; SIZE is [w, h] incl. a 1-tile wall ring. */
export const ZONES = Object.freeze({
  PER_LAYER: 3,
  LAYERS: [[0, 0.15], [0.15, 0.35], [0.35, 0.55], [0.55, 0.78], [0.78, 0.92]],
  LANDMARKS: ['sand_pocket', 'fossil_chamber', 'gas_cavern', 'vault', 'lava_lake'],
  BANDS: { sand_pocket: [0.03, 0.4], fossil_chamber: [0.12, 0.4], aquifer: [0.15, 0.55], vault: [0.2, 0.8], gas_cavern: [0.3, 0.75], crystal_geode: [0.35, 0.9], lava_lake: [0.78, 0.92] },
  SIZE: { sand_pocket: [6, 5], fossil_chamber: [7, 5], aquifer: [8, 5], vault: [8, 6], gas_cavern: [9, 6], crystal_geode: [7, 6], lava_lake: [10, 6] },
  CORE_CHAMBER: { W: 9, H: 5 },
});

export const CORE_GOAL = Object.freeze({ HOLD_S: 20, REWARD_CASH: 100000, QUAKE_EVERY_S: 4 });

export const CAMP = Object.freeze({ STATION_MIN_GAP: 12, MAX_STATIONS: 4, STATION_RANGE: 1.6, STATION_COST: { cash: 1500, ores: { 8: 2 } } });

/** Upgradeable camp buildings: level i+1 needs level i; effects are read by Economy. */
export const CAMP_BUILDINGS = Object.freeze({
  shop: { name: 'Trading Post', levels: [{ cost: { cash: 2000 }, effect: { sellMul: 1.1 } }, { cost: { cash: 15000 }, effect: { sellMul: 1.2 } }, { cost: { cash: 90000 }, effect: { sellMul: 1.3 } }] },
  workshop: { name: 'Workshop', levels: [{ cost: { cash: 3000 }, effect: { upgradeDiscount: 0.95 } }, { cost: { cash: 25000 }, effect: { upgradeDiscount: 0.9 } }, { cost: { cash: 120000 }, effect: { upgradeDiscount: 0.85 } }] },
});

export const CONTRACTS = Object.freeze({ MAX_ACTIVE: 3, OFFERS: 4, PREMIUM: 0.25 });

/** test: {event:'ore', ore, count} | {event:'depth', depthM} | {event:'completed'} */
export const ACHIEVEMENTS = Object.freeze([
  { id: 'first_fossil', name: 'Bone Collector', desc: 'Find a fossil.', test: { event: 'ore', ore: 10, count: 1 } },
  { id: 'fossils_5', name: 'Paleontologist', desc: 'Find 5 fossils.', test: { event: 'ore', ore: 10, count: 5 } },
  { id: 'fossils_15', name: 'Museum Curator', desc: 'Find 15 fossils.', test: { event: 'ore', ore: 10, count: 15 } },
  { id: 'first_gold', name: 'Gold Fever', desc: 'Mine gold.', test: { event: 'ore', ore: 16, count: 1 } },
  { id: 'first_diamond', name: 'Diamonds!', desc: 'Mine a diamond.', test: { event: 'ore', ore: 20, count: 1 } },
  { id: 'depth_100', name: 'Going Down', desc: 'Reach 100 m.', test: { event: 'depth', depthM: 100 } },
  { id: 'depth_500', name: 'Deep Diver', desc: 'Reach 500 m.', test: { event: 'depth', depthM: 500 } },
  { id: 'depth_1000', name: 'Into the Mantle', desc: 'Reach 1,000 m.', test: { event: 'depth', depthM: 1000 } },
  { id: 'core', name: 'Heart of the World', desc: 'Stabilize the Core.', test: { event: 'completed' } },
]);

export const DAILY = Object.freeze({ SALT: 0xda11 });

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
  BASE_CAMP: Object.freeze({ SPAWN_X: 29, SHOP_X: 24, STATION_X: 36, SHAFT_X: 31, INTERACT_RANGE: 2.2,
    /** Unbreakable foundation under the camp buildings: columns PAD_X0..PAD_X1, PAD_DEPTH rows deep. */
    PAD_X0: 20, PAD_X1: 40, PAD_DEPTH: 3 }),
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
  { id: 5, key: 'MANTLE', name: 'Mantle Rock (Obsidian)', layer: 'Mantle', hp: 40, tier: 5, hard: 2.2, solid: true, band: [0.78, 0.92], sfx: 'mantle',
    colors: { base: '#17131b', dark: '#0b090d', light: '#3f3550', accent: '#ff6a1f', extra: '#ffc14a' } },
  { id: 6, key: 'BEDROCK', name: 'Bedrock', layer: 'Bedrock', hp: 65535, tier: 99, solid: true, sfx: 'clink',
    colors: { base: '#2a2a31', dark: '#18181d', light: '#3d3d46', accent: '#4a4a55', extra: '#101014' } },
  { id: 7, key: 'WATER', name: 'Water Seep', hp: 0, tier: 0, solid: false, sfx: 'none',
    colors: { base: '#2b6f8f', dark: '#1b4a63', light: '#5fb4d6', accent: '#9fe2ff', extra: '#173a4d' } },
  { id: 8, key: 'MAGMA', name: 'Magma Channel', hp: 0, tier: 0, solid: false, sfx: 'none',
    colors: { base: '#ff5a12', dark: '#7a1c08', light: '#ffb340', accent: '#ffe08a', extra: '#3a0d04' } },
  // Deepest band. Drawn on top of lighting from the animated strip tiles/magma_anim.png (Renderer).
  { id: 9, key: 'CORE', name: 'Magma Rock', layer: 'Molten Core', hp: 60, tier: 6, hard: 2.8, solid: true, band: [0.92, 1], sfx: 'mantle',
    anim: { src: 'tiles/magma_anim.png', frames: 12, fps: 10 },
    colors: { base: '#3a2a2e', dark: '#1e1416', light: '#ff7a1a', accent: '#ff5a12', extra: '#ffc14a' } },
  // Loose sand pockets: no depth band; falls when unsupported (systems/Hazards/Collapse.js).
  { id: 10, key: 'SAND', name: 'Loose Sand', layer: 'Sand', hp: 1, tier: 1, hard: 0.4, solid: true, sfx: 'soil',
    colors: { base: '#d6b66a', dark: '#a8863e', light: '#ecd596', accent: '#c19d52', extra: '#8a6a30' } },
  // Placed by the player (systems/Items.js); walkable, climbable.
  { id: 11, key: 'LADDER', name: 'Ladder', hp: 0, tier: 0, solid: false, sfx: 'none',
    colors: { base: '#8a5a2b', dark: '#4f3220', light: '#b98046', accent: '#6b4423', extra: '#3b2a1a' } },
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
  // Heaviest ore in the game (dense wolframite/scheelite): tier 4 like gold/platinum, priced between them, found in granite-to-basalt veins.
  // Mining it with the Titanium Drill is what pays for the Tungsten Carbide Drill. No hand-drawn tile yet: procedural art.
  { id: 21, key: 'TUNGSTEN', name: 'Tungsten', kg: 5.0, hard: 7.0, perKg: 112.0, price: 560.0, tier: 4, hosts: [3, 4], weight: 2.5, vein: [2, 4], glint: 0.5, pitch: 1060,
    colors: { base: '#33313a', light: '#a68fc4', spec: '#ffffff', dark: '#18171c' }, glow: '#9a7aff', tile: null },
]);

/** Ore tiles are tougher than plain host rock. */
export const ORE_HP_MUL = 1.5;

/** Pickaxes: index = tier - 1. */
export const PICKAXES = Object.freeze([
  // Tiers 1-3 are hand tools (free to swing); tiers 4-6 are powered drills that draw battery per block.
  { tier: 1, name: 'Bronze Pickaxe', short: 'Bronze', cost: 0, damage: 2, swing: 0.60, color: '#c58a45' },
  { tier: 2, name: 'Iron Pickaxe', short: 'Iron', cost: 50, damage: 4, swing: 0.54, color: '#8d9096' },
  { tier: 3, name: 'Steel Pickaxe', short: 'Steel', cost: 700, damage: 6, swing: 0.48, color: '#b9c3cf' },
  { tier: 4, name: 'Titanium Drill', short: 'Titanium', cost: 8000, damage: 10, swing: 0.42, color: '#d7dde8', powered: true },
  { tier: 5, name: 'Tungsten Carbide Drill', short: 'Tungsten Carbide', cost: 75000, damage: 16, swing: 0.38, color: '#646a7a', powered: true },
  { tier: 6, name: 'Diamond-Tipped Drill', short: 'Diamond-Tipped', cost: 560000, damage: 24, swing: 0.34, color: '#9ff4ff', powered: true },
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

/**
 * Tech tree (flat). Each node needs cash, rare ores (ids from ORES) and its prerequisites.
 * effect: {stat, add?, mul?} changes a derived stat (see systems/Tech.js); {unlock} is a flag checked by feature code.
 */
export const TECH = Object.freeze([
  { id: 'battery_1', branch: 'suit', name: 'Battery Cell I', requires: [], cost: { cash: 600, ores: { 7: 3 } }, effect: { stat: 'maxEnergy', add: 50 } },
  { id: 'battery_2', branch: 'suit', name: 'Battery Cell II', requires: ['battery_1'], cost: { cash: 6000, ores: { 9: 5 } }, effect: { stat: 'maxEnergy', add: 200 } },
  { id: 'battery_3', branch: 'suit', name: 'Battery Cell III', requires: ['battery_2'], cost: { cash: 60000, ores: { 15: 5 } }, effect: { stat: 'maxEnergy', add: 800 } },
  { id: 'padded_suit_1', branch: 'suit', name: 'Padded Suit I', requires: [], cost: { cash: 400, ores: { 5: 4 } }, effect: { stat: 'fallDamage', mul: 0.75 } },
  { id: 'padded_suit_2', branch: 'suit', name: 'Padded Suit II', requires: ['padded_suit_1'], cost: { cash: 5000, ores: { 13: 3 } }, effect: { stat: 'fallDamage', mul: 0.6 } },
  { id: 'heat_suit', branch: 'suit', name: 'Heat Suit', requires: ['padded_suit_2'], cost: { cash: 40000, ores: { 11: 4 } }, effect: { unlock: 'heat_suit' } },
  { id: 'magma_boots', branch: 'suit', name: 'Magma Boots', requires: ['heat_suit'], cost: { cash: 90000, ores: { 21: 4 } }, effect: { unlock: 'magma_boots' } },
  { id: 'gas_mask', branch: 'suit', name: 'Gas Mask', requires: [], cost: { cash: 3000, ores: { 12: 3 } }, effect: { unlock: 'gas_mask' } },
  { id: 'jet_tank_1', branch: 'jet', name: 'Jet Tank I', requires: [], cost: { cash: 1000, ores: { 5: 4 } }, effect: { stat: 'jetDrain', mul: 0.8 } },
  { id: 'jet_tank_2', branch: 'jet', name: 'Jet Tank II', requires: ['jet_tank_1'], cost: { cash: 11000, ores: { 14: 2 } }, effect: { stat: 'jetDrain', mul: 0.75 } },
  { id: 'jet_thrust_1', branch: 'jet', name: 'Jet Thrusters', requires: ['jet_tank_1'], cost: { cash: 7000, ores: { 9: 4 } }, effect: { stat: 'jetThrust', mul: 1.2 } },
  { id: 'stash_2', branch: 'camp', name: 'Bigger Stash', requires: [], cost: { cash: 2000, ores: { 2: 20 } }, effect: { stat: 'stashCap', add: 300 } },
  { id: 'pack_1', branch: 'tools', name: 'Bigger Pack I', requires: [], cost: { cash: 800, ores: { 6: 4 } }, effect: { stat: 'capacity', add: 25 } },
  { id: 'pack_2', branch: 'tools', name: 'Bigger Pack II', requires: ['pack_1'], cost: { cash: 9000, ores: { 16: 3 } }, effect: { stat: 'capacity', add: 75 } },
  { id: 'charge_station', branch: 'camp', name: 'Field Charging Station', requires: ['battery_1'], cost: { cash: 8000, ores: { 8: 6 } }, effect: { unlock: 'charge_station' } },
  { id: 'ladder_kit', branch: 'tools', name: 'Ladder Kit', requires: [], cost: { cash: 1200, ores: { 3: 4 } }, effect: { unlock: 'ladder_kit' } },
  { id: 'big_bomb', branch: 'tools', name: 'Big Bomb Recipe', requires: [], cost: { cash: 6000, ores: { 11: 3 } }, effect: { unlock: 'big_bomb' } },
  { id: 'deep_scanner', branch: 'tools', name: 'Deep Scanner', requires: [], cost: { cash: 7000, ores: { 13: 3 } }, effect: { stat: 'radarRange', mul: 1.5 } },
  { id: 'contracts_terminal', branch: 'camp', name: 'Contracts Terminal', requires: [], cost: { cash: 2500, ores: { 4: 6 } }, effect: { unlock: 'contracts_terminal' } },
]);

export const CONSUMABLES = Object.freeze({
  dynamite: { name: 'Dynamite', short: 'Dynamite', price: 15, slot: 1, start: 2 },
  teleporter: { name: 'Portable Teleporter', short: 'Warp', price: 40, slot: 2, start: 0 },
  cell: { name: 'Reserve Energy Cell', short: 'Cell', price: 10, slot: 3, start: 1, frac: 0.4 },
  ladder: { name: 'Ladder', short: 'Ladder', price: 6, slot: 4, start: 0, tech: 'ladder_kit' },
  bigBomb: { name: 'Big Bomb', short: 'Big Bomb', price: 60, slot: 5, start: 0, tech: 'big_bomb' },
});

export const ECONOMY = Object.freeze({
  START_CREDITS: 0,
  /** Units per ore the home stash holds (TECH stash_2 raises it). */
  STASH_CAP: 200,
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

/** Protective gear (unlocked via TECH). */
export const GEAR = Object.freeze({ HEAT_SUIT_RESIST: 0.8, AMBIENT_T0: 15, AMBIENT_T1: 350 });

export const PHYSICS = Object.freeze({
  GRAVITY: 650,
  WALK_SPEED: 105,
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
  /** Contact heat (°C): magma channels run MAGMA_T0 at the top of the mantle up to MAGMA_T1 at the bottom; core rock is CORE_T. */
  MAGMA_T0: 700, MAGMA_T1: 1300, CORE_T: 1700,
  /** Suit HP lost per second per °C above SAFE_T. */
  HEAT_SAFE_T: 60, HEAT_DPS_PER_C: 0.01, // damage grows linearly from 60 °C: 0.4 HP/s at 100 °C, ~2.9 at the bottom; magma/core contact ~13-20
  HARD_LANDING_DMG_PER_TILE: 18,
  LADDER_SPEED: 90,
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
  BIG_RADIUS: 3,
  MAX_ACTIVE: 8,
  FLASH_RATE_START: 3,
  FLASH_RATE_END: 14,
  SHOCKWAVE_TIME: 0.5,
  SHOCKWAVE_RADIUS: 96,
});

export const MINING = Object.freeze({
  REACH: 44,
  /** Multiplies every block's HP: topsoil with the starting pickaxe takes ~3 s (5 hits x 0.6 s). */
  HP_MULT: 5,
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
  /** Toast warnings fire when the battery drops through these fractions (descending). */
  WARN_AT: [0.3, 0.15, 0.05],
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
  CONE_WALL_BLEED: 34, // px past the wall face: the beam lights one full tile into rock
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
    // One theme per layer, keyed by band material id (0 = surface). root = key MIDI note, scale = semitones,
    // melody = 16 steps of scale degrees ('0'-'9', wrapping into higher octaves) or '.' for rest,
    // lead = root + oct + degree. wave 'piano' = soft piano-like tone; gain scales the lead.
    THEMES: Object.freeze({
      0: { name: 'Base Camp', root: 48, scale: [0, 2, 4, 7, 9], beat: 0.6, wave: 'piano', oct: 12, decay: 2.6, gain: 0.7,
        melody: '0.2...4.3...2...' },
      1: { name: 'Topsoil', root: 43, scale: [0, 2, 4, 7, 9], beat: 0.4, wave: 'triangle', oct: 24, decay: 1.8,
        melody: '0.4.3.2.1.2.3...' },
      2: { name: 'Sedimentary', root: 50, scale: [0, 2, 4, 6, 7, 9, 11], beat: 0.3, wave: 'sine', oct: 12, decay: 1.6,
        melody: '0246420135753102' },
      3: { name: 'Crust', root: 45, scale: [0, 3, 5, 7, 10], beat: 0.48, wave: 'triangle', oct: 24, decay: 2.4,
        melody: '0..2.3..4.3.2.1.' },
      4: { name: 'Deep Crust', root: 40, scale: [0, 2, 3, 5, 7, 8, 10], beat: 0.6, wave: 'triangle', oct: 24, decay: 3,
        melody: '4..3.2..0...1.2.' },
      5: { name: 'Mantle', root: 40, scale: [0, 1, 3, 5, 7, 8, 10], beat: 0.7, wave: 'sine', oct: 12, decay: 3.5, dissonant: true,
        melody: '0.1...0...3.1...' },
      9: { name: 'Molten Core', root: 37, scale: [0, 1, 4, 5, 7, 8, 10], beat: 0.85, wave: 'sine', oct: 12, decay: 4, dissonant: true,
        melody: '0..1..4...1..0..' },
    }),
    SWITCH_HOLD: 1.5, // seconds a new layer must persist before the theme changes (band edges are noisy)
    VARY: 0.12, // chance per note to skip or step to a neighbour degree
    DISSONANT: [1, 6],
    LOOKAHEAD: 0.25,
    TICK_MS: 25,
    LEAD_GAIN: 0.07,
    DELAY_TIME: 0.43,
    DELAY_FB: 0.42,
  }),
});

export const SAVE = Object.freeze({
  KEY: 'jttdote.save',
  SLOTS: 3,
  /** localStorage key holding the active slot number. */
  SLOT_KEY: 'jttdote.slot',
  SETTINGS_KEY: 'jttdote.settings',
  VERSION: 4,
  AUTOSAVE_SEC: 15,
  EXPLOSION_BLOCK_SEC: 1.5,
});

export const SETTINGS_DEFAULT = Object.freeze({
  musicOn: true,
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
  slot4: ['Digit4'],
  slot5: ['Digit5'],
  down: ['KeyS', 'ArrowDown'],
  station: ['KeyG'],
  interact: ['KeyE'],
  pause: ['Escape'],
  debug: ['F3'],
  dev: ['F4'],
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
