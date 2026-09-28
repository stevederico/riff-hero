import type { AudioEngine } from '../audio/engine.ts';
import { playFail, playMiss, playPhrase, playSurge } from '../audio/sfx.ts';
import { SongPlayer } from '../audio/songPlayer.ts';
import { buildArrangement } from '../game/arrangement.ts';
import { buildChart } from '../game/chart.ts';
import { HIT_WINDOWS, Judge } from '../game/judge.ts';
import { ScoreKeeper } from '../game/scoring.ts';
import { LANE_COUNT } from '../game/types.ts';
import type { Chart, Difficulty, PlayEvent, SongDef } from '../game/types.ts';
import type { Effects } from '../render/effects.ts';
import type { Frame } from '../render/frame.ts';
import type { Layout } from '../render/projection.ts';
import { Bot } from './bot.ts';

const LEAD_IN_SECONDS = 1.6;
const SPARK_INTERVAL_SECONDS = 0.05;
const MISS_SOUND_GAP_SECONDS = 0.12;
const MS_PER_SECOND = 1000;
/** Input older than this is judged as if it just happened, in case a timestamp is off. */
const MAX_INPUT_AGE_SECONDS = 0.25;

export type Outcome = 'playing' | 'finished' | 'failed';

export interface SessionOptions {
  song: SongDef;
  difficulty: Difficulty;
  /** Null plays silent on the wall clock, for the menu backdrop. */
  engine: AudioEngine | null;
  /** Player's audio offset setting, in seconds. */
  offset: number;
  /** Let the computer play. */
  isBot: boolean;
  effects: Effects;
  getLayout: () => Layout;
  onBanner: (text: string) => void;
}

/** One play through of a song: clock, judging, score and feedback. */
export class Session {
  readonly chart: Chart;
  readonly judge: Judge;
  readonly score: ScoreKeeper;
  readonly pressed: boolean[] = Array.from({ length: LANE_COUNT }, () => false);
  outcome: Outcome = 'playing';
  private readonly player: SongPlayer;
  private readonly bot: Bot | null;
  private sparkTimer = 0;
  private lastMissSound = Number.NEGATIVE_INFINITY;
  private offset: number;

  constructor(private readonly options: SessionOptions) {
    this.chart = buildChart(options.song, options.difficulty);
    this.judge = new Judge(this.chart.notes);
    this.score = new ScoreKeeper(this.chart);
    this.player = new SongPlayer(options.engine, buildArrangement(options.song));
    this.bot = options.isBot ? new Bot(this) : null;
    this.offset = options.offset;
  }

  get song(): SongDef {
    return this.options.song;
  }

  get difficulty(): Difficulty {
    return this.options.difficulty;
  }

  get isBot(): boolean {
    return this.options.isBot;
  }

  /** Song time the player is hearing. */
  get time(): number {
    return this.player.heardTime - this.offset;
  }

  /**
   * Song time when an input event happened, from its timestamp in milliseconds on
   * the performance clock. Presses are judged when they happened, not when the page got to them.
   */
  timeAtStamp(stampMs: number): number {
    const age = (performance.now() - stampMs) / MS_PER_SECOND;
    return this.time - Math.min(MAX_INPUT_AGE_SECONDS, Math.max(0, age));
  }

  /** Change the audio offset, in seconds. Takes effect straight away. */
  setOffset(seconds: number): void {
    this.offset = seconds;
  }

  get isInterrupted(): boolean {
    return this.player.isInterrupted;
  }

  start(): void {
    this.player.start(LEAD_IN_SECONDS);
  }

  pause(): void {
    this.releaseAll();
    this.player.pause();
  }

  /** Carry on after a pause. Start the audio engine first so the song has sound. */
  resume(): void {
    this.player.resume();
  }

  stop(): void {
    this.player.stop();
  }

  /** A lane was pressed. `at` defaults to now; the bot passes the exact note time. */
  press(lane: number, at = this.time): void {
    if (this.outcome !== 'playing' || this.pressed[lane]) return;
    this.pressed[lane] = true;
    if (this.isBeforeFirstNote(at)) return;
    this.handle(this.judge.press(lane, at));
  }

  /** Warm up presses during the count in cost nothing. */
  private isBeforeFirstNote(at: number): boolean {
    const [first] = this.chart.notes;
    return first !== undefined && at < first.time - HIT_WINDOWS.good;
  }

  release(lane: number, at = this.time): void {
    if (!this.pressed[lane]) return;
    this.pressed[lane] = false;
    this.handle(this.judge.release(lane, at));
  }

  activateSurge(): void {
    if (this.outcome !== 'playing' || !this.score.activateSurge()) return;
    this.options.onBanner('SURGE!');
    if (this.options.engine) playSurge(this.options.engine);
  }

  /** Advance the song. `seconds` is the time since the last update. */
  update(seconds: number): void {
    if (this.outcome !== 'playing') return;
    this.player.pump();
    this.bot?.step(this.time);
    this.handle(this.judge.advance(this.time));
    this.score.tick(seconds);
    this.emitSparks(seconds);
    if (this.score.isFailed) this.finish('failed');
    else if (this.time >= this.chart.duration) this.finish('finished');
  }

  /** Snapshot for the renderer. */
  frame(view: Pick<Frame, 'showKeys' | 'showHud' | 'reducedMotion'>): Frame {
    return {
      ...view,
      time: this.time,
      song: this.options.song,
      chart: this.chart,
      status: this.judge.status,
      pressed: this.pressed,
      holding: this.pressed.map((_, lane) => this.judge.isHolding(lane)),
      score: this.score,
    };
  }

  private releaseAll(): void {
    for (let lane = 0; lane < LANE_COUNT; lane += 1) this.release(lane);
  }

  private finish(outcome: Outcome): void {
    this.outcome = outcome;
    this.releaseAll();
    if (outcome === 'failed' && this.options.engine) playFail(this.options.engine);
    this.player.stop();
  }

  private handle(events: PlayEvent[]): void {
    for (const event of events) {
      const wasReady = this.score.canActivateSurge;
      const feedback = this.score.apply(event);
      this.react(event);
      if (!feedback.phraseCompleted) continue;
      if (this.options.engine) playPhrase(this.options.engine);
      if (!wasReady && this.score.canActivateSurge) this.options.onBanner('SURGE READY');
    }
  }

  private react(event: PlayEvent): void {
    const { effects, getLayout } = this.options;
    if (event.kind === 'hit') {
      effects.hit(getLayout(), event.note.lane, event.grade, this.score.isSurgeActive);
      this.player.setLeadAudible(true);
      return;
    }
    if (event.kind === 'miss') {
      effects.miss(event.note.lane);
      this.player.setLeadAudible(false);
    }
    if (event.kind === 'miss' || event.kind === 'stray') this.playMissSound();
  }

  private playMissSound(): void {
    const { engine } = this.options;
    if (!engine || this.time - this.lastMissSound < MISS_SOUND_GAP_SECONDS) return;
    this.lastMissSound = this.time;
    playMiss(engine);
  }

  private emitSparks(seconds: number): void {
    this.sparkTimer += seconds;
    if (this.sparkTimer < SPARK_INTERVAL_SECONDS) return;
    this.sparkTimer = 0;
    for (let lane = 0; lane < LANE_COUNT; lane += 1) {
      if (!this.judge.isHolding(lane)) continue;
      this.options.effects.sustain(this.options.getLayout(), lane, this.score.isSurgeActive);
    }
  }
}
