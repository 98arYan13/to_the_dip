/** @module story  Expedition Log entries and main missions (spec 7.2 / 7.3). `when` is exactly one trigger. */
import { HAZARD } from './config.js';

const E = (id, chapter, title, text, when, modal) => ({ id, chapter, title, text, when, ...(modal ? { modal: true } : {}) });

export const LOG_ENTRIES = [
  E('intro', 1, 'Eleven Days Ago', "Eleven days ago every chip within 300 km of this valley burned out at once. The pulses come from below, and they are getting stronger. The planet's magnetic field is already slipping. We have a kiln, a bronze pick and a hole in the ground. Whatever is down there, we go and meet it.", { start: true }, true),
  E('ch1_tools', 1, 'Rebuilding', 'Nothing with a transistor survives here. Copper, tin, clay and fire still work. We rebuild from the beginning.', { flag: 'sold' }),
  E('relic_hull_shard', 1, 'Hull Shard', 'This is not ore. The alloy is layered atom by atom, and it rings — faintly, every few minutes, in time with the pulses. Something made this. Pieces of it are scattered through the rock.', { relic: 'hull_shard' }, true),
  E('ch2_radio', 2, 'The Signal', 'The valve radio hears it: a carrier wave from straight down, steady as a heartbeat. We are calling the source the Seed.', { tech: 'radio' }),
  E('first_pulse', 2, 'First Pulse', 'Lamp dead, battery half gone, teeth aching. Down here the pulses hit hard. Thick wires survive. Fine ones do not.', { flag: 'pulse' }),
  E('relic_shield_lattice', 3, 'Shielding Lattice', "A mesh with a repeating cell just the wrong size for the Seed's frequency. The pulse cannot cross it. We can copy this in copper and steel — and behind it, circuits will live.", { relic: 'shield_lattice' }, true),
  E('ch3_quakes', 3, 'The Quakes', "The quakes are not tectonic. The Seed is drawing heat from the core, and the convection that drives Earth's magnetic field is stalling. Our estimate: a few decades of shield left.", { depthM: HAZARD.QUAKE.SAFE_DEPTH_M }),
  E('ch4_electronics', 4, 'Light in the Rain', 'First working circuit board since the blackout, sealed in a lattice cage. It felt like lighting a fire in the rain.', { tech: 'electronics' }),
  E('relic_thermal_siphon', 4, 'Thermal Siphon', 'No turbine, no moving parts. Heat goes in one face, current comes out the other, far better than any thermocouple we know. This is how it feeds.', { relic: 'thermal_siphon' }, true),
  E('ch5_fission', 5, 'Splitting Atoms', "We split atoms to out-dig a machine that drinks a planet's heat. It has been here for millions of years. We have had four hundred of science.", { tech: 'fission' }),
  E('relic_matter_loom', 5, 'Matter Loom', 'The meteorite ore was never a meteorite. It is hull. The Loom shows how the Seed re-forges it — and with rhodium and platinum, so can we.', { relic: 'matter_loom' }, true),
  E('relic_control_key', 5, 'Control Key', 'A pattern, not an object: the handshake its control system expects. Build an interface that speaks it, carry it to the heart, and the Seed may listen.', { relic: 'control_key' }, true),
  E('core_denied', 5, 'Ignored', 'It did not even notice me.', { flag: 'core_denied' }),
  E('ending', 6, 'The Hum Stops', "The hum stops. The tremors fade; far above, compass needles steady. In the silence the Seed's core is still warm in your hands — a drive that folds space. Then the last line of its log decodes: one transmission sent, relayed by the Moon and by Mars, to a star 40 light-years away. It called home. We had better answer in person.", { completed: true }),
  E('ch6_relays', 6, 'Relays', 'Orbit first, to triangulate. Then the relays. Then the source.', { tech: 'rocketry' }),
];

const M = (id, chapter, text, when) => ({ id, chapter, text, when });

export const MISSIONS = [
  M('ch1_sell', 1, 'Sell your first load of ore', { flag: 'sold' }),
  M('ch1_bloomery', 1, 'Research the Bloomery', { tech: 'bloomery' }),
  M('ch1_signal', 1, 'Find the source of the strange signal in the upper sands', { relic: 'hull_shard' }),
  M('ch2_radio', 2, 'Build a Radio', { tech: 'radio' }),
  M('ch2_detector', 2, 'Build the Pulse Detector', { tech: 'pulse_detector' }),
  M('ch2_pulse', 2, 'Survive a pulse storm below 150 m', { flag: 'pulse' }),
  M('ch2_blast', 2, 'Research the Blast Furnace', { tech: 'blast_furnace' }),
  M('ch3_lattice', 3, 'Recover the relic from the Flooded Gallery', { relic: 'shield_lattice' }),
  M('ch3_faraday', 3, 'Build Faraday Shielding', { tech: 'faraday_shielding' }),
  M('ch3_arc', 3, 'Research the Arc Furnace', { tech: 'arc_furnace' }),
  M('ch4_electronics', 4, 'Restore Electronics', { tech: 'electronics' }),
  M('ch4_siphon', 4, 'Recover the relic from the Choked Hall', { relic: 'thermal_siphon' }),
  M('ch4_fission', 4, 'Achieve Nuclear Fission', { tech: 'fission' }),
  M('ch5_loom', 5, 'Breach the Sealed Vault', { relic: 'matter_loom' }),
  M('ch5_exotic', 5, 'Forge Exotic Alloy', { flag: 'exotic' }),
  M('ch5_key', 5, 'Recover the Control Key from the Drowned Forge', { relic: 'control_key' }),
  M('ch5_interface', 5, 'Build the Core Interface', { tech: 'core_interface' }),
  M('ch6_core', 6, 'Reach the Core and shut down the Seed', { completed: true }),
  M('ch6_relays', 6, 'Research Rocketry and follow the signal', { tech: 'rocketry' }),
];
