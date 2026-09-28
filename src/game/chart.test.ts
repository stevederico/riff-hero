import { describe, expect, it } from 'vitest';
import { RULES, beatStrength, buildChart, fitsBurst, laneForDegree, thinLead } from './chart.ts';
import { expandLead } from './lead.ts';
import { SONGS } from './songs/index.ts';
import { stepSeconds } from './timing.ts';
import { DIFFICULTIES } from './types.ts';
import type { Chart } from './types.ts';

const CASES = SONGS.flatMap((song) =>
  DIFFICULTIES.map((difficulty) => [`${song.title} ${difficulty}`, song, difficulty] as const));
const TOLERANCE = 1e-6;

/** Distinct note times, since chord notes share one. */
function noteTimes(chart: Chart): number[] {
  return [...new Set(chart.notes.map((note) => note.time))];
}

describe('beatStrength', () => {
  it('ranks the downbeat strongest', () => {
    expect(beatStrength(32)).toBe(0);
  });

  it('ranks an off 16th weakest', () => {
    expect(beatStrength(3)).toBe(4);
  });
});

describe('laneForDegree', () => {
  it('centers a small set of pitches', () => {
    expect(laneForDegree([2, 4, 6], 2, 5)).toBe(1);
  });

  it('puts higher pitches further right', () => {
    const lanes = [0, 1, 2, 3, 4, 5, 6, 7].map((degree) =>
      laneForDegree([0, 1, 2, 3, 4, 5, 6, 7], degree, 5));
    expect(lanes).toEqual([...lanes].sort((a, b) => a - b));
  });

  it('uses the full width for a wide set of pitches', () => {
    expect(laneForDegree([0, 1, 2, 3, 4, 5, 6, 7], 7, 5)).toBe(4);
  });
});

describe('thinLead', () => {
  it('keeps the downbeat over a weaker neighbour', () => {
    const [song] = SONGS;
    if (!song) throw new Error('no songs');
    const kept = thinLead(expandLead(song), RULES.easy, song.bpm);
    const weak = kept.filter((note) => note.step % 4 !== 0);
    expect(weak).toEqual([]);
  });
});

describe('fitsBurst', () => {
  const rules = { ...RULES.easy, burst: { notes: 3, seconds: 1 } };
  const BPM = 120;

  it('allows notes when there is no burst rule', () => {
    expect(fitsBurst([0, 1, 2, 3], 4, RULES.hard, BPM)).toBe(true);
  });

  it('allows the last note that fits in a window', () => {
    expect(fitsBurst([0, 2], 4, rules, BPM)).toBe(true);
  });

  it('rejects one note too many in a window', () => {
    expect(fitsBurst([0, 2, 4], 6, rules, BPM)).toBe(false);
  });

  it('allows the same note once the window has moved on', () => {
    expect(fitsBurst([0, 2, 4], 8, rules, BPM)).toBe(true);
  });
});

/** Notes per second between the first and last note, counting a chord once. */
function density(chart: Chart): number {
  const times = noteTimes(chart);
  return times.length / ((times.at(-1) ?? 1) - (times[0] ?? 0));
}

describe('difficulty spread', () => {
  const SONG_CASES = SONGS.map((song) => [song.title, song] as const);

  it.each(SONG_CASES)('%s has at least 25%% more notes on Hard than Medium', (_, song) => {
    const hard = buildChart(song, 'hard').notes.length;
    const medium = buildChart(song, 'medium').notes.length;
    expect(hard / medium).toBeGreaterThanOrEqual(1.25);
  });

  it.each(SONG_CASES)('%s has at least 30%% more notes on Medium than Easy', (_, song) => {
    const medium = buildChart(song, 'medium').notes.length;
    const easy = buildChart(song, 'easy').notes.length;
    expect(medium / easy).toBeGreaterThanOrEqual(1.3);
  });

  it.each(DIFFICULTIES.map((difficulty) => [difficulty] as const))('gets no easier as songs get wilder on %s', (difficulty) => {
    const byIntensity = [...SONGS].sort((a, b) => a.intensity - b.intensity);
    const [calmest] = byIntensity;
    const wildest = byIntensity.at(-1);
    if (!calmest || !wildest) throw new Error('no songs');
    expect(density(buildChart(wildest, difficulty))).toBeGreaterThan(density(buildChart(calmest, difficulty)));
  });

  it.each(CASES)('%s keeps bursts inside the difficulty cap', (_, song, difficulty) => {
    const { burst } = RULES[difficulty];
    const times = noteTimes(buildChart(song, difficulty));
    const crowded = burst
      ? times.filter((time, i) => (times[i + burst.notes] ?? Infinity) - time < burst.seconds - 0.002)
      : [];
    expect(crowded).toEqual([]);
  });
});

describe('buildChart', () => {
  it.each(CASES)('%s has notes', (_, song, difficulty) => {
    expect(buildChart(song, difficulty).notes.length).toBeGreaterThan(30);
  });

  it.each(CASES)('%s is sorted by time', (_, song, difficulty) => {
    const { notes } = buildChart(song, difficulty);
    const sorted = [...notes].sort((a, b) => a.time - b.time || a.lane - b.lane);
    expect(notes).toEqual(sorted);
  });

  it.each(CASES)('%s uses ids that match the index', (_, song, difficulty) => {
    const { notes } = buildChart(song, difficulty);
    expect(notes.map((note) => note.id)).toEqual(notes.map((_note, index) => index));
  });

  it.each(CASES)('%s stays inside its lanes', (_, song, difficulty) => {
    const { notes } = buildChart(song, difficulty);
    const outside = notes.filter((note) => note.lane < 0 || note.lane >= RULES[difficulty].lanes);
    expect(outside).toEqual([]);
  });

  it.each(CASES)('%s respects the minimum gap', (_, song, difficulty) => {
    const times = noteTimes(buildChart(song, difficulty));
    const gaps = times.slice(1).map((time, i) => time - (times[i] ?? 0));
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(RULES[difficulty].minGap - 0.002);
  });

  it.each(CASES)('%s lands every note on the beat grid', (_, song, difficulty) => {
    const gridSeconds = stepSeconds(song.bpm) * RULES[difficulty].grid;
    const offGrid = noteTimes(buildChart(song, difficulty)).filter((time) => {
      const steps = time / gridSeconds;
      return Math.abs(steps - Math.round(steps)) > TOLERANCE;
    });
    expect(offGrid).toEqual([]);
  });

  it.each(CASES)('%s never puts two notes in one lane at once', (_, song, difficulty) => {
    const { notes } = buildChart(song, difficulty);
    const keys = notes.map((note) => `${note.time.toFixed(4)}:${note.lane}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(CASES)('%s ends sustains before the next note in that lane', (_, song, difficulty) => {
    const { notes } = buildChart(song, difficulty);
    const clashes = notes.filter((note) => notes.some((other) =>
      other.lane === note.lane && other.time > note.time && other.time < note.time + note.duration));
    expect(clashes).toEqual([]);
  });

  it.each(CASES)('%s has phrase sizes that match its notes', (_, song, difficulty) => {
    const chart = buildChart(song, difficulty);
    const counted = chart.phraseSizes.map((_size, phrase) =>
      chart.notes.filter((note) => note.phrase === phrase).length);
    expect(counted).toEqual([...chart.phraseSizes]);
  });

  it.each(CASES)('%s offers enough surge to activate', (_, song, difficulty) => {
    expect(buildChart(song, difficulty).phraseSizes.length).toBeGreaterThanOrEqual(4);
  });

  it.each(SONGS.map((song) => [song.title, song] as const))('%s gets denser with difficulty', (_, song) => {
    const counts = DIFFICULTIES.map((difficulty) => buildChart(song, difficulty).notes.length);
    expect(counts).toEqual([...counts].sort((a, b) => a - b));
  });

  it.each(SONGS.map((song) => [song.title, song] as const))('%s has no chords on easy', (_, song) => {
    const chart = buildChart(song, 'easy');
    expect(noteTimes(chart).length).toBe(chart.notes.length);
  });

  it.each(SONGS.map((song) => [song.title, song] as const))('%s has chords on hard', (_, song) => {
    const chart = buildChart(song, 'hard');
    expect(noteTimes(chart).length).toBeLessThan(chart.notes.length);
  });

  it('is deterministic', () => {
    const [song] = SONGS;
    if (!song) throw new Error('no songs');
    expect(buildChart(song, 'hard')).toEqual(buildChart(song, 'hard'));
  });
});
