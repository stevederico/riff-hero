import { TOUCH_ZONE_TOP, laneAtX } from '../render/projection.ts';
import type { Layout } from '../render/projection.ts';

const LANE_CODES: Record<string, number> = {
  KeyA: 0, KeyS: 1, KeyD: 2, KeyF: 3, KeyG: 4,
  Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4,
  Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3, Numpad5: 4,
};
const SURGE_CODES = new Set(['Space', 'Enter', 'ShiftLeft', 'ShiftRight']);
const PAUSE_CODES = new Set(['Escape', 'KeyP']);

export interface InputHandlers {
  /** Whether lane and surge input should be taken right now. */
  isPlaying: () => boolean;
  /** `stamp` is the event timestamp in milliseconds, on the performance clock. */
  press: (lane: number, stamp: number) => void;
  release: (lane: number, stamp: number) => void;
  surge: () => void;
  /** Escape or P was pressed. */
  togglePause: () => void;
  /** The window lost focus or was hidden. */
  interrupt: () => void;
  /** The player switched between touch and keyboard. */
  setTouch: (isTouch: boolean) => void;
}

/** Keyboard, mouse and touch input for the highway. */
export class Input {
  private readonly keyLanes = new Map<string, number>();
  private readonly pointerLanes = new Map<number, number>();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly getLayout: () => Layout,
    private readonly handlers: InputHandlers,
  ) {}

  attach(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerUp);
    window.addEventListener('blur', this.handleInterrupt);
    document.addEventListener('visibilitychange', this.handleVisibility);
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (LANE_CODES[event.code] !== undefined) this.handlers.setTouch(false);
    if (PAUSE_CODES.has(event.code)) {
      if (document.querySelector('dialog[open]')) return;
      this.handlers.togglePause();
      return;
    }
    if (!this.handlers.isPlaying()) return;
    const lane = LANE_CODES[event.code];
    if (lane !== undefined) {
      event.preventDefault();
      this.keyLanes.set(event.code, lane);
      this.handlers.press(lane, event.timeStamp);
    } else if (SURGE_CODES.has(event.code)) {
      event.preventDefault();
      this.handlers.surge();
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    const lane = this.keyLanes.get(event.code);
    if (lane === undefined) return;
    this.keyLanes.delete(event.code);
    if (![...this.keyLanes.values()].includes(lane)) this.handlers.release(lane, event.timeStamp);
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') this.handlers.setTouch(true);
    if (!this.handlers.isPlaying()) return;
    const layout = this.getLayout();
    if (event.clientY < layout.height * TOUCH_ZONE_TOP) return;
    event.preventDefault();
    const lane = laneAtX(layout, event.clientX);
    this.pointerLanes.set(event.pointerId, lane);
    this.handlers.press(lane, event.timeStamp);
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    const lane = this.pointerLanes.get(event.pointerId);
    if (lane === undefined) return;
    this.pointerLanes.delete(event.pointerId);
    if (![...this.pointerLanes.values()].includes(lane)) this.handlers.release(lane, event.timeStamp);
  };

  private readonly handleVisibility = (): void => {
    if (document.hidden) this.handleInterrupt();
  };

  private readonly handleInterrupt = (): void => {
    this.keyLanes.clear();
    this.pointerLanes.clear();
    this.handlers.interrupt();
  };
}
