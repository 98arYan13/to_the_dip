/**
 * @module anim/Animator
 * Chooses a clip from player state and produces the (cross-faded) base pose.
 */
import { createPose } from './Rig.js';
import { sampleClip, blendPose, clipEnded } from './Clip.js';

export const CLIP_NAMES = ['idle', 'walk', 'walk_back', 'jump', 'fall', 'land', 'mine_side', 'mine_down', 'climb', 'hurt', 'jet'];
const FADE = 0.1;
const TAU = Math.PI * 2;

/**
 * Priority: hurt > ladder > mine > air > land > walk > idle.
 * @param {{hurtTimer:number, onLadder:boolean, onGround:boolean, mineState:number, vy:number, vx:number, jetting:boolean, facing?:number}} p
 * @param {{aimDown:boolean, landing:boolean}} ctx
 */
export function selectClip(p, ctx) {
  if (p.hurtTimer > 0) return 'hurt';
  if (p.onLadder && !p.onGround) return Math.abs(p.vy) > 1 ? 'climb' : 'idle'; // standing still on a ladder looks normal
  if (p.mineState === 1) return ctx.aimDown ? 'mine_down' : 'mine_side';
  if (!p.onGround) return p.jetting ? 'jet' : p.vy < -40 ? 'jump' : 'fall';
  if (ctx.landing) return 'land';
  if (Math.abs(p.vx) <= 10) return 'idle';
  return p.vx * (p.facing || 1) < 0 ? 'walk_back' : 'walk'; // moving against the aim direction = backpedal
}

export class Animator {
  /** @param {import('./Rig.js').Rig} rig @param {Record<string, any>} clips */
  constructor(rig, clips) {
    this.rig = rig; this.clips = clips;
    this.clip = 'idle'; this.t = 0; this.fadeT = FADE;
    this.base = createPose(rig); this.out = createPose(rig);
    this.from = createPose(rig); this.sampled = createPose(rig);
    this.landing = false; this.landVY = 0; this.squashT = 1; this.climbDist = 0;
    this.wasGround = true; this.airVY = 0;
  }

  /**
   * @param {any} p Player @param {number} dt @param {{time:number, aimDown:boolean}} ctx
   * @returns {import('./Rig.js').Pose} valid until the next update; callers may mutate it
   */
  update(p, dt, ctx) {
    if (!p.onGround) this.airVY = Math.max(this.airVY, p.vy);
    if (p.onGround && !this.wasGround) {
      const v = Math.max(p.impactVY, this.airVY);
      if (v > 60) { this.landing = true; this.landVY = v; this.squashT = 0; this.landStart = true; }
    }
    if (p.onGround) this.airVY = 0; else this.landing = false;
    this.wasGround = p.onGround;
    this.squashT += dt;
    if (this.landing && this.clip === 'land' && clipEnded(this.clips.land, this.t + dt)) this.landing = false;

    const name = selectClip(p, { aimDown: ctx.aimDown, landing: this.landing });
    if (name !== this.clip || this.landStart) {
      this.landStart = false;
      this.from.angle.set(this.base.angle); this.from.dx.set(this.base.dx); this.from.dy.set(this.base.dy);
      this.fadeT = name.startsWith('mine_') ? FADE : 0;
      this.clip = name; this.t = 0;
    } else this.t += dt;
    this.fadeT += dt;

    const c = this.clips[name];
    let t;
    if (name === 'walk' || name === 'walk_back') t = ((p.walkPhase / TAU) % 1) * c.duration;
    else if (name.startsWith('mine_')) t = p.swingPhase * c.duration;
    else if (name === 'climb') { this.climbDist += Math.abs(p.vy) * dt; t = (this.climbDist / 24) * c.duration; }
    else if (name === 'idle' || name === 'jet') t = ctx.time;
    else t = this.t;
    sampleClip(c, t, this.rig, this.sampled);
    blendPose(this.from, this.sampled, this.fadeT / FADE, this.base);

    for (const k of /** @type {const} */ (['angle', 'dx', 'dy'])) this.out[k].set(this.base[k]);
    return this.out;
  }
}
