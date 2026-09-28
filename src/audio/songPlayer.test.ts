import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SongPlayer } from './songPlayer.ts';

/** A silent player on the wall clock, started so song time 0 is now. */
function startPlayer(): SongPlayer {
  const player = new SongPlayer(null, []);
  player.start(-0.06);
  return player;
}

describe('SongPlayer without audio', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['performance'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('follows the wall clock', () => {
    const player = startPlayer();
    vi.advanceTimersByTime(2000);
    expect(player.heardTime).toBeCloseTo(2);
  });

  it('holds still while paused', () => {
    const player = startPlayer();
    vi.advanceTimersByTime(1000);
    player.pause();
    vi.advanceTimersByTime(5000);
    expect(player.heardTime).toBeCloseTo(1);
  });

  it('carries on from the paused time without a jump', () => {
    const player = startPlayer();
    vi.advanceTimersByTime(1000);
    player.pause();
    vi.advanceTimersByTime(5000);
    player.resume();
    vi.advanceTimersByTime(500);
    expect(player.heardTime).toBeCloseTo(1.5);
  });

  it('freezes for good when stopped', () => {
    const player = startPlayer();
    vi.advanceTimersByTime(1000);
    player.stop();
    player.resume();
    vi.advanceTimersByTime(5000);
    expect(player.heardTime).toBeCloseTo(1);
  });

  it('never reports an interruption without audio', () => {
    expect(startPlayer().isInterrupted).toBe(false);
  });
});
