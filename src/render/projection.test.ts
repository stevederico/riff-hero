import { describe, expect, it } from 'vitest';
import {
  FAR_DEPTH, computeLayout, depthScale, laneAtX, laneCenter, noteDepth, project,
} from './projection.ts';

const PHONE = computeLayout(390, 844);
const DESKTOP = computeLayout(1280, 720);

describe('computeLayout', () => {
  it('detects portrait screens', () => {
    expect([PHONE.isPortrait, DESKTOP.isPortrait]).toEqual([true, false]);
  });

  it('keeps the highway on screen', () => {
    const overflow = [PHONE, DESKTOP].filter((layout) => layout.halfWidth * 2 > layout.width);
    expect(overflow).toEqual([]);
  });

  it('puts the vanishing point above the strike line', () => {
    expect(DESKTOP.vanishY).toBeLessThan(DESKTOP.strikeY);
  });
});

describe('depthScale', () => {
  it('is full size on the strike line', () => {
    expect(depthScale(0)).toBe(1);
  });

  it('shrinks with distance', () => {
    expect(depthScale(FAR_DEPTH)).toBeLessThan(depthScale(0.5));
  });

  it('stays finite far below the strike line', () => {
    expect(Number.isFinite(depthScale(-5))).toBe(true);
  });
});

describe('noteDepth', () => {
  it('is 0 when the note is due', () => {
    expect(noteDepth(10, 10, 2)).toBe(0);
  });

  it('is 1 when the note first appears', () => {
    expect(noteDepth(12, 10, 2)).toBe(1);
  });
});

describe('project', () => {
  it('puts depth 0 on the strike line', () => {
    expect(project(DESKTOP, 0, 0)).toEqual({ x: DESKTOP.centerX, y: DESKTOP.strikeY });
  });

  it('moves distant notes toward the vanishing point', () => {
    expect(project(DESKTOP, 1, FAR_DEPTH).y).toBeLessThan(project(DESKTOP, 1, 0.5).y);
  });

  it('narrows the highway with distance', () => {
    expect(project(DESKTOP, 1, FAR_DEPTH).x).toBeLessThan(project(DESKTOP, 1, 0).x);
  });
});

describe('laneCenter', () => {
  it('centers the middle lane', () => {
    expect(laneCenter(2)).toBeCloseTo(0);
  });

  it('mirrors the outer lanes', () => {
    expect(laneCenter(0)).toBeCloseTo(-laneCenter(4));
  });
});

describe('laneAtX', () => {
  it.each([0, 1, 2, 3, 4])('finds lane %i from its center', (lane) => {
    expect(laneAtX(PHONE, project(PHONE, laneCenter(lane), 0).x)).toBe(lane);
  });

  it('snaps taps left of the highway to the first lane', () => {
    expect(laneAtX(DESKTOP, 0)).toBe(0);
  });

  it('snaps taps right of the highway to the last lane', () => {
    expect(laneAtX(DESKTOP, DESKTOP.width)).toBe(4);
  });
});
