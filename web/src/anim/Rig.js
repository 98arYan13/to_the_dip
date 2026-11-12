/**
 * @module anim/Rig
 * 2D skeleton: bone data loading and forward kinematics. Pure (no DOM).
 */

/**
 * @typedef {{name:string, parent:string|null, x:number, y:number, rest:number, length:number, width:number, layer:number, color:string, restRad:number, sprite?:string, pivot?:[number,number]}} BoneDef
 * @typedef {{canvas:number, angleStep:number, bones:BoneDef[], index:Map<string,number>, parent:Int16Array, drawOrder:number[]}} Rig
 * @typedef {{angle:Float32Array, dx:Float32Array, dy:Float32Array}} Pose
 * @typedef {{x:Float32Array, y:Float32Array, a:Float32Array}} WorldPose
 */

const DEG = Math.PI / 180;

/** @param {any} data rig.json contents */
export function loadRig(data) {
  /** @type {Map<string, number>} */ const index = new Map();
  const bones = data.bones.map((/** @type {any} */ b, /** @type {number} */ i) => {
    index.set(b.name, i);
    return { ...b, restRad: b.rest * DEG };
  });
  const parent = new Int16Array(bones.length);
  bones.forEach((/** @type {BoneDef} */ b, /** @type {number} */ i) => {
    if (b.parent === null) { parent[i] = -1; return; }
    const p = index.get(b.parent);
    if (p === undefined) throw new Error(`bone ${b.name}: unknown parent ${b.parent}`);
    if (p >= i) throw new Error(`bone ${b.name}: parent ${b.parent} must come before it`);
    parent[i] = p;
  });
  const drawOrder = bones.map((/** @type {any} */ _, /** @type {number} */ i) => i).sort((/** @type {number} */ a, /** @type {number} */ b) => bones[a].layer - bones[b].layer || a - b);
  return { canvas: data.canvas, angleStep: data.angleStep, bones, index, parent, drawOrder };
}

/** All-zero pose = rest pose. @param {Rig} rig @returns {Pose} */
export function createPose(rig) {
  const n = rig.bones.length;
  return { angle: new Float32Array(n), dx: new Float32Array(n), dy: new Float32Array(n) };
}

/** @param {Rig} rig @param {Pose} pose @param {WorldPose} [out] @returns {WorldPose} */
export function solveWorld(rig, pose, out) {
  const n = rig.bones.length;
  const w = out || { x: new Float32Array(n), y: new Float32Array(n), a: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    const b = rig.bones[i]; const p = rig.parent[i];
    const lx = b.x + pose.dx[i]; const ly = b.y + pose.dy[i];
    if (p < 0) { w.x[i] = lx; w.y[i] = ly; w.a[i] = b.restRad + pose.angle[i]; continue; }
    const c = Math.cos(w.a[p]); const s = Math.sin(w.a[p]);
    w.x[i] = w.x[p] + lx * c - ly * s;
    w.y[i] = w.y[p] + lx * s + ly * c;
    w.a[i] = w.a[p] + b.restRad + pose.angle[i];
  }
  return w;
}

/** @param {Rig} rig @param {WorldPose} world @param {number} i @returns {[number, number]} */
export function boneTip(rig, world, i) {
  const l = rig.bones[i].length;
  return [world.x[i] + l * Math.cos(world.a[i]), world.y[i] + l * Math.sin(world.a[i])];
}
