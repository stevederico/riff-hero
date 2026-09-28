import { beatSeconds } from '../game/timing.ts';
import { LANE_COUNT } from '../game/types.ts';
import type { Frame } from './frame.ts';
import {
  FAR_DEPTH, NEAR_DEPTH, depthScale, laneCenter, laneWidth, noteDepth, project,
} from './projection.ts';
import type { Layout } from './projection.ts';
import { LANE_KEYS, MONO_FONT, SURGE_COLOR, drawGlow, font, laneColor } from './theme.ts';

const BEATS_PER_BAR = 4;
const PAD_RADIUS = 0.4;
const PAD_SQUASH = 0.42;
/** Highway position of the boundary left of a lane. Lane 5 is the right edge. */
const laneEdge = (lane: number): number => (lane / LANE_COUNT) * 2 - 1;

function tracePath(g: CanvasRenderingContext2D, layout: Layout, corners: Array<[number, number]>): void {
  g.beginPath();
  corners.forEach(([across, depth], i) => {
    const point = project(layout, across, depth);
    if (i === 0) g.moveTo(point.x, point.y);
    else g.lineTo(point.x, point.y);
  });
  g.closePath();
}

function drawSurface(g: CanvasRenderingContext2D, layout: Layout, frame: Frame): void {
  const top = project(layout, 0, FAR_DEPTH).y;
  const surface = g.createLinearGradient(0, top, 0, layout.height);
  const tint = frame.score.isSurgeActive ? '190 90% 16%' : '258 45% 9%';
  surface.addColorStop(0, `hsla(${tint} / 0.35)`);
  surface.addColorStop(0.3, `hsla(${tint} / 0.9)`);
  surface.addColorStop(1, `hsla(${tint} / 0.97)`);
  g.fillStyle = surface;
  tracePath(g, layout, [[-1, FAR_DEPTH], [1, FAR_DEPTH], [1, NEAR_DEPTH], [-1, NEAR_DEPTH]]);
  g.fill();
}

function drawPressedLanes(g: CanvasRenderingContext2D, layout: Layout, frame: Frame): void {
  frame.pressed.forEach((isPressed, lane) => {
    if (!isPressed) return;
    const top = project(layout, 0, 0.6).y;
    const glow = g.createLinearGradient(0, layout.strikeY, 0, top);
    glow.addColorStop(0, `${laneColor(lane)}66`);
    glow.addColorStop(1, `${laneColor(lane)}00`);
    g.fillStyle = glow;
    tracePath(g, layout, [
      [laneEdge(lane), 0.6], [laneEdge(lane + 1), 0.6], [laneEdge(lane + 1), 0], [laneEdge(lane), 0],
    ]);
    g.fill();
  });
}

function drawLaneLines(g: CanvasRenderingContext2D, layout: Layout, frame: Frame): void {
  for (let lane = 0; lane <= LANE_COUNT; lane += 1) {
    const isRail = lane === 0 || lane === LANE_COUNT;
    const far = project(layout, laneEdge(lane), FAR_DEPTH);
    const near = project(layout, laneEdge(lane), NEAR_DEPTH);
    g.strokeStyle = isRail ? railColor(frame) : 'rgba(255, 255, 255, 0.13)';
    g.lineWidth = isRail ? 3 : 1;
    g.beginPath();
    g.moveTo(far.x, far.y);
    g.lineTo(near.x, near.y);
    g.stroke();
  }
}

function railColor(frame: Frame): string {
  if (frame.score.isSurgeActive) return SURGE_COLOR;
  return `hsl(${frame.song.theme.hue} 100% 70%)`;
}

function drawBeatLines(g: CanvasRenderingContext2D, layout: Layout, frame: Frame): void {
  const beat = beatSeconds(frame.song.bpm);
  const first = Math.max(0, Math.ceil(frame.time / beat));
  const last = Math.floor((frame.time + frame.chart.lookahead) / beat);
  for (let index = first; index <= last; index += 1) {
    const depth = noteDepth(index * beat, frame.time, frame.chart.lookahead);
    const isBar = index % BEATS_PER_BAR === 0;
    const left = project(layout, -1, depth);
    const right = project(layout, 1, depth);
    const fade = Math.min(1, (FAR_DEPTH - depth) * 5);
    g.strokeStyle = `rgba(255, 255, 255, ${(isBar ? 0.4 : 0.14) * fade})`;
    g.lineWidth = (isBar ? 3 : 1.5) * depthScale(depth);
    g.beginPath();
    g.moveTo(left.x, left.y);
    g.lineTo(right.x, right.y);
    g.stroke();
  }
}

function drawPad(g: CanvasRenderingContext2D, layout: Layout, frame: Frame, lane: number): void {
  const center = project(layout, laneCenter(lane), 0);
  const isDown = frame.pressed[lane] === true;
  const radius = laneWidth(layout) * PAD_RADIUS * (isDown ? 0.92 : 1);
  const color = laneColor(lane);
  if (isDown || frame.holding[lane]) drawGlow(g, color, center.x, center.y, radius * 2.2, 0.7);
  g.beginPath();
  g.ellipse(center.x, center.y, radius, radius * PAD_SQUASH, 0, 0, Math.PI * 2);
  g.fillStyle = isDown ? color : 'rgba(8, 6, 18, 0.85)';
  g.fill();
  g.lineWidth = Math.max(2.5, radius * 0.12);
  g.strokeStyle = color;
  g.stroke();
  g.beginPath();
  g.ellipse(center.x, center.y, radius * 0.55, radius * 0.55 * PAD_SQUASH, 0, 0, Math.PI * 2);
  g.strokeStyle = isDown ? 'rgba(255, 255, 255, 0.9)' : `${color}88`;
  g.lineWidth = 1.5;
  g.stroke();
  if (!frame.showKeys) return;
  g.fillStyle = isDown ? '#0a0818' : 'rgba(255, 255, 255, 0.85)';
  g.font = font(radius * 0.42, 700, MONO_FONT);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(LANE_KEYS[lane] ?? '', center.x, center.y + 1);
}

/** The road surface, lane lines and scrolling beat lines. Drawn under the notes. */
export function drawHighway(g: CanvasRenderingContext2D, layout: Layout, frame: Frame): void {
  drawSurface(g, layout, frame);
  drawPressedLanes(g, layout, frame);
  drawBeatLines(g, layout, frame);
  drawLaneLines(g, layout, frame);
  const left = project(layout, -1, 0);
  const right = project(layout, 1, 0);
  g.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(left.x, left.y);
  g.lineTo(right.x, right.y);
  g.stroke();
}

/** The five strike pads. */
export function drawPads(g: CanvasRenderingContext2D, layout: Layout, frame: Frame): void {
  for (let lane = 0; lane < LANE_COUNT; lane += 1) drawPad(g, layout, frame, lane);
}
