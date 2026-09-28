import { describe, expect, it } from 'vitest';
import { buildArrangement } from './arrangement.ts';
import { buildChart } from './chart.ts';
import { parseDrums, parsePattern } from './patterns.ts';
import { SONGS } from './songs/index.ts';
import { songDuration } from './timing.ts';
import { DIFFICULTIES } from './types.ts';

const SONG_CASES = SONGS.map((song) => [song.title, song] as const);
const MATCH_TOLERANCE = 1e-6;

describe('parsePattern', () => {
  it('extends notes with hold characters', () => {
    expect(parsePattern('X--.x...')).toEqual([
      { step: 0, steps: 3, muted: false },
      { step: 4, steps: 1, muted: true },
    ]);
  });
});

describe('parseDrums', () => {
  it('reads soft hits at a lower velocity', () => {
    const [hard, soft] = parseDrums('xo');
    expect((soft?.velocity ?? 1) < (hard?.velocity ?? 0)).toBe(true);
  });
});

describe('buildArrangement', () => {
  it.each(SONG_CASES)('%s is sorted by time', (_, song) => {
    const times = buildArrangement(song).map((event) => event.time);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it.each(SONG_CASES)('%s fits inside the song length', (_, song) => {
    const last = Math.max(...buildArrangement(song).map((event) => event.time + event.duration));
    expect(last).toBeLessThanOrEqual(songDuration(song));
  });

  it.each(SONG_CASES)('%s opens with four count in clicks', (_, song) => {
    const clicks = buildArrangement(song).filter((event) => event.type === 'click');
    expect(clicks.length).toBe(4);
  });

  it.each(SONG_CASES)('%s has drums, bass, rhythm and lead', (_, song) => {
    const types = new Set<string>(buildArrangement(song).map((event) => event.type));
    expect(['kick', 'snare', 'bass', 'rhythm', 'lead'].filter((type) => !types.has(type))).toEqual([]);
  });

  it.each(SONG_CASES)('%s plays a lead note under every chart note', (_, song) => {
    const leadTimes = buildArrangement(song)
      .filter((event) => event.type === 'lead')
      .map((event) => event.time);
    const orphans = DIFFICULTIES.flatMap((difficulty) => buildChart(song, difficulty).notes)
      .filter((note) => !leadTimes.some((time) => Math.abs(time - note.time) < MATCH_TOLERANCE));
    expect(orphans).toEqual([]);
  });

  it.each(SONG_CASES)('%s runs between one and two minutes', (_, song) => {
    const seconds = songDuration(song);
    expect(seconds > 60 && seconds < 120).toBe(true);
  });
});
