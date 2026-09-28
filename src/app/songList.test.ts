import { describe, expect, it } from 'vitest';
import { starCount } from './songList.ts';

describe('starCount', () => {
  it.each([[0, '0 stars'], [1, '1 star'], [3, '3 stars']])('reads %i as "%s"', (stars, text) => {
    expect(starCount(stars)).toBe(text);
  });
});
