import type { SongDef } from '../types.ts';

const A_NATURAL_MINOR = [0, 2, 3, 5, 7, 8, 10];
const MAIN_CHORDS = [0, 8, 3, 10];
const BUILD_CHORDS = [8, 10, 8, 10];

/* 16th note pickups and tremolo on the off steps only show up on Hard, which keeps every 16th. */
const VERSE = [
  'a-..4-4-7-4-0.04',
  'f-..7-7-9-7-5.57',
  'c-..4-4-6-4-2.24',
  'd-..6-6-8-6-4-34',
];

const VERSE_BUSY = [
  'a-.44-4-7-4-0.04',
  'f-.77-7-9-7-5.57',
  'c-.44-4-6-4-2.24',
  'd-.66-6-8-6-4-34',
];

const BUILD = [
  '5-555-557-777-77',
  '6-666-668-888-88',
  '5-555-557-777-77',
  '6-668-889-------',
];

const CHORUS = [
  '7-----7-9---7-67',
  '5-----5-7---5-45',
  '4-----4-6---4-34',
  '6---4---3---1-01',
  '7-----7-9---7-67',
  '5-----5-7---5-45',
  '4-----4-6---8-78',
  '6-6-8-8-9-------',
];

const BRIDGE = [
  '7-4-79797-4-2-42',
  '7-4-797-7-479-74',
  '5-2-57575-2-0-20',
  '5-2-575-5-257-52',
  '6-4-69696-4-2-42',
  '6-4-696-6-469-64',
  '6-3-68686-3-1-31',
  '8-6-8-6-3468a---',
];

/** Song 2: an upbeat punk sprint in A minor. */
export const voltageParade: SongDef = {
  id: 'voltage-parade',
  title: 'Voltage Parade',
  artist: 'Kid Capacitor',
  blurb: 'A fizzy punk sprint with a chorus that refuses to leave your head.',
  intensity: 2,
  bpm: 140,
  rootMidi: 45,
  leadMidi: 57,
  scale: A_NATURAL_MINOR,
  theme: { hue: 160, hueAlt: 40 },
  sections: [
    { name: 'Count In', bars: 1, chords: [0], riff: [], drums: 'count', rhythm: 'none', bass: 'none' },
    {
      name: 'Intro', bars: 2, chords: [0, 0], riff: ['a---------------', 'a-------a---a---'],
      drums: 'half', rhythm: 'sustain', bass: 'roots', fill: true,
    },
    {
      name: 'Verse', bars: 8, chords: MAIN_CHORDS, riff: VERSE,
      drums: 'punk', rhythm: 'drive', bass: 'eighths', fill: true,
    },
    {
      name: 'Build', bars: 4, chords: BUILD_CHORDS, riff: BUILD,
      drums: 'drive', rhythm: 'chug', bass: 'eighths', fill: true,
    },
    {
      name: 'Chorus', bars: 8, chords: MAIN_CHORDS, riff: CHORUS,
      drums: 'drive', rhythm: 'sustain', bass: 'eighths', fill: true,
    },
    {
      name: 'Verse 2', bars: 4, chords: MAIN_CHORDS, riff: VERSE_BUSY,
      drums: 'punk', rhythm: 'drive', bass: 'eighths', fill: true,
    },
    {
      name: 'Build 2', bars: 4, chords: BUILD_CHORDS, riff: BUILD,
      drums: 'drive', rhythm: 'chug', bass: 'eighths', fill: true,
    },
    {
      name: 'Chorus 2', bars: 8, chords: MAIN_CHORDS, riff: CHORUS,
      drums: 'drive', rhythm: 'sustain', bass: 'eighths', fill: true,
    },
    {
      name: 'Bridge', bars: 8, chords: [0, 0, 8, 8, 3, 3, 10, 10], riff: BRIDGE,
      drums: 'half', rhythm: 'stabs', bass: 'roots', fill: true,
    },
    {
      name: 'Last Chorus', bars: 8, chords: MAIN_CHORDS, riff: CHORUS,
      drums: 'drive', rhythm: 'sustain', bass: 'eighths', fill: true,
    },
    {
      name: 'Ending', bars: 1, chords: [0], riff: ['a---------------'],
      drums: 'none', rhythm: 'sustain', bass: 'roots',
    },
  ],
};
