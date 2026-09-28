import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CROWD_START } from '../game/scoring.ts';
import { SONGS } from '../game/songs/index.ts';
import { DIFFICULTIES } from '../game/types.ts';
import type { Difficulty, SongDef } from '../game/types.ts';
import { Effects } from '../render/effects.ts';
import { computeLayout } from '../render/projection.ts';
import { Session } from './session.ts';

const FRAME_MS = 16;
const MS_PER_SECOND = 1000;
const LAYOUT = computeLayout(1280, 720);
const CASES = SONGS.flatMap((song) =>
  DIFFICULTIES.map((difficulty) => [`${song.title} ${difficulty}`, song, difficulty] as const));

function firstSong(): SongDef {
  const [song] = SONGS;
  if (!song) throw new Error('no songs');
  return song;
}

function makeSession(song: SongDef, difficulty: Difficulty, isBot: boolean, banners: string[] = []): Session {
  const session = new Session({
    song,
    difficulty,
    engine: null,
    offset: 0,
    isBot,
    effects: new Effects(),
    getLayout: () => LAYOUT,
    onBanner: (text) => banners.push(text),
  });
  session.start();
  return session;
}

/** Run the game loop on the fake clock for a number of seconds, or until the song ends. */
function run(session: Session, seconds: number): void {
  const frames = Math.ceil((seconds * MS_PER_SECOND) / FRAME_MS);
  for (let i = 0; i < frames && session.outcome === 'playing'; i += 1) {
    vi.advanceTimersByTime(FRAME_MS);
    session.update(FRAME_MS / MS_PER_SECOND);
  }
}

/** Run until the song clock reaches a time. */
function runUntil(session: Session, time: number): void {
  run(session, Math.max(0, time - session.time));
}

describe('Session', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['performance', 'setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts before the song so the player can get ready', () => {
    expect(makeSession(firstSong(), 'easy', false).time).toBeLessThan(-1);
  });

  it.each(CASES)('%s can be finished with a full combo', (_, song, difficulty) => {
    const session = makeSession(song, difficulty, true);
    run(session, 200);
    expect([session.outcome, session.score.isFullCombo]).toEqual(['finished', true]);
  });

  it.each(CASES)('%s earns five stars for a perfect run', (_, song, difficulty) => {
    const session = makeSession(song, difficulty, true);
    run(session, 200);
    expect(session.score.stars).toBe(5);
  });

  it.each(CASES)('%s fails a player who never plays', (_, song, difficulty) => {
    const session = makeSession(song, difficulty, false);
    run(session, 200);
    expect(session.outcome).toBe('failed');
  });

  it('fails well before the end of the song', () => {
    const session = makeSession(firstSong(), 'easy', false);
    run(session, 200);
    expect(session.time).toBeLessThan(session.chart.duration / 2);
  });

  it('scores a press on the first note', () => {
    const session = makeSession(firstSong(), 'easy', false);
    const [note] = session.chart.notes;
    if (!note) throw new Error('empty chart');
    runUntil(session, note.time);
    session.press(note.lane);
    expect(session.score.hits).toBe(1);
  });

  it('breaks the combo on a press with no note', () => {
    const session = makeSession(firstSong(), 'easy', false);
    const [note] = session.chart.notes;
    if (!note) throw new Error('empty chart');
    runUntil(session, note.time);
    session.press(note.lane);
    session.release(note.lane);
    session.press(4);
    expect(session.score.combo).toBe(0);
  });

  it('ignores a second press while the lane is down', () => {
    const session = makeSession(firstSong(), 'easy', false);
    runUntil(session, 30);
    session.press(0);
    const afterOne = session.score.crowd;
    session.press(0);
    expect(session.score.crowd).toBe(afterOne);
  });

  it('does not punish warm up taps during the count in', () => {
    const session = makeSession(firstSong(), 'hard', false);
    for (let lane = 0; lane < 5; lane += 1) {
      session.press(lane);
      session.release(lane);
    }
    expect(session.score.crowd).toBe(CROWD_START);
  });

  it.each(SONGS.map((song) => [song.title, song] as const))(
    '%s gives an idle player on Hard more than 7 seconds',
    (_, song) => {
      const session = makeSession(song, 'hard', false);
      run(session, 200);
      const [first] = session.chart.notes;
      expect(session.time - (first?.time ?? 0)).toBeGreaterThan(7);
    },
  );

  it.each([['easy'], ['medium']] as const)('lets a player hitting half the notes finish %s', (difficulty) => {
    const session = makeSession(firstSong(), difficulty, false);
    const times = [...new Set(session.chart.notes.map((note) => note.time))];
    times.forEach((time, index) => {
      runUntil(session, time);
      if (index % 2 === 1) return;
      const chord = session.chart.notes.filter((note) => note.time === time);
      chord.forEach((note) => session.press(note.lane, time));
      chord.forEach((note) => session.release(note.lane));
    });
    run(session, 200);
    expect([session.outcome, session.score.stars]).toEqual(['finished', 3]);
  });

  it('shows which lanes are down', () => {
    const session = makeSession(firstSong(), 'easy', false);
    session.press(1);
    session.press(3);
    session.release(1);
    expect(session.pressed).toEqual([false, false, false, true, false]);
  });

  it('holds the clock still while paused', () => {
    const session = makeSession(firstSong(), 'easy', false);
    run(session, 3);
    session.pause();
    const pausedAt = session.time;
    vi.advanceTimersByTime(5000);
    expect(session.time).toBe(pausedAt);
  });

  it('picks up where it left off after a pause', () => {
    const session = makeSession(firstSong(), 'easy', false);
    run(session, 3);
    session.pause();
    const pausedAt = session.time;
    vi.advanceTimersByTime(5000);
    session.resume();
    vi.advanceTimersByTime(1000);
    expect(session.time).toBeCloseTo(pausedAt + 1);
  });

  it('judges a press at the moment of its timestamp', () => {
    const session = makeSession(firstSong(), 'easy', false);
    runUntil(session, 5);
    vi.advanceTimersByTime(100);
    expect(session.timeAtStamp(performance.now() - 100)).toBeCloseTo(session.time - 0.1);
  });

  it('never judges a press from the future', () => {
    const session = makeSession(firstSong(), 'easy', false);
    runUntil(session, 5);
    expect(session.timeAtStamp(performance.now() + 500)).toBe(session.time);
  });

  it('caps how far back a stale timestamp can reach', () => {
    const session = makeSession(firstSong(), 'easy', false);
    runUntil(session, 5);
    expect(session.timeAtStamp(performance.now() - 5000)).toBeCloseTo(session.time - 0.25);
  });

  it('applies a new audio offset straight away', () => {
    const session = makeSession(firstSong(), 'easy', false);
    runUntil(session, 5);
    const before = session.time;
    session.setOffset(0.05);
    expect(session.time).toBeCloseTo(before - 0.05);
  });

  it('freezes the clock when the song ends', () => {
    const session = makeSession(firstSong(), 'easy', false);
    run(session, 200);
    const endedAt = session.time;
    vi.advanceTimersByTime(3000);
    expect(session.time).toBe(endedAt);
  });

  it('lets go of every lane when paused', () => {
    const session = makeSession(firstSong(), 'easy', false);
    session.press(2);
    session.pause();
    expect(session.pressed.includes(true)).toBe(false);
  });

  it('announces surge when the bot fires it', () => {
    const banners: string[] = [];
    const session = makeSession(firstSong(), 'hard', true, banners);
    run(session, 200);
    expect(banners).toContain('SURGE!');
  });

  it('ignores input once the song is over', () => {
    const session = makeSession(firstSong(), 'easy', false);
    run(session, 200);
    session.press(0);
    expect(session.pressed[0]).toBe(false);
  });

  it('reports sustains being held to the renderer', () => {
    const session = makeSession(firstSong(), 'easy', false);
    const sustain = session.chart.notes.find((note) => note.duration > 0.5);
    if (!sustain) throw new Error('no sustain in chart');
    runUntil(session, sustain.time);
    session.press(sustain.lane);
    run(session, 0.2);
    const frame = session.frame({ showKeys: true, showHud: true, reducedMotion: false });
    expect(frame.holding[sustain.lane]).toBe(true);
  });
});
