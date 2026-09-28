import { STEPS_PER_BAR, STEPS_PER_BEAT } from './types.ts';
import type { SongDef } from './types.ts';

const SECONDS_PER_MINUTE = 60;
/** Silence after the last bar so the final chord can ring out. */
export const SONG_TAIL_SECONDS = 1.6;

/** Length of one 16th note step in seconds. */
export function stepSeconds(bpm: number): number {
  return SECONDS_PER_MINUTE / bpm / STEPS_PER_BEAT;
}

/** Length of one beat in seconds. */
export function beatSeconds(bpm: number): number {
  return SECONDS_PER_MINUTE / bpm;
}

/** Song time in seconds of an absolute step. */
export function stepToTime(step: number, bpm: number): number {
  return step * stepSeconds(bpm);
}

/** Total bars in a song. */
export function songBars(song: SongDef): number {
  return song.sections.reduce((total, section) => total + section.bars, 0);
}

/** Song length in seconds, including the ring out tail. */
export function songDuration(song: SongDef): number {
  return stepToTime(songBars(song) * STEPS_PER_BAR, song.bpm) + SONG_TAIL_SECONDS;
}

/** MIDI note number to frequency in Hz. */
export function midiToFrequency(midi: number): number {
  const A4_MIDI = 69;
  const A4_HZ = 440;
  const SEMITONES = 12;
  return A4_HZ * 2 ** ((midi - A4_MIDI) / SEMITONES);
}
