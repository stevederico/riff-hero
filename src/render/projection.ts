import { LANE_COUNT } from '../game/types.ts';

/** How strongly the highway narrows with distance. */
export const PERSPECTIVE = 2.4;
/** Depth of the far end of the highway. The strike line is depth 0. */
export const FAR_DEPTH = 1;
/** Notes past the strike line are drawn down to this depth, then dropped. */
export const NEAR_DEPTH = -0.22;
/** Taps above this share of the screen height are not lane presses, so the HUD is safe to touch. */
export const TOUCH_ZONE_TOP = 0.4;

const PORTRAIT = { halfWidth: 0.47, strikeY: 0.8, vanishY: 0.1 };
const LANDSCAPE = { halfWidth: 0.3, maxHalfWidthOfHeight: 0.5, strikeY: 0.84, vanishY: 0.06 };

/** Where the highway sits on screen, in CSS pixels. */
export interface Layout {
  width: number;
  height: number;
  centerX: number;
  /** Screen y of the strike line. */
  strikeY: number;
  /** Screen y of the vanishing point. */
  vanishY: number;
  /** Half the highway width at the strike line. */
  halfWidth: number;
  isPortrait: boolean;
}

export interface Point {
  x: number;
  y: number;
}

/** Fit the highway to a screen size. */
export function computeLayout(width: number, height: number): Layout {
  const isPortrait = height > width;
  const halfWidth = isPortrait
    ? width * PORTRAIT.halfWidth
    : Math.min(width * LANDSCAPE.halfWidth, height * LANDSCAPE.maxHalfWidthOfHeight);
  const shape = isPortrait ? PORTRAIT : LANDSCAPE;
  return {
    width,
    height,
    centerX: width / 2,
    strikeY: height * shape.strikeY,
    vanishY: height * shape.vanishY,
    halfWidth,
    isPortrait,
  };
}

/** Size of things at a depth, relative to their size on the strike line. */
export function depthScale(depth: number): number {
  return 1 / (1 + PERSPECTIVE * Math.max(depth, NEAR_DEPTH));
}

/** Depth of a note: 0 on the strike line, 1 when it first appears. */
export function noteDepth(noteTime: number, now: number, lookahead: number): number {
  return (noteTime - now) / lookahead;
}

/** Highway position from -1 (left edge) to 1 (right edge) of a lane center. */
export function laneCenter(lane: number): number {
  return ((lane + 0.5) / LANE_COUNT) * 2 - 1;
}

/** Screen point for a highway position (-1 to 1 across) at a depth. */
export function project(layout: Layout, across: number, depth: number): Point {
  const scale = depthScale(depth);
  return {
    x: layout.centerX + across * layout.halfWidth * scale,
    y: layout.vanishY + (layout.strikeY - layout.vanishY) * scale,
  };
}

/** Width of one lane on the strike line. */
export function laneWidth(layout: Layout): number {
  return (layout.halfWidth * 2) / LANE_COUNT;
}

/** Lane under a screen x at the strike line. Taps just outside snap to the edge lanes. */
export function laneAtX(layout: Layout, x: number): number {
  const left = layout.centerX - layout.halfWidth;
  const lane = Math.floor((x - left) / laneWidth(layout));
  return Math.min(LANE_COUNT - 1, Math.max(0, lane));
}
