import type { Grade } from '../game/types.ts';

/** Lane colors, left to right. */
export const LANE_COLORS = ['#2fe0ff', '#ff4f9a', '#ffd338', '#6dff7a', '#b47bff'] as const;
export const LANE_KEYS = ['A', 'S', 'D', 'F', 'G'] as const;
export const SURGE_COLOR = '#7df9ff';
export const MISS_COLOR = '#ff5468';
export const DEAD_NOTE_COLOR = '#5a5670';
export const TEXT_COLOR = '#f4f1ff';
export const DIM_TEXT_COLOR = '#a9a3c4';
export const FONT = '"Geist", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const MONO_FONT = '"Geist Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace';

export const GRADE_LABELS: Record<Grade, string> = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD' };
export const GRADE_COLORS: Record<Grade, string> = {
  perfect: '#fff7b0',
  great: '#8dffb4',
  good: '#8fd4ff',
};

/** Color of a lane, falling back to white for an unknown lane. */
export function laneColor(lane: number): string {
  return LANE_COLORS[lane] ?? '#ffffff';
}

/** Canvas font string. */
export function font(size: number, weight = 700, family = FONT): string {
  return `${weight} ${Math.round(size)}px ${family}`;
}

const glowCache = new Map<string, HTMLCanvasElement>();
const GLOW_SIZE = 128;

/** A soft round glow in a color, drawn once and reused as a sprite. */
export function glowSprite(color: string): HTMLCanvasElement {
  const cached = glowCache.get(color);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = GLOW_SIZE;
  canvas.height = GLOW_SIZE;
  const g = canvas.getContext('2d');
  if (g) {
    const half = GLOW_SIZE / 2;
    const gradient = g.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.25, color);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.globalAlpha = 0.9;
    g.fillStyle = gradient;
    g.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE);
  }
  glowCache.set(color, canvas);
  return canvas;
}

/** Draw a glow sprite centered on a point, added on top of what is there. */
export function drawGlow(
  g: CanvasRenderingContext2D, color: string, x: number, y: number, radius: number, alpha: number,
): void {
  if (alpha <= 0 || radius <= 0) return;
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = Math.min(1, alpha);
  g.drawImage(glowSprite(color), x - radius, y - radius, radius * 2, radius * 2);
  g.restore();
}
