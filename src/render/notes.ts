import type { ChartNote } from '../game/types.ts';
import type { Frame } from './frame.ts';
import {
  FAR_DEPTH, NEAR_DEPTH, depthScale, laneCenter, laneWidth, noteDepth, project,
} from './projection.ts';
import type { Layout } from './projection.ts';
import { DEAD_NOTE_COLOR, SURGE_COLOR, drawGlow, laneColor } from './theme.ts';

const NOTE_RADIUS = 0.41;
const NOTE_SQUASH = 0.45;
const NOTE_THICKNESS = 0.4;
/** Half the width of a sustain tail, in highway units. */
const TAIL_HALF_WIDTH = 0.034;
const FADE_IN_RATE = 6;
const STAR_POINTS = 4;
const FULL_TURN = Math.PI * 2;

interface HeadStyle {
  color: string;
  isSurge: boolean;
  alpha: number;
}

function ellipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, FULL_TURN);
}

function drawStar(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  g.beginPath();
  for (let i = 0; i < STAR_POINTS * 2; i += 1) {
    const reach = i % 2 === 0 ? 1 : 0.38;
    const angle = (i / (STAR_POINTS * 2)) * FULL_TURN - Math.PI / 2;
    g.lineTo(x + Math.cos(angle) * rx * reach, y + Math.sin(angle) * ry * reach);
  }
  g.closePath();
  g.fill();
}

function drawHead(g: CanvasRenderingContext2D, layout: Layout, lane: number, depth: number, style: HeadStyle): void {
  const center = project(layout, laneCenter(lane), depth);
  const rx = laneWidth(layout) * NOTE_RADIUS * depthScale(depth);
  const ry = rx * NOTE_SQUASH;
  const top = center.y - ry * NOTE_THICKNESS;
  if (style.isSurge) drawGlow(g, SURGE_COLOR, center.x, top, rx * 1.9, 0.55 * style.alpha);
  g.save();
  g.globalAlpha = style.alpha;
  g.fillStyle = style.color;
  ellipse(g, center.x, center.y, rx, ry);
  g.fill();
  g.fillStyle = 'rgba(0, 0, 0, 0.5)';
  g.fill();
  g.fillStyle = style.color;
  ellipse(g, center.x, top, rx, ry);
  g.fill();
  g.lineWidth = Math.max(1, rx * 0.09);
  g.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  g.stroke();
  g.fillStyle = 'rgba(10, 8, 24, 0.75)';
  ellipse(g, center.x, top, rx * 0.58, ry * 0.58);
  g.fill();
  g.fillStyle = style.isSurge ? SURGE_COLOR : '#ffffff';
  if (style.isSurge) drawStar(g, center.x, top, rx * 0.5, ry * 0.5);
  else {
    ellipse(g, center.x, top, rx * 0.36, ry * 0.36);
    g.fill();
  }
  g.restore();
}

function drawTail(
  g: CanvasRenderingContext2D, layout: Layout, lane: number, from: number, to: number, color: string, isLit: boolean,
): void {
  if (to <= from) return;
  const across = laneCenter(lane);
  const corners = [
    project(layout, across - TAIL_HALF_WIDTH, from),
    project(layout, across + TAIL_HALF_WIDTH, from),
    project(layout, across + TAIL_HALF_WIDTH, to),
    project(layout, across - TAIL_HALF_WIDTH, to),
  ];
  g.save();
  g.globalAlpha = isLit ? 1 : 0.8;
  g.fillStyle = color;
  g.beginPath();
  corners.forEach((corner) => g.lineTo(corner.x, corner.y));
  g.closePath();
  g.fill();
  if (isLit) {
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = 'rgba(255, 255, 255, 0.45)';
    g.fill();
  }
  g.restore();
}

function noteColor(frame: Frame, note: ChartNote): string {
  if (frame.status[note.id] === 'missed') return DEAD_NOTE_COLOR;
  return laneColor(note.lane);
}

function drawNote(g: CanvasRenderingContext2D, layout: Layout, frame: Frame, note: ChartNote): void {
  const { lookahead } = frame.chart;
  const depth = noteDepth(note.time, frame.time, lookahead);
  const endDepth = noteDepth(note.time + note.duration, frame.time, lookahead);
  if (depth > FAR_DEPTH || endDepth < NEAR_DEPTH) return;
  const isHit = frame.status[note.id] === 'hit';
  const isHeld = isHit && frame.holding[note.lane] === true;
  if (note.duration > 0) {
    const from = isHit ? Math.max(0, depth) : Math.max(NEAR_DEPTH, depth);
    const color = isHit && !isHeld ? DEAD_NOTE_COLOR : noteColor(frame, note);
    drawTail(g, layout, note.lane, from, Math.min(FAR_DEPTH, endDepth), color, isHeld);
  }
  if (isHit || depth < NEAR_DEPTH) return;
  drawHead(g, layout, note.lane, depth, {
    color: noteColor(frame, note),
    isSurge: note.phrase >= 0 && frame.status[note.id] === 'pending',
    alpha: Math.min(1, (FAR_DEPTH - depth) * FADE_IN_RATE),
  });
}

/** Draw every note on the highway, far ones first so near ones overlap them. */
export function drawNotes(g: CanvasRenderingContext2D, layout: Layout, frame: Frame): void {
  const { notes } = frame.chart;
  for (let i = notes.length - 1; i >= 0; i -= 1) {
    const note = notes[i];
    if (note) drawNote(g, layout, frame, note);
  }
}
