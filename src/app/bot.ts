import { LANE_COUNT } from '../game/types.ts';
import type { Session } from './session.ts';

const TAP_SECONDS = 0.09;

/** Plays a song perfectly. Drives the menu backdrop and automated tests. */
export class Bot {
  private readonly releaseAt: number[] = Array.from({ length: LANE_COUNT }, () => 0);
  private cursor = 0;

  constructor(private readonly session: Session) {}

  /** Press every note that is due and let go of the ones that are over. */
  step(now: number): void {
    const { session } = this;
    for (let lane = 0; lane < LANE_COUNT; lane += 1) {
      if (session.pressed[lane] && now >= (this.releaseAt[lane] ?? 0)) session.release(lane);
    }
    const { notes } = session.chart;
    for (let note = notes[this.cursor]; note && note.time <= now; note = notes[this.cursor]) {
      this.cursor += 1;
      session.release(note.lane);
      session.press(note.lane, note.time);
      this.releaseAt[note.lane] = note.time + note.duration + TAP_SECONDS;
    }
    session.activateSurge();
  }
}
