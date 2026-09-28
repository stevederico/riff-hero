import { STEPS_PER_BAR } from './types.ts';
import type { LeadNote, SongDef, SongSection } from './types.ts';

/*
 * Riff notation: one string of 16 characters per bar, one per 16th note.
 *   '.'        rest
 *   '-'        hold the previous note one more step
 *   '0' to '9' single note on that scale degree
 *   'a' to 'j' power chord on scale degree 0 to 9
 * An empty string is a silent bar.
 */
const REST = '.';
const HOLD = '-';
const SILENT_BAR = REST.repeat(STEPS_PER_BAR);
const SEMITONES_PER_OCTAVE = 12;
const CHORD_BASE = 'a'.charCodeAt(0);
const DIGIT_BASE = '0'.charCodeAt(0);
const MAX_DEGREE = 9;

interface ParsedSymbol {
  degree: number;
  chord: boolean;
}

/** Pick an item from a list that repeats, or a fallback when the list is empty. */
export function cycle<T>(items: readonly T[], index: number, fallback: T): T {
  if (items.length === 0) return fallback;
  return items[index % items.length] ?? fallback;
}

/** Read one riff character. Returns null for anything that does not start a note. */
export function parseSymbol(char: string): ParsedSymbol | null {
  const code = char.charCodeAt(0);
  if (code >= DIGIT_BASE && code <= DIGIT_BASE + MAX_DEGREE) {
    return { degree: code - DIGIT_BASE, chord: false };
  }
  if (code >= CHORD_BASE && code <= CHORD_BASE + MAX_DEGREE) {
    return { degree: code - CHORD_BASE, chord: true };
  }
  return null;
}

/** Whether a riff bar is valid notation. */
export function isValidRiffBar(bar: string): boolean {
  if (bar === '') return true;
  if (bar.length !== STEPS_PER_BAR) return false;
  return [...bar].every((char) => char === REST || char === HOLD || parseSymbol(char) !== null);
}

/** MIDI note of a scale degree, walking up octaves past the end of the scale. */
export function degreeToMidi(song: SongDef, degree: number, octaveShift = 0): number {
  const size = song.scale.length;
  const octave = Math.floor(degree / size) + octaveShift;
  const offset = song.scale[degree % size] ?? 0;
  return song.leadMidi + offset + octave * SEMITONES_PER_OCTAVE;
}

function riffBar(section: SongSection, barInSection: number): string {
  const bar = cycle(section.riff, barInSection, '');
  return bar === '' ? SILENT_BAR : bar;
}

interface BarSlot {
  pattern: string;
  section: number;
  octave: number;
}

/** Every bar of the song in order, with its riff pattern. */
function listBars(song: SongDef): BarSlot[] {
  return song.sections.flatMap((section, sectionIndex) =>
    Array.from({ length: section.bars }, (_, barInSection) => ({
      pattern: riffBar(section, barInSection),
      section: sectionIndex,
      octave: section.leadOctave ?? 0,
    })),
  );
}

/** Expand every riff in the song into lead notes, in time order. */
export function expandLead(song: SongDef): LeadNote[] {
  const notes: LeadNote[] = [];
  let open: LeadNote | null = null;
  listBars(song).forEach((slot, bar) => {
    for (let i = 0; i < STEPS_PER_BAR; i += 1) {
      const char = slot.pattern.charAt(i);
      if (char === HOLD) {
        if (open) open.steps += 1;
        continue;
      }
      const symbol = parseSymbol(char);
      open = symbol && {
        step: bar * STEPS_PER_BAR + i,
        steps: 1,
        degree: symbol.degree,
        midi: degreeToMidi(song, symbol.degree, slot.octave),
        chord: symbol.chord,
        section: slot.section,
        bar,
      };
      if (open) notes.push(open);
    }
  });
  return notes;
}
