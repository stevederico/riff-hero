import { midiToFrequency } from '../game/timing.ts';

const SILENCE = 0.0001;

export interface DrumKit {
  ctx: BaseAudioContext;
  out: AudioNode;
  noise: AudioBuffer;
}

interface NoiseHit {
  when: number;
  level: number;
  decay: number;
  filter: BiquadFilterType;
  frequency: number;
}

interface ToneHit {
  when: number;
  level: number;
  decay: number;
  from: number;
  to: number;
  sweep: number;
  wave: OscillatorType;
}

/** One second of white noise, shared by every noise based drum. */
export function createNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function fadeOut(gain: GainNode, when: number, level: number, decay: number): void {
  gain.gain.setValueAtTime(level, when);
  gain.gain.exponentialRampToValueAtTime(SILENCE, when + decay);
}

function noiseHit(kit: DrumKit, hit: NoiseHit): void {
  const source = kit.ctx.createBufferSource();
  source.buffer = kit.noise;
  source.loop = true;
  const filter = kit.ctx.createBiquadFilter();
  filter.type = hit.filter;
  filter.frequency.value = hit.frequency;
  const gain = kit.ctx.createGain();
  fadeOut(gain, hit.when, hit.level, hit.decay);
  source.connect(filter).connect(gain).connect(kit.out);
  source.start(hit.when, Math.random() * 0.5);
  source.stop(hit.when + hit.decay);
}

function toneHit(kit: DrumKit, hit: ToneHit): void {
  const osc = kit.ctx.createOscillator();
  osc.type = hit.wave;
  osc.frequency.setValueAtTime(hit.from, hit.when);
  osc.frequency.exponentialRampToValueAtTime(hit.to, hit.when + hit.sweep);
  const gain = kit.ctx.createGain();
  fadeOut(gain, hit.when, hit.level, hit.decay);
  osc.connect(gain).connect(kit.out);
  osc.start(hit.when);
  osc.stop(hit.when + hit.decay);
}

/** Bass drum: a sine that drops in pitch, plus a click for attack. */
export function playKick(kit: DrumKit, when: number, velocity: number): void {
  toneHit(kit, { when, level: velocity, decay: 0.28, from: 150, to: 42, sweep: 0.11, wave: 'sine' });
  noiseHit(kit, { when, level: 0.25 * velocity, decay: 0.02, filter: 'lowpass', frequency: 3000 });
}

/** Snare: a burst of noise over a short tone. */
export function playSnare(kit: DrumKit, when: number, velocity: number): void {
  noiseHit(kit, { when, level: 0.7 * velocity, decay: 0.19, filter: 'highpass', frequency: 1400 });
  toneHit(kit, { when, level: 0.5 * velocity, decay: 0.12, from: 230, to: 140, sweep: 0.08, wave: 'triangle' });
}

/** Hi hat, closed or open. */
export function playHat(kit: DrumKit, when: number, velocity: number, isOpen: boolean): void {
  const decay = isOpen ? 0.3 : 0.05;
  noiseHit(kit, { when, level: 0.3 * velocity, decay, filter: 'highpass', frequency: 7500 });
}

/** Crash cymbal. */
export function playCrash(kit: DrumKit, when: number, velocity: number): void {
  noiseHit(kit, { when, level: 0.45 * velocity, decay: 1.4, filter: 'highpass', frequency: 4200 });
  noiseHit(kit, { when, level: 0.2 * velocity, decay: 0.5, filter: 'bandpass', frequency: 2600 });
}

/** Tom drum tuned to a MIDI note. */
export function playTom(kit: DrumKit, when: number, midi: number, velocity: number): void {
  const pitch = midiToFrequency(midi);
  toneHit(kit, { when, level: 0.8 * velocity, decay: 0.3, from: pitch * 1.5, to: pitch, sweep: 0.12, wave: 'sine' });
}

/** Drum stick click for the count in. */
export function playClick(kit: DrumKit, when: number): void {
  toneHit(kit, { when, level: 0.5, decay: 0.06, from: 1900, to: 1500, sweep: 0.03, wave: 'triangle' });
  noiseHit(kit, { when, level: 0.3, decay: 0.03, filter: 'bandpass', frequency: 2800 });
}
