/**
 * @module debug/DebugOverlay
 * F3 overlay: FPS, update/render ms, frame-time graph, draw calls, particle/voice counts,
 * chunk rebuilds and quality preset.
 */
import { UI } from '../config.js';

export class DebugOverlay {
  /** @param {HTMLElement} root */
  constructor(root) {
    this.visible = false;
    this.el = document.createElement('div');
    this.el.className = 'debug hidden';
    this.text = document.createElement('pre');
    this.graph = document.createElement('canvas');
    this.graph.width = UI.DEBUG_GRAPH_W; this.graph.height = UI.DEBUG_GRAPH_H;
    this.el.append(this.text, this.graph);
    root.appendChild(this.el);
    this.gctx = /** @type {CanvasRenderingContext2D} */ (this.graph.getContext('2d'));
    this.samples = new Float32Array(UI.DEBUG_GRAPH_W);
    this.head = 0;
    this.textTimer = 0;
  }

  toggle() { this.visible = !this.visible; this.el.classList.toggle('hidden', !this.visible); }

  /**
   * @param {number} dt
   * @param {{fps:number, frameMs:number, updateMs:number, renderMs:number, drawCalls:number, particles:number, particleCap:number,
   *   voices:number, chunkRebuilds:number, totalRebuilds:number, quality:string, seed:number, tile:string}} s
   */
  update(dt, s) {
    this.samples[this.head] = s.frameMs;
    this.head = (this.head + 1) % this.samples.length;
    if (!this.visible) return;
    const g = this.gctx; const W = UI.DEBUG_GRAPH_W; const H = UI.DEBUG_GRAPH_H;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(80,255,160,0.3)'; g.fillRect(0, H - (16.7 / 33.3) * H, W, 1);
    for (let x = 0; x < W; x++) {
      const v = this.samples[(this.head + x) % W];
      const h = Math.min(H, (v / 33.3) * H);
      g.fillStyle = v > 18 ? '#ff6050' : '#50ffa0';
      g.fillRect(x, H - h, 1, h);
    }
    this.textTimer -= dt;
    if (this.textTimer > 0) return;
    this.textTimer = UI.DEBUG_TEXT_INTERVAL;
    this.text.textContent =
      `FPS ${s.fps.toFixed(0)}  frame ${s.frameMs.toFixed(2)} ms\n` +
      `update ${s.updateMs.toFixed(2)} ms  render ${s.renderMs.toFixed(2)} ms\n` +
      `draw calls ${s.drawCalls}\n` +
      `particles ${s.particles}/${s.particleCap}  voices ${s.voices}\n` +
      `chunk rebuilds ${s.chunkRebuilds}/frame (${s.totalRebuilds} total)\n` +
      `quality ${s.quality}  seed ${s.seed}\n${s.tile}`;
  }
}
