import { createNoiseBuffer } from './drums.ts';

const UNLOCK_TIMEOUT_MS = 600;
const MAX_LATENCY_SECONDS = 0.25;
const VOLUME_RAMP_SECONDS = 0.02;

/** Owns the audio context and the master output. Created on the first tap or key press. */
export class AudioEngine {
  readonly ctx: AudioContext;
  readonly master: GainNode;
  readonly noise: AudioBuffer;

  constructor(volume: number) {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.master = this.ctx.createGain();
    this.master.gain.value = volume;
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -9;
    limiter.knee.value = 6;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    this.master.connect(limiter).connect(this.ctx.destination);
    this.noise = createNoiseBuffer(this.ctx);
  }

  get isRunning(): boolean {
    return this.ctx.state === 'running';
  }

  /** Seconds between scheduling a sound and hearing it. */
  get latency(): number {
    const total = (this.ctx.baseLatency || 0) + (this.ctx.outputLatency || 0);
    return Math.min(MAX_LATENCY_SECONDS, Math.max(0, total));
  }

  /** Ask the browser to start audio. Resolves false when it stays blocked. */
  async unlock(): Promise<boolean> {
    if (this.isRunning) return true;
    const timeout = new Promise<void>((resolve) => { setTimeout(resolve, UNLOCK_TIMEOUT_MS); });
    try {
      await Promise.race([this.ctx.resume(), timeout]);
    } catch (error) {
      console.error('Audio could not start', error);
    }
    return this.isRunning;
  }

  setVolume(volume: number): void {
    this.master.gain.setTargetAtTime(volume, this.ctx.currentTime, VOLUME_RAMP_SECONDS);
  }
}
