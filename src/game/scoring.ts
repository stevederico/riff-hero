import type { Chart, ChartNote, Difficulty, Grade, PlayEvent } from './types.ts';

export const GRADE_POINTS: Record<Grade, number> = { perfect: 100, great: 75, good: 50 };
export const HOLD_POINTS_PER_SECOND = 120;
export const COMBO_PER_MULTIPLIER = 10;
export const MAX_COMBO_MULTIPLIER = 4;
export const SURGE_MULTIPLIER = 2;
export const SURGE_PER_PHRASE = 0.25;
export const SURGE_TO_ACTIVATE = 0.5;
export const SURGE_DRAIN_PER_SECOND = 1 / 16;
/**
 * Share of the star points needed for each star. Star points leave out the combo
 * multiplier and surge, so hitting half the notes cleanly earns three stars.
 */
export const STAR_THRESHOLDS = [0.28, 0.35, 0.39, 0.6, 0.85];
export const CROWD_START = 0.65;
const CROWD_HIT_GAIN = 0.015;
const CROWD_PERFECT_GAIN = 0.022;
/**
 * Crowd lost per miss. A player holds steady at about 40% of notes hit on Easy,
 * 50% on Medium and 60% on Hard, and sinks below that.
 */
const CROWD_MISS_LOSS: Record<Difficulty, number> = { easy: 0.013, medium: 0.018, hard: 0.028 };
/** A press with no note costs this share of a miss. */
const STRAY_SHARE_OF_MISS = 0.5;

export interface Feedback {
  points: number;
  phraseCompleted: boolean;
  comboBroken: boolean;
}

export type GradeCounts = Record<Grade | 'miss', number>;

/** Multiplier earned from the combo alone. */
export function comboMultiplier(combo: number): number {
  return Math.min(MAX_COMBO_MULTIPLIER, 1 + Math.floor(combo / COMBO_PER_MULTIPLIER));
}

/** Star points for hitting every note perfectly and holding every sustain to the end. */
export function maxStarPoints(chart: Chart): number {
  return chart.notes.reduce(
    (total, note) => total + GRADE_POINTS.perfect + note.duration * HOLD_POINTS_PER_SECOND,
    0,
  );
}

/** Stars earned for some star points, 0 to 5. */
export function starsFor(points: number, maxPoints: number): number {
  if (maxPoints <= 0) return 0;
  return STAR_THRESHOLDS.filter((threshold) => points / maxPoints >= threshold).length;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Turns judged events into score, combo, surge and the crowd meter. */
export class ScoreKeeper {
  score = 0;
  /** Points without the combo multiplier or surge, used for stars. */
  starPoints = 0;
  combo = 0;
  maxCombo = 0;
  surge = 0;
  isSurgeActive = false;
  crowd = CROWD_START;
  readonly counts: GradeCounts = { perfect: 0, great: 0, good: 0, miss: 0 };
  readonly maxStarPoints: number;
  private readonly phraseHits: number[];
  private readonly phraseFailed: boolean[];
  /** Time of the last missed note, so both notes of a missed chord cost the crowd once. */
  private lastMissTime = Number.NEGATIVE_INFINITY;

  constructor(private readonly chart: Chart) {
    this.maxStarPoints = maxStarPoints(chart);
    this.phraseHits = chart.phraseSizes.map(() => 0);
    this.phraseFailed = chart.phraseSizes.map(() => false);
  }

  get multiplier(): number {
    return comboMultiplier(this.combo) * (this.isSurgeActive ? SURGE_MULTIPLIER : 1);
  }

  get isFailed(): boolean {
    return this.crowd <= 0;
  }

  get stars(): number {
    return starsFor(this.starPoints, this.maxStarPoints);
  }

  get hits(): number {
    return this.counts.perfect + this.counts.great + this.counts.good;
  }

  /** Share of the notes played so far that were hit, 0 to 1. */
  get accuracy(): number {
    const judged = this.hits + this.counts.miss;
    return judged === 0 ? 0 : this.hits / judged;
  }

  get isFullCombo(): boolean {
    return this.chart.notes.length > 0 && this.hits === this.chart.notes.length;
  }

  get canActivateSurge(): boolean {
    return !this.isSurgeActive && this.surge >= SURGE_TO_ACTIVATE;
  }

  /** Apply one judged event and report what changed. */
  apply(event: PlayEvent): Feedback {
    switch (event.kind) {
      case 'hit': return this.applyHit(event.note.phrase, event.grade);
      case 'miss': return this.applyMiss(event.note);
      case 'stray': return this.breakCombo(CROWD_MISS_LOSS[this.chart.difficulty] * STRAY_SHARE_OF_MISS);
      case 'hold': return this.addPoints(event.seconds * HOLD_POINTS_PER_SECOND);
      case 'holdEnd': return { points: 0, phraseCompleted: false, comboBroken: false };
    }
  }

  /** Start surge if the meter is full enough. Returns whether it started. */
  activateSurge(): boolean {
    if (!this.canActivateSurge) return false;
    this.isSurgeActive = true;
    return true;
  }

  /** Drain the surge meter while it is active. */
  tick(seconds: number): void {
    if (!this.isSurgeActive) return;
    this.surge = clamp01(this.surge - seconds * SURGE_DRAIN_PER_SECOND);
    if (this.surge <= 0) this.isSurgeActive = false;
  }

  private applyHit(phrase: number, grade: Grade): Feedback {
    this.counts[grade] += 1;
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const gain = grade === 'perfect' ? CROWD_PERFECT_GAIN : CROWD_HIT_GAIN;
    this.crowd = clamp01(this.crowd + gain * (this.isSurgeActive ? SURGE_MULTIPLIER : 1));
    const feedback = this.addPoints(GRADE_POINTS[grade]);
    feedback.phraseCompleted = this.creditPhrase(phrase);
    return feedback;
  }

  private applyMiss(note: ChartNote): Feedback {
    this.counts.miss += 1;
    if (note.phrase >= 0) this.phraseFailed[note.phrase] = true;
    const isSameChord = note.time === this.lastMissTime;
    this.lastMissTime = note.time;
    return this.breakCombo(isSameChord ? 0 : CROWD_MISS_LOSS[this.chart.difficulty]);
  }

  private breakCombo(crowdLoss: number): Feedback {
    const comboBroken = this.combo > 0;
    this.combo = 0;
    this.crowd = clamp01(this.crowd - crowdLoss);
    return { points: 0, phraseCompleted: false, comboBroken };
  }

  /** Add points before the multiplier. Stars count them plain, the score multiplies them. */
  private addPoints(basePoints: number): Feedback {
    const points = basePoints * this.multiplier;
    this.starPoints += basePoints;
    this.score += points;
    return { points, phraseCompleted: false, comboBroken: false };
  }

  private creditPhrase(phrase: number): boolean {
    if (phrase < 0 || this.phraseFailed[phrase]) return false;
    const hits = (this.phraseHits[phrase] ?? 0) + 1;
    this.phraseHits[phrase] = hits;
    if (hits !== this.chart.phraseSizes[phrase]) return false;
    this.surge = clamp01(this.surge + SURGE_PER_PHRASE);
    return true;
  }
}
