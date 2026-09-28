import { describe, expect, it } from 'vitest';
import { cycle, degreeToMidi, expandLead, isValidRiffBar, parseSymbol } from './lead.ts';
import { SONGS } from './songs/index.ts';
import type { SongDef } from './types.ts';

function makeSong(riff: string[], overrides: Partial<SongDef> = {}): SongDef {
  return {
    id: 'test',
    title: 'Test',
    artist: 'Test',
    blurb: '',
    intensity: 1,
    bpm: 120,
    rootMidi: 40,
    leadMidi: 52,
    scale: [0, 3, 5, 7, 10],
    theme: { hue: 0, hueAlt: 0 },
    sections: [{
      name: 'A', bars: riff.length, chords: [0], riff, drums: 'rock', rhythm: 'chug', bass: 'eighths',
    }],
    ...overrides,
  };
}

describe('parseSymbol', () => {
  it('reads digits as single notes', () => {
    expect(parseSymbol('7')).toEqual({ degree: 7, chord: false });
  });

  it('reads letters as power chords', () => {
    expect(parseSymbol('c')).toEqual({ degree: 2, chord: true });
  });

  it('returns null for rests and holds', () => {
    expect([parseSymbol('.'), parseSymbol('-')]).toEqual([null, null]);
  });
});

describe('cycle', () => {
  it('wraps around the list', () => {
    expect(cycle([1, 2, 3], 4, 0)).toBe(2);
  });

  it('uses the fallback for an empty list', () => {
    expect(cycle([], 4, 9)).toBe(9);
  });
});

describe('degreeToMidi', () => {
  it('walks up an octave past the end of the scale', () => {
    expect(degreeToMidi(makeSong([]), 5)).toBe(64);
  });

  it('applies the octave shift', () => {
    expect(degreeToMidi(makeSong([]), 1, 1)).toBe(67);
  });
});

describe('expandLead', () => {
  it('extends a note for every hold character', () => {
    const [first] = expandLead(makeSong(['0---............']));
    expect(first?.steps).toBe(4);
  });

  it('carries a hold across a bar line', () => {
    const [first] = expandLead(makeSong(['............0---', '--..............']));
    expect(first?.steps).toBe(6);
  });

  it('places notes on absolute steps', () => {
    const notes = expandLead(makeSong(['0...............', '....3...........']));
    expect(notes.map((note) => note.step)).toEqual([0, 20]);
  });

  it('ignores a hold that follows a rest', () => {
    expect(expandLead(makeSong(['.-..............']))).toEqual([]);
  });

  it('treats an empty riff as silence', () => {
    expect(expandLead(makeSong(['', '']))).toEqual([]);
  });

  it('marks letters as chords', () => {
    const [first] = expandLead(makeSong(['a...............']));
    expect(first?.chord).toBe(true);
  });
});

describe('song riffs', () => {
  it.each(SONGS.map((song) => [song.title, song] as const))('%s uses valid notation', (_, song) => {
    const bars = song.sections.flatMap((section) => section.riff);
    expect(bars.filter((bar) => !isValidRiffBar(bar))).toEqual([]);
  });

  it.each(SONGS.map((song) => [song.title, song] as const))('%s never overlaps lead notes', (_, song) => {
    const lead = expandLead(song);
    const overlaps = lead.filter((note, i) => {
      const next = lead[i + 1];
      return next !== undefined && note.step + note.steps > next.step;
    });
    expect(overlaps).toEqual([]);
  });
});
