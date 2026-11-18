/**
 * @module config
 * Single source of truth for every tunable number in the game.
 * Nothing outside this file should contain gameplay/balance/audio/render constants.
 */

/** Tile type ids (stored in World.tileType). */
export const TILE = Object.freeze({
  AIR: 0, SOIL: 1, LIMESTONE: 2, GRANITE: 3, BASALT: 4, MANTLE: 5, BEDROCK: 6, WATER: 7, MAGMA: 8, CORE: 9, SAND: 10, LADDER: 11, ALIEN_HULL: 12, RELIC: 13,
  // Off-world rock (appended so saved tile ids stay valid)
  REGOLITH: 14, BRECCIA: 15, MARE_BASALT: 16, ANORTHOSITE: 17, LUNAR_MANTLE: 18,
  RUST_REGOLITH: 19, ICE_GROUND: 20, MARS_BASALT: 21, SULFATE: 22, MARS_CRUST: 23,
  ASH: 24, HULL_PLATE: 25, LATTICE: 26, HEAT_SINK: 27, MIND: 28,
});

/** Ore ids (stored in World.oreType), in the design-table rank order. */
export const ORE = Object.freeze({
  NONE: 0, COAL: 1, IRON: 2, LEAD: 3, ZINC: 4, COPPER: 5, NICKEL: 6, LITHIUM: 7, TIN: 8, COBALT: 9, FOSSIL: 10,
  URANIUM: 11, LAPIS: 12, SILVER: 13, BLACK_OPAL: 14, PLATINUM: 15, GOLD: 16, METEORITE: 17, RHODIUM: 18, RUBY: 19, DIAMOND: 20,
  TUNGSTEN: 21, // appended last so saved oreType ids stay valid
  BAUXITE: 22, ILMENITE: 23, OIL_SHALE: 24,
  HELIUM3: 43, RARE_EARTHS: 44, WATER_ICE: 45, PERCHLORATE: 46, // off-world ores; ids 25-42 belong to ITEM
});

/** Processed material ids: share the ORES id space (cargo/stash/pay work unchanged) but are never generated. */
export const ITEM = Object.freeze({
  SOLDER: 25, BRONZE: 26, COPPER_WIRE: 27, WROUGHT_IRON: 28, STEEL: 29, STAINLESS: 30, ALUMINIUM: 31, TITANIUM: 32,
  TUNGSTEN_CARBIDE: 33, FUEL: 34, PLASTIC: 35, CARBON_FIBER: 36, CIRCUIT: 37, LI_ION_CELL: 38, INDUSTRIAL_DIAMOND: 39,
  ENRICHED_URANIUM: 40, EXOTIC_ALLOY: 41, WARP_CHARGE: 42,
  PROPELLANT: 47, FUSION_FUEL: 48, SUPERCONDUCTOR: 49,
});

/** Recipe inputs per material (one output each). Material kg/price are derived from these. */
export const MATERIAL_INPUTS = Object.freeze({
  [ITEM.SOLDER]: { [ORE.TIN]: 2, [ORE.LEAD]: 1 },
  [ITEM.BRONZE]: { [ORE.COPPER]: 3, [ORE.TIN]: 1 },
  [ITEM.COPPER_WIRE]: { [ORE.COPPER]: 2 },
  [ITEM.WROUGHT_IRON]: { [ORE.IRON]: 2, [ORE.COAL]: 1 },
  [ITEM.STEEL]: { [ORE.IRON]: 2, [ORE.COAL]: 2 },
  [ITEM.STAINLESS]: { [ITEM.STEEL]: 2, [ORE.NICKEL]: 1 },
  [ITEM.ALUMINIUM]: { [ORE.BAUXITE]: 4 },
  [ITEM.TITANIUM]: { [ORE.ILMENITE]: 3, [ORE.COAL]: 1 },
  [ITEM.TUNGSTEN_CARBIDE]: { [ORE.TUNGSTEN]: 2, [ORE.COAL]: 1 },
  [ITEM.FUEL]: { [ORE.OIL_SHALE]: 2 },
  [ITEM.PLASTIC]: { [ORE.OIL_SHALE]: 2 },
  [ITEM.CARBON_FIBER]: { [ITEM.PLASTIC]: 3 },
  [ITEM.CIRCUIT]: { [ITEM.COPPER_WIRE]: 2, [ORE.GOLD]: 1, [ITEM.PLASTIC]: 1 },
  [ITEM.LI_ION_CELL]: { [ORE.LITHIUM]: 2, [ORE.COBALT]: 1, [ORE.NICKEL]: 1 },
  [ITEM.INDUSTRIAL_DIAMOND]: { [ORE.DIAMOND]: 1 },
  [ITEM.ENRICHED_URANIUM]: { [ORE.URANIUM]: 5 },
  [ITEM.EXOTIC_ALLOY]: { [ORE.METEORITE]: 2, [ORE.RHODIUM]: 1, [ORE.PLATINUM]: 1 },
  [ITEM.WARP_CHARGE]: { [ITEM.EXOTIC_ALLOY]: 1, [ITEM.ENRICHED_URANIUM]: 1 },
  [ITEM.PROPELLANT]: { [ORE.WATER_ICE]: 2, [ORE.PERCHLORATE]: 1 },
  [ITEM.FUSION_FUEL]: { [ORE.HELIUM3]: 2, [ORE.WATER_ICE]: 1 },
  [ITEM.SUPERCONDUCTOR]: { [ORE.RARE_EARTHS]: 2, [ITEM.COPPER_WIRE]: 1 },
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
  /** Electromagnetic storm: WARN_S notice, then an unsheltered player loses DRAIN_FRAC of max energy and has gear offline for STUN_S (both scaled by pulseResist). */
  PULSE: Object.freeze({ SAFE_DEPTH_M: 150, WARN_S: 5, MIN_GAP_S: 150, MAX_GAP_S: 360, DRAIN_FRAC: 0.25, STUN_S: 6 }),
});

/** Toxic/explosive gas: per-tile concentration 0..MAX in open air; sealed pockets until a wall breaks. */
export const GAS = Object.freeze({ MAX: 8, STEP_S: 0.25, DPS: 6, EXPLODE_R: 2, MAX_CHAIN_PER_TICK: 40, MAX_PER_TICK: 400 });

/**
 * Set pieces: size [w, h] incl. the wall, strata = stratum indices that may host it, landmarkOf = the stratum whose guaranteed landmark it is,
 * hazard/reward/sign describe the piece for the player (sign = a hint tile just outside the wall).
 */
export const SET_PIECES = Object.freeze({
  sand_pocket: { size: [6, 5], strata: [0, 1], hazard: 'collapse', reward: 'none', landmarkOf: 0, sign: 'none' },
  fossil_chamber: { size: [7, 5], strata: [1], hazard: 'none', reward: 'fossil', landmarkOf: 1, sign: 'none' },
  aquifer: { size: [8, 5], strata: [1, 2], hazard: 'flood', reward: 'none', sign: 'moss' },
  vault: { size: [8, 6], strata: [1, 2, 3], hazard: 'none', reward: 'ore', landmarkOf: 3, sign: 'glint' },
  gas_cavern: { size: [9, 6], strata: [2, 3], hazard: 'gas', reward: 'none', landmarkOf: 2, sign: 'moss' },
  crystal_geode: { size: [7, 6], strata: [2, 3, 4], hazard: 'none', reward: 'ore', sign: 'glint' },
  lava_lake: { size: [10, 6], strata: [4], hazard: 'magma', reward: 'none', landmarkOf: 4, sign: 'glow' },
  karst_shaft: { size: [5, 16], strata: [1], hazard: 'fall', reward: 'ore', sign: 'moss' },
  lava_tube: { size: [26, 5], strata: [3], hazard: 'rockfall', reward: 'travel', sign: 'glint' },
  magma_chamber: { size: [9, 7], strata: [4], hazard: 'magma', reward: 'ore', sign: 'glow' },
  // Off-world pieces: `planet` names the world (default earth); strata are that planet's stratum indices. hostsRuin = the planet's ruin sits in this piece; crossShaft = may span the shaft column.
  cold_trap: { planet: 'moon', size: [9, 6], strata: [3], hazard: 'drain', reward: 'water ice', landmarkOf: 3, sign: 'glint' },
  tube_cathedral: { planet: 'moon', size: [30, 9], strata: [2], hazard: 'none', reward: 'relic', landmarkOf: 2, sign: 'glint', hostsRuin: true, crossShaft: true }, // 30 wide cannot fit beside the shaft column in a 64-wide map
  regolith_slide: { planet: 'moon', size: [8, 6], strata: [0, 1], hazard: 'collapse', reward: 'none', landmarkOf: 0, sign: 'none' },
  ice_lens: { planet: 'mars', size: [14, 4], strata: [1], hazard: 'none', reward: 'water ice', landmarkOf: 1, sign: 'glint' },
  brine_pocket: { planet: 'mars', size: [8, 5], strata: [1, 3], hazard: 'flood', reward: 'none', landmarkOf: 3, sign: 'moss' },
  methane_vent: { planet: 'mars', size: [7, 6], strata: [2, 3, 4], hazard: 'gas', reward: 'none', landmarkOf: 2, sign: 'moss' },
  dust_sink: { planet: 'mars', size: [6, 5], strata: [0, 1], hazard: 'collapse', reward: 'none', landmarkOf: 0, sign: 'none' },
  fabricator_hall: { planet: 'tessera', size: [12, 6], strata: [1, 2, 3], hazard: 'pulse', reward: 'meteorite', landmarkOf: 1, sign: 'glint' },
  coolant_channel: { planet: 'tessera', size: [14, 4], strata: [2, 3], hazard: 'flood', reward: 'none', landmarkOf: 2, sign: 'moss' },
  data_vault: { planet: 'tessera', size: [9, 6], strata: [3], hazard: 'none', reward: 'relic', landmarkOf: 3, sign: 'none', hostsRuin: true },
});

/** Gap (rows) a deep map may go without a set piece and a flat 4x4 floor (spec 8.2). */
export const PACING = Object.freeze({ WINDOW: 120 });

export const ZONES = Object.freeze({
  PER_LAYER: 3,
  SPACING: 3,
  LAYERS: [[0, 0.15], [0.15, 0.35], [0.35, 0.55], [0.55, 0.78], [0.78, 0.92]],
  CORE_CHAMBER: { W: 9, H: 5 },
  MIND_CHAMBER: { W: 15, H: 9 },
  /** One alien ruin per LAYERS entry (world/Ruins.js); SIZE is [w, h] incl. the hull ring. */
  RUIN: { SIZE: [9, 6] },
});

export const CORE_GOAL = Object.freeze({ HOLD_S: 20, REWARD_CASH: 100000, QUAKE_EVERY_S: 4 });

export const CAMP = Object.freeze({ STATION_MIN_GAP: 12, MAX_STATIONS: 4, STATION_RANGE: 1.6, STATION_COST: { ores: { 29: 4, 27: 2 } }, // 4 steel + 2 copper wire (ITEM ids)
  /** Placed field camp: W x H open tiles with (x, y) the bottom-left; RANGE tiles from its centre to rest. */
  FIELD_CAMP: Object.freeze({ W: 4, H: 4, MAX: 3, RANGE: 2 }) });

/**
 * Upgradeable camp buildings: level i+1 needs level i. levels[i] is level i+1: cost, tech (required tech id),
 * needs (another building's minimum level). Processing buildings pay in materials; the Trading Post in cash.
 */
export const CAMP_BUILDINGS = Object.freeze({
  shop: { name: 'Trading Post', levels: [{ cost: { cash: 2000 }, effect: { sellMul: 1.1 } }, { cost: { cash: 15000 }, effect: { sellMul: 1.2 } }, { cost: { cash: 90000 }, effect: { sellMul: 1.3 } }] },
  generator: { name: 'Generator', levels: [
    { name: 'Coal Generator', cost: {} },
    { name: 'Diesel Generator', cost: { ores: { [ITEM.STEEL]: 20, [ITEM.COPPER_WIRE]: 10 } }, tech: 'diesel_power' },
    { name: 'Fission Reactor', cost: { ores: { [ITEM.STAINLESS]: 30, [ORE.LEAD]: 40, [ITEM.CIRCUIT]: 10 } }, tech: 'fission' },
    { name: 'Fusion Reactor', cost: { ores: { [ITEM.SUPERCONDUCTOR]: 30, [ITEM.STAINLESS]: 20, [ITEM.CIRCUIT]: 20 } }, tech: 'fusion_power' },
  ] },
  furnace: { name: 'Furnace', levels: [
    { name: 'Clay Kiln', cost: {} },
    { name: 'Bloomery', cost: { ores: { [ORE.IRON]: 15, [ORE.COAL]: 10 } }, tech: 'bloomery' },
    { name: 'Blast Furnace', cost: { ores: { [ITEM.WROUGHT_IRON]: 20, [ITEM.BRONZE]: 10 } }, tech: 'blast_furnace' },
    { name: 'Arc Furnace', cost: { ores: { [ITEM.STEEL]: 30, [ITEM.COPPER_WIRE]: 20 } }, tech: 'arc_furnace', needs: { building: 'generator', level: 2 } },
  ] },
  refinery: { name: 'Refinery', levels: [
    { name: 'Distillery', cost: { ores: { [ITEM.STEEL]: 20, [ITEM.SOLDER]: 10 } }, tech: 'oil_refining' },
    { name: 'Carbonizer', cost: { ores: { [ITEM.STAINLESS]: 20, [ITEM.ALUMINIUM]: 10 } }, tech: 'carbon_fiber' },
  ] },
  lab: { name: 'Lab', levels: [
    { name: 'Electronics Lab', cost: { ores: { [ITEM.ALUMINIUM]: 20, [ITEM.COPPER_WIRE]: 10 } }, tech: 'electronics' },
    { name: 'Isotope Lab', cost: { ores: { [ITEM.STAINLESS]: 20, [ORE.LEAD]: 30, [ITEM.CIRCUIT]: 10 } }, tech: 'fission' },
  ] },
  workshop: { name: 'Workshop', levels: [
    { name: 'Forge Bench', cost: {} },
    { name: 'Machine Shop', cost: { ores: { [ITEM.STEEL]: 20, [ITEM.BRONZE]: 10 } }, tech: 'machining' },
    { name: 'Precision Shop', cost: { ores: { [ITEM.TITANIUM]: 20, [ITEM.CIRCUIT]: 10 } }, tech: 'precision' },
  ] },
});

/** Camp power pool: capacity per Generator level, fuels (power per unit, min Generator level), 1 power per 10 battery energy. */
export const POWER = Object.freeze({
  CAP: [200, 1000, 10000, 100000],
  FUELS: [{ id: ORE.COAL, power: 10, gen: 1 }, { id: ITEM.FUEL, power: 40, gen: 2 }, { id: ITEM.ENRICHED_URANIUM, power: 500, gen: 3 }, { id: ITEM.FUSION_FUEL, power: 5000, gen: 4 }],
  PER_ENERGY: 0.1,
  START: 100,
  START_COAL: 20,
});

/** Building levels owned on a fresh game. */
export const START_BUILDINGS = Object.freeze({ generator: 1, furnace: 1, workshop: 1 });

/** Where each material is made, and the tech that unlocks it. `in` is MATERIAL_INPUTS; power per craft. */
const RECIPE_DEFS = [
  ['SOLDER', 'furnace', 1, 'solder'], ['BRONZE', 'furnace', 2, 'bloomery'], ['COPPER_WIRE', 'furnace', 2, 'bloomery'],
  ['WROUGHT_IRON', 'furnace', 2, 'bloomery'], ['STEEL', 'furnace', 3, 'blast_furnace', 5], ['STAINLESS', 'furnace', 3, 'blast_furnace'],
  ['ALUMINIUM', 'furnace', 4, 'arc_furnace', 30], ['TITANIUM', 'furnace', 4, 'arc_furnace'], ['TUNGSTEN_CARBIDE', 'furnace', 4, 'arc_furnace'],
  ['FUEL', 'refinery', 1, 'oil_refining'], ['PLASTIC', 'refinery', 1, 'oil_refining'], ['CARBON_FIBER', 'refinery', 2, 'carbon_fiber'],
  ['CIRCUIT', 'lab', 1, 'electronics'], ['LI_ION_CELL', 'lab', 1, 'electronics'], ['INDUSTRIAL_DIAMOND', 'lab', 1, 'diamond_tooling'],
  ['ENRICHED_URANIUM', 'lab', 2, 'fission'], ['EXOTIC_ALLOY', 'furnace', 4, 'exotic_materials'], ['WARP_CHARGE', 'lab', 2, 'warp_drive'],
  ['PROPELLANT', 'refinery', 2, 'lunar_landing'], ['FUSION_FUEL', 'lab', 2, 'lunar_landing'], ['SUPERCONDUCTOR', 'lab', 2, 'lunar_landing'],
  // The Moon can refuel before Mars: ice + ordinary fuel instead of perchlorate.
  ['PROPELLANT', 'refinery', 2, 'lunar_landing', undefined, { [ORE.WATER_ICE]: 2, [ITEM.FUEL]: 2 }, 'propellant_lunar'],
];

/** @type {readonly {id:string, building:string, level:number, in:Record<number,number>, out:Record<number,number>, power:number, tech?:string}[]} */
export const RECIPES = Object.freeze(RECIPE_DEFS.map(([key, building, level, tech, power, inOverride, id]) => {
  const out = /** @type {any} */ (ITEM)[key]; const inp = inOverride ?? /** @type {any} */ (MATERIAL_INPUTS)[out];
  // Default power: 1 per input unit.
  return { id: id ?? String(key).toLowerCase(), building, level, in: inp, out: { [out]: 1 }, power: power ?? Object.values(inp).reduce((a, n) => a + n, 0), tech };
}));

export const CONTRACTS = Object.freeze({ MAX_ACTIVE: 3, OFFERS: 4, PREMIUM: 0.25 });

/** Cash paid for completing a mission, by chapter (index = chapter - 1). */
export const STORY = Object.freeze({ REWARD_BY_CHAPTER: Object.freeze([10, 30, 250, 3000, 80000, 0]) });

/** test: {event:'ore', ore, count} | {depth, depthM} | {completed} | {relic, count | id[, unlessFlag | dry]} | {pulse, count} | {tech, stat, min} */
export const ACHIEVEMENTS = Object.freeze([
  { id: 'first_fossil', name: 'Bone Collector', desc: 'Find a fossil.', test: { event: 'ore', ore: 10, count: 1 } },
  { id: 'fossils_5', name: 'Paleontologist', desc: 'Find 5 fossils.', test: { event: 'ore', ore: 10, count: 5 } },
  { id: 'fossils_15', name: 'Museum Curator', desc: 'Find 15 fossils.', test: { event: 'ore', ore: 10, count: 15 } },
  { id: 'first_gold', name: 'Gold Fever', desc: 'Mine gold.', test: { event: 'ore', ore: 16, count: 1 } },
  { id: 'first_diamond', name: 'Diamonds!', desc: 'Mine a diamond.', test: { event: 'ore', ore: 20, count: 1 } },
  { id: 'depth_100', name: 'Going Down', desc: 'Reach 100 m.', test: { event: 'depth', depthM: 100 } },
  { id: 'depth_500', name: 'Deep Diver', desc: 'Reach 500 m.', test: { event: 'depth', depthM: 500 } },
  { id: 'depth_1000', name: 'Into the Mantle', desc: 'Reach 1,000 m.', test: { event: 'depth', depthM: 1000 } },
  { id: 'core', name: 'The Seed Is Silent', desc: 'Shut down the Seed.', test: { event: 'completed' } },
  { id: 'relic_first', name: 'First Contact', desc: 'Recover an alien relic.', test: { event: 'relic', count: 1 } },
  { id: 'relic_all', name: 'Relic Hunter', desc: 'Recover all 5 alien relics.', test: { event: 'relic', count: 5 } },
  { id: 'clean_air', name: 'Clean Air', desc: 'Recover the Thermal Siphon without blowing up its hall.', test: { event: 'relic', id: 'thermal_siphon', unlessFlag: 'hall_exploded' } },
  { id: 'dry_feet', name: 'Dry Feet', desc: 'Recover the Shielding Lattice with its ruin drained.', test: { event: 'relic', id: 'shield_lattice', dry: true } },
  { id: 'pulse_10', name: 'Storm Chaser', desc: 'Weather 10 unsheltered pulses.', test: { event: 'pulse', count: 10 } },
  { id: 'immune', name: 'Immune', desc: 'Become immune to the pulse.', test: { event: 'tech', stat: 'pulseResist', min: 1 } },
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
  CAVE_MIN_DEPTH: 5,
  WATER_FREQ: 0.11,
  WATER_THRESHOLD: 0.12,
  MAGMA_FREQ_X: 0.06,
  MAGMA_FREQ_Y: 0.045,
  MAGMA_WIDTH: 0.035,
  FUNGI_CHANCE: 0.22,
  MOSS_CHANCE: 0.2,
  /** Fraction of host-rock tiles that become ore, per host band material id. */
  BAND_ORE_FRACTION: Object.freeze({ 1: 0.06, 2: 0.07, 3: 0.07, 4: 0.08, 5: 0.09, 14: 0.05, 15: 0.07, 16: 0.08, 17: 0.08, 18: 0.09, 19: 0.06, 20: 0.07, 21: 0.08, 22: 0.08, 23: 0.09, 24: 0.05, 25: 0.07, 26: 0.08, 27: 0.09 }),
  ORE_DEPTH_BIAS: 0.35,
  ORE_ATTEMPT_MULT: 20,
  BASE_CAMP: Object.freeze({ SPAWN_X: 29, SHOP_X: 24, STATION_X: 36, SHAFT_X: 31, INTERACT_RANGE: 2.2,
    /** Centre tile of each processing building (2 tiles wide), clear of the shop, shaft and station. */
    BUILDING_SLOTS: Object.freeze({ generator: 13, furnace: 16, refinery: 19, lab: 41, workshop: 44, launch_pad: 8 }),
    /** Unbreakable foundation under the camp buildings: columns PAD_X0..PAD_X1, PAD_DEPTH rows deep. */
    PAD_X0: 11, PAD_X1: 46, PAD_DEPTH: 3 }),
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
  { id: 10, key: 'SAND', name: 'Loose Sand', layer: 'Sand', hp: 1, tier: 1, hard: 0.4, solid: true, loose: true, sfx: 'soil',
    colors: { base: '#d6b66a', dark: '#a8863e', light: '#ecd596', accent: '#c19d52', extra: '#8a6a30' } },
  // Placed by the player (systems/Items.js); walkable, climbable.
  { id: 11, key: 'LADDER', name: 'Ladder', hp: 0, tier: 0, solid: false, sfx: 'none',
    colors: { base: '#8a5a2b', dark: '#4f3220', light: '#b98046', accent: '#6b4423', extra: '#3b2a1a' } },
  // Alien ruins (world/Ruins.js): the hull only yields to a Big Bomb; the relic is mined by hand, hard 9 keeps both out of quake rockfall.
  { id: 12, key: 'ALIEN_HULL', name: 'Alien Hull', hp: 65535, tier: 99, hard: 9, solid: true, sfx: 'clink',
    colors: { base: '#3a2a5c', dark: '#1e1433', light: '#6a4ea8', accent: '#b08cff', extra: '#120b20' } },
  { id: 13, key: 'RELIC', name: 'Alien Relic', hp: 12, tier: 1, hard: 9, solid: true, sfx: 'clink',
    colors: { base: '#2ac0d0', dark: '#156068', light: '#a0f8ff', accent: '#ffffff', extra: '#0b3034' } },
  // Off-world rock: procedural colours. loose = falls like sand (systems/Hazards/Collapse.js). hp is tuned so a pick of the tier that reaches it needs ~10-30 hits.
  { id: 14, key: 'REGOLITH', name: 'Lunar Regolith', layer: 'Regolith', hp: 20, tier: 5, hard: 1.8, solid: true, loose: true, sfx: 'soil',
    colors: { base: '#9a9a9c', dark: '#6a6a6e', light: '#c4c4c6', accent: '#84848a', extra: '#4e4e54' } },
  { id: 15, key: 'BRECCIA', name: 'Impact Breccia', layer: 'Megaregolith', hp: 50, tier: 6, hard: 2.4, solid: true, sfx: 'granite',
    colors: { base: '#7c7a78', dark: '#52504e', light: '#a8a5a2', accent: '#64605c', extra: '#c8b8a0' } },
  { id: 16, key: 'MARE_BASALT', name: 'Mare Basalt', layer: 'Mare Basalt', hp: 60, tier: 6, hard: 2.6, solid: true, sfx: 'basalt',
    colors: { base: '#3c3e4a', dark: '#22242c', light: '#585b6a', accent: '#2c2e38', extra: '#6a6e80' } },
  { id: 17, key: 'ANORTHOSITE', name: 'Anorthosite', layer: 'Anorthosite Crust', hp: 80, tier: 7, hard: 3.0, solid: true, sfx: 'granite',
    colors: { base: '#c8ccd4', dark: '#8e929c', light: '#eef0f4', accent: '#a4a8b2', extra: '#7a7e88' } },
  { id: 18, key: 'LUNAR_MANTLE', name: 'Lunar Mantle', layer: 'Lunar Mantle', hp: 100, tier: 7, hard: 3.4, solid: true, sfx: 'mantle',
    colors: { base: '#2c3a34', dark: '#16201c', light: '#4a6056', accent: '#6a8a70', extra: '#8aa890' } },
  { id: 19, key: 'RUST_REGOLITH', name: 'Rusty Regolith', layer: 'Rusty Regolith', hp: 30, tier: 6, hard: 2.0, solid: true, loose: true, sfx: 'soil',
    colors: { base: '#a8553a', dark: '#74351f', light: '#d07e5a', accent: '#8c4128', extra: '#e8a078' } },
  { id: 20, key: 'ICE_GROUND', name: 'Ice-Cemented Ground', layer: 'Ice Ground', hp: 70, tier: 7, hard: 2.6, solid: true, sfx: 'limestone',
    colors: { base: '#8a6e66', dark: '#5a443e', light: '#c8d8e4', accent: '#a8c4d8', extra: '#e8f4fc' } },
  { id: 21, key: 'MARS_BASALT', name: 'Martian Basalt', layer: 'Martian Basalt', hp: 80, tier: 7, hard: 3.0, solid: true, sfx: 'basalt',
    colors: { base: '#4a3030', dark: '#2a1a1a', light: '#6e4a46', accent: '#382222', extra: '#8a6058' } },
  { id: 22, key: 'SULFATE', name: 'Sulfate & Clay', layer: 'Sulfate Beds', hp: 90, tier: 8, hard: 3.2, solid: true, sfx: 'limestone',
    colors: { base: '#c8a458', dark: '#8c6e30', light: '#ecd08c', accent: '#a8863e', extra: '#f4ecc8' } },
  { id: 23, key: 'MARS_CRUST', name: 'Deep Martian Crust', layer: 'Deep Crust', hp: 110, tier: 8, hard: 3.6, solid: true, sfx: 'mantle',
    colors: { base: '#3a2024', dark: '#1c0e10', light: '#5e3a3a', accent: '#c8542a', extra: '#ff8a4a' } },
  { id: 24, key: 'ASH', name: 'Ash Crust', layer: 'Ash Crust', hp: 50, tier: 7, hard: 2.4, solid: true, sfx: 'soil',
    colors: { base: '#5a5a5e', dark: '#38383c', light: '#84848a', accent: '#46464a', extra: '#a0a0a6' } },
  { id: 25, key: 'HULL_PLATE', name: 'Hull Plating', layer: 'Hull Plating', hp: 70, tier: 8, hard: 3.4, solid: true, sfx: 'clink',
    colors: { base: '#4a5666', dark: '#2a323e', light: '#7e8ea4', accent: '#36d0e0', extra: '#1c222c' } },
  { id: 26, key: 'LATTICE', name: 'Lattice', layer: 'Lattice', hp: 70, tier: 8, hard: 3.4, solid: true, sfx: 'clink',
    colors: { base: '#3a4a60', dark: '#1e2836', light: '#6a86aa', accent: '#46e0ff', extra: '#10161e' } },
  { id: 27, key: 'HEAT_SINK', name: 'Heat Sink', layer: 'Heat Sink', hp: 70, tier: 8, hard: 3.4, solid: true, sfx: 'clink',
    colors: { base: '#5a3a38', dark: '#301c1c', light: '#9a5e52', accent: '#ff7a2a', extra: '#1c0e0e' } },
  { id: 28, key: 'MIND', name: 'The Mind', layer: 'The Mind', hp: 70, tier: 8, hard: 3.4, solid: true, sfx: 'clink',
    colors: { base: '#2a2038', dark: '#140e1c', light: '#5a4a7c', accent: '#b08cff', extra: '#08040c' } },
]);

/**
 * Ores indexed by ORE id. kg = cargo weight per block (ore + protective matrix), hard = H_mat,
 * perKg = value per kg of cargo, price = perKg * kg per block. weight = relative abundance within a host band.
 */
const ORE_LIST = [
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
  { id: 17, key: 'METEORITE', name: 'Meteorite', kg: 7.0, hard: 7.5, perKg: 125.0, price: 875.0, tier: 5, hosts: [4, 5], weight: 1.4, vein: [1, 3], glint: 0.3, pitch: 420,
    colors: { base: '#c0d8f0', light: '#ffffff', spec: '#ffffff', dark: '#606c78' }, glow: '#a0d0ff', tile: 'meteorit-rhodium-ruby-diamond_0' },
  { id: 18, key: 'RHODIUM', name: 'Rhodium', kg: 1.8, hard: 6.5, perKg: 593.06, price: 1067.51, tier: 5, hosts: [5], weight: 1.4, vein: [1, 3], glint: 0.7, pitch: 1250,
    colors: { base: '#3a2a2a', light: '#ff7a2a', spec: '#ffffff', dark: '#1d1515' }, glow: '#ff6a1a', tile: 'meteorit-rhodium-ruby-diamond_1' },
  { id: 19, key: 'RUBY', name: 'Ruby & Emerald', kg: 0.6, hard: 8.0, perKg: 2600.0, price: 1560.0, tier: 5, hosts: [5], weight: 0.7, vein: [1, 2], glint: 0.95, pitch: 1400,
    colors: { base: '#c01a3a', light: '#3ae07a', spec: '#ffffff', dark: '#600d1d' }, glow: '#ff3a6a', tile: 'meteorit-rhodium-ruby-diamond_2' },
  { id: 20, key: 'DIAMOND', name: 'Diamond', kg: 0.5, hard: 10.0, perKg: 5000.0, price: 2500.0, tier: 6, hosts: [5], weight: 0.35, vein: [1, 2], glint: 1.0, pitch: 1568,
    colors: { base: '#7fe8ff', light: '#e8fdff', spec: '#ffffff', dark: '#3f747f' }, glow: '#8ff4ff', tile: 'meteorit-rhodium-ruby-diamond_3', crystal: true },
  // Heaviest ore in the game (dense wolframite/scheelite): tier 4 like gold/platinum, priced between them, found in granite-to-basalt veins.
  // Mining it with the Titanium Drill is what pays for the Tungsten Carbide Drill. No hand-drawn tile yet: procedural art.
  { id: 21, key: 'TUNGSTEN', name: 'Tungsten', kg: 5.0, hard: 7.0, perKg: 112.0, price: 560.0, tier: 4, hosts: [3, 4], weight: 2.5, vein: [2, 4], glint: 0.5, pitch: 1060,
    colors: { base: '#33313a', light: '#a68fc4', spec: '#ffffff', dark: '#18171c' }, glow: '#9a7aff', tile: null },
  // Tech-redesign ores (procedural art). Bauxite ~ iron, oil shale ~ lead, ilmenite ~ cobalt.
  { id: 22, key: 'BAUXITE', name: 'Bauxite', kg: 6.0, hard: 1.5, perKg: 0.18, price: 1.08, tier: 1, hosts: [1, 2], weight: 6, vein: [3, 7], glint: 0.1, pitch: 500,
    colors: { base: '#b0603a', light: '#e0a070', spec: '#ffffff', dark: '#58301d' }, glow: null, tile: null },
  { id: 23, key: 'ILMENITE', name: 'Ilmenite', kg: 3.0, hard: 3.0, perKg: 9.0, price: 27.0, tier: 3, hosts: [3, 4], weight: 4, vein: [2, 5], glint: 0.4, pitch: 720,
    colors: { base: '#2e2a30', light: '#8a8494', spec: '#ffffff', dark: '#171518' }, glow: null, tile: null },
  { id: 24, key: 'OIL_SHALE', name: 'Oil Shale', kg: 4.5, hard: 1.3, perKg: 0.9, price: 4.05, tier: 2, hosts: [2, 3], weight: 5, vein: [3, 6], glint: 0.1, pitch: 440,
    colors: { base: '#3a3226', light: '#6e5e44', spec: '#ffffff', dark: '#1d1913' }, glow: null, tile: null },
];

/** Off-world ores (hosts are filled per planet; none on Earth). Prices sit between the neighbouring Earth tiers by perKg (rhodium 593 < ore < diamond 5000). */
const SPACE_ORES = [
  { id: 43, key: 'HELIUM3', name: 'Helium-3', kg: 0.6, hard: 4.0, perKg: 1800, price: 1080, tier: 5, hosts: [], weight: 1, vein: [1, 3], glint: 0.8, pitch: 1100,
    colors: { base: '#d8e8ff', light: '#ffffff', spec: '#ffffff', dark: '#6c7480' }, glow: '#bcd8ff', tile: null },
  { id: 44, key: 'RARE_EARTHS', name: 'Rare Earths', kg: 1.2, hard: 5.0, perKg: 3400, price: 4080, tier: 6, hosts: [], weight: 1, vein: [1, 3], glint: 0.7, pitch: 1000,
    colors: { base: '#8a5a8a', light: '#e0a8e0', spec: '#ffffff', dark: '#452d45' }, glow: '#e090e0', tile: null },
  { id: 45, key: 'WATER_ICE', name: 'Water Ice', kg: 2.0, hard: 1.5, perKg: 3000, price: 6000, tier: 6, hosts: [], weight: 1, vein: [3, 7], glint: 0.4, pitch: 900,
    colors: { base: '#a8d0e8', light: '#f0fbff', spec: '#ffffff', dark: '#54687a' }, glow: null, tile: null },
  { id: 46, key: 'PERCHLORATE', name: 'Perchlorate', kg: 1.5, hard: 2.0, perKg: 2800, price: 4200, tier: 6, hosts: [], weight: 1, vein: [2, 5], glint: 0.3, pitch: 800,
    colors: { base: '#c8b070', light: '#f4e4a8', spec: '#ffffff', dark: '#645838' }, glow: null, tile: null },
];

/** [key, name, base, light, dark] per material, in ITEM id order (inputs always come before outputs). */
const MATERIAL_DEFS = [
  ['SOLDER', 'Solder', '#8c949c', '#d4dae0', '#464a4e'], ['BRONZE', 'Bronze', '#a0702c', '#e0a858', '#503816'],
  ['COPPER_WIRE', 'Copper Wire', '#c06a30', '#f0a060', '#603518'], ['WROUGHT_IRON', 'Wrought Iron', '#4a4a50', '#8a8a94', '#252528'],
  ['STEEL', 'Steel', '#7c8794', '#c4ced8', '#3e444a'], ['STAINLESS', 'Stainless Steel', '#a8b4c0', '#eef4fa', '#545a60'],
  ['ALUMINIUM', 'Aluminium', '#b8c0c8', '#f4f8fc', '#5c6064'], ['TITANIUM', 'Titanium', '#8c94a8', '#d4dcf0', '#464a54'],
  ['TUNGSTEN_CARBIDE', 'Tungsten Carbide', '#4c4a58', '#9a96b0', '#26252c'], ['FUEL', 'Fuel', '#a0802a', '#e8c860', '#504015'],
  ['PLASTIC', 'Plastic', '#d0d8e0', '#ffffff', '#687078'], ['CARBON_FIBER', 'Carbon Fiber', '#26282c', '#5c6068', '#131416'],
  ['CIRCUIT', 'Circuit Board', '#2a7a3a', '#6ae07a', '#153d1d'], ['LI_ION_CELL', 'Li-ion Cell', '#3a6ab0', '#80b0f0', '#1d3558'],
  ['INDUSTRIAL_DIAMOND', 'Industrial Diamond', '#a0d0e0', '#f0fcff', '#507078'], ['ENRICHED_URANIUM', 'Enriched Uranium', '#4aba2a', '#b0ff6a', '#255d15'],
  ['EXOTIC_ALLOY', 'Exotic Alloy', '#7a4ac0', '#c8a0ff', '#3d2560'], ['WARP_CHARGE', 'Warp Charge', '#2ac0d0', '#a0f8ff', '#156068'],
  ['PROPELLANT', 'Propellant', '#d8d0c0', '#ffffff', '#6c6860'], ['FUSION_FUEL', 'Fusion Fuel', '#e8f0ff', '#ffffff', '#7480a0'],
  ['SUPERCONDUCTOR', 'Superconductor', '#4a6ab0', '#a8c0ff', '#25355a'],
];

/** Appends materials: kg = 0.5 x input kg (rock matrix removed), price = 1.3 x input price (processing adds value). */
function withMaterials(list) {
  for (const [key, name, base, light, dark] of MATERIAL_DEFS) {
    const id = /** @type {any} */ (ITEM)[key];
    let inKg = 0; let inPrice = 0;
    for (const [o, n] of Object.entries(/** @type {any} */ (MATERIAL_INPUTS)[id])) { inKg += n * list[+o].kg; inPrice += n * list[+o].price; }
    const kg = 0.5 * inKg; const price = 1.3 * inPrice;
    list[id] = { id, key, name, kind: 'material', kg, hard: 1, perKg: price / kg, price, tier: 0, hosts: [], weight: 0, vein: [1, 1], glint: 0, pitch: 0,
      colors: { base, light, spec: '#ffffff', dark }, glow: null, tile: null };
  }
  return list;
}

/** Ores and materials indexed by id; `kind` tells them apart. */
export const ORES = Object.freeze(withMaterials((() => {
  const list = ORE_LIST.map((o) => o && { ...o, kind: 'ore' });
  for (const o of SPACE_ORES) list[o.id] = { ...o, kind: 'ore' };
  return list;
})()));

/** World generation: ores above RARE_PRICE per block spawn at RARE_WEIGHT_MUL of their weight (shortcut: Economy's balance model still uses the unscaled weight). */
export const WORLD_RARITY = Object.freeze({ RARE_PRICE: 100, RARE_WEIGHT_MUL: 0.3 });

/** True for mineable ores (never for materials or 0). @param {number} id */
export const isOre = (id) => /** @type {any} */ (ORES[id])?.kind === 'ore';

const stratum = (tile, cave, extra = {}) => {
  const m = MATERIALS[tile];
  return { tile, from: m.band?.[0], to: m.band?.[1], tier: m.tier, cave, water: false, magma: false, gas: false, ...extra };
};

/** Launch pad travel: cost per destination (Earth is free) and the tech effect that makes a destination known. */
export const TRAVEL = Object.freeze({
  COST: Object.freeze({ moon: { [ITEM.PROPELLANT]: 10 }, mars: { [ITEM.PROPELLANT]: 25 }, tessera: { [ITEM.WARP_CHARGE]: 3 }, earth: {} }),
  FLAG: Object.freeze({ moon: 'dest_moon', mars: 'dest_mars', tessera: 'dest_tessera' }),
});

/** Planet profiles. strata: top to bottom, `from`/`to` as fractions of underground rows; cave.open = open-space budget [min, max] as a fraction of the stratum. */
export const PLANETS = Object.freeze({
  earth: {
    id: 'earth', name: 'Earth', eras: [1, 2, 3, 4, 5], H: WORLD.H, gravity: 1, air: 'breathable', pulse: { mul: 1 }, quake: { mul: 1 }, hpMul: 1,
    strata: [
      stratum(TILE.SOIL, { style: 'none', open: [0, 0.01] }),
      stratum(TILE.LIMESTONE, { style: 'karst', open: [0.08, 0.12], fx: 0.03, fy: 0.16, shaftsPer64: 2, shaftLen: [8, 16] }),
      stratum(TILE.GRANITE, { style: 'fissure', open: [0.03, 0.05], freq: 0.09, angleDeg: 30, width: 0.03 }),
      stratum(TILE.BASALT, { style: 'tube', open: [0.07, 0.10], count: [2, 4], len: [18, 34], radius: 1, slope: 0.15 }, { water: true }),
      stratum(TILE.MANTLE, { style: 'pocket', open: [0.04, 0.06], freq: 0.22 }, { magma: true }),
      stratum(TILE.CORE, { style: 'none', open: [0, 0] }),
    ],
    setPieces: {}, relic: 'per-layer', goal: 'core',
  },
  moon: {
    id: 'moon', name: 'Moon', eras: [6], H: 448, gravity: 0.4, air: 'vacuum', pulse: { mul: 0.5 }, quake: { mul: 1.5 }, hpMul: 1.5, goal: 'relic', relic: 'relay_alpha', ruinStratum: 2, ruinFill: 'air', setPieces: {},
    strata: [
      stratum(TILE.REGOLITH, { style: 'none', open: [0, 0.01] }, { from: 0, to: 0.08 }),
      stratum(TILE.BRECCIA, { style: 'pocket', open: [0.06, 0.09], freq: 0.3 }, { from: 0.08, to: 0.30 }),
      stratum(TILE.MARE_BASALT, { style: 'tube', open: [0.10, 0.14], count: [2, 5], len: [24, 44], radius: 3, slope: 0.15 }, { from: 0.30, to: 0.60 }),
      stratum(TILE.ANORTHOSITE, { style: 'fissure', open: [0.02, 0.04], freq: 0.09, angleDeg: 30, width: 0.03 }, { from: 0.60, to: 0.88 }),
      stratum(TILE.LUNAR_MANTLE, { style: 'none', open: [0, 0] }, { from: 0.88, to: 1 }),
    ],
    // Very rich = weight x3. Bauxite sits in the anorthosite only: the table's regolith + anorthosite pair is not two neighbouring strata.
    ores: { [ORE.HELIUM3]: { strata: [0, 1], mul: 3 }, [ORE.IRON]: { strata: [0] }, [ORE.BAUXITE]: { strata: [3], mul: 3 },
      [ORE.ILMENITE]: { strata: [1, 2], mul: 3 }, [ORE.RARE_EARTHS]: { strata: [1], mul: 3 }, [ORE.NICKEL]: { strata: [1] },
      [ORE.COBALT]: { strata: [2] }, [ORE.PLATINUM]: { strata: [2] },
      [ORE.URANIUM]: { strata: [3] }, [ORE.GOLD]: { strata: [3] }, [ORE.WATER_ICE]: { strata: [3] }, [ORE.DIAMOND]: { strata: [4] } },
  },
  mars: {
    id: 'mars', name: 'Mars', eras: [7], H: 704, gravity: 0.6, air: 'thin', pulse: { mul: 1 }, quake: { mul: 0.5 }, hpMul: 2, goal: 'relic', relic: 'relay_beta', ruinStratum: 3, ruinFill: 'gas', setPieces: {},
    strata: [
      stratum(TILE.RUST_REGOLITH, { style: 'none', open: [0, 0.01] }, { from: 0, to: 0.06 }),
      stratum(TILE.ICE_GROUND, { style: 'pocket', open: [0.06, 0.09], freq: 0.2, fyMul: 3 }, { from: 0.06, to: 0.25, water: true }),
      stratum(TILE.MARS_BASALT, { style: 'tube', open: [0.08, 0.11], count: [2, 5], len: [20, 40], radius: 2, slope: 0.15 }, { from: 0.25, to: 0.55, gas: true }),
      stratum(TILE.SULFATE, { style: 'karst', open: [0.08, 0.12], fx: 0.03, fy: 0.16, shaftsPer64: 2, shaftLen: [8, 16] }, { from: 0.55, to: 0.82, water: true }),
      stratum(TILE.MARS_CRUST, { style: 'fissure', open: [0.03, 0.05], freq: 0.09, angleDeg: 30, width: 0.03 }, { from: 0.82, to: 1, magma: true }),
    ],
    ores: { [ORE.IRON]: { strata: [0], mul: 3 }, [ORE.PERCHLORATE]: { strata: [0] },
      [ORE.WATER_ICE]: { strata: [1] }, [ORE.LEAD]: { strata: [1] }, [ORE.ZINC]: { strata: [1] },
      [ORE.COPPER]: { strata: [2] }, [ORE.NICKEL]: { strata: [2] }, [ORE.COBALT]: { strata: [2] }, [ORE.TUNGSTEN]: { strata: [2] },
      [ORE.LITHIUM]: { strata: [3] }, [ORE.URANIUM]: { strata: [3] }, [ORE.BLACK_OPAL]: { strata: [3] },
      [ORE.PLATINUM]: { strata: [4] }, [ORE.RHODIUM]: { strata: [4] }, [ORE.DIAMOND]: { strata: [4] } },
  },
  tessera: {
    id: 'tessera', name: 'Tessera', eras: [], needFrom: [7], needOres: [ORE.METEORITE, ORE.RHODIUM, ORE.PLATINUM, ORE.DIAMOND],
    H: 1000, gravity: 1.4, air: 'thin', pulse: { mul: 3 }, quake: { mul: 0 }, hpMul: 3, goal: 'mind', relic: 'origin_core', ruinStratum: 3, ruinFill: 'water', setPieces: {},
    strata: [
      stratum(TILE.ASH, { style: 'pocket', open: [0.03, 0.05], freq: 0.22 }, { from: 0, to: 0.05 }),
      stratum(TILE.HULL_PLATE, { style: 'corridor', open: [0.04, 0.06], rowGap: [8, 12], colGap: [12, 18], thick: 1 }, { from: 0.05, to: 0.30 }),
      stratum(TILE.LATTICE, { style: 'corridor', open: [0.12, 0.16], rowGap: [6, 9], colGap: [8, 14], thick: 1 }, { from: 0.30, to: 0.62, hpMul: 1.5, water: true }),
      stratum(TILE.HEAT_SINK, { style: 'corridor', open: [0.14, 0.18], rowGap: [8, 11], colGap: [10, 16], thick: 3 }, { from: 0.62, to: 0.92, hpMul: 2, magma: true }),
      stratum(TILE.MIND, { style: 'corridor', open: [0, 0], rowGap: [8, 11], colGap: [10, 16], thick: 1 }, { from: 0.92, to: 1, hpMul: 3 }),
    ],
    ores: { [ORE.IRON]: { strata: [0] }, [ORE.COAL]: { strata: [0] }, [ORE.METEORITE]: { strata: [1, 2], mul: 3 }, [ORE.PLATINUM]: { strata: [1] },
      [ORE.RHODIUM]: { strata: [2, 3] }, [ORE.DIAMOND]: { strata: [3] } },
  },
});
for (const p of Object.values(PLANETS)) {
  for (const [id, e] of Object.entries(p.ores || {})) e.weight = /** @type {any} */ (ORES[+id]).weight * (e.mul ?? 1);
}

/** Host rock tile ids of `ore` on a planet: Earth uses ORES[].hosts, other worlds list strata in PLANETS[p].ores. */
export function oreHosts(planetId, ore) {
  const p = PLANETS[planetId];
  if (!p.ores) return ore.hosts;
  return (p.ores[ore.id]?.strata ?? []).map((k) => p.strata[k].tile);
}
/** Relative abundance of `ore` on a planet (profile override, else the ore's own weight). */
export const oreWeight = (planetId, ore) => PLANETS[planetId].ores?.[ore.id]?.weight ?? ore.weight;

/** Gravity multiplier of a planet. @param {string} planetId */
export const planetGravity = (planetId) => PLANETS[planetId]?.gravity ?? 1;

/** Idle-drain multiplier of the suit's life support by air type; fusion power halves the surcharge. @param {string} planetId @param {string[]} tech */
export function lifeSupportMul(planetId, tech) {
  const extra = { breathable: 0, thin: 0.5, vacuum: 1 }[PLANETS[planetId]?.air ?? 'breathable'] ?? 0;
  return 1 + (tech.includes('fusion_power') ? extra / 2 : extra);
}

/** Underground depth in metres of a world `H` rows tall. */
export const underM = (H) => (H - 1 - WORLD.SURFACE_ROWS) * WORLD.METERS_PER_TILE;

/** Ore audit: a floor above BULK_TILES tiles marks a bulk ore (ceiling only). floor x need (open = outside set pieces), ceiling x need, repair attempts per ore. */
export const AUDIT = Object.freeze({ FLOOR: 1.5, FLOOR_OPEN: 1.0, CEIL: 6, MAX_ATTEMPTS: 8, BULK_TILES: 200 });

/** Ore tiles are tougher than plain host rock. */
export const ORE_HP_MUL = 1.5;

/** Pickaxes: index = tier - 1. Tiers 2+ are crafted in the Workshop: recipe (materials), tech, minimum workshop level. */
export const PICKAXES = Object.freeze([
  // Tiers 1-3 are hand tools (free to swing); tiers 4-6 are powered drills that draw battery per block.
  { tier: 1, name: 'Bronze Pickaxe', short: 'Bronze', damage: 2, swing: 0.60, color: '#c58a45' },
  { tier: 2, name: 'Iron Pickaxe', short: 'Iron', damage: 4, swing: 0.54, color: '#8d9096',
    recipe: { [ITEM.WROUGHT_IRON]: 4 }, tech: 'ironworking', workshop: 1 },
  { tier: 3, name: 'Steel Pickaxe', short: 'Steel', damage: 6, swing: 0.48, color: '#b9c3cf',
    recipe: { [ITEM.STEEL]: 6 }, tech: 'steelmaking', workshop: 1 },
  { tier: 4, name: 'Titanium Drill', short: 'Titanium', damage: 10, swing: 0.42, color: '#d7dde8', powered: true,
    recipe: { [ITEM.TITANIUM]: 6, [ITEM.LI_ION_CELL]: 2, [ITEM.COPPER_WIRE]: 4 }, tech: 'titanium_drill', workshop: 2 },
  { tier: 5, name: 'Tungsten Carbide Drill', short: 'Tungsten Carbide', damage: 16, swing: 0.38, color: '#646a7a', powered: true,
    recipe: { [ITEM.TUNGSTEN_CARBIDE]: 6, [ITEM.TITANIUM]: 4, [ITEM.CIRCUIT]: 2 }, tech: 'tungsten_drill', workshop: 3 },
  { tier: 6, name: 'Diamond-Tipped Drill', short: 'Diamond-Tipped', damage: 24, swing: 0.34, color: '#9ff4ff', powered: true,
    recipe: { [ITEM.INDUSTRIAL_DIAMOND]: 4, [ITEM.TUNGSTEN_CARBIDE]: 6, [ITEM.CIRCUIT]: 4, [ITEM.LI_ION_CELL]: 2 }, tech: 'diamond_tooling', workshop: 3 },
  { tier: 7, name: 'Plasma Cutter', short: 'Plasma', damage: 40, swing: 0.30, color: '#ff9a3a', powered: true,
    recipe: { [ITEM.SUPERCONDUCTOR]: 6, [ITEM.FUSION_FUEL]: 4, [ITEM.TUNGSTEN_CARBIDE]: 6 }, tech: 'plasma_cutter', workshop: 3 },
  { tier: 8, name: 'Lattice Cutter', short: 'Lattice', damage: 64, swing: 0.28, color: '#c8a0ff', powered: true,
    recipe: { [ITEM.EXOTIC_ALLOY]: 6, [ITEM.SUPERCONDUCTOR]: 6, [ITEM.INDUSTRIAL_DIAMOND]: 4 }, tech: 'lattice_cutter', workshop: 3 },
]);

/** Non-pickaxe upgrades. Level 0 is starting gear (jetpack level 0 = none); later levels are crafted like pickaxes. */
export const UPGRADES = Object.freeze({
  jetpack: { name: 'Jetpack', levels: [
    { name: 'None', thrust: 0, maxUp: 0, drain: 0 },
    { thrust: 1900, maxUp: 220, drain: 1, recipe: { [ITEM.ALUMINIUM]: 4, [ITEM.STEEL]: 2, [ITEM.COPPER_WIRE]: 2 }, tech: 'jetpack', workshop: 1 },
    { thrust: 2300, maxUp: 280, drain: 0.85, recipe: { [ITEM.TITANIUM]: 4, [ITEM.LI_ION_CELL]: 2 }, tech: 'jetpack', workshop: 2 },
    { thrust: 2800, maxUp: 340, drain: 0.7, recipe: { [ITEM.CARBON_FIBER]: 4, [ITEM.CIRCUIT]: 2 }, tech: 'carbon_fiber', workshop: 1 },
    { thrust: 3400, maxUp: 420, drain: 0.55, recipe: { [ITEM.EXOTIC_ALLOY]: 2, [ITEM.CIRCUIT]: 2 }, tech: 'exotic_materials', workshop: 1 },
    { thrust: 4800, maxUp: 520, drain: 0.45, recipe: { [ITEM.EXOTIC_ALLOY]: 4, [ITEM.FUSION_FUEL]: 4 }, tech: 'jetpack_5', workshop: 1 },
  ] },
  radar: { name: 'Radar', levels: [
    { radius: 8, duration: 6, headlamp: 64 },
    { radius: 12, duration: 9, headlamp: 107, recipe: { [ITEM.COPPER_WIRE]: 4, [ITEM.SOLDER]: 2 }, tech: 'radio', workshop: 1 },
    { radius: 16, duration: 12, headlamp: 149, recipe: { [ITEM.CIRCUIT]: 2, [ITEM.ALUMINIUM]: 2 }, tech: 'precision', workshop: 1 },
    { radius: 22, duration: 16, headlamp: 192, recipe: { [ITEM.CIRCUIT]: 4, [ITEM.INDUSTRIAL_DIAMOND]: 2 }, tech: 'diamond_tooling', workshop: 1 },
  ] },
  /** Backpack + battery tiers: capacity kg (C_max), max energy, drill efficiency (eta_rig). */
  rig: { name: 'Cargo & Battery Rig', levels: [
    { name: 'Canvas Sack & Lead-Acid', zone: '0-100m', capacity: 35, maxEnergy: 100, eff: 1.0 },
    { name: 'Reinforced Frame & NiCad', zone: '100-300m', capacity: 75, maxEnergy: 250, eff: 1.3,
      recipe: { [ITEM.WROUGHT_IRON]: 4, [ORE.NICKEL]: 3 }, tech: 'ironworking', workshop: 1 },
    { name: 'Steel Exo-Frame & NiMH', zone: '300-600m', capacity: 150, maxEnergy: 600, eff: 1.8,
      recipe: { [ITEM.STEEL]: 6, [ORE.NICKEL]: 4, [ORE.COBALT]: 2 }, tech: 'steelmaking', workshop: 1 },
    { name: 'Aluminium Rig & Li-ion', zone: '600-1,000m', capacity: 300, maxEnergy: 1500, eff: 2.5,
      recipe: { [ITEM.ALUMINIUM]: 6, [ITEM.LI_ION_CELL]: 3 }, tech: 'precision', workshop: 1 },
    { name: 'Carbon Pod & Isotope Core', zone: '1,000-1,500m', capacity: 600, maxEnergy: 4000, eff: 3.5,
      recipe: { [ITEM.CARBON_FIBER]: 6, [ITEM.ENRICHED_URANIUM]: 2, [ITEM.CIRCUIT]: 2 }, tech: 'isotope_rig', workshop: 1 },
    { name: 'Quantum Cargo & Plasma', zone: '1,500m+', capacity: 1200, maxEnergy: 10000, eff: 5.0,
      recipe: { [ITEM.EXOTIC_ALLOY]: 4, [ITEM.CIRCUIT]: 4, [ITEM.ENRICHED_URANIUM]: 2 }, tech: 'warp_drive', workshop: 1 },
    { name: 'Fusion Pack', zone: 'Moon', capacity: 2400, maxEnergy: 25000, eff: 6.5,
      recipe: { [ITEM.FUSION_FUEL]: 6, [ITEM.SUPERCONDUCTOR]: 4 }, tech: 'fusion_pack', workshop: 1 },
    { name: 'Lattice Frame', zone: 'Mars', capacity: 4800, maxEnergy: 60000, eff: 8,
      recipe: { [ITEM.EXOTIC_ALLOY]: 6, [ITEM.FUSION_FUEL]: 8 }, tech: 'lattice_frame', workshop: 1 },
  ] },
});

/** Tech eras; an era is reached when the previous era's key tech is owned. */
export const ERAS = Object.freeze([
  { n: 1, name: 'Bronze Age' }, { n: 2, name: 'Iron Age' }, { n: 3, name: 'Industrial' },
  { n: 4, name: 'Electric' }, { n: 5, name: 'Atomic' }, { n: 6, name: 'Space' },
  { n: 7, name: 'Interplanetary' }, { n: 8, name: 'Interstellar' },
]);

const O_ = ORE; const I_ = ITEM;
/** Shorthand for a tech cost. @param {number} cash @param {Record<number, number>} ores */
const tc = (cash, ores) => ({ cash, ores });

/** Alien relics (blueprints). layer = world layer holding the ruin; -1 = not in the world. */
export const RELICS = Object.freeze([
  { id: 'hull_shard', name: 'Hull Shard', planet: 'earth', layer: 0 },
  { id: 'shield_lattice', name: 'Shielding Lattice', planet: 'earth', layer: 1 },
  { id: 'thermal_siphon', name: 'Thermal Siphon', planet: 'earth', layer: 2 },
  { id: 'matter_loom', name: 'Matter Loom', planet: 'earth', layer: 3 },
  { id: 'control_key', name: 'Control Key', planet: 'earth', layer: 4 },
  { id: 'seed_core', name: 'Seed Core', planet: 'earth', layer: -1 },
  { id: 'relay_alpha', name: 'Relay Alpha', planet: 'moon' },
  { id: 'relay_beta', name: 'Relay Beta', planet: 'mars' },
  { id: 'origin_core', name: 'Origin Core', planet: 'tessera' },
].map((r) => Object.freeze(r)));

/**
 * Era-based tech graph. requires = all must be owned (real logic); parent = UI placement only; key = reaching
 * the next era. Rewards are found by reverse lookup (systems/Tech.js unlocksOf): every recipe, building level,
 * equipment level or consumable with `tech: id`. effect: {stat, add?, mul?} changes a derived stat; {unlock} is a flag.
 */
export const TECH = Object.freeze([
  // Era 1 — Bronze Age
  { id: 'bloomery', era: 1, key: true, name: 'Bloomery', desc: 'A clay chimney furnace hot enough to reduce iron ore to spongy wrought iron.', requires: [], cost: tc(37, { [O_.IRON]: 15, [O_.COAL]: 10 }) },
  { id: 'solder', era: 1, name: 'Soldering', desc: 'Low-melting tin-lead alloy that joins metal parts.', requires: [], cost: tc(5, { [O_.LEAD]: 3, [O_.ZINC]: 2 }) },
  { id: 'contracts_terminal', era: 1, name: 'Contracts Terminal', desc: 'Radio link to buyers who pay a premium for specific ores.', requires: [], cost: tc(1, { [O_.ZINC]: 6 }), effect: { unlock: 'contracts_terminal' } },
  { id: 'stash_2', era: 1, name: 'Bigger Stash', desc: 'A proper storage shed at camp.', requires: [], cost: tc(10, { [O_.IRON]: 20 }), effect: { stat: 'stashCap', add: 300 } },
  { id: 'padded_suit_1', era: 1, name: 'Padded Suit I', desc: 'Quilted padding softens hard landings.', requires: [], cost: tc(4, { [O_.ZINC]: 4 }), effect: { stat: 'fallDamage', mul: 0.75 } },
  // Era 2 — Iron Age
  { id: 'ironworking', era: 2, name: 'Ironworking', desc: 'Forging wrought iron into tools and frames.', requires: ['bloomery'], cost: tc(320, { [I_.WROUGHT_IRON]: 8 }) },
  { id: 'radio', era: 2, name: 'Radio', desc: 'Copper coils and soldered joints make a simple ground radar.', requires: ['bloomery', 'solder'], cost: tc(140, { [I_.COPPER_WIRE]: 4, [I_.SOLDER]: 2 }) },
  { id: 'pack_1', era: 2, name: 'Bigger Pack I', desc: 'An iron-framed pack carries more ore.', requires: ['bloomery'], cost: tc(330, { [O_.NICKEL]: 4, [I_.WROUGHT_IRON]: 2 }), effect: { stat: 'capacity', add: 25 } },
  { id: 'battery_1', era: 2, name: 'Battery Cell I', desc: 'Extra lead-acid cells for the rig.', requires: ['bloomery'], cost: tc(260, { [O_.LEAD]: 6, [I_.COPPER_WIRE]: 2 }), effect: { stat: 'maxEnergy', add: 50 } },
  { id: 'pulse_detector', era: 2, name: 'Pulse Detector', desc: 'Tuned to the ring of the Hull Shard: warns of pulses early and pings the nearest ruin.', requires: ['radio'], relic: 'hull_shard', cost: tc(150, { [I_.COPPER_WIRE]: 4, [I_.SOLDER]: 2 }), effect: { unlock: 'pulse_detector' } },
  { id: 'blast_furnace', era: 2, key: true, name: 'Blast Furnace', desc: 'Forced air and coke melt iron fully, the first step to steel.', requires: ['bloomery'], cost: tc(380, { [I_.WROUGHT_IRON]: 20, [I_.BRONZE]: 4, [O_.COAL]: 10 }) },
  // Era 3 — Industrial
  { id: 'steelmaking', era: 3, name: 'Steelmaking', desc: 'Controlled carbon content turns iron into hard steel.', requires: ['blast_furnace'], cost: tc(2000, { [I_.STEEL]: 6 }) },
  { id: 'machining', era: 3, name: 'Machining', desc: 'Lathes and mills cut precise steel parts.', requires: ['blast_furnace'], cost: tc(2000, { [I_.STEEL]: 10, [I_.BRONZE]: 6 }) },
  { id: 'oil_refining', era: 3, name: 'Oil Refining', desc: 'Heating oil shale distills fuel and the feedstock for plastics.', requires: ['blast_furnace'], cost: tc(2800, { [I_.STEEL]: 10, [I_.SOLDER]: 6, [O_.OIL_SHALE]: 10 }) },
  { id: 'gas_mask', era: 3, parent: 'oil_refining', name: 'Gas Mask', desc: 'Plastic seals and a charcoal filter keep toxic gas out.', requires: ['oil_refining'], cost: tc(2000, { [I_.PLASTIC]: 2, [O_.COAL]: 4 }), effect: { unlock: 'gas_mask' } },
  { id: 'big_bomb', era: 3, parent: 'oil_refining', name: 'Big Bomb Recipe', desc: 'Fuel oil and fertilizer (ANFO): a much bigger blast.', requires: ['oil_refining'], cost: tc(2400, { [I_.FUEL]: 4, [O_.COAL]: 4 }), effect: { unlock: 'big_bomb' } },
  { id: 'diesel_power', era: 3, name: 'Diesel Power', desc: 'A diesel generator burns refined fuel for far more power.', requires: ['oil_refining'], cost: tc(2800, { [I_.STEEL]: 20, [I_.COPPER_WIRE]: 10, [I_.FUEL]: 10 }) },
  { id: 'faraday_shielding', era: 3, name: 'Faraday Shielding', desc: 'A copy of the alien lattice in copper and steel: the pulse cannot cross it.', requires: ['blast_furnace'], relic: 'shield_lattice', cost: tc(2400, { [I_.COPPER_WIRE]: 10, [I_.STAINLESS]: 4 }), effect: { stat: 'pulseResist', add: 0.5 } },
  { id: 'heat_suit', era: 3, name: 'Heat Suit', desc: 'Stainless mesh and insulation reflect deep-rock heat.', requires: ['blast_furnace'], cost: tc(3000, { [I_.STAINLESS]: 6, [I_.COPPER_WIRE]: 4 }), effect: { stat: 'heatResist', add: 0.5 } },
  { id: 'padded_suit_2', era: 3, name: 'Padded Suit II', desc: 'Steel plates and plastic foam absorb big falls.', requires: ['padded_suit_1', 'oil_refining'], cost: tc(2400, { [I_.STEEL]: 4, [I_.PLASTIC]: 4 }), effect: { stat: 'fallDamage', mul: 0.6 } },
  { id: 'battery_2', era: 3, name: 'Battery Cell II', desc: 'Nickel-cobalt cells hold far more charge.', requires: ['battery_1', 'blast_furnace'], cost: tc(2300, { [O_.NICKEL]: 4, [O_.COBALT]: 3 }), effect: { stat: 'maxEnergy', add: 200 } },
  { id: 'deep_scanner', era: 3, name: 'Deep Scanner', desc: 'A stronger transmitter pushes radar pulses further.', requires: ['radio', 'blast_furnace'], cost: tc(1900, { [O_.SILVER]: 3, [I_.COPPER_WIRE]: 4 }), effect: { stat: 'radarRange', mul: 1.5 } },
  { id: 'led_lamp', era: 3, name: 'LED Headlamp', desc: 'Efficient LEDs throw the headlamp beam 30% further.', requires: ['radio', 'blast_furnace'], cost: tc(1800, { [I_.COPPER_WIRE]: 4, [I_.SOLDER]: 3 }), effect: { stat: 'headlamp', mul: 1.3 } },
  { id: 'arc_furnace', era: 3, key: true, name: 'Arc Furnace', desc: 'An electric arc beyond 3000 °C smelts aluminium, titanium and tungsten.', requires: ['diesel_power'], cost: tc(7600, { [I_.STEEL]: 30, [I_.COPPER_WIRE]: 20 }) },
  // Era 4 — Electric
  { id: 'electronics', era: 4, name: 'Electronics', desc: 'Circuits that only survive inside the grounded cage of the camp.', requires: ['arc_furnace'], cost: tc(32000, { [I_.ALUMINIUM]: 20, [I_.COPPER_WIRE]: 10, [O_.GOLD]: 4 }) },
  { id: 'titanium_drill', era: 4, name: 'Titanium Drill', desc: 'A battery-powered drill with a titanium head.', requires: ['electronics', 'machining', 'faraday_shielding'], cost: tc(35000, { [I_.TITANIUM]: 6, [I_.LI_ION_CELL]: 2 }) },
  { id: 'jetpack', era: 4, name: 'Jetpack', desc: 'Light aluminium thrusters fed by lithium cells.', requires: ['electronics'], cost: tc(35000, { [I_.ALUMINIUM]: 4, [I_.LI_ION_CELL]: 2, [I_.COPPER_WIRE]: 2 }) },
  { id: 'jet_tank_1', era: 4, parent: 'jetpack', name: 'Jet Tank I', desc: 'Better nozzles waste less energy.', requires: ['jetpack'], cost: tc(26000, { [I_.ALUMINIUM]: 4, [I_.LI_ION_CELL]: 1 }), effect: { stat: 'jetDrain', mul: 0.8 } },
  { id: 'jet_thrust_1', era: 4, parent: 'jetpack', name: 'Jet Thrusters', desc: 'Titanium combustion chambers take more thrust.', requires: ['jetpack'], cost: tc(24000, { [I_.TITANIUM]: 4, [I_.CIRCUIT]: 2 }), effect: { stat: 'jetThrust', mul: 1.2 } },
  { id: 'charge_station', era: 4, name: 'Field Charging Station', desc: 'Portable chargers wired back to the camp generator.', requires: ['electronics', 'faraday_shielding'], cost: tc(35000, { [I_.LI_ION_CELL]: 4, [I_.COPPER_WIRE]: 6 }), effect: { unlock: 'charge_station' } },
  { id: 'heat_suit_2', era: 4, name: 'Heat Suit II', desc: 'Aluminized layers and active cooling.', requires: ['heat_suit', 'electronics', 'thermal_power'], cost: tc(33000, { [I_.ALUMINIUM]: 8, [I_.STAINLESS]: 4, [I_.CIRCUIT]: 2 }), effect: { stat: 'heatResist', add: 0.3 } },
  { id: 'thermal_power', era: 4, name: 'Thermal Power', desc: 'Alien siphon plates trickle-charge the suit from rock heat: a bigger effective battery.', requires: ['electronics'], relic: 'thermal_siphon', cost: tc(28000, { [I_.ALUMINIUM]: 6, [I_.CIRCUIT]: 4, [I_.COPPER_WIRE]: 6 }), effect: { stat: 'maxEnergy', mul: 1.25 } },
  { id: 'precision', era: 4, name: 'Precision Machining', desc: 'CNC tools cut titanium to fine tolerances.', requires: ['electronics', 'machining', 'faraday_shielding'], cost: tc(24000, { [I_.TITANIUM]: 20, [I_.CIRCUIT]: 10 }) },
  { id: 'battery_3', era: 4, name: 'Battery Cell III', desc: 'Lithium-ion packs with platinum contacts.', requires: ['battery_2', 'electronics'], cost: tc(25000, { [I_.LI_ION_CELL]: 4, [O_.PLATINUM]: 2 }), effect: { stat: 'maxEnergy', add: 800 } },
  { id: 'pack_2', era: 4, name: 'Bigger Pack II', desc: 'Aluminium and titanium frame, same weight, more room.', requires: ['pack_1', 'arc_furnace'], cost: tc(26000, { [I_.ALUMINIUM]: 6, [I_.TITANIUM]: 4 }), effect: { stat: 'capacity', add: 75 } },
  { id: 'fission', era: 4, key: true, name: 'Nuclear Fission', desc: 'Enriched uranium splits in a reactor for huge power.', requires: ['electronics', 'arc_furnace'], cost: tc(77000, { [I_.STAINLESS]: 30, [O_.LEAD]: 40, [I_.CIRCUIT]: 10, [O_.URANIUM]: 10 }) },
  // Era 5 — Atomic
  { id: 'carbon_fiber', era: 5, name: 'Carbon Fiber', desc: 'Carbonized plastic threads: stronger than steel, far lighter.', requires: ['fission'], cost: tc(890000, { [I_.STAINLESS]: 20, [I_.ALUMINIUM]: 10, [I_.PLASTIC]: 20 }) },
  { id: 'tungsten_drill', era: 5, name: 'Tungsten Carbide Drill', desc: 'Carbide bits keep their edge in the hardest rock.', requires: ['precision', 'fission'], cost: tc(880000, { [I_.TUNGSTEN_CARBIDE]: 6, [I_.TITANIUM]: 4, [I_.CIRCUIT]: 2 }) },
  { id: 'magma_boots', era: 5, name: 'Magma Boots', desc: 'Carbide soles and carbon-fiber shells let you walk on magma.', requires: ['heat_suit_2', 'carbon_fiber'], cost: tc(880000, { [I_.TUNGSTEN_CARBIDE]: 4, [I_.CARBON_FIBER]: 4 }), effect: { unlock: 'magma_boots' } },
  { id: 'diamond_tooling', era: 5, name: 'Diamond Tooling', desc: 'Synthetic diamond grit for drill tips and sensors.', requires: ['tungsten_drill'], cost: tc(870000, { [O_.DIAMOND]: 4, [I_.TUNGSTEN_CARBIDE]: 6 }) },
  { id: 'jet_tank_2', era: 5, parent: 'jetpack', name: 'Jet Tank II', desc: 'Carbon-fiber tanks store more propellant.', requires: ['jet_tank_1', 'carbon_fiber'], cost: tc(890000, { [I_.CARBON_FIBER]: 4, [I_.LI_ION_CELL]: 2 }), effect: { stat: 'jetDrain', mul: 0.75 } },
  { id: 'isotope_rig', era: 5, name: 'Isotope Rig', desc: 'A radioisotope core powers a carbon-fiber pod.', requires: ['carbon_fiber', 'fission'], cost: tc(890000, { [I_.CARBON_FIBER]: 6, [I_.ENRICHED_URANIUM]: 2 }) },
  { id: 'rocketry', era: 5, key: true, name: 'Rocketry', desc: 'Light airframes and liquid fuel reach orbit.', requires: ['carbon_fiber', 'fission'], cost: tc(1800000, { [I_.CARBON_FIBER]: 40, [I_.ALUMINIUM]: 40, [I_.CIRCUIT]: 20, [I_.FUEL]: 60 }) },
  { id: 'pulse_hardening', era: 5, name: 'Pulse Hardening', desc: 'Carbon-fiber shells and shielded circuits make gear immune to the pulse.', requires: ['faraday_shielding', 'carbon_fiber'], cost: tc(880000, { [I_.CARBON_FIBER]: 6, [I_.CIRCUIT]: 6 }), effect: { stat: 'pulseResist', add: 0.5 } },
  { id: 'exotic_materials', era: 5, name: 'Exotic Materials', desc: 'Re-forging Seed hull fragments with rhodium and platinum.', requires: ['fission'], relic: 'matter_loom', cost: tc(880000, { [O_.METEORITE]: 4, [O_.RHODIUM]: 2, [O_.PLATINUM]: 2 }) },
  { id: 'core_interface', era: 5, name: 'Core Interface', desc: 'A device that speaks the handshake of the Seed. Without it the machine will not listen.', requires: ['exotic_materials'], relic: 'control_key', cost: tc(850000, { [I_.EXOTIC_ALLOY]: 4, [I_.CIRCUIT]: 10, [I_.ENRICHED_URANIUM]: 4 }), effect: { unlock: 'core_interface' } },
  { id: 'elevator', era: 5, name: 'Space Elevator', desc: 'A carbon-fiber tether and steel climbers: stops on the way down become permanent.', requires: ['carbon_fiber', 'machining'], cost: tc(880000, { [I_.STEEL]: 20, [I_.CARBON_FIBER]: 10 }), effect: { unlock: 'elevator' } },
  // Era 6 — Space
  { id: 'orbital_station', era: 6, name: 'Orbital Station', desc: 'A crewed station that triangulates the source of the signal.', requires: ['rocketry'], cost: tc(800000, { [I_.CARBON_FIBER]: 30, [I_.TITANIUM]: 30, [I_.CIRCUIT]: 20, [I_.LI_ION_CELL]: 10 }), effect: { unlock: 'launch_pad' } },
  { id: 'lunar_landing', era: 6, name: 'Lunar Landing', desc: 'A lander to the first relay of the alien signal, with a pressure suit.', requires: ['orbital_station'], cost: tc(1200000, { [I_.ALUMINIUM]: 40, [I_.TITANIUM]: 20, [I_.FUEL]: 80, [I_.CIRCUIT]: 20 }), effect: { unlock: 'dest_moon' } },
  { id: 'fusion_power', era: 6, name: 'Fusion Power', desc: 'Relay Alpha holds the plasma containment: a reactor that burns helium-3.', requires: ['lunar_landing'], relic: 'relay_alpha', cost: tc(1300000, { [I_.SUPERCONDUCTOR]: 10, [I_.FUSION_FUEL]: 10, [I_.STAINLESS]: 20 }) },
  { id: 'plasma_cutter', era: 6, name: 'Plasma Cutter', desc: 'A contained plasma arc that slices rock.', requires: ['fusion_power'], cost: tc(1450000, { [I_.SUPERCONDUCTOR]: 6, [I_.FUSION_FUEL]: 4, [I_.TUNGSTEN_CARBIDE]: 6 }) },
  { id: 'fusion_pack', era: 6, name: 'Fusion Pack', desc: 'A compact fusion cell and a superconducting frame.', requires: ['fusion_power'], cost: tc(1450000, { [I_.FUSION_FUEL]: 6, [I_.SUPERCONDUCTOR]: 4 }) },
  { id: 'mars_mission', era: 6, key: true, name: 'Mars Mission', desc: 'Nuclear propulsion to the second relay of the signal.', requires: ['lunar_landing', 'fusion_power'], relic: 'relay_alpha', cost: tc(2700000, { [I_.CARBON_FIBER]: 40, [I_.PROPELLANT]: 20, [I_.CIRCUIT]: 30, [I_.FUSION_FUEL]: 10 }), effect: { unlock: 'dest_mars' } },
  // Era 7 — Interplanetary
  { id: 'lattice_cutter', era: 7, name: 'Lattice Cutter', desc: 'Relay Beta teaches a cutting edge grown as a crystal lattice.', requires: ['mars_mission', 'exotic_materials'], relic: 'relay_beta', cost: tc(3300000, { [I_.EXOTIC_ALLOY]: 6, [I_.SUPERCONDUCTOR]: 6, [I_.INDUSTRIAL_DIAMOND]: 4 }) },
  { id: 'lattice_frame', era: 7, name: 'Lattice Frame', desc: 'A rig frame grown from exotic alloy.', requires: ['mars_mission', 'exotic_materials'], cost: tc(3300000, { [I_.EXOTIC_ALLOY]: 6, [I_.FUSION_FUEL]: 8 }) },
  { id: 'heat_suit_3', era: 7, name: 'Heat Suit III', desc: 'Superconducting coolant loops: full protection from heat.', requires: ['mars_mission', 'heat_suit_2'], cost: tc(3300000, { [I_.SUPERCONDUCTOR]: 6, [I_.EXOTIC_ALLOY]: 4 }), effect: { stat: 'heatResist', add: 0.2 } },
  { id: 'jetpack_5', era: 7, name: 'Jetpack V', desc: 'Fusion-fed exotic thrusters.', requires: ['mars_mission', 'exotic_materials'], cost: tc(3300000, { [I_.EXOTIC_ALLOY]: 4, [I_.FUSION_FUEL]: 4 }) },
  { id: 'warp_drive', era: 7, name: 'Warp Drive', desc: 'Folds space for an instant trip home: portable warp charges.', requires: ['mars_mission', 'exotic_materials'], relic: 'seed_core', cost: tc(3000000, { [I_.EXOTIC_ALLOY]: 10, [I_.FUSION_FUEL]: 20, [I_.CIRCUIT]: 40 }) },
  { id: 'interstellar', era: 7, key: true, name: 'Interstellar Travel', desc: 'Ships that can reach the source of the signal.', requires: ['warp_drive'], relic: 'relay_beta', cost: tc(6000000, { [I_.EXOTIC_ALLOY]: 20, [I_.FUSION_FUEL]: 30, [I_.SUPERCONDUCTOR]: 20, [I_.CARBON_FIBER]: 60 }), effect: { unlock: 'dest_tessera' } },
]);

export const CONSUMABLES = Object.freeze({
  dynamite: { name: 'Dynamite', short: 'Dynamite', price: 15, slot: 1, start: 2 },
  cell: { name: 'Reserve Energy Cell', short: 'Cell', price: 10, slot: 3, start: 1, frac: 0.4 },
  ladder: { name: 'Ladder', short: 'Ladder', price: 3, slot: 4, start: 10 },
  bigBomb: { name: 'Big Bomb', short: 'Big Bomb', price: 60, slot: 5, start: 0, tech: 'big_bomb' },
  campKit: { name: 'Field Camp Kit', short: 'Camp', price: 120, slot: 6, start: 0 },
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
  /** [planet, host band (material id)] a player at tier N mostly mines: Earth through tier 6, then the Moon, Mars and Tessera strata. */
  FOCUS_BY_TIER: [['earth', 1], ['earth', 2], ['earth', 3], ['earth', 4], ['earth', 5], ['earth', 5], ['moon', 15], ['mars', 23]],
  TRIPS_MIN: 3,
  TRIPS_MAX: 5,
});

/** Protective gear (unlocked via TECH). */
export const GEAR = Object.freeze({ AMBIENT_T0: 15, AMBIENT_T1: 350 }); // heat resist comes from TECH heat_suit / heat_suit_2

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
  /** Px climbed per rung tick sound. */
  LADDER_STEP_DIST: 12,
  /** Standing jump apex (px): two 16px tiles plus 2px clearance. */
  JUMP_H: 34,
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

export const RADAR = Object.freeze({ COOLDOWN: 10, RING_SPEED: 520 });
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
  /** Zoom multipliers on the base pixel scale (mouse wheel / +/- keys); index ZOOM_DEFAULT is 1x. */
  ZOOM_LEVELS: Object.freeze([0.5, 0.75, 1, 1.5, 2]),
  ZOOM_DEFAULT: 2,
});

export const RENDER = Object.freeze({
  MAX_CHUNK_REBUILDS: 3,
  ATLAS_VARIANTS: 6,
  ORE_VARIANTS: 4,
  ATLAS_COLS: 16,
  REVEAL_FADE: 2.5,
  REVEAL_INTERVAL: 4,
  REVEAL_NEAR: 1.5, // tiles revealed through walls around the player
  REVEAL_FULL_FRAC: 0.5, // inside this fraction of the headlamp range tiles reveal fully; beyond it they fade toward REVEAL_EDGE_ALPHA
  REVEAL_EDGE_ALPHA: 0.25,
  HEADLAMP_MAX_TILES: 6,
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
  PLAYER_RADIUS: 220, // warm glow radius at the max (6-tile) headlamp; scales down with the lamp level
  PLAYER_COLOR: '#ffb070',
  PLAYER_INTENSITY: 1.0,
  CONE_HALF_ANGLE: 0.2618, // 15 deg each side: a 30 deg wide headlamp beam
  CONE_COLOR: '#fff1d6',
  HELMET_RADIUS: 40, // small bright glow on the helmet

  /** Beam feather: [fraction of the cone width, alpha] slices from widest to narrowest (alphas add up near 1). */
  CONE_FEATHER: Object.freeze([[1, 0.55], [0.85, 0.25], [0.7, 0.2]]),
  LAMP_HEAD_DY: 9, // px above the player centre where the beam starts (helmet lamp)
  AURA_BREATHE: 0.035, // slow +-3.5% swell of the player aura
  CONE_WALL_BLEED: 34, // px past the wall face: the beam lights one full tile into rock
  FLICKER: 0.04,
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
  VERSION: 7,
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
  slot6: ['Digit6'],
  down: ['KeyS', 'ArrowDown'],
  station: ['KeyG'],
  interact: ['KeyE'],
  pause: ['Escape'],
  debug: ['F3'],
  dev: ['F4'],
  zoomIn: ['Equal', 'NumpadAdd'],
  zoomOut: ['Minus', 'NumpadSubtract'],
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
  /** Enlarged minimap (click to toggle), canvas px. */
  MINIMAP_BIG_W: 480,
  MINIMAP_BIG_H: 560,
  MINIMAP_BIG_SCALE: 3,
  PLAYER_BLINK: 0.5,
  DEBUG_GRAPH_W: 200,
  DEBUG_GRAPH_H: 60,
  DEBUG_TEXT_INTERVAL: 0.25,
});

export const LOOP = Object.freeze({ STEP: 1 / 60, MAX_STEPS: 5, MAX_FRAME_DT: 0.25 });

export const DEBUG = Object.freeze({ LOG: false });
