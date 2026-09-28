import { beforeEach, describe, expect, it } from 'vitest';
import {
  CROWD_START, GRADE_POINTS, HOLD_POINTS_PER_SECOND, SURGE_DRAIN_PER_SECOND, SURGE_PER_PHRASE,
  ScoreKeeper, comboMultiplier, maxStarPoints, starsFor,
} from './scoring.ts';
import type { Chart, ChartNote, Difficulty, Grade, PlayEvent } from './types.ts';

const NOTE_COUNT = 60;
const PHRASE_SIZE = 3;

/** A chart of tap notes one second apart. The first six notes form two surge phrases. */
function makeChart(difficulty: Difficulty = 'medium'): Chart {
  const notes: ChartNote[] = Array.from({ length: NOTE_COUNT }, (_, id) => ({
    id,
    time: id,
    lane: id % 5,
    duration: 0,
    phrase: id < PHRASE_SIZE * 2 ? Math.floor(id / PHRASE_SIZE) : -1,
  }));
  return {
    songId: 'test', difficulty, notes, phraseSizes: [PHRASE_SIZE, PHRASE_SIZE], lookahead: 2, duration: 70,
  };
}

function hit(chart: Chart, id: number, grade: Grade = 'perfect'): PlayEvent {
  const note = chart.notes[id];
  if (!note) throw new Error(`no note ${id}`);
  return { kind: 'hit', note, grade, offset: 0 };
}

function miss(chart: Chart, id: number): PlayEvent {
  const note = chart.notes[id];
  if (!note) throw new Error(`no note ${id}`);
  return { kind: 'miss', note };
}

describe('comboMultiplier', () => {
  it.each([[0, 1], [9, 1], [10, 2], [29, 3], [30, 4], [500, 4]])('combo %i gives x%i', (combo, expected) => {
    expect(comboMultiplier(combo)).toBe(expected);
  });
});

describe('starsFor', () => {
  it.each([[0, 0], [0.31, 1], [0.38, 2], [0.45, 3], [0.62, 4], [0.9, 5], [1.4, 5]])('%f of max gives %i stars', (share, stars) => {
    expect(starsFor(share * 1000, 1000)).toBe(stars);
  });

  it('gives no stars for an empty chart', () => {
    expect(starsFor(100, 0)).toBe(0);
  });
});

describe('maxStarPoints', () => {
  it('counts sustain points', () => {
    const chart = makeChart();
    const [first, ...rest] = chart.notes;
    if (!first) throw new Error('empty chart');
    const longer = { ...chart, notes: [{ ...first, duration: 2 }, ...rest] };
    expect(maxStarPoints(longer) - maxStarPoints(chart)).toBe(2 * HOLD_POINTS_PER_SECOND);
  });

  it('ignores the combo multiplier', () => {
    expect(maxStarPoints(makeChart())).toBe(NOTE_COUNT * GRADE_POINTS.perfect);
  });
});

describe('ScoreKeeper', () => {
  let chart: Chart;
  let keeper: ScoreKeeper;
  const hitRange = (from: number, to: number): void => {
    for (let id = from; id < to; id += 1) keeper.apply(hit(chart, id));
  };

  beforeEach(() => {
    chart = makeChart();
    keeper = new ScoreKeeper(chart);
  });

  it('scores a perfect hit', () => {
    expect(keeper.apply(hit(chart, 0)).points).toBe(GRADE_POINTS.perfect);
  });

  it('scores less for a good hit', () => {
    expect(keeper.apply(hit(chart, 0, 'good')).points).toBe(GRADE_POINTS.good);
  });

  it('doubles points at a ten combo', () => {
    hitRange(0, 9);
    expect(keeper.apply(hit(chart, 9)).points).toBe(GRADE_POINTS.perfect * 2);
  });

  it('resets the combo on a miss', () => {
    hitRange(0, 12);
    keeper.apply(miss(chart, 12));
    expect(keeper.combo).toBe(0);
  });

  it('remembers the longest combo', () => {
    hitRange(0, 12);
    keeper.apply(miss(chart, 12));
    hitRange(13, 16);
    expect(keeper.maxCombo).toBe(12);
  });

  it('reports a broken combo', () => {
    hitRange(0, 3);
    expect(keeper.apply(miss(chart, 3)).comboBroken).toBe(true);
  });

  it('breaks the combo on a stray press', () => {
    hitRange(0, 3);
    keeper.apply({ kind: 'stray', lane: 0 });
    expect(keeper.combo).toBe(0);
  });

  it('does not count a stray press as a miss', () => {
    keeper.apply({ kind: 'stray', lane: 0 });
    expect(keeper.counts.miss).toBe(0);
  });

  it('pays sustains by the second at the current multiplier', () => {
    hitRange(0, 10);
    const { points } = keeper.apply({ kind: 'hold', lane: 0, seconds: 0.5 });
    expect(points).toBe(0.5 * HOLD_POINTS_PER_SECOND * 2);
  });

  it('reaches the maximum star points on a perfect run', () => {
    hitRange(0, NOTE_COUNT);
    expect(keeper.starPoints).toBe(keeper.maxStarPoints);
  });

  it('gives five stars for a perfect run', () => {
    hitRange(0, NOTE_COUNT);
    expect(keeper.stars).toBe(5);
  });

  it('keeps star points free of the combo multiplier', () => {
    hitRange(0, 20);
    expect(keeper.starPoints).toBe(20 * GRADE_POINTS.perfect);
  });

  describe('stars for a typical player', () => {
    /** Hit a share of the notes with a realistic mix of grades, missing the rest. */
    const playShare = (share: number): void => {
      const grades: Grade[] = ['perfect', 'perfect', 'perfect', 'great', 'great', 'perfect', 'great', 'good', 'perfect', 'great'];
      for (let id = 0; id < NOTE_COUNT; id += 1) {
        const isHit = Math.floor((id + 1) * share) > Math.floor(id * share);
        keeper.apply(isHit ? hit(chart, id, grades[id % grades.length]) : miss(chart, id));
      }
    };

    it('gives three stars at about half the notes', () => {
      playShare(0.5);
      expect(keeper.stars).toBe(3);
    });

    it('gives one star at about forty percent of the notes', () => {
      playShare(0.4);
      expect(keeper.stars).toBe(1);
    });

    it('gives no stars at a quarter of the notes', () => {
      playShare(0.25);
      expect(keeper.stars).toBe(0);
    });
  });

  it('calls a run with every note hit a full combo', () => {
    hitRange(0, NOTE_COUNT);
    expect(keeper.isFullCombo).toBe(true);
  });

  it('reports accuracy as the share of played notes that were hit', () => {
    hitRange(0, 3);
    keeper.apply(miss(chart, 3));
    expect(keeper.accuracy).toBe(0.75);
  });

  it('reports no accuracy before any note is played', () => {
    expect(keeper.accuracy).toBe(0);
  });

  describe('crowd meter', () => {
    it('starts in the middle', () => {
      expect(keeper.crowd).toBe(CROWD_START);
    });

    it('rises on a hit', () => {
      keeper.apply(hit(chart, 0));
      expect(keeper.crowd).toBeGreaterThan(CROWD_START);
    });

    it('falls on a miss', () => {
      keeper.apply(miss(chart, 0));
      expect(keeper.crowd).toBeLessThan(CROWD_START);
    });

    it('fails the song when it empties', () => {
      for (let id = 0; id < NOTE_COUNT; id += 1) keeper.apply(miss(chart, id));
      expect(keeper.isFailed).toBe(true);
    });

    it('never goes above full', () => {
      hitRange(0, NOTE_COUNT);
      expect(keeper.crowd).toBeLessThanOrEqual(1);
    });

    it('drains once for both notes of a missed chord', () => {
      const [first, second] = chart.notes;
      if (!first || !second) throw new Error('empty chart');
      keeper.apply({ kind: 'miss', note: first });
      const afterOne = keeper.crowd;
      keeper.apply({ kind: 'miss', note: { ...second, time: first.time } });
      expect(keeper.crowd).toBe(afterOne);
    });

    it('still counts both notes of a missed chord in the stats', () => {
      const [first, second] = chart.notes;
      if (!first || !second) throw new Error('empty chart');
      keeper.apply({ kind: 'miss', note: first });
      keeper.apply({ kind: 'miss', note: { ...second, time: first.time } });
      expect(keeper.counts.miss).toBe(2);
    });

    it('punishes misses harder on hard', () => {
      const hard = new ScoreKeeper(makeChart('hard'));
      hard.apply(miss(chart, 0));
      keeper.apply(miss(chart, 0));
      expect(hard.crowd).toBeLessThan(keeper.crowd);
    });
  });

  describe('surge', () => {
    it('fills when a whole phrase is hit', () => {
      hitRange(0, PHRASE_SIZE);
      expect(keeper.surge).toBe(SURGE_PER_PHRASE);
    });

    it('reports the completed phrase', () => {
      hitRange(0, PHRASE_SIZE - 1);
      expect(keeper.apply(hit(chart, PHRASE_SIZE - 1)).phraseCompleted).toBe(true);
    });

    it('does not fill when a phrase note is missed', () => {
      keeper.apply(miss(chart, 0));
      hitRange(1, PHRASE_SIZE);
      expect(keeper.surge).toBe(0);
    });

    it('cannot start below half a meter', () => {
      hitRange(0, PHRASE_SIZE);
      expect(keeper.activateSurge()).toBe(false);
    });

    it('starts with half a meter', () => {
      hitRange(0, PHRASE_SIZE * 2);
      expect(keeper.activateSurge()).toBe(true);
    });

    it('doubles the multiplier while active', () => {
      hitRange(0, PHRASE_SIZE * 2);
      keeper.activateSurge();
      expect(keeper.multiplier).toBe(2);
    });

    it('drains over time', () => {
      hitRange(0, PHRASE_SIZE * 2);
      keeper.activateSurge();
      keeper.tick(1);
      expect(keeper.surge).toBeCloseTo(0.5 - SURGE_DRAIN_PER_SECOND);
    });

    it('ends when the meter is empty', () => {
      hitRange(0, PHRASE_SIZE * 2);
      keeper.activateSurge();
      keeper.tick(60);
      expect(keeper.isSurgeActive).toBe(false);
    });

    it('does not drain while idle', () => {
      hitRange(0, PHRASE_SIZE);
      keeper.tick(5);
      expect(keeper.surge).toBe(SURGE_PER_PHRASE);
    });

    it('cannot start twice', () => {
      hitRange(0, PHRASE_SIZE * 2);
      keeper.activateSurge();
      expect(keeper.activateSurge()).toBe(false);
    });
  });
});
