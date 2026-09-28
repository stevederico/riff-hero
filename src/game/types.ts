export const LANE_COUNT = 5;
export const STEPS_PER_BEAT = 4;
export const STEPS_PER_BAR = 16;

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export type DrumStyle = 'none' | 'count' | 'rock' | 'drive' | 'punk' | 'half' | 'gallop' | 'double';
export type RhythmStyle = 'none' | 'chug' | 'stabs' | 'sustain' | 'gallop' | 'drive';
export type BassStyle = 'none' | 'roots' | 'eighths' | 'gallop';

/** One block of a song. `chords` and `riff` cycle when shorter than `bars`. */
export interface SongSection {
  name: string;
  bars: number;
  /** Chord root per bar, in semitones above the song root. */
  chords: readonly number[];
  /** Lead guitar per bar, 16 characters each. See `lead.ts` for the notation. */
  riff: readonly string[];
  drums: DrumStyle;
  rhythm: RhythmStyle;
  bass: BassStyle;
  /** Play a drum fill in the last bar. */
  fill?: boolean;
  /** Octaves to shift the lead guitar. */
  leadOctave?: number;
}

export interface SongTheme {
  /** Base hue (0 to 360) for the stage lights. */
  hue: number;
  /** Second hue for contrast lighting. */
  hueAlt: number;
}

export interface SongDef {
  id: string;
  title: string;
  artist: string;
  blurb: string;
  /** Rough feel shown on the song card, 1 (chill) to 3 (frantic). */
  intensity: number;
  bpm: number;
  /** MIDI note of the rhythm guitar root. */
  rootMidi: number;
  /** MIDI note of lead degree 0. */
  leadMidi: number;
  /** Scale as semitone offsets inside one octave. */
  scale: readonly number[];
  theme: SongTheme;
  sections: readonly SongSection[];
}

/** A lead guitar note on the 16th note grid. */
export interface LeadNote {
  /** Absolute step from the start of the song. */
  step: number;
  /** Length in steps. */
  steps: number;
  degree: number;
  midi: number;
  /** Played as a power chord. */
  chord: boolean;
  section: number;
  /** Absolute bar index. */
  bar: number;
}

/** A note the player has to hit. `id` is the index in the chart. */
export interface ChartNote {
  id: number;
  time: number;
  lane: number;
  /** Sustain length in seconds, 0 for a tap note. */
  duration: number;
  /** Surge phrase index, or -1. */
  phrase: number;
}

export interface Chart {
  songId: string;
  difficulty: Difficulty;
  notes: readonly ChartNote[];
  /** Note count per surge phrase. */
  phraseSizes: readonly number[];
  /** Seconds a note takes to travel the highway. */
  lookahead: number;
  /** Song length in seconds. */
  duration: number;
}

export type Grade = 'perfect' | 'great' | 'good';

export type PlayEvent =
  | { kind: 'hit'; note: ChartNote; grade: Grade; offset: number }
  | { kind: 'miss'; note: ChartNote }
  | { kind: 'stray'; lane: number }
  | { kind: 'hold'; lane: number; seconds: number }
  | { kind: 'holdEnd'; note: ChartNote; completed: boolean };

export type AudioEventType =
  | 'kick' | 'snare' | 'hat' | 'openHat' | 'crash' | 'tom' | 'click'
  | 'bass' | 'rhythm' | 'lead';

/** One scheduled sound. Times are in seconds from the start of the song. */
export interface AudioEvent {
  type: AudioEventType;
  time: number;
  duration: number;
  midi: number;
  velocity: number;
  /** Palm muted (rhythm) or power chord (lead). */
  flag: boolean;
}
