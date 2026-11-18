/**
 * @module audio/Director
 * Pure state machine (idle -> playing -> gap) deciding when pieces start, fade and when Signal phrases play.
 * No Web Audio, no Math.random: pass an rng. `update` returns commands for Music to execute.
 */
import { MUSIC, themeFor, zoneOf } from './musicThemes.js';

const LEAD = 1; // plan this many seconds before a start so the scheduler can queue it

export class MusicDirector {
  /** @param {() => number} rng @param {{ composePiece:Function, composeFinale?:Function, composeEnding?:Function, signalPhrase?:Function }} fns */
  constructor(rng, fns) {
    this.rng = rng; this.fns = fns;
    this.phase = 'idle'; this.piece = null; this.prev = null; this.theme = null;
    this.at = 0; this.endsAt = 0; this.nextAt = 0;
    this.fading = false; this.switchGap = false; this.diffSince = null; this.lastSignal = -Infinity;
    this.finale = false; this.done = false;
  }

  /** @param {number} now @param {{ planet?:string, depth01?:number, onSurface?:boolean, nearRuin?:boolean, relics?:number, finaleLevel?:number }} ctx */
  update(now, ctx = {}) {
    if (this.done) return [];
    const out = [], f = this.fns, lvl = ctx.finaleLevel || 0;
    const zone = zoneOf(ctx.depth01, ctx.onSurface), theme = themeFor(ctx.planet, zone);
    const start = (at, piece, th) => { this.piece = piece; this.theme = th; this.at = at; this.endsAt = at + piece.duration; this.fading = false; this.phase = 'playing'; this.diffSince = null; out.push({ type: 'play', piece, at }); };
    const fade = (at, sec) => { out.push({ type: 'fade', at, sec }); this.fading = true; this.endsAt = at + sec; };

    if (lvl === 4 && f.composeEnding) {
      if (this.phase === 'playing' && !this.fading) fade(now, 2);
      start(now + 2, f.composeEnding(), theme); this.done = true;
      return out;
    }
    const inFinale = lvl >= 1 && lvl <= 3 && !!f.composeFinale;
    if (inFinale && !this.finale) {
      if (this.phase === 'playing' && !this.fading) fade(now, 2);
      else if (this.phase === 'gap') this.nextAt = Math.min(this.nextAt, now + 2);
    }
    this.finale = inFinale;

    if (this.phase === 'idle') start(now + MUSIC.FIRST_DELAY, this.compose(theme, ctx, null), theme);
    else if (this.phase === 'playing') {
      if (!this.fading && !this.finale && this.piece.themeId !== theme.id) {
        this.diffSince ??= now;
        if (now - this.diffSince >= MUSIC.SWITCH_HOLD) {
          const el = now - this.at, sec = this.piece.sections.find((s) => el < s.t1) ?? this.piece.sections.at(-1);
          fade(Math.max(now, this.at + sec.t1), MUSIC.FADE_OUT); this.switchGap = true;
        }
      } else this.diffSince = null;
      if (!this.fading && ctx.nearRuin && f.signalPhrase) {
        const bar = this.piece.barSec, at = this.at + Math.ceil(Math.max(0, now - this.at) / bar) * bar;
        if (at < this.endsAt && at - this.lastSignal >= MUSIC.SIGNAL_GAP_SEC) {
          this.lastSignal = at;
          out.push({ type: 'phrase', events: f.signalPhrase(this.theme, ctx.relics || 0, this.piece), at });
        }
      }
      if (now >= this.endsAt - LEAD) {
        const [lo, hi] = zone === 'camp' ? MUSIC.CAMP_GAP_SEC : MUSIC.GAP_SEC;
        const gap = this.finale ? 0 : this.switchGap ? MUSIC.SWITCH_GAP_SEC : lo + this.rng() * (hi - lo);
        this.nextAt = this.endsAt + gap; this.switchGap = false; this.phase = 'gap'; this.prev = this.piece;
      }
    }
    if (this.phase === 'gap' && now >= this.nextAt - LEAD) start(this.nextAt, this.compose(theme, ctx, this.prev), theme);
    return out;
  }

  compose(theme, ctx, prev) {
    if (this.finale) return this.fns.composeFinale(ctx.finaleLevel, this.rng);
    const avoid = prev ? { motif: prev.firstMotif, progression: prev.firstProgression } : undefined;
    return this.fns.composePiece(theme, { depth01: ctx.depth01, avoid }, this.rng);
  }
}
