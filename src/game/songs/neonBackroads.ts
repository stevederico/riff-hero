import type { SongDef } from '../types.ts';

const E_MINOR_PENTATONIC = [0, 3, 5, 7, 10];
const VERSE_CHORDS = [0, 0, 3, 5];
const CHORUS_CHORDS = [8, 10, 0, 0];

/* 16th note pickups on the off steps only show up on Hard, which keeps every 16th. */
const VERSE = [
  'a-.0.01.2-1-0.01',
  'a-.0.01.2-4-2-12',
  'b-.1.12.4-2-1.12',
  'c-.2.24.5---4-21',
];

const VERSE_BUSY = [
  'a-.0101.21210.01',
  'a-.0101.2-4-2-12',
  'b-.1212.42421.12',
  'c-.2424.5---4-21',
];

const CHORUS = [
  '6---6-5-4---5-45',
  '7---7-6-5---4-34',
  'f---5-6-5-4-5-45',
  '5-4-3-4-5-------',
  '6---6-5-4---5-45',
  '7---7-6-5---7-67',
  '8---8-9-8-7-8-78',
  '8-7-5-4-f-------',
];

const SOLO = [
  '5656765.7-6-5-4-',
  '5-4-3-4-5654567-',
  '6767876.8-7-6-5-',
  '7-6-5-6-7678789-',
  '9898787.7-6-5-6-',
  '7-6-5-6-5454343-',
  '565.454.343.232.',
  '1-0-1-2-a-------',
];

/** Song 1: a mid tempo road trip rocker in E minor. */
export const neonBackroads: SongDef = {
  id: 'neon-backroads',
  title: 'Neon Backroads',
  artist: 'The Static Pilots',
  blurb: 'Windows down, amps up. A cruising rocker to warm up your fingers.',
  intensity: 1,
  bpm: 112,
  rootMidi: 40,
  leadMidi: 52,
  scale: E_MINOR_PENTATONIC,
  theme: { hue: 285, hueAlt: 190 },
  sections: [
    { name: 'Count In', bars: 1, chords: [0], riff: [], drums: 'count', rhythm: 'none', bass: 'none' },
    {
      name: 'Intro', bars: 2, chords: [0, 0], riff: ['5-------4-------', '3-------1---2---'],
      drums: 'rock', rhythm: 'chug', bass: 'eighths', fill: true,
    },
    {
      name: 'Verse', bars: 8, chords: VERSE_CHORDS, riff: VERSE,
      drums: 'rock', rhythm: 'chug', bass: 'eighths', fill: true,
    },
    {
      name: 'Chorus', bars: 8, chords: CHORUS_CHORDS, riff: CHORUS,
      drums: 'drive', rhythm: 'sustain', bass: 'eighths', fill: true,
    },
    {
      name: 'Verse 2', bars: 4, chords: VERSE_CHORDS, riff: VERSE_BUSY,
      drums: 'rock', rhythm: 'chug', bass: 'eighths', fill: true,
    },
    {
      name: 'Chorus 2', bars: 8, chords: CHORUS_CHORDS, riff: CHORUS,
      drums: 'drive', rhythm: 'sustain', bass: 'eighths', fill: true,
    },
    {
      name: 'Solo', bars: 8, chords: [0, 0, 3, 5, 8, 10, 0, 0], riff: SOLO,
      drums: 'half', rhythm: 'stabs', bass: 'roots', fill: true,
    },
    {
      name: 'Last Chorus', bars: 8, chords: CHORUS_CHORDS, riff: CHORUS,
      drums: 'drive', rhythm: 'sustain', bass: 'eighths', fill: true,
    },
    {
      name: 'Ending', bars: 1, chords: [0], riff: ['a---------------'],
      drums: 'none', rhythm: 'sustain', bass: 'roots',
    },
  ],
};
