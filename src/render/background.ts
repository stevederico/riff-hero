import { beatPulse } from './frame.ts';
import type { Frame } from './frame.ts';
import { FAR_DEPTH, project } from './projection.ts';
import type { Layout } from './projection.ts';
import { drawGlow } from './theme.ts';

const BEAM_COUNT = 6;
const SPECK_COUNT = 60;
const SURGE_HUE = 188;
const CROWD_ROWS = 3;
const HEADS_PER_ROW = 26;

/** Cheap repeatable noise from an index, 0 to 1. */
function hash(index: number): number {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function drawSky(g: CanvasRenderingContext2D, layout: Layout, hue: number, pulse: number): void {
  const sky = g.createLinearGradient(0, 0, 0, layout.height);
  sky.addColorStop(0, `hsl(${hue} 65% ${5 + pulse * 2}%)`);
  sky.addColorStop(0.45, `hsl(${hue} 70% ${11 + pulse * 5}%)`);
  sky.addColorStop(1, 'hsl(260 60% 3%)');
  g.fillStyle = sky;
  g.fillRect(0, 0, layout.width, layout.height);
}

function drawSpecks(g: CanvasRenderingContext2D, layout: Layout, frame: Frame): void {
  g.fillStyle = '#ffffff';
  for (let i = 0; i < SPECK_COUNT; i += 1) {
    const drift = frame.reducedMotion ? 0 : frame.time * (4 + hash(i + 200) * 8);
    const x = (hash(i) * layout.width + drift) % layout.width;
    const y = hash(i + 100) * layout.height * 0.55;
    const twinkle = 0.5 + 0.5 * Math.sin(frame.time * 2 + i);
    g.globalAlpha = 0.15 + 0.35 * twinkle * hash(i + 300);
    g.fillRect(x, y, 2, 2);
  }
  g.globalAlpha = 1;
}

function drawBeams(g: CanvasRenderingContext2D, layout: Layout, frame: Frame, hues: number[], pulse: number): void {
  g.save();
  g.globalCompositeOperation = 'lighter';
  const reach = layout.height * 0.9;
  for (let i = 0; i < BEAM_COUNT; i += 1) {
    const originX = (layout.width * (i + 0.5)) / BEAM_COUNT;
    const sway = frame.reducedMotion ? 0 : Math.sin(frame.time * 0.7 + i * 1.9) * 0.35;
    const angle = (i - (BEAM_COUNT - 1) / 2) * 0.12 + sway;
    const spread = layout.width * 0.07;
    const endX = originX + Math.sin(angle) * reach;
    const beam = g.createLinearGradient(originX, 0, endX, reach);
    const hue = hues[i % hues.length] ?? 0;
    beam.addColorStop(0, `hsla(${hue} 100% 65% / ${0.2 + pulse * 0.16})`);
    beam.addColorStop(1, `hsla(${hue} 100% 60% / 0)`);
    g.fillStyle = beam;
    g.beginPath();
    g.moveTo(originX - 4, -10);
    g.lineTo(originX + 4, -10);
    g.lineTo(endX + spread, reach);
    g.lineTo(endX - spread, reach);
    g.closePath();
    g.fill();
  }
  g.restore();
}

/** Rows of bobbing heads along the horizon. They jump higher when the crowd is happy. */
function drawCrowd(g: CanvasRenderingContext2D, layout: Layout, frame: Frame, pulse: number): void {
  const horizon = project(layout, 0, FAR_DEPTH).y;
  const mood = frame.score.crowd;
  for (let row = 0; row < CROWD_ROWS; row += 1) {
    const size = layout.width / HEADS_PER_ROW / (1.5 - row * 0.2);
    const baseY = horizon + row * size * 0.5;
    g.fillStyle = `hsl(260 40% ${4 + row * 2.5}%)`;
    for (let i = -1; i <= HEADS_PER_ROW * 1.6; i += 1) {
      const x = (i + hash(i + row * 50) * 0.6) * size * 1.25;
      const jump = frame.reducedMotion ? 0 : pulse * mood * size * (0.3 + hash(i * 3 + row) * 0.7);
      g.beginPath();
      g.arc(x, baseY - jump, size * 0.55, 0, Math.PI * 2);
      g.fill();
    }
    g.fillRect(0, baseY, layout.width, layout.height - baseY);
  }
}

/** Stage backdrop: sky, light beams, specks and the crowd. */
export function drawBackground(g: CanvasRenderingContext2D, layout: Layout, frame: Frame): void {
  const pulse = frame.reducedMotion ? 0 : beatPulse(frame);
  const isSurging = frame.score.isSurgeActive;
  const hue = isSurging ? SURGE_HUE : frame.song.theme.hue;
  const hueAlt = isSurging ? SURGE_HUE + 40 : frame.song.theme.hueAlt;
  drawSky(g, layout, hue, pulse);
  drawSpecks(g, layout, frame);
  drawBeams(g, layout, frame, [hue, hueAlt], pulse);
  const horizon = project(layout, 0, FAR_DEPTH);
  drawGlow(g, `hsl(${hueAlt} 100% 60%)`, horizon.x, horizon.y, layout.halfWidth * (1.1 + pulse * 0.2), 0.5);
  drawCrowd(g, layout, frame, pulse);
}
