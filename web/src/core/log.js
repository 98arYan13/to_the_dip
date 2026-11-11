/**
 * @module core/log
 * Debug logger gated by DEBUG.LOG (or `?debug` in the URL). No console spam in normal play.
 */
import { DEBUG } from '../config.js';

let enabled = DEBUG.LOG;
try {
  if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) enabled = true;
} catch { /* not in a browser */ }

/** @param {...any} args */
export function log(...args) {
  if (enabled) console.log('[depths]', ...args);
}

/** @param {...any} args */
export function warn(...args) {
  if (enabled) console.warn('[depths]', ...args);
}

export function setLogging(on) { enabled = !!on; }
