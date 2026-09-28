import type { SongDef } from '../types.ts';

const D_NATURAL_MINOR = [0, 2, 3, 5, 7, 8, 10];
const VERSE_CHORDS = [0, 0, 8, 10];
const CHORUS_CHORDS = [0, 10, 8, 7];

const VERSE = [
  'a-003-005-003-00',
  'a-003-005-007-54',
  'f-557-559-557-55',
  'g-668-668-669-87',
];

const CLIMB = [
  '5---7---9---7---',
  '5-7-9-7-5-7-9-7-',
  '6---8---6---8---',
  '6-7-8-9-8-7-6-4-',
];

const CHORUS = [
  '7---7-8-9---8-7-',
  '6---6-7-8---7-6-',
  '5---5-6-7---6-5-',
  '4---4-5-4---3-4-',
  '7---7-8-9---8-7-',
  '6---6-7-8---7-6-',
  '5---5-6-7---6-5-',
  '4-4-5-5-6-6-8-8-',
];

const SOLO = [
  '0-2-4-7-4-2-0245',
  '7---7-5-4-5-7---',
  '5-7-9-7-5-7-5432',
  '5---5-4-2-4-5---',
  '6-8-6-4-6-8-6789',
  '9---8-6-8-9-8-6-',
  '4-4-5-5-6-6-8-8-',
  '9-8-7-6-5-4-2-1-',
];

/** Song 3: a galloping metal chase in D minor. */
export const dragonFreeway: SongDef = {
  id: 'dragon-freeway',
  title: 'Dragon Freeway',
  artist: 'Iron Lantern',
  blurb: 'Galloping riffs at full throttle. Bring fast fingers and a spare pick.',
  intensity: 3,
  bpm: 165,
  rootMidi: 38,
  leadMidi: 50,
  scale: D_NATURAL_MINOR,
  theme: { hue: 12, hueAlt: 48 },
  sections: [
    { name: 'Count In', bars: 1, chords: [0], riff: [], drums: 'count', rhythm: 'none', bass: 'none' },
    {
      name: 'Intro', bars: 4, chords: VERSE_CHORDS, riff: ['a---------------', 'a-------a---a---', 'f-------f-------', 'g-------g---g-g-'],
      drums: 'half', rhythm: 'gallop', bass: 'gallop', fill: true,
    },
    {
      name: 'Verse', bars: 8, chords: VERSE_CHORDS, riff: VERSE,
      drums: 'gallop', rhythm: 'gallop', bass: 'gallop', fill: true,
    },
    {
      name: 'Climb', bars: 4, chords: [8, 8, 10, 10], riff: CLIMB,
      drums: 'half', rhythm: 'sustain', bass: 'eighths', fill: true,
    },
    {
      name: 'Chorus', bars: 8, chords: CHORUS_CHORDS, riff: CHORUS, leadOctave: 1,
      drums: 'double', rhythm: 'drive', bass: 'eighths', fill: true,
    },
    {
      name: 'Verse 2', bars: 8, chords: VERSE_CHORDS, riff: VERSE,
      drums: 'gallop', rhythm: 'gallop', bass: 'gallop', fill: true,
    },
    {
      name: 'Climb 2', bars: 4, chords: [8, 8, 10, 10], riff: CLIMB,
      drums: 'half', rhythm: 'sustain', bass: 'eighths', fill: true,
    },
    {
      name: 'Chorus 2', bars: 8, chords: CHORUS_CHORDS, riff: CHORUS, leadOctave: 1,
      drums: 'double', rhythm: 'drive', bass: 'eighths', fill: true,
    },
    {
      name: 'Solo', bars: 8, chords: [0, 0, 8, 8, 10, 10, 7, 7], riff: SOLO, leadOctave: 1,
      drums: 'double', rhythm: 'gallop', bass: 'gallop', fill: true,
    },
    {
      name: 'Last Chorus', bars: 8, chords: CHORUS_CHORDS, riff: CHORUS, leadOctave: 1,
      drums: 'double', rhythm: 'drive', bass: 'eighths', fill: true,
    },
    {
      name: 'Ending', bars: 1, chords: [0], riff: ['a---------------'],
      drums: 'none', rhythm: 'sustain', bass: 'roots',
    },
  ],
};
