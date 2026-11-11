/**
 * @module entities/Player
 * Explorer movement (walk + jetpack) and the mining state machine (IDLE → SWING → STRIKE).
 */
import { PHYSICS, WORLD, MINING, ENERGY } from '../config.js';
import { EV } from '../core/EventBus.js';

export const MINE_IDLE = 0;
export const MINE_SWING = 1;

export class Player {
  /**
   * @param {{physics:import('../systems/Physics.js').Physics, mining:import('../systems/Mining.js').Mining,
   *   energy:import('../systems/Energy.js').Energy, economy:import('../systems/Economy.js').Economy,
   *   bus:import('../core/EventBus.js').EventBus}} deps
   */
  constructor(deps) {
    this.d = deps;
    this.w = PHYSICS.PLAYER_W;
    this.h = PHYSICS.PLAYER_H;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.prevX = 0; this.prevY = 0;
    this.onGround = false; this.hitX = false; this.hitY = false; this.impactVX = 0; this.impactVY = 0;
    this.facing = 1;
    this.jetting = false;
    this.mineState = MINE_IDLE;
    this.swingTimer = 0;
    this.swingPhase = 0;
    this.target = -1;
    this.aimX = 0; this.aimY = 0;
    this.stepDist = 0;
    this.walkPhase = 0;
    this.spawn();
  }

  /** Place at base camp. */
  spawn() {
    const T = WORLD.TILE_PX;
    this.x = WORLD.BASE_CAMP.SPAWN_X * T + (T - this.w) / 2;
    this.y = WORLD.SURFACE_ROWS * T - this.h;
    this.vx = 0; this.vy = 0;
    this.prevX = this.x; this.prevY = this.y;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h * 0.35; }
  get feetY() { return this.y + this.h; }

  /**
   * @param {number} dt
   * @param {import('../core/Input.js').Input} input
   * @param {number} aimX world px @param {number} aimY world px
   */
  update(dt, input, aimX, aimY) {
    const { physics, mining, energy, economy, bus } = this.d;
    this.prevX = this.x; this.prevY = this.y;
    this.aimX = aimX; this.aimY = aimY;

    // Horizontal
    let dir = 0;
    if (input.isDown('left')) dir -= 1;
    if (input.isDown('right')) dir += 1;
    if (input.padMoveX !== 0) dir = input.padMoveX;
    const target = dir * PHYSICS.WALK_SPEED;
    const accel = this.onGround ? PHYSICS.GROUND_ACCEL : PHYSICS.AIR_ACCEL;
    if (dir !== 0) {
      const dv = target - this.vx;
      const step = accel * dt;
      this.vx += Math.abs(dv) <= step ? dv : Math.sign(dv) * step;
    } else if (this.onGround) {
      const f = PHYSICS.GROUND_FRICTION * dt;
      this.vx = Math.abs(this.vx) <= f ? 0 : this.vx - Math.sign(this.vx) * f;
    }

    // Jetpack + gravity
    const jp = economy.jetpack;
    this.jetting = input.isDown('jet') && energy.value > 0;
    if (this.jetting) {
      this.vy -= jp.thrust * dt;
      if (this.vy < -jp.maxUp) this.vy = -jp.maxUp;
    }
    this.vy += PHYSICS.GRAVITY * dt;
    if (this.vy > PHYSICS.MAX_FALL) this.vy = PHYSICS.MAX_FALL;

    physics.move(this, dt);

    this.facing = aimX >= this.cx ? 1 : -1;

    // Footsteps
    if (this.onGround && Math.abs(this.vx) > 10) {
      this.stepDist += Math.abs(this.vx) * dt;
      this.walkPhase += Math.abs(this.vx) * dt * 0.12;
      if (this.stepDist >= PHYSICS.FOOTSTEP_DIST) {
        this.stepDist = 0;
        const w = physics.world;
        const tx = Math.floor(this.cx / w.T); const ty = Math.floor((this.feetY + 1) / w.T);
        bus.emit(EV.FOOTSTEP, w.inBounds(tx, ty) ? w.tileType[ty * w.W + tx] : 0);
      }
    } else this.stepDist = PHYSICS.FOOTSTEP_DIST * 0.5;

    // Mining state machine
    const pick = economy.pickaxe;
    if (input.isDown('mine')) {
      const t = mining.findTarget(this.cx, this.cy, aimX, aimY);
      if (t >= 0) {
        if (this.mineState === MINE_IDLE || t !== this.target) {
          this.mineState = MINE_SWING;
          this.swingTimer = pick.swing * MINING.FIRST_SWING_FRAC;
          this.target = t;
        }
        this.swingTimer += dt;
        if (this.swingTimer >= pick.swing) {
          this.swingTimer -= pick.swing;
          const res = mining.strike(t, this.cx, this.cy);
          if (res !== 'none') energy.drain(ENERGY.MINING_DRAIN_PER_HIT);
          if (res === 'broken') this.target = -1;
        }
        this.swingPhase = this.swingTimer / pick.swing;
      } else {
        this.mineState = MINE_IDLE; this.target = -1;
        this.swingPhase = Math.max(0, this.swingPhase - dt * 4);
      }
    } else {
      this.mineState = MINE_IDLE; this.target = -1;
      this.swingPhase = Math.max(0, this.swingPhase - dt * 4);
    }
  }

  /** Snap to a position (teleport / rescue / load). */
  placeAt(x, y) {
    this.x = x; this.y = y; this.prevX = x; this.prevY = y; this.vx = 0; this.vy = 0;
  }
}
