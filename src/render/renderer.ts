import { drawBackground } from './background.ts';
import { Effects } from './effects.ts';
import type { Frame } from './frame.ts';
import { drawHighway, drawPads } from './highway.ts';
import { drawHud } from './hud.ts';
import { drawNotes } from './notes.ts';
import { computeLayout } from './projection.ts';
import type { Layout } from './projection.ts';

const MAX_PIXEL_RATIO = 2;
const SHAKE_PIXELS = 7;

/** Draws the game onto a canvas that fills the window. */
export class Renderer {
  readonly effects = new Effects();
  layout: Layout;
  private readonly g: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const g = canvas.getContext('2d', { alpha: false });
    if (!g) throw new Error('This browser cannot draw on a canvas.');
    this.g = g;
    this.layout = computeLayout(1, 1);
    this.resize();
  }

  /** Match the canvas to the window. Call when the window changes size. */
  resize(): void {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const ratio = Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.g.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.layout = computeLayout(width, height);
  }

  /** Draw one frame. `seconds` is the time since the last frame. */
  draw(frame: Frame, seconds: number): void {
    const { g, layout, effects } = this;
    effects.isReducedMotion = frame.reducedMotion;
    effects.update(seconds);
    drawBackground(g, layout, frame);
    g.save();
    if (effects.shake > 0) {
      const reach = effects.shake * SHAKE_PIXELS;
      g.translate((Math.random() - 0.5) * reach, (Math.random() - 0.5) * reach);
    }
    drawHighway(g, layout, frame);
    drawPads(g, layout, frame);
    drawNotes(g, layout, frame);
    effects.draw(g, layout);
    g.restore();
    if (frame.showHud) drawHud(g, layout, frame);
  }
}
