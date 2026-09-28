import { cycle, expandLead } from './lead.ts';
import {
  BASS_PATTERNS, DRUM_PATTERNS, FILL, RHYTHM_PATTERNS, parseDrums, parsePattern,
} from './patterns.ts';
import { stepSeconds, stepToTime } from './timing.ts';
import { STEPS_PER_BAR, STEPS_PER_BEAT } from './types.ts';
import type { AudioEvent, AudioEventType, SongDef, SongSection } from './types.ts';

const SEMITONES_PER_OCTAVE = 12;
/** Rhythm guitar roots above this MIDI note drop an octave to stay heavy. */
const RHYTHM_CEILING_MIDI = 52;
const HIGH_TOM_MIDI = 50;
const LOW_TOM_MIDI = 43;
const HAT_VELOCITY = 0.7;
const NOTE_GATE = 0.92;

interface BarContext {
  song: SongDef;
  section: SongSection;
  /** Absolute step of the first step in the bar. */
  startStep: number;
  isFirst: boolean;
  isFill: boolean;
  rootMidi: number;
}

function makeEvent(
  ctx: BarContext, type: AudioEventType, step: number, extra: Partial<AudioEvent> = {},
): AudioEvent {
  return {
    type,
    time: stepToTime(ctx.startStep + step, ctx.song.bpm),
    duration: stepSeconds(ctx.song.bpm),
    midi: 0,
    velocity: 1,
    flag: false,
    ...extra,
  };
}

function drumHits(ctx: BarContext, type: AudioEventType, pattern: string, velocity = 1): AudioEvent[] {
  return parseDrums(pattern)
    .filter((hit) => !ctx.isFill || type === 'kick' || hit.step < FILL.startStep)
    .map((hit) => makeEvent(ctx, type, hit.step, { velocity: hit.velocity * velocity }));
}

function fillHits(ctx: BarContext): AudioEvent[] {
  const toms = (pattern: string, midi: number): AudioEvent[] =>
    parseDrums(pattern).map((hit) => makeEvent(ctx, 'tom', hit.step, { midi }));
  return [
    ...parseDrums(FILL.snare).map((hit) => makeEvent(ctx, 'snare', hit.step)),
    ...toms(FILL.highTom, HIGH_TOM_MIDI),
    ...toms(FILL.lowTom, LOW_TOM_MIDI),
  ];
}

function drumEvents(ctx: BarContext): AudioEvent[] {
  if (ctx.section.drums === 'count') {
    return [0, 1, 2, 3].map((beat) => makeEvent(ctx, 'click', beat * STEPS_PER_BEAT));
  }
  const pattern = DRUM_PATTERNS[ctx.section.drums];
  const events = [
    ...drumHits(ctx, 'kick', pattern.kick),
    ...drumHits(ctx, 'snare', pattern.snare),
    ...drumHits(ctx, 'hat', pattern.hat, HAT_VELOCITY),
    ...drumHits(ctx, 'openHat', pattern.openHat, HAT_VELOCITY),
  ];
  if (ctx.isFirst) events.push(makeEvent(ctx, 'crash', 0));
  if (ctx.isFirst && ctx.section.drums === 'none') events.push(makeEvent(ctx, 'kick', 0));
  if (ctx.isFill) events.push(...fillHits(ctx));
  return events;
}

function stringEvents(ctx: BarContext): AudioEvent[] {
  const step = stepSeconds(ctx.song.bpm);
  const rhythm = parsePattern(RHYTHM_PATTERNS[ctx.section.rhythm]).map((note) =>
    makeEvent(ctx, 'rhythm', note.step, {
      midi: ctx.rootMidi,
      duration: note.steps * step * NOTE_GATE,
      flag: note.muted,
    }));
  const bass = parsePattern(BASS_PATTERNS[ctx.section.bass]).map((note) =>
    makeEvent(ctx, 'bass', note.step, {
      midi: ctx.rootMidi - SEMITONES_PER_OCTAVE,
      duration: note.steps * step * NOTE_GATE,
      flag: note.muted,
    }));
  return [...rhythm, ...bass];
}

function rhythmRoot(song: SongDef, chord: number): number {
  const midi = song.rootMidi + chord;
  return midi > RHYTHM_CEILING_MIDI ? midi - SEMITONES_PER_OCTAVE : midi;
}

function listBars(song: SongDef): BarContext[] {
  let bar = 0;
  return song.sections.flatMap((section) =>
    Array.from({ length: section.bars }, (_, index) => {
      const context: BarContext = {
        song,
        section,
        startStep: bar * STEPS_PER_BAR,
        isFirst: index === 0,
        isFill: section.fill === true && index === section.bars - 1,
        rootMidi: rhythmRoot(song, cycle(section.chords, index, 0)),
      };
      bar += 1;
      return context;
    }));
}

function leadEvents(song: SongDef): AudioEvent[] {
  return expandLead(song).map((note) => ({
    type: 'lead',
    time: stepToTime(note.step, song.bpm),
    duration: stepToTime(note.steps, song.bpm) * NOTE_GATE,
    midi: note.midi,
    velocity: 1,
    flag: note.chord,
  }));
}

/** Every sound in the song: drums, bass, rhythm guitar and lead guitar, in time order. */
export function buildArrangement(song: SongDef): AudioEvent[] {
  const backing = listBars(song).flatMap((ctx) => [...drumEvents(ctx), ...stringEvents(ctx)]);
  return [...backing, ...leadEvents(song)].sort((a, b) => a.time - b.time);
}
