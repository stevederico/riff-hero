import { expandLead } from './lead.ts';
import { songDuration, stepSeconds, stepToTime } from './timing.ts';
import { STEPS_PER_BAR } from './types.ts';
import type { Chart, ChartNote, Difficulty, LeadNote, SongDef } from './types.ts';

export interface DifficultyRules {
  /** Keep only notes that start on this step grid (4 = quarter notes). */
  grid: number;
  /** Smallest gap between two note times, in seconds. */
  minGap: number;
  /** Optional cap on bursts: at most `notes` notes in any window of `seconds`. */
  burst?: { notes: number; seconds: number };
  /** Number of lanes in use, counted from the left. */
  lanes: number;
  chords: 'none' | 'some' | 'all';
  /** Notes at least this many steps long become sustains. */
  sustainMinSteps: number;
  lookahead: number;
}

export const RULES: Record<Difficulty, DifficultyRules> = {
  easy: {
    grid: 4, minGap: 0.36, burst: { notes: 3, seconds: 1.2 }, lanes: 3, chords: 'none', sustainMinSteps: 6, lookahead: 2.4,
  },
  medium: {
    grid: 2, minGap: 0.18, burst: { notes: 8, seconds: 2 }, lanes: 4, chords: 'some', sustainMinSteps: 6, lookahead: 1.9,
  },
  hard: { grid: 1, minGap: 0.085, lanes: 5, chords: 'all', sustainMinSteps: 6, lookahead: 1.5 },
};

const GAP_TOLERANCE = 0.001;
const CHORD_LANE_SPREAD = 2;
const PHRASE_PERIOD_BARS = 6;
const PHRASE_START_BAR = 4;
const MIN_PHRASE_NOTES = 3;
const BEAT_STRENGTH_GRIDS = [16, 8, 4, 2];

interface DraftNote {
  time: number;
  lane: number;
  duration: number;
  bar: number;
}

/** Rank of a step inside its bar: 0 for the downbeat, higher for weaker beats. */
export function beatStrength(step: number): number {
  const inBar = step % STEPS_PER_BAR;
  const rank = BEAT_STRENGTH_GRIDS.findIndex((grid) => inBar % grid === 0);
  return rank < 0 ? BEAT_STRENGTH_GRIDS.length : rank;
}

/** Whether adding a step keeps every window of `burst.seconds` at `burst.notes` notes or fewer. */
export function fitsBurst(keptSteps: readonly number[], step: number, rules: DifficultyRules, bpm: number): boolean {
  if (!rules.burst) return true;
  const { notes, seconds } = rules.burst;
  const windowSteps = (seconds - GAP_TOLERANCE) / stepSeconds(bpm);
  const nearby = keptSteps.filter((other) => Math.abs(other - step) < windowSteps);
  const steps = [...nearby, step].sort((a, b) => a - b);
  return steps.every((start, i) => {
    const end = steps[i + notes];
    return end === undefined || end - start >= windowSteps;
  });
}

/** Drop notes until the part fits the difficulty, keeping the strongest beats. */
export function thinLead(lead: readonly LeadNote[], rules: DifficultyRules, bpm: number): LeadNote[] {
  const onGrid = lead.filter((note) => (note.step % STEPS_PER_BAR) % rules.grid === 0);
  const byStrength = [...onGrid].sort(
    (a, b) => beatStrength(a.step) - beatStrength(b.step) || a.step - b.step,
  );
  const minSteps = (rules.minGap - GAP_TOLERANCE) / stepSeconds(bpm);
  const kept: LeadNote[] = [];
  const keptSteps: number[] = [];
  for (const note of byStrength) {
    const isSpaced = keptSteps.every((other) => Math.abs(other - note.step) >= minSteps);
    if (!isSpaced || !fitsBurst(keptSteps, note.step, rules, bpm)) continue;
    kept.push(note);
    keptSteps.push(note.step);
  }
  return kept.sort((a, b) => a.step - b.step);
}

/** Lane for a pitch: higher pitches sit further right, spread over the lanes in use. */
export function laneForDegree(degrees: readonly number[], degree: number, lanes: number): number {
  const index = Math.max(0, degrees.indexOf(degree));
  const count = degrees.length;
  if (count <= lanes) return index + Math.floor((lanes - count) / 2);
  return Math.round((index * (lanes - 1)) / (count - 1));
}

function degreesBySection(notes: readonly LeadNote[]): Map<number, number[]> {
  const sections = new Map<number, Set<number>>();
  for (const note of notes) {
    const set = sections.get(note.section) ?? new Set<number>();
    set.add(note.degree);
    sections.set(note.section, set);
  }
  const sorted = new Map<number, number[]>();
  sections.forEach((set, section) => sorted.set(section, [...set].sort((a, b) => a - b)));
  return sorted;
}

function wantsChord(note: LeadNote, rules: DifficultyRules): boolean {
  if (!note.chord || rules.chords === 'none') return false;
  if (rules.chords === 'all') return true;
  return note.step % STEPS_PER_BAR === 0 && note.bar % 2 === 0;
}

function partnerLane(lane: number, lanes: number): number {
  return lane + CHORD_LANE_SPREAD < lanes ? lane + CHORD_LANE_SPREAD : lane - CHORD_LANE_SPREAD;
}

function draftNotes(song: SongDef, kept: readonly LeadNote[], rules: DifficultyRules): DraftNote[] {
  const degrees = degreesBySection(kept);
  const drafts: DraftNote[] = [];
  for (const note of kept) {
    const lane = laneForDegree(degrees.get(note.section) ?? [], note.degree, rules.lanes);
    const isSustain = note.steps >= rules.sustainMinSteps;
    const draft: DraftNote = {
      time: stepToTime(note.step, song.bpm),
      lane,
      duration: isSustain ? stepToTime(note.steps - 1, song.bpm) : 0,
      bar: note.bar,
    };
    drafts.push(draft);
    if (wantsChord(note, rules)) drafts.push({ ...draft, lane: partnerLane(lane, rules.lanes) });
  }
  return drafts.sort((a, b) => a.time - b.time || a.lane - b.lane);
}

/** Group notes in every sixth pair of bars into surge phrases. Returns a phrase per note. */
function assignPhrases(drafts: readonly DraftNote[]): { phrases: number[]; sizes: number[] } {
  const windowOf = (bar: number): number =>
    bar % PHRASE_PERIOD_BARS >= PHRASE_START_BAR ? Math.floor(bar / PHRASE_PERIOD_BARS) : -1;
  const counts = new Map<number, number>();
  for (const draft of drafts) {
    const window = windowOf(draft.bar);
    if (window >= 0) counts.set(window, (counts.get(window) ?? 0) + 1);
  }
  const sizes: number[] = [];
  const indexOf = new Map<number, number>();
  counts.forEach((count, window) => {
    if (count < MIN_PHRASE_NOTES) return;
    indexOf.set(window, sizes.length);
    sizes.push(count);
  });
  return { phrases: drafts.map((draft) => indexOf.get(windowOf(draft.bar)) ?? -1), sizes };
}

/** Build the playable chart for a song from its lead guitar part. */
export function buildChart(song: SongDef, difficulty: Difficulty): Chart {
  const rules = RULES[difficulty];
  const kept = thinLead(expandLead(song), rules, song.bpm);
  const drafts = draftNotes(song, kept, rules);
  const { phrases, sizes } = assignPhrases(drafts);
  const notes: ChartNote[] = drafts.map((draft, id) => ({
    id,
    time: draft.time,
    lane: draft.lane,
    duration: draft.duration,
    phrase: phrases[id] ?? -1,
  }));
  return {
    songId: song.id,
    difficulty,
    notes,
    phraseSizes: sizes,
    lookahead: rules.lookahead,
    duration: songDuration(song),
  };
}
