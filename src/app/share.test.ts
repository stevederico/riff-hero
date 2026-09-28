import { describe, expect, it } from 'vitest';
import { DEFAULT_SHARE_URL, buildShareText, shareUrl } from './share.ts';

const RESULT = { songTitle: 'Neon Backroads', difficultyLabel: 'Hard', score: 123456.4, stars: 3, hasFailed: false };

describe('shareUrl', () => {
  it('points at the game by default', () => {
    expect(shareUrl()).toBe(DEFAULT_SHARE_URL);
  });

  it('uses the grok.me host', () => {
    expect(DEFAULT_SHARE_URL).toBe('https://rockstar-hero.grok.me');
  });
});

describe('buildShareText', () => {
  it('names the song, difficulty and score', () => {
    expect(buildShareText(RESULT)).toBe(
      'I scored 123,456 on Neon Backroads on Hard in Rockstar Hero ★★★. Can you beat it?',
    );
  });

  it('leaves out stars when none were earned', () => {
    expect(buildShareText({ ...RESULT, stars: 0 })).not.toContain('★');
  });

  it('owns up to a failed show', () => {
    expect(buildShareText({ ...RESULT, hasFailed: true })).toContain('walked out');
  });
});
