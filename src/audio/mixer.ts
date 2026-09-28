import { playClick, playCrash, playHat, playKick, playSnare, playTom } from './drums.ts';
import type { DrumKit } from './drums.ts';
import { playBass, playLead, playRhythm } from './voices.ts';
import type { AudioEvent } from '../game/types.ts';

const CURVE_SAMPLES = 2048;
const LEAD_DUCKED_LEVEL = 0.06;
const DUCK_SECONDS = 0.015;
/** Bus levels, set by measuring offline renders so the full mix peaks near 1. */
const MIX = { drums: 0.5, bass: 0.3, rhythm: 0.22, lead: 0.26 };

/** The signal chain for one play through of a song. */
export interface SongMix {
  /** Everything passes through here last, so one fade silences the song. */
  output: GainNode;
  drums: DrumKit;
  bass: AudioNode;
  rhythm: AudioNode;
  lead: AudioNode;
  /** Drops when the player misses, so the guitar cuts out. */
  leadDuck: GainNode;
}

function driveCurve(amount: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(CURVE_SAMPLES);
  const scale = Math.tanh(amount);
  for (let i = 0; i < CURVE_SAMPLES; i += 1) {
    const x = (i / (CURVE_SAMPLES - 1)) * 2 - 1;
    curve[i] = Math.tanh(amount * x) / scale;
  }
  return curve;
}

function filter(
  ctx: BaseAudioContext, type: BiquadFilterType, frequency: number, gainDb = 0,
): BiquadFilterNode {
  const node = ctx.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.gain.value = gainDb;
  return node;
}

function level(ctx: BaseAudioContext, value: number): GainNode {
  const node = ctx.createGain();
  node.gain.value = value;
  return node;
}

function pan(ctx: BaseAudioContext, value: number): StereoPannerNode {
  const node = ctx.createStereoPanner();
  node.pan.value = value;
  return node;
}

/** Guitar amp: drive into a wave shaper, then filters that stand in for a speaker cabinet. */
function createAmp(ctx: BaseAudioContext, drive: number, cabinetHz: number): { input: GainNode; output: AudioNode } {
  const input = level(ctx, 1);
  const shaper = ctx.createWaveShaper();
  shaper.curve = driveCurve(drive);
  shaper.oversample = '2x';
  const output = input
    .connect(shaper)
    .connect(filter(ctx, 'highpass', 110))
    .connect(filter(ctx, 'peaking', 1400, 4))
    .connect(filter(ctx, 'lowpass', cabinetHz));
  return { input, output };
}

function addEcho(ctx: BaseAudioContext, source: AudioNode, out: AudioNode): void {
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.29;
  const feedback = level(ctx, 0.28);
  source.connect(delay);
  delay.connect(feedback).connect(delay);
  delay.connect(level(ctx, 0.22)).connect(out);
}

/** Build the mix for a song and connect it to `destination`. */
export function createSongMix(ctx: BaseAudioContext, destination: AudioNode, noise: AudioBuffer): SongMix {
  const output = level(ctx, 1);
  output.connect(destination);

  const drumBus = level(ctx, MIX.drums);
  drumBus.connect(output);
  const bass = level(ctx, MIX.bass);
  bass.connect(output);

  const rhythmAmp = createAmp(ctx, 5, 3400);
  rhythmAmp.output.connect(level(ctx, MIX.rhythm)).connect(pan(ctx, -0.35)).connect(output);

  const leadAmp = createAmp(ctx, 7, 4800);
  const leadDuck = level(ctx, 1);
  const leadOut = leadAmp.output.connect(leadDuck).connect(level(ctx, MIX.lead));
  leadOut.connect(pan(ctx, 0.2)).connect(output);
  addEcho(ctx, leadOut, output);

  return {
    output,
    drums: { ctx, out: drumBus, noise },
    bass,
    rhythm: rhythmAmp.input,
    lead: leadAmp.input,
    leadDuck,
  };
}

/** Cut or restore the lead guitar. */
export function setLeadAudible(ctx: BaseAudioContext, mix: SongMix, isAudible: boolean): void {
  const target = isAudible ? 1 : LEAD_DUCKED_LEVEL;
  mix.leadDuck.gain.setTargetAtTime(target, ctx.currentTime, DUCK_SECONDS);
}

/** Schedule one song event at an absolute audio clock time. */
export function playEvent(ctx: BaseAudioContext, mix: SongMix, event: AudioEvent, when: number): void {
  switch (event.type) {
    case 'kick': return playKick(mix.drums, when, event.velocity);
    case 'snare': return playSnare(mix.drums, when, event.velocity);
    case 'hat': return playHat(mix.drums, when, event.velocity, false);
    case 'openHat': return playHat(mix.drums, when, event.velocity, true);
    case 'crash': return playCrash(mix.drums, when, event.velocity);
    case 'tom': return playTom(mix.drums, when, event.midi, event.velocity);
    case 'click': return playClick(mix.drums, when);
    case 'bass': return playBass(ctx, mix.bass, event, when);
    case 'rhythm': return playRhythm(ctx, mix.rhythm, event, when);
    case 'lead': return playLead(ctx, mix.lead, event, when);
  }
}
