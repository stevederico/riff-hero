import { SURGE_TO_ACTIVATE } from '../game/scoring.ts';
import type { Frame } from './frame.ts';
import { TOUCH_ZONE_TOP } from './projection.ts';
import type { Layout } from './projection.ts';
import { DIM_TEXT_COLOR, MISS_COLOR, MONO_FONT, SURGE_COLOR, drawGlow, font } from './theme.ts';

const DANGER_LEVEL = 0.25;
/** Meter top and bottom as shares of the screen height. Portrait keeps them above the tap zone. */
const PORTRAIT_SPAN = { top: 0.15, bottom: 0.35 };
const LANDSCAPE_SPAN = { top: 0.42, bottom: 0.8 };
/** Extra touch area around the surge meter, so it is easy to hit. */
const SURGE_TOUCH_MARGIN = { x: 22, y: 20 };
const SURGE_TOUCH_GAP = 6;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Base text size for the HUD, scaled to the screen. */
export function unit(layout: Layout): number {
  return Math.max(11, Math.min(layout.width, layout.height) * 0.03);
}

function meterRect(layout: Layout, side: -1 | 1): Rect {
  const width = layout.isPortrait ? 14 : 16;
  const center = layout.isPortrait
    ? (side < 0 ? 17 : layout.width - 17)
    : layout.centerX + side * (layout.halfWidth + 40);
  const span = layout.isPortrait ? PORTRAIT_SPAN : LANDSCAPE_SPAN;
  const top = layout.height * span.top;
  const bottom = layout.height * span.bottom;
  return { x: center - width / 2, y: top, width, height: bottom - top };
}

/** Screen area of the surge meter. */
export function surgeMeterRect(layout: Layout): Rect {
  return meterRect(layout, 1);
}

/**
 * Touch area for firing surge: the meter plus a margin, kept on screen and clear
 * of the lanes. In portrait it stays above the tap zone; in landscape it stays
 * right of the highway.
 */
export function surgeButtonRect(layout: Layout): Rect {
  const meter = surgeMeterRect(layout);
  const highwayRight = layout.centerX + layout.halfWidth + SURGE_TOUCH_GAP;
  const minLeft = layout.isPortrait ? 0 : highwayRight;
  const left = Math.max(minLeft, meter.x - SURGE_TOUCH_MARGIN.x);
  const right = Math.min(layout.width, meter.x + meter.width + SURGE_TOUCH_MARGIN.x);
  const top = meter.y - SURGE_TOUCH_MARGIN.y;
  const maxBottom = layout.isPortrait ? layout.height * TOUCH_ZONE_TOP - SURGE_TOUCH_GAP : layout.height;
  const bottom = Math.min(maxBottom, meter.y + meter.height + SURGE_TOUCH_MARGIN.y);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function roundRect(g: CanvasRenderingContext2D, rect: Rect): void {
  g.beginPath();
  g.roundRect(rect.x, rect.y, rect.width, rect.height, rect.width / 2);
}

function drawMeterFrame(g: CanvasRenderingContext2D, rect: Rect, label: string, size: number): void {
  roundRect(g, rect);
  g.fillStyle = 'rgba(6, 4, 16, 0.75)';
  g.fill();
  g.lineWidth = 1.5;
  g.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  g.stroke();
  g.fillStyle = DIM_TEXT_COLOR;
  g.font = font(size * 0.62, 700, MONO_FONT);
  g.textAlign = 'center';
  g.textBaseline = 'top';
  g.fillText(label, rect.x + rect.width / 2, rect.y + rect.height + 6);
}

function fillMeter(g: CanvasRenderingContext2D, rect: Rect, level: number, fill: string | CanvasGradient): void {
  g.save();
  roundRect(g, rect);
  g.clip();
  g.fillStyle = fill;
  const height = rect.height * Math.min(1, Math.max(0, level));
  g.fillRect(rect.x, rect.y + rect.height - height, rect.width, height);
  g.restore();
}

/** Crowd meter on the left. Flashes the screen edge red when nearly empty. */
export function drawCrowdMeter(g: CanvasRenderingContext2D, layout: Layout, frame: Frame): void {
  const rect = meterRect(layout, -1);
  const { crowd } = frame.score;
  drawMeterFrame(g, rect, 'CROWD', unit(layout));
  const colors = g.createLinearGradient(0, rect.y + rect.height, 0, rect.y);
  colors.addColorStop(0, MISS_COLOR);
  colors.addColorStop(0.5, '#ffd338');
  colors.addColorStop(1, '#6dff7a');
  fillMeter(g, rect, crowd, colors);
  if (crowd >= DANGER_LEVEL) return;
  const flash = 0.5 + 0.5 * Math.sin(frame.time * 12);
  const edge = g.createRadialGradient(
    layout.centerX, layout.height / 2, layout.height * 0.35,
    layout.centerX, layout.height / 2, layout.height * 0.85,
  );
  edge.addColorStop(0, 'rgba(255, 40, 70, 0)');
  edge.addColorStop(1, `rgba(255, 40, 70, ${0.2 + flash * 0.25})`);
  g.fillStyle = edge;
  g.fillRect(0, 0, layout.width, layout.height);
}

/** Surge meter on the right, with a mark at the level needed to fire it. */
export function drawSurgeMeter(g: CanvasRenderingContext2D, layout: Layout, frame: Frame): void {
  const rect = surgeMeterRect(layout);
  const { score } = frame;
  const centerX = rect.x + rect.width / 2;
  if (score.canActivateSurge || score.isSurgeActive) {
    const throb = 0.6 + 0.4 * Math.sin(frame.time * 8);
    drawGlow(g, SURGE_COLOR, centerX, rect.y + rect.height / 2, rect.height * 0.7, 0.45 * throb);
  }
  drawMeterFrame(g, rect, 'SURGE', unit(layout));
  fillMeter(g, rect, score.surge, score.isSurgeActive ? '#ffffff' : SURGE_COLOR);
  const markY = rect.y + rect.height * (1 - SURGE_TO_ACTIVATE);
  g.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(rect.x - 3, markY);
  g.lineTo(rect.x + rect.width + 3, markY);
  g.stroke();
  if (!score.canActivateSurge) return;
  g.fillStyle = SURGE_COLOR;
  g.font = font(unit(layout) * 0.7, 800, MONO_FONT);
  g.textAlign = 'center';
  g.textBaseline = 'bottom';
  g.fillText(frame.showKeys ? 'SPACE' : 'TAP', centerX, rect.y - 6);
}
