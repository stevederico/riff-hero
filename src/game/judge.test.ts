import { beforeEach, describe, expect, it } from 'vitest';
import { HIT_WINDOWS, HOLD_RELEASE_GRACE, Judge, gradeFor } from './judge.ts';
import type { ChartNote } from './types.ts';

function makeNotes(specs: Array<[time: number, lane: number, duration?: number]>): ChartNote[] {
  return specs.map(([time, lane, duration = 0], id) => ({ id, time, lane, duration, phrase: -1 }));
}

describe('gradeFor', () => {
  it('grades a dead on hit as perfect', () => {
    expect(gradeFor(0)).toBe('perfect');
  });

  it('grades early and late hits the same', () => {
    expect(gradeFor(-0.08)).toBe(gradeFor(0.08));
  });

  it('grades the edge of the window as good', () => {
    expect(gradeFor(HIT_WINDOWS.good)).toBe('good');
  });

  it('rejects hits outside the window', () => {
    expect(gradeFor(HIT_WINDOWS.good + 0.001)).toBeNull();
  });
});

describe('Judge', () => {
  let judge: Judge;

  beforeEach(() => {
    judge = new Judge(makeNotes([[1, 0], [1.1, 0], [2, 3], [3, 1, 1]]));
  });

  it('hits a note pressed on time', () => {
    expect(judge.press(0, 1.01)).toMatchObject([{ kind: 'hit', grade: 'perfect', note: { id: 0 } }]);
  });

  it('reports the timing error', () => {
    const [event] = judge.press(0, 0.95);
    expect(event).toMatchObject({ kind: 'hit', grade: 'great' });
  });

  it('calls a press with no note nearby a stray', () => {
    expect(judge.press(0, 0.5)).toEqual([{ kind: 'stray', lane: 0 }]);
  });

  it('calls a press in the wrong lane a stray', () => {
    expect(judge.press(2, 1)).toEqual([{ kind: 'stray', lane: 2 }]);
  });

  it('takes the earlier of two notes in range', () => {
    expect(judge.press(0, 1.05)).toMatchObject([{ note: { id: 0 } }]);
  });

  it('takes the next note once the first is hit', () => {
    judge.press(0, 1.0);
    expect(judge.press(0, 1.1)).toMatchObject([{ note: { id: 1 } }]);
  });

  it('cannot hit the same note twice', () => {
    judge = new Judge(makeNotes([[1, 0]]));
    judge.press(0, 1);
    expect(judge.press(0, 1.02)).toEqual([{ kind: 'stray', lane: 0 }]);
  });

  it('misses notes that scroll past', () => {
    const events = judge.advance(1.5);
    expect(events.map((event) => event.kind)).toEqual(['miss', 'miss']);
  });

  it('keeps a note hittable until the window closes', () => {
    expect(judge.advance(1 + HIT_WINDOWS.good - 0.001)).toEqual([]);
  });

  it('does not miss a note that was hit', () => {
    judge.press(0, 1);
    judge.press(0, 1.1);
    expect(judge.advance(1.9)).toEqual([]);
  });

  it('cannot hit a note after it was missed', () => {
    judge = new Judge(makeNotes([[1, 0]]));
    judge.advance(1.14);
    expect(judge.press(0, 1.14)).toEqual([{ kind: 'stray', lane: 0 }]);
  });

  it('records the status of each note', () => {
    judge.press(0, 1);
    judge.advance(2.5);
    expect(judge.status).toEqual(['hit', 'missed', 'missed', 'pending']);
  });

  describe('sustains', () => {
    beforeEach(() => {
      judge.advance(2.5);
    });

    it('pays out a sustain while it is held', () => {
      judge.press(1, 3);
      expect(judge.advance(3.5)).toEqual([{ kind: 'hold', lane: 1, seconds: 0.5 }]);
    });

    it('completes a sustain held to the end', () => {
      judge.press(1, 3);
      const kinds = judge.advance(4.2).map((event) => event.kind);
      expect(kinds).toEqual(['hold', 'holdEnd']);
    });

    it('never pays a sustain past its end', () => {
      judge.press(1, 3);
      const [hold] = judge.advance(9);
      expect(hold).toMatchObject({ kind: 'hold', seconds: 1 });
    });

    it('does not pay for time before the note when hit early', () => {
      judge.press(1, 2.9);
      const [hold] = judge.advance(3.5);
      expect(hold).toMatchObject({ kind: 'hold', seconds: 0.5 });
    });

    it('drops a sustain released early', () => {
      judge.press(1, 3);
      const events = judge.release(1, 3.4);
      expect(events.at(-1)).toMatchObject({ kind: 'holdEnd', completed: false });
    });

    it('forgives a release just before the end', () => {
      judge.press(1, 3);
      const events = judge.release(1, 4 - HOLD_RELEASE_GRACE + 0.01);
      expect(events.at(-1)).toMatchObject({ kind: 'holdEnd', completed: true });
    });
  });

  it('ignores a release with no sustain', () => {
    expect(judge.release(4, 1)).toEqual([]);
  });

  it('tracks whether a lane is holding', () => {
    judge.press(1, 3);
    expect([judge.isHolding(1), judge.isHolding(0)]).toEqual([true, false]);
  });

  it('is finished once every note is judged', () => {
    judge.advance(10);
    expect(judge.isFinished).toBe(true);
  });

  it('is not finished while a sustain is held', () => {
    judge.advance(2.9);
    judge.press(1, 3);
    judge.advance(3.5);
    expect(judge.isFinished).toBe(false);
  });
});
