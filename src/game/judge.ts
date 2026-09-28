import type { ChartNote, Grade, PlayEvent } from './types.ts';

/** Largest timing error in seconds for each grade. */
export const HIT_WINDOWS: Record<Grade, number> = { perfect: 0.045, great: 0.09, good: 0.135 };
/** Letting go of a sustain this close to its end still counts as complete. */
export const HOLD_RELEASE_GRACE = 0.12;

export type NoteStatus = 'pending' | 'hit' | 'missed';

interface ActiveHold {
  note: ChartNote;
  end: number;
  creditedTo: number;
}

/** Grade for a timing error in seconds, or null when outside every window. */
export function gradeFor(offset: number): Grade | null {
  const error = Math.abs(offset);
  if (error <= HIT_WINDOWS.perfect) return 'perfect';
  if (error <= HIT_WINDOWS.great) return 'great';
  if (error <= HIT_WINDOWS.good) return 'good';
  return null;
}

/** Tracks which notes were hit or missed. Knows nothing about score. */
export class Judge {
  readonly status: NoteStatus[];
  private cursor = 0;
  private readonly holds = new Map<number, ActiveHold>();

  constructor(private readonly notes: readonly ChartNote[]) {
    this.status = notes.map(() => 'pending');
  }

  /** The player pressed a lane at `time`. */
  press(lane: number, time: number): PlayEvent[] {
    const note = this.findTarget(lane, time);
    if (!note) return [{ kind: 'stray', lane }];
    const offset = time - note.time;
    const grade = gradeFor(offset) ?? 'good';
    this.status[note.id] = 'hit';
    if (note.duration > 0) {
      const start = Math.max(time, note.time);
      this.holds.set(lane, { note, end: note.time + note.duration, creditedTo: start });
    }
    return [{ kind: 'hit', note, grade, offset }];
  }

  /** The player let go of a lane at `time`. */
  release(lane: number, time: number): PlayEvent[] {
    const hold = this.holds.get(lane);
    if (!hold) return [];
    this.holds.delete(lane);
    const events = this.creditHold(hold, lane, time);
    const completed = time >= hold.end - HOLD_RELEASE_GRACE;
    events.push({ kind: 'holdEnd', note: hold.note, completed });
    return events;
  }

  /** Move the clock forward: notes that scrolled past become misses, sustains pay out. */
  advance(time: number): PlayEvent[] {
    const events: PlayEvent[] = [];
    for (let note = this.notes[this.cursor]; note; note = this.notes[this.cursor]) {
      const isPending = this.status[note.id] === 'pending';
      if (isPending && note.time >= time - HIT_WINDOWS.good) break;
      if (isPending) {
        this.status[note.id] = 'missed';
        events.push({ kind: 'miss', note });
      }
      this.cursor += 1;
    }
    this.holds.forEach((hold, lane) => {
      events.push(...this.creditHold(hold, lane, time));
      if (time < hold.end) return;
      this.holds.delete(lane);
      events.push({ kind: 'holdEnd', note: hold.note, completed: true });
    });
    return events;
  }

  /** Whether a sustain is being held in a lane. */
  isHolding(lane: number): boolean {
    return this.holds.has(lane);
  }

  /** True once every note is judged and no sustain is active. */
  get isFinished(): boolean {
    return this.cursor >= this.notes.length && this.holds.size === 0;
  }

  private findTarget(lane: number, time: number): ChartNote | undefined {
    for (let i = this.cursor; i < this.notes.length; i += 1) {
      const note = this.notes[i];
      if (!note || note.time > time + HIT_WINDOWS.good) return undefined;
      const isOpen = this.status[note.id] === 'pending' && note.lane === lane;
      if (isOpen && note.time >= time - HIT_WINDOWS.good) return note;
    }
    return undefined;
  }

  private creditHold(hold: ActiveHold, lane: number, time: number): PlayEvent[] {
    const upTo = Math.min(time, hold.end);
    const seconds = upTo - hold.creditedTo;
    if (seconds <= 0) return [];
    hold.creditedTo = upTo;
    return [{ kind: 'hold', lane, seconds }];
  }
}
