/**
 * @module anim/Overlays
 * Live adjustments on top of the clip pose: landing squash, head look, two-bone arm IK. Pure.
 */
import { solveWorld } from './Rig.js';

const LOOK_MAX = 30 * Math.PI / 180;

/** World px → rig px (mirrored when facing left). @returns {[number, number]} */
export function toRigSpace(wx, wy, boxX, boxY, facing) {
  const rx = (wx - boxX) * 3;
  return [facing < 0 ? 96 - rx : rx, (wy - boxY) * 3];
}

/**
 * Two-bone IK in the chain root's frame. a1 = world angle of bone 1, a2 = angle of bone 2 relative to bone 1.
 * bend = -1 puts the elbow below the root→target line (for a target on the right), +1 above it.
 */
export function solveTwoBone(l1, l2, dx, dy, bend) {
  const dist = Math.hypot(dx, dy);
  const base = dist > 0 ? Math.atan2(dy, dx) : 0;
  const d = Math.min(l1 + l2, Math.max(Math.abs(l1 - l2) + 1e-3, dist));
  const cosA = Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const a1 = base - Math.sign(bend || 1) * Math.acos(cosA);
  const ex = l1 * Math.cos(a1); const ey = l1 * Math.sin(a1);
  const a2 = Math.atan2(d * Math.sin(base) - ey, d * Math.cos(base) - ex) - a1;
  return { a1, a2, reached: dist <= l1 + l2 && dist >= Math.abs(l1 - l2) };
}

/** Points the head at (tx, ty), clamped to ±30° from its rest look direction (forward = +x of the rig). */
export function headLook(rig, pose, world, tx, ty) {
  const h = rig.index.get('head'); if (h === undefined) return;
  const phi = Math.atan2(ty - world.y[h], Math.max(tx - world.x[h], 4));
  const restWorld = world.a[h] - pose.angle[h];
  let d = phi - (restWorld + Math.PI / 2);
  d = Math.atan2(Math.sin(d), Math.cos(d));
  pose.angle[h] = Math.max(-LOOK_MAX, Math.min(LOOK_MAX, d));
}

export function gripTarget(rig, world, pickAngle) {
  const u = rig.index.get('armF_upper'); const l = rig.index.get('armF_lower');
  const r = 0.85 * (rig.bones[u].length + rig.bones[l].length);
  return /** @type {[number, number]} */ ([world.x[u] + r * Math.cos(pickAngle), world.y[u] + r * Math.sin(pickAngle)]);
}

export function armToGrip(rig, pose, world, gx, gy) {
  const u = rig.index.get('armF_upper'); const l = rig.index.get('armF_lower');
  const { a1, a2 } = solveTwoBone(rig.bones[u].length, rig.bones[l].length, gx - world.x[u], gy - world.y[u], -1);
  pose.angle[u] = a1 - (world.a[rig.parent[u]] + rig.bones[u].restRad);
  pose.angle[l] = a2 - rig.bones[l].restRad;
}

/** Px the hips drop right after landing. */
export const squashOffset = (landVY, t) => Math.round(Math.min(6, landVY / 60) * Math.max(0, 1 - t / 0.18));

/**
 * squash → solve → head look → (mining) arm IK → solve. Mutates `pose`.
 * @param {{look:[number,number], mining:boolean, pickAngle:number, landVY:number, squashT:number}} ctx
 */
export function applyOverlays(rig, pose, ctx) {
  pose.dy[0] += squashOffset(ctx.landVY, ctx.squashT);
  let w = solveWorld(rig, pose);
  headLook(rig, pose, w, ctx.look[0], ctx.look[1]);
  if (ctx.mining) {
    const [gx, gy] = gripTarget(rig, w, ctx.pickAngle);
    armToGrip(rig, pose, w, gx, gy);
  }
  w = solveWorld(rig, pose, w);
  return w;
}
