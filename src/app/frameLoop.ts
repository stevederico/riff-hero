const MS_PER_SECOND = 1000;
const MAX_FRAME_SECONDS = 0.1;
const TIMER_FRAME_MS = 16;
const WATCHDOG_INTERVAL_MS = 200;
/** No frame for this long means the window is covered. */
const STALLED_FRAME_MS = 450;

export interface FrameLoopOptions {
  /** Run on a timer instead of animation frames, for windows that are not on screen. */
  isTimerDriven: boolean;
  /** Called every frame with the seconds since the last one. */
  onFrame: (seconds: number) => void;
  /** Called when frames stop arriving. Browsers stop drawing covered windows without telling the page. */
  onStall: () => void;
}

/** Calls the game once per frame and notices when frames stop. */
export class FrameLoop {
  private lastFrame = performance.now();

  constructor(private readonly options: FrameLoopOptions) {}

  start(): void {
    if (!this.options.isTimerDriven) setInterval(() => this.checkForStall(), WATCHDOG_INTERVAL_MS);
    this.schedule();
  }

  private schedule(): void {
    if (this.options.isTimerDriven) setTimeout(() => this.tick(performance.now()), TIMER_FRAME_MS);
    else requestAnimationFrame(this.tick);
  }

  private readonly tick = (now: number): void => {
    const seconds = Math.min(MAX_FRAME_SECONDS, (now - this.lastFrame) / MS_PER_SECOND);
    this.lastFrame = now;
    this.options.onFrame(seconds);
    this.schedule();
  };

  private checkForStall(): void {
    if (performance.now() - this.lastFrame > STALLED_FRAME_MS) this.options.onStall();
  }
}
