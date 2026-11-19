/**
 * @module entities/Player
 * Explorer movement (walk + jetpack) and the mining state machine (IDLE → SWING → STRIKE).
 */
import { PHYSICS, WORLD, MINING, TILE, GEAR, planetGravity } from '../config.js';
import { EV } from '../core/EventBus.js';
import { defaultOutfit } from '../anim/Outfit.js';

export const MINE_IDLE = 0;

/**
 * Damage = max(5, round((fallenTiles - threshold) * 18 * sqrt(fallMult))), or 0 below the threshold.
 */
export function hardLandingDamage(fallenTiles, threshold, fallMult, planetG = 1) {
  if (fallenTiles <= threshold) return 0;
  return Math.max(PHYSICS.HARD_LANDING_MIN_DMG, Math.round((fallenTiles - threshold) * PHYSICS.HARD_LANDING_DMG_PER_TILE * Math.sqrt(fallMult) * planetG));
}

/** Contact temperature (°C) of a tile type at depth01 (0..1), or 0 if not hot. Magma channels get hotter with depth. */
export function tileHeat(type, depth01) {
  if (type === TILE.MAGMA) return PHYSICS.MAGMA_T0 + (PHYSICS.MAGMA_T1 - PHYSICS.MAGMA_T0) * depth01;
  return type === TILE.CORE ? PHYSICS.CORE_T : 0;
}

/** Ambient air/rock temperature (°C) at depth01; past HEAT_SAFE_T in the deep layers, so the depths burn slowly too. */
export function ambientTemp(depth01) {
  return GEAR.AMBIENT_T0 + (GEAR.AMBIENT_T1 - GEAR.AMBIENT_T0) * depth01;
}

/** Suit HP lost per second at a temperature; `resist` (0..1) is the heat-suit protection. */
export function heatDps(tempC, resist = 0) {
  return Math.max(0, tempC - PHYSICS.HEAT_SAFE_T) * PHYSICS.HEAT_DPS_PER_C * (1 - resist);
}

/** Magma is only safe to stand in/on with magma boots. */
export function canStandOn(type, boots) {
  return type !== TILE.MAGMA || boots;
}
export const MINE_SWING = 1;

/** Launch speed (px/s, positive) that peaks `heightPx` high under `gravity`. */
export function jumpVelocity(heightPx, gravity) {
  return Math.sqrt(2 * gravity * heightPx);
}

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
    /** Set by main.js while a pulse storm has electronics offline. */ this.gearOffline = false;
    this.onLadder = false;
    this.hurtTimer = 0;
    this.mineState = MINE_IDLE;
    this.swingTimer = 0;
    this.swingPhase = 0;
    this.flat = false;
    this.target = -1;
    this.aimX = 0; this.aimY = 0;
    this.stepDist = 0;
    this.walkPhase = 0;
    this.outfit = defaultOutfit();
    this.hp = PHYSICS.SUIT_HP;
    /** Set from settings. */
    this.fallMult = 1;
    this.hardLandingTiles = 5;
    /** Downward distance fallen without jetpack braking (px). */
    this.unbrakedFallPx = 0;
    this.spawn();
  }

  /** Place at base camp. */
  spawn() {
    const T = WORLD.TILE_PX;
    this.x = WORLD.BASE_CAMP.SPAWN_X * T + (T - this.w) / 2;
    this.unbrakedFallPx = 0;
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
    const slow = economy.speedMult;
    const target = dir * PHYSICS.WALK_SPEED * slow;
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
    const w0 = physics.world; const ptx = Math.floor(this.cx / w0.T); const pty = Math.floor(this.cy / w0.T);
    // Centre OR feet cell: at the top rung the centre leaves the ladder first, which would strand the feet below the ledge.
    const ftY = Math.floor((this.feetY - 1) / w0.T);
    const isLadder = (ty) => w0.inBounds(ptx, ty) && w0.tileType[ty * w0.W + ptx] === TILE.LADDER;
    const onLadder = isLadder(pty) || isLadder(ftY);
    this.onLadder = onLadder;
    if (this.hurtTimer > 0) this.hurtTimer -= dt;
    if (this.onGround && !onLadder && input.wasPressed('jet')) this.vy = -jumpVelocity(PHYSICS.JUMP_H, PHYSICS.GRAVITY * this.fallMult * planetGravity(economy.planet));
    this.jetting = economy.hasJetpack && !this.gearOffline && !onLadder && input.isDown('jet') && energy.value > 0;
    if (this.jetting) {
      this.vy -= economy.stat('jetThrust', jp.thrust) * dt;
      if (this.vy < -jp.maxUp * slow) this.vy = -jp.maxUp * slow;
    }
    const pg = planetGravity(economy.planet), grav = PHYSICS.GRAVITY * this.fallMult * pg;
    this.vy += grav * dt;
    const maxFall = PHYSICS.MAX_FALL * Math.sqrt(this.fallMult * pg);
    if (this.vy > maxFall) this.vy = maxFall;
    if (onLadder) {
      this.vy = (input.isDown('jet') ? -1 : input.isDown('down') ? 1 : 0) * PHYSICS.LADDER_SPEED;
      this.unbrakedFallPx = 0;
      this.climbAcc = (this.climbAcc || 0) + Math.abs(this.vy) * dt;
      if (this.climbAcc >= PHYSICS.LADDER_STEP_DIST) { this.climbAcc = 0; bus.emit(EV.LADDER_STEP); }
    }

    const yBefore = this.y;
    physics.move(this, dt);
    this._trackFall(this.y - yBefore, grav);

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
    const tool = economy.toolDef;
    const swing = pick.swing * (tool ? tool.swingMul : 1) / slow;
    this.flat = false; // powered tool held on an empty battery: the renderer shows it dead
    if (input.isDown('mine')) {
      const t = mining.findTarget(this.cx, this.cy, aimX, aimY);
      if (t >= 0) {
        if (this.mineState === MINE_IDLE || t !== this.target) {
          this.mineState = MINE_SWING;
          this.swingTimer = swing * MINING.FIRST_SWING_FRAC;
          this.target = t;
        }
        const flat = (pick.powered || !!tool?.hitEnergy) && (energy.value < 0.5 || this.gearOffline);
        this.flat = flat;
        if (flat) {
          if (!this.flatHinted) { this.flatHinted = true; bus.emit(EV.HINT, this.gearOffline ? 'Electronics offline' : 'Drill battery empty — recharge at the station'); }
        } else { this.flatHinted = false; this.swingTimer += dt; }
        if (this.swingTimer >= swing) {
          this.swingTimer -= swing;
          bus.emit(EV.SWING, { tool: economy.tool, dur: swing });
          // Energy: a tool with hitEnergy pays per tile struck (and nothing more); otherwise a powered pickaxe pays once per break.
          const pay = (r) => {
            if (r === 'blocked' || r === 'none') return false;
            const h = mining.hit;
            if (tool?.hitEnergy) energy.drainBlock(h.type, h.ore, tool.hitEnergy);
            else if (pick.powered && r === 'broken') energy.drainBlock(h.type, h.ore);
            return true;
          };
          const res = mining.strike(t, this.cx, this.cy);
          const { x: x0, y: y0, nx, ny } = mining.hit;
          if (pay(res) && tool?.bore) { // cone drill: carry on into the solid tiles behind, straight along the strike axis
            const w = mining.world;
            for (let k = 1; k < tool.bore; k++) {
              const x = x0 - nx * k; const y = y0 - ny * k;
              if (!w.inBounds(x, y) || !pay(mining.strike(y * w.W + x, this.cx, this.cy))) break;
            }
          }
          if (res === 'broken') this.target = -1;
        }
        this.swingPhase = this.swingTimer / swing;
      } else {
        this.mineState = MINE_IDLE; this.target = -1;
        this.swingPhase = Math.max(0, this.swingPhase - dt * 4);
      }
    } else {
      this.mineState = MINE_IDLE; this.target = -1;
      this.swingPhase = Math.max(0, this.swingPhase - dt * 4);
    }
  }

  /**
   * Unbraked free-fall bookkeeping and hard-landing damage.
   * @param {number} dy px moved this step @param {number} grav px/s²
   */
  _trackFall(dy, grav) {
    if (this.jetting) {
      // Braking sheds fall distance down to the kinetic equivalent v²/2g.
      const kin = this.vy > 0 ? (this.vy * this.vy) / (2 * grav) : 0;
      this.unbrakedFallPx = Math.min(this.unbrakedFallPx, kin);
    } else if (dy > 0 && !this.onGround) this.unbrakedFallPx += dy;
    if (!this.onGround) return;
    const tiles = (this.unbrakedFallPx + Math.max(0, dy)) / WORLD.TILE_PX;
    this.unbrakedFallPx = 0;
    const dmg = Math.round(hardLandingDamage(tiles, this.hardLandingTiles, this.fallMult, planetGravity(this.d.economy.planet)) * this.d.economy.stat('fallDamage', 1));
    if (dmg > 0) {
      this.d.bus.emit(EV.HARD_LANDING, { damage: dmg, tiles, vy: this.impactVY });
      this.setHP(this.hp - dmg);
    }
  }

  /**
   * Suit heat damage from the hottest tile touching the body (1px margin so solid core rock burns on contact).
   * @param {number} dt @param {import('../world/World.js').World} world @param {number} depth01
   */
  burn(dt, world, depth01) {
    const T = WORLD.TILE_PX;
    const { economy } = this.d;
    const boots = economy.tech.includes('magma_boots');
    const footRow = Math.floor((this.y + this.h - 1) / T);
    let temp = 0;
    for (let ty = Math.floor((this.y - 1) / T); ty <= Math.floor((this.y + this.h + 1) / T); ty++) {
      for (let tx = Math.floor((this.x - 1) / T); tx <= Math.floor((this.x + this.w + 1) / T); tx++) {
        if (!world.inBounds(tx, ty)) continue;
        const type = world.tileType[ty * world.W + tx];
        if (type === TILE.MAGMA && ty >= footRow && canStandOn(type, boots)) continue; // boots: magma underfoot is harmless
        const h = tileHeat(type, depth01);
        if (h > 0) temp = Math.max(temp, h + ambientTemp(depth01));
      }
    }
    this.temp = Math.max(temp, ambientTemp(depth01));
    this.burnAcc = (this.burnAcc || 0) + heatDps(this.temp, economy.stat('heatResist', 0)) * dt;
    this.burnFlinch = (this.burnFlinch || 0) - dt;
    if (this.burnAcc >= 1) {
      const d = Math.floor(this.burnAcc); this.burnAcc -= d;
      // heat ticks every few frames: flinch at most once a second, or the hurt clip would lock out every other pose
      const flinch = this.burnFlinch <= 0; if (flinch) this.burnFlinch = 1;
      this.setHP(this.hp - d, flinch);
    }
  }

  /** @param {number} hp @param {boolean} [flinch] play the hurt animation on damage */
  setHP(hp, flinch = true) {
    const was = this.hp;
    if (this.god && hp < was) return; // god mode: damage has no effect
    this.hp =Math.max(0, Math.min(PHYSICS.SUIT_HP, hp));
    if (this.hp < was && flinch) this.hurtTimer = 0.3; // drives the hurt animation
    if (this.hp !== was) this.d.bus.emit(EV.HP_CHANGED, this.hp);
    if (this.hp <= 0 && was > 0) this.d.bus.emit(EV.PLAYER_DEAD, 'suit');
  }

  /** Instant death by a hazard. @param {string} cause */
  die(cause) { if (!this.god && this.hp > 0) { this.hp = 0; this.d.bus.emit(EV.HP_CHANGED, 0); this.d.bus.emit(EV.PLAYER_DEAD, cause); } }

  /** Snap to a position (teleport / rescue / load). */
  placeAt(x, y) {
    this.x = x; this.y = y; this.prevX = x; this.prevY = y; this.vx = 0; this.vy = 0;
    this.unbrakedFallPx = 0;
  }
}
