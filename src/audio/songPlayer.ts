import type { AudioEngine } from './engine.ts';
import { createSongMix, playEvent, setLeadAudible } from './mixer.ts';
import type { SongMix } from './mixer.ts';
import type { AudioEvent } from '../game/types.ts';

/** How far ahead of the clock sounds are handed to the audio thread. */
const SCHEDULE_AHEAD_SECONDS = 0.3;
/** Longest the clock may run on the wall clock between audio clock updates. */
const MAX_EXTRAPOLATION_SECONDS = 0.05;
/** Sounds this late are dropped, so a stalled page does not play a burst when it wakes. */
const MAX_LATE_SECONDS = 0.1;
const START_DELAY_SECONDS = 0.06;
const FADE_SECONDS = 0.04;
const MS_PER_SECOND = 1000;

const wallSeconds = (): number => performance.now() / MS_PER_SECOND;

interface AudioOutput {
  engine: AudioEngine;
  mix: SongMix;
}

/** Fade a mix out and cut it loose, so sounds already queued in it are never heard. */
function silence(engine: AudioEngine, mix: SongMix): void {
  const { gain } = mix.output;
  if (engine.isRunning) {
    const now = engine.ctx.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
    setTimeout(() => { mix.output.disconnect(); }, FADE_SECONDS * MS_PER_SECOND * 2);
    return;
  }
  gain.value = 0;
  mix.output.disconnect();
}

/**
 * Plays a song's events and tells the game what time it is.
 * The audio clock leads when audio is running. Without an engine, or when the
 * browser will not start audio again after a pause, the wall clock takes over
 * and the song plays on silent.
 */
export class SongPlayer {
  private audio: AudioOutput | null;
  private nextEvent = 0;
  /** Clock reading (audio or wall) at song time 0. */
  private origin = 0;
  private lastAudioTime = -1;
  private lastAudioWall = 0;
  private lastTime = Number.NEGATIVE_INFINITY;
  private lastHeard = Number.NEGATIVE_INFINITY;
  private pausedAt: number | null = null;
  private isStopped = false;

  constructor(engine: AudioEngine | null, private readonly events: readonly AudioEvent[]) {
    this.audio = engine?.isRunning ? { engine, mix: this.createMix(engine) } : null;
  }

  /** Whether sound is playing, as opposed to the silent fallback. */
  get hasAudio(): boolean {
    return this.audio !== null;
  }

  /** True when the browser suspended audio behind our back. */
  get isInterrupted(): boolean {
    return this.audio !== null && this.pausedAt === null && !this.isStopped && !this.audio.engine.isRunning;
  }

  /** Begin the song so that song time 0 arrives after `leadIn` seconds. */
  start(leadIn: number): void {
    this.origin = this.rawClock() + leadIn + START_DELAY_SECONDS;
    this.lastTime = Number.NEGATIVE_INFINITY;
    this.lastHeard = Number.NEGATIVE_INFINITY;
    this.pump();
  }

  /** Song time in seconds of the sound being scheduled right now. Never runs backwards. */
  get time(): number {
    if (this.pausedAt !== null) return this.pausedAt;
    this.lastTime = Math.max(this.lastTime, this.rawClock() - this.origin);
    return this.lastTime;
  }

  /** Song time of what the player is hearing right now. Never runs backwards, and holds still while paused. */
  get heardTime(): number {
    return this.pausedAt === null ? this.updateHeard() : this.lastHeard;
  }

  /** Hand upcoming sounds to the audio thread. Call every frame. */
  pump(): void {
    if (!this.audio || this.isStopped || this.pausedAt !== null) return;
    const { engine, mix } = this.audio;
    const now = this.time;
    const horizon = now + SCHEDULE_AHEAD_SECONDS;
    for (let event = this.events[this.nextEvent]; event && event.time < horizon; event = this.events[this.nextEvent]) {
      if (event.time > now - MAX_LATE_SECONDS) playEvent(engine.ctx, mix, event, this.origin + event.time);
      this.nextEvent += 1;
    }
  }

  /** Freeze the clock and cut the sound. Sounds queued past this point are played again on resume. */
  pause(): void {
    if (this.pausedAt !== null || this.isStopped) return;
    this.updateHeard();
    this.pausedAt = this.time;
    if (this.audio) silence(this.audio.engine, this.audio.mix);
    const resumeAt = this.pausedAt;
    const index = this.events.findIndex((event) => event.time >= resumeAt);
    this.nextEvent = index < 0 ? this.events.length : index;
  }

  /**
   * Start the clock again from where it stopped. Call after the audio engine
   * has had a chance to start; if it is still blocked the song carries on silent.
   */
  resume(): void {
    const resumeAt = this.pausedAt;
    if (resumeAt === null || this.isStopped) return;
    const engine = this.audio?.engine;
    this.audio = engine?.isRunning ? { engine, mix: this.createMix(engine) } : null;
    this.lastAudioTime = -1;
    this.lastAudioWall = 0;
    this.origin = this.rawClock() - resumeAt;
    this.lastTime = resumeAt;
    this.pausedAt = null;
    this.pump();
  }

  /** Cut or restore the lead guitar, for misses and hits. */
  setLeadAudible(isAudible: boolean): void {
    if (this.audio) setLeadAudible(this.audio.engine.ctx, this.audio.mix, isAudible);
  }

  /** Fade out and freeze the clock for good. The player cannot be used again. */
  stop(): void {
    if (this.isStopped) return;
    if (this.pausedAt === null) this.updateHeard();
    this.pausedAt ??= this.time;
    this.isStopped = true;
    if (this.audio) silence(this.audio.engine, this.audio.mix);
  }

  /** Move the heard clock forward, never back, even when the output latency changes. */
  private updateHeard(): number {
    const latency = this.audio ? this.audio.engine.latency : 0;
    this.lastHeard = Math.max(this.lastHeard, this.time - latency);
    return this.lastHeard;
  }

  private createMix(engine: AudioEngine): SongMix {
    return createSongMix(engine.ctx, engine.master, engine.noise);
  }

  /** Audio clock, smoothed with the wall clock because it only moves in blocks. */
  private rawClock(): number {
    const wall = wallSeconds();
    if (!this.audio) return wall;
    const audio = this.audio.engine.ctx.currentTime;
    if (audio !== this.lastAudioTime) {
      this.lastAudioTime = audio;
      this.lastAudioWall = wall;
    }
    return audio + Math.min(MAX_EXTRAPOLATION_SECONDS, wall - this.lastAudioWall);
  }
}
