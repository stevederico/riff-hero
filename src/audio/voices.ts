import { midiToFrequency } from '../game/timing.ts';
import type { AudioEvent } from '../game/types.ts';

const SILENCE = 0.0001;
const FIFTH = 2 ** (7 / 12);
const OCTAVE = 2;
const DETUNE_CENTS = 7;
const VIBRATO_MIN_SECONDS = 0.35;
const VIBRATO_DELAY = 0.18;
const VIBRATO_HZ = 5.6;
const VIBRATO_CENTS = 14;
/** How many time constants fit in the release, so the tail is near silent when it ends. */
const RELEASE_TIME_CONSTANTS = 4;

interface Envelope {
  attack: number;
  peak: number;
  sustain: number;
  decay: number;
  release: number;
}

/** Shape a gain node into attack, decay, sustain and release. Returns the end time. */
function applyEnvelope(gain: GainNode, when: number, duration: number, env: Envelope): number {
  const holdUntil = when + Math.max(duration, env.attack);
  gain.gain.setValueAtTime(SILENCE, when);
  gain.gain.linearRampToValueAtTime(env.peak, when + env.attack);
  gain.gain.setTargetAtTime(env.sustain, when + env.attack, env.decay);
  gain.gain.setTargetAtTime(SILENCE, holdUntil, env.release / RELEASE_TIME_CONSTANTS);
  return holdUntil + env.release;
}

function addVibrato(ctx: BaseAudioContext, oscillators: OscillatorNode[], when: number, end: number): void {
  const lfo = ctx.createOscillator();
  lfo.frequency.value = VIBRATO_HZ;
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(0, when + VIBRATO_DELAY);
  depth.gain.linearRampToValueAtTime(VIBRATO_CENTS, when + VIBRATO_DELAY + 0.2);
  lfo.connect(depth);
  oscillators.forEach((osc) => depth.connect(osc.detune));
  lfo.start(when);
  lfo.stop(end);
}

function sawPair(ctx: BaseAudioContext, frequency: number, out: AudioNode): OscillatorNode[] {
  return [-DETUNE_CENTS, DETUNE_CENTS].map((cents) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = frequency;
    osc.detune.value = cents;
    osc.connect(out);
    return osc;
  });
}

/** Lead guitar note. Power chords add a fifth and an octave. */
export function playLead(ctx: BaseAudioContext, out: AudioNode, event: AudioEvent, when: number): void {
  const root = midiToFrequency(event.midi);
  const pitches = event.flag ? [root, root * FIFTH, root * OCTAVE] : [root];
  const gain = ctx.createGain();
  const end = applyEnvelope(gain, when, event.duration, {
    attack: 0.004, peak: 0.34 / Math.sqrt(pitches.length), sustain: 0.24 / Math.sqrt(pitches.length),
    decay: 0.12, release: 0.08,
  });
  const oscillators = pitches.flatMap((pitch) => sawPair(ctx, pitch, gain));
  if (event.duration > VIBRATO_MIN_SECONDS) addVibrato(ctx, oscillators, when, end);
  gain.connect(out);
  oscillators.forEach((osc) => { osc.start(when); osc.stop(end); });
}

/** Rhythm guitar power chord, open or palm muted. */
export function playRhythm(ctx: BaseAudioContext, out: AudioNode, event: AudioEvent, when: number): void {
  const root = midiToFrequency(event.midi);
  const isMuted = event.flag;
  const gain = ctx.createGain();
  const duration = isMuted ? 0.05 : event.duration;
  const end = applyEnvelope(gain, when, duration, {
    attack: 0.003, peak: 0.3, sustain: isMuted ? 0.05 : 0.2, decay: isMuted ? 0.035 : 0.2, release: 0.06,
  });
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = isMuted ? 1100 : 5200;
  const oscillators = [root, root * FIFTH, root * OCTAVE].flatMap((pitch) => sawPair(ctx, pitch, tone));
  tone.connect(gain).connect(out);
  oscillators.forEach((osc) => { osc.start(when); osc.stop(end); });
}

/** Bass guitar note with a filter that closes as it rings. */
export function playBass(ctx: BaseAudioContext, out: AudioNode, event: AudioEvent, when: number): void {
  const pitch = midiToFrequency(event.midi);
  const gain = ctx.createGain();
  const duration = event.flag ? event.duration * 0.6 : event.duration;
  const end = applyEnvelope(gain, when, duration, {
    attack: 0.005, peak: 0.6, sustain: 0.42, decay: 0.1, release: 0.05,
  });
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.Q.value = 2;
  tone.frequency.setValueAtTime(1100, when);
  tone.frequency.exponentialRampToValueAtTime(320, when + 0.18);
  const saw = ctx.createOscillator();
  saw.type = 'sawtooth';
  saw.frequency.value = pitch;
  const sub = ctx.createOscillator();
  sub.type = 'triangle';
  sub.frequency.value = pitch;
  saw.connect(tone);
  sub.connect(gain);
  tone.connect(gain).connect(out);
  [saw, sub].forEach((osc) => { osc.start(when); osc.stop(end); });
}
