import type { AudioEngine } from './engine.ts';

const SILENCE = 0.0001;

interface Sweep {
  wave: OscillatorType;
  from: number;
  to: number;
  seconds: number;
  level: number;
  delay?: number;
}

function sweep(engine: AudioEngine, tone: Sweep): void {
  if (!engine.isRunning) return;
  const { ctx } = engine;
  const when = ctx.currentTime + (tone.delay ?? 0);
  const osc = ctx.createOscillator();
  osc.type = tone.wave;
  osc.frequency.setValueAtTime(tone.from, when);
  osc.frequency.exponentialRampToValueAtTime(tone.to, when + tone.seconds);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(tone.level, when);
  gain.gain.exponentialRampToValueAtTime(SILENCE, when + tone.seconds);
  osc.connect(gain).connect(engine.master);
  osc.start(when);
  osc.stop(when + tone.seconds);
}

function noise(engine: AudioEngine, frequency: number, seconds: number, level: number, attack: number): void {
  if (!engine.isRunning) return;
  const { ctx } = engine;
  const when = ctx.currentTime;
  const source = ctx.createBufferSource();
  source.buffer = engine.noise;
  source.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = frequency;
  band.Q.value = 0.8;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(SILENCE, when);
  gain.gain.exponentialRampToValueAtTime(level, when + attack);
  gain.gain.exponentialRampToValueAtTime(SILENCE, when + seconds);
  source.connect(band).connect(gain).connect(engine.master);
  source.start(when);
  source.stop(when + seconds);
}

/** Dead string thunk for a missed note or a stray press. */
export function playMiss(engine: AudioEngine): void {
  sweep(engine, { wave: 'square', from: 140, to: 70, seconds: 0.09, level: 0.14 });
  noise(engine, 900, 0.07, 0.12, 0.005);
}

/** Rising whoosh when surge starts. */
export function playSurge(engine: AudioEngine): void {
  sweep(engine, { wave: 'sawtooth', from: 180, to: 1400, seconds: 0.5, level: 0.12 });
  sweep(engine, { wave: 'square', from: 360, to: 2800, seconds: 0.5, level: 0.05 });
  noise(engine, 3000, 0.7, 0.2, 0.3);
}

/** Chime when a surge phrase is completed. */
export function playPhrase(engine: AudioEngine): void {
  sweep(engine, { wave: 'triangle', from: 1320, to: 1320, seconds: 0.18, level: 0.12 });
  sweep(engine, { wave: 'triangle', from: 1980, to: 1980, seconds: 0.3, level: 0.12, delay: 0.08 });
}

/** Menu blip. */
export function playBlip(engine: AudioEngine): void {
  sweep(engine, { wave: 'triangle', from: 660, to: 990, seconds: 0.08, level: 0.15 });
}

/** The amp dies: played when the crowd meter empties. */
export function playFail(engine: AudioEngine): void {
  sweep(engine, { wave: 'sawtooth', from: 330, to: 40, seconds: 1.1, level: 0.25 });
  noise(engine, 500, 1.2, 0.2, 0.02);
}

/** Crowd roar for a finished song. */
export function playCheer(engine: AudioEngine): void {
  noise(engine, 1200, 2.6, 0.3, 0.5);
  noise(engine, 2600, 2.2, 0.16, 0.7);
}
