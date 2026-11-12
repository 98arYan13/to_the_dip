/**
 * @module anim/Clip
 * Keyframe sampling and pose blending. Pure.
 * Clip: { loop, duration, keys: { [bone]: [t, angleDeg, dx, dy, ease?][] } }
 */
const DEG = Math.PI / 180;
const warned = new Set();

const EASE = {
  linear: (/** @type {number} */ t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inout: (t) => t * t * (3 - 2 * t),
  step: () => 0,
};

/**
 * Resets `pose` to zero, then writes each keyed bone.
 * @param {any} clip @param {number} t @param {import('./Rig.js').Rig} rig @param {import('./Rig.js').Pose} pose
 */
export function sampleClip(clip, t, rig, pose) {
  pose.angle.fill(0); pose.dx.fill(0); pose.dy.fill(0);
  const D = clip.duration;
  t = clip.loop ? ((t % D) + D) % D : Math.min(Math.max(t, 0), D);
  for (const name in clip.keys) {
    const i = rig.index.get(name);
    if (i === undefined) {
      if (!warned.has(name)) { warned.add(name); console.warn(`clip names unknown bone "${name}"`); }
      continue;
    }
    const keys = clip.keys[name];
    const n = keys.length;
    if (!n) continue;
    // find segment [k0, k1] containing t; loop wraps last → first at duration
    let k0 = 0;
    while (k0 + 1 < n && keys[k0 + 1][0] <= t) k0++;
    const a = keys[k0];
    let b = null; let tb = 0;
    if (k0 + 1 < n) { b = keys[k0 + 1]; tb = b[0]; } else if (clip.loop && n > 1) { b = keys[0]; tb = D + b[0]; }
    const ta = a[0];
    if (!b || t < ta) { pose.angle[i] = (a[1] || 0) * DEG; pose.dx[i] = a[2] || 0; pose.dy[i] = a[3] || 0; continue; }
    const f = /** @type {any} */ (EASE)[a[4] || 'linear']?.((t - ta) / (tb - ta)) ?? (t - ta) / (tb - ta);
    pose.angle[i] = ((a[1] || 0) + ((b[1] || 0) - (a[1] || 0)) * f) * DEG;
    pose.dx[i] = (a[2] || 0) + ((b[2] || 0) - (a[2] || 0)) * f;
    pose.dy[i] = (a[3] || 0) + ((b[3] || 0) - (a[3] || 0)) * f;
  }
  return pose;
}

/** out = a + (b - a)·w, w clamped to [0,1]. */
export function blendPose(a, b, w, out) {
  w = Math.min(1, Math.max(0, w));
  for (const k of /** @type {const} */ (['angle', 'dx', 'dy'])) {
    const A = a[k]; const B = b[k]; const O = out[k];
    for (let i = 0; i < A.length; i++) O[i] = A[i] + (B[i] - A[i]) * w;
  }
  return out;
}

export const clipEnded = (clip, t) => !clip.loop && t >= clip.duration;
