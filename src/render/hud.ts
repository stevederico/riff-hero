import type { Frame } from './frame.ts';
import { drawCrowdMeter, drawSurgeMeter, unit } from './meters.ts';
import type { Layout } from './projection.ts';
import { DIM_TEXT_COLOR, MONO_FONT, SURGE_COLOR, TEXT_COLOR, drawGlow, font } from './theme.ts';

const STAR_COUNT = 5;
const STAR_COLOR = '#ffd338';
const TITLE_SECONDS = 3.5;
const FULL_TURN = Math.PI * 2;

function drawStarShape(g: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  const points = 5;
  g.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const reach = i % 2 === 0 ? radius : radius * 0.45;
    const angle = (i / (points * 2)) * FULL_TURN - Math.PI / 2;
    g.lineTo(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
  }
  g.closePath();
}

function drawScore(g: CanvasRenderingContext2D, layout: Layout, frame: Frame): void {
  const size = unit(layout);
  const left = 16;
  const top = 18;
  g.textAlign = 'left';
  g.textBaseline = 'top';
  g.fillStyle = DIM_TEXT_COLOR;
  g.font = font(size * 0.62, 700, MONO_FONT);
  g.fillText('SCORE', left, top);
  g.fillStyle = TEXT_COLOR;
  g.font = font(size * 1.5, 800, MONO_FONT);
  g.fillText(Math.round(frame.score.score).toLocaleString('en-US'), left, top + size * 0.8);
  const radius = size * 0.42;
  for (let i = 0; i < STAR_COUNT; i += 1) {
    drawStarShape(g, left + radius + i * radius * 2.4, top + size * 3, radius);
    g.fillStyle = i < frame.score.stars ? STAR_COLOR : 'rgba(255, 255, 255, 0.16)';
    g.fill();
  }
}

function drawCombo(g: CanvasRenderingContext2D, layout: Layout, frame: Frame): void {
  const size = unit(layout);
  const { score } = frame;
  const y = layout.height * (layout.isPortrait ? 0.15 : 0.11);
  const color = score.isSurgeActive ? SURGE_COLOR : TEXT_COLOR;
  if (score.multiplier > 1) drawGlow(g, color, layout.centerX, y, size * 3.2, 0.3);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.font = font(size * 2.3, 800, MONO_FONT);
  g.fillText(`x${score.multiplier}`, layout.centerX, y);
  if (score.combo < 2) return;
  g.fillStyle = DIM_TEXT_COLOR;
  g.font = font(size * 0.75, 700, MONO_FONT);
  g.fillText(`${score.combo} COMBO`, layout.centerX, y + size * 1.9);
}

function drawProgress(g: CanvasRenderingContext2D, layout: Layout, frame: Frame): void {
  const share = Math.min(1, Math.max(0, frame.time / frame.chart.duration));
  g.fillStyle = 'rgba(255, 255, 255, 0.12)';
  g.fillRect(0, 0, layout.width, 4);
  g.fillStyle = `hsl(${frame.song.theme.hueAlt} 100% 65%)`;
  g.fillRect(0, 0, layout.width * share, 4);
}

function drawTitle(g: CanvasRenderingContext2D, layout: Layout, frame: Frame): void {
  if (frame.time > TITLE_SECONDS) return;
  const size = unit(layout);
  const y = layout.height * (layout.isPortrait ? 0.27 : 0.24);
  g.globalAlpha = Math.min(1, TITLE_SECONDS - frame.time);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = TEXT_COLOR;
  g.font = font(size * 1.2, 800);
  g.fillText(frame.song.title, layout.centerX, y);
  g.fillStyle = DIM_TEXT_COLOR;
  g.font = font(size * 0.7, 600);
  g.fillText(`${frame.song.artist}  /  ${frame.chart.difficulty.toUpperCase()}`, layout.centerX, y + size * 1.3);
  g.globalAlpha = 1;
}

/** Score, combo, meters and song progress. Drawn last. */
export function drawHud(g: CanvasRenderingContext2D, layout: Layout, frame: Frame): void {
  drawCrowdMeter(g, layout, frame);
  drawSurgeMeter(g, layout, frame);
  drawScore(g, layout, frame);
  drawCombo(g, layout, frame);
  drawTitle(g, layout, frame);
  drawProgress(g, layout, frame);
}
