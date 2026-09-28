import type { BassStyle, DrumStyle, RhythmStyle } from './types.ts';

/*
 * Backing patterns, one character per 16th note.
 * Drums: 'x' is a hit, 'o' a soft hit.
 * Guitar and bass: 'X' open note, 'x' palm muted note, '-' holds it one more step.
 */
export interface DrumPattern {
  kick: string;
  snare: string;
  hat: string;
  openHat: string;
}

const EMPTY = '................';
const EIGHTHS = 'x.x.x.x.x.x.x.x.';
const QUARTERS = 'x...x...x...x...';
const BACKBEAT = '....x.......x...';

export const DRUM_PATTERNS: Record<DrumStyle, DrumPattern> = {
  none: { kick: EMPTY, snare: EMPTY, hat: EMPTY, openHat: EMPTY },
  count: { kick: EMPTY, snare: EMPTY, hat: EMPTY, openHat: EMPTY },
  rock: { kick: 'x.......x.x.....', snare: BACKBEAT, hat: EIGHTHS, openHat: EMPTY },
  drive: { kick: 'x.....x.x.x.....', snare: BACKBEAT, hat: EMPTY, openHat: QUARTERS },
  punk: { kick: 'x.....x.x.....x.', snare: BACKBEAT, hat: EIGHTHS, openHat: EMPTY },
  half: { kick: 'x.........x.....', snare: '........x.......', hat: QUARTERS, openHat: EMPTY },
  gallop: { kick: 'x.oox.oox.oox.oo', snare: BACKBEAT, hat: QUARTERS, openHat: EMPTY },
  double: { kick: 'xoxoxoxoxoxoxoxo', snare: BACKBEAT, hat: EMPTY, openHat: QUARTERS },
};

/** Second half of a bar, played instead of the normal pattern at the end of a section. */
export const FILL = {
  startStep: 8,
  snare: '........x.x.....',
  highTom: '............xx..',
  lowTom: '..............xx',
} as const;

export const RHYTHM_PATTERNS: Record<RhythmStyle, string> = {
  none: EMPTY,
  chug: 'X-x.x.x.X-x.x.x.',
  stabs: 'X--...X--...X--.',
  sustain: 'X---------------',
  gallop: 'X-xxx.xxx.xxx.xx',
  drive: 'X-X-X-X-X-X-X-X-',
};

export const BASS_PATTERNS: Record<BassStyle, string> = {
  none: EMPTY,
  roots: 'X-----..X-----..',
  eighths: 'X-X-X-X-X-X-X-X-',
  gallop: 'X-xxX-xxX-xxX-xx',
};

export interface PatternNote {
  step: number;
  steps: number;
  muted: boolean;
}

/** Read a guitar or bass pattern into notes. */
export function parsePattern(pattern: string): PatternNote[] {
  const notes: PatternNote[] = [];
  let open: PatternNote | null = null;
  [...pattern].forEach((char, step) => {
    if (char === '-') {
      if (open) open.steps += 1;
      return;
    }
    open = char === 'X' || char === 'x' ? { step, steps: 1, muted: char === 'x' } : null;
    if (open) notes.push(open);
  });
  return notes;
}

/** Steps where a drum pattern has a hit, with a velocity from 0 to 1. */
export function parseDrums(pattern: string): { step: number; velocity: number }[] {
  const SOFT_VELOCITY = 0.6;
  return [...pattern].flatMap((char, step) => {
    if (char === 'x') return [{ step, velocity: 1 }];
    if (char === 'o') return [{ step, velocity: SOFT_VELOCITY }];
    return [];
  });
}
