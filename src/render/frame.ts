import type { NoteStatus } from '../game/judge.ts';
import type { ScoreKeeper } from '../game/scoring.ts';
import type { Chart, SongDef } from '../game/types.ts';
import { beatSeconds } from '../game/timing.ts';

/** Everything the renderer needs to draw one frame of a song. */
export interface Frame {
  /** Song time the player is hearing, in seconds. */
  time: number;
  song: SongDef;
  chart: Chart;
  status: readonly NoteStatus[];
  /** Lanes with a key or finger down. */
  pressed: readonly boolean[];
  /** Lanes holding a sustain. */
  holding: readonly boolean[];
  score: ScoreKeeper;
  /** Show keyboard letters on the pads. */
  showKeys: boolean;
  /** Draw score and meters. Off for the menu backdrop. */
  showHud: boolean;
  reducedMotion: boolean;
}

/** Brightness kick on each beat: 1 on the beat, fading to 0 before the next. */
export function beatPulse(frame: Frame): number {
  if (frame.time < 0) return 0;
  const beat = frame.time / beatSeconds(frame.song.bpm);
  const phase = beat - Math.floor(beat);
  return (1 - phase) ** 2;
}
