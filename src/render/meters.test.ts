import { describe, expect, it } from 'vitest';
import { surgeButtonRect, surgeMeterRect } from './meters.ts';
import { TOUCH_ZONE_TOP, computeLayout } from './projection.ts';

const PORTRAIT = [[390, 844], [375, 667], [430, 932], [360, 740]] as const;
const LANDSCAPE = [[1280, 720], [844, 390], [1024, 768], [1920, 1080]] as const;
const MIN_TOUCH_SIZE = 44;

describe('surgeButtonRect', () => {
  it.each(PORTRAIT)('stays above the lane tap zone at %ix%i', (width, height) => {
    const area = surgeButtonRect(computeLayout(width, height));
    expect(area.y + area.height).toBeLessThanOrEqual(height * TOUCH_ZONE_TOP);
  });

  it.each(LANDSCAPE)('stays right of the highway at %ix%i', (width, height) => {
    const layout = computeLayout(width, height);
    expect(surgeButtonRect(layout).x).toBeGreaterThan(layout.centerX + layout.halfWidth);
  });

  it.each([...PORTRAIT, ...LANDSCAPE])('stays on screen at %ix%i', (width, height) => {
    const area = surgeButtonRect(computeLayout(width, height));
    expect([area.x >= 0, area.y >= 0, area.x + area.width <= width, area.y + area.height <= height])
      .toEqual([true, true, true, true]);
  });

  it.each([...PORTRAIT, ...LANDSCAPE])('is big enough to tap at %ix%i', (width, height) => {
    const area = surgeButtonRect(computeLayout(width, height));
    expect(Math.min(area.width, area.height)).toBeGreaterThanOrEqual(MIN_TOUCH_SIZE);
  });

  it.each([...PORTRAIT, ...LANDSCAPE])('covers the meter at %ix%i', (width, height) => {
    const layout = computeLayout(width, height);
    const meter = surgeMeterRect(layout);
    const area = surgeButtonRect(layout);
    expect([area.x <= meter.x, area.x + area.width >= meter.x + meter.width]).toEqual([true, true]);
  });
});
