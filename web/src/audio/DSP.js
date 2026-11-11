/**
 * @module audio/DSP
 * Procedural noise buffers, impulse responses and waveshaper curves.
 */
import { mulberry32 } from '../core/RNG.js';

/**
 * Stereo noise buffer.
 * @param {BaseAudioContext} ctx @param {'white'|'pink'|'brown'} kind @param {number} seconds
 */
export function makeNoiseBuffer(ctx, kind, seconds, seed = 1) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  const rnd = mulberry32(seed);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = rnd() * 2 - 1;
      if (kind === 'white') d[i] = w * 0.5;
      else if (kind === 'pink') {
        // Paul Kellet's refined pink filter
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
  }
  return buf;
}

/**
 * Exponentially decaying stereo noise impulse response.
 * @param {BaseAudioContext} ctx @param {number} seconds @param {number} decay
 */
export function makeImpulse(ctx, seconds, decay, seed = 7) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  const rnd = mulberry32(seed);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

/** tanh soft-clip curve. */
export function softClipCurve(amount, n = 2048) {
  const c = new Float32Array(n);
  const norm = Math.tanh(amount);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * amount) / norm;
  }
  return c;
}

/** Hard-ish distortion curve for the dynamite boom. */
export function distortionCurve(k, n = 2048) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return c;
}

export const dbToGain = (db) => Math.pow(10, db / 20);
export const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
