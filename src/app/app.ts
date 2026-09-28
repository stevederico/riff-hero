import { AudioEngine } from '../audio/engine.ts';
import { playBlip, playCheer } from '../audio/sfx.ts';
import { SONGS } from '../game/songs/index.ts';
import { loadBest, loadSettings, saveBest, saveSettings } from '../game/storage.ts';
import type { KeyValueStore, Settings } from '../game/storage.ts';
import type { Difficulty, SongDef } from '../game/types.ts';
import { surgeButtonRect } from '../render/meters.ts';
import { Renderer } from '../render/renderer.ts';
import { byId } from './dom.ts';
import { FrameLoop } from './frameLoop.ts';
import { Input } from './input.ts';
import { renderResults } from './resultsView.ts';
import { Session } from './session.ts';
import { shareScore } from './share.ts';
import type { ShareResult } from './share.ts';
import { difficultyLabel, renderSongList } from './songList.ts';
import {
  bindUi, placeSurgeButton, setControlsHint, setPauseSong, setShareStatus, showBanner, showCountdown,
  showPlayControls, showScreen,
} from './ui.ts';

const MS_PER_SECOND = 1000;
const COUNTDOWN_STEPS = ['3', '2', '1'];
const COUNTDOWN_STEP_MS = 550;

type Mode = 'menu' | 'starting' | 'playing' | 'paused' | 'countdown' | 'results';
const HUD_MODES: readonly Mode[] = ['playing', 'paused', 'countdown'];
const FROZEN_MODES: readonly Mode[] = ['paused', 'countdown', 'results'];

const wait = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });

export interface AppOptions {
  canvas: HTMLCanvasElement;
  store: KeyValueStore;
  /** Let the computer play every song, for demos and tests. */
  isBot: boolean;
  /** For automated tests in a window that is not on screen: run on a timer and never auto pause. */
  isHeadless: boolean;
}

/** The whole game: menus, the play loop and everything between. */
export class App {
  private readonly renderer: Renderer;
  private readonly settings: Settings;
  private isTouch = window.matchMedia('(pointer: coarse)').matches;
  private readonly motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private engine: AudioEngine | null = null;
  private session: Session;
  private mode: Mode = 'menu';
  private attractIndex = 0;
  private lastPick: { song: SongDef; difficulty: Difficulty } | null = null;
  private lastResult: ShareResult | null = null;
  /** Bumped to cancel a countdown that is running. */
  private countdownRun = 0;

  constructor(private readonly options: AppOptions) {
    this.renderer = new Renderer(options.canvas);
    this.settings = loadSettings(options.store);
    this.session = this.createAttract();
  }

  start(): void {
    bindUi(this.settings, {
      pause: () => this.pause(),
      resume: () => { void this.resume(); },
      restart: () => { if (this.lastPick) void this.play(this.lastPick.song, this.lastPick.difficulty); },
      quit: () => this.quit(),
      surge: () => this.session.activateSurge(),
      share: () => { void this.share(); },
      click: () => this.blip(),
      changeSettings: (settings) => this.applySettings(settings),
    });
    new Input(this.options.canvas, () => this.renderer.layout, {
      isPlaying: () => this.mode === 'playing',
      press: (lane, stamp) => this.session.press(lane, this.session.timeAtStamp(stamp)),
      release: (lane, stamp) => this.session.release(lane, this.session.timeAtStamp(stamp)),
      surge: () => this.session.activateSurge(),
      togglePause: () => this.togglePause(),
      interrupt: () => { if (!this.options.isHeadless) this.pause(); },
      setTouch: (isTouch) => this.setTouch(isTouch),
    }).attach();
    window.addEventListener('resize', () => this.handleResize());
    setControlsHint(this.isTouch);
    this.refreshSongList();
    this.handleResize();
    new FrameLoop({
      isTimerDriven: this.options.isHeadless,
      onFrame: (seconds) => this.tick(seconds),
      onStall: () => this.pause(),
    }).start();
  }

  private tick(seconds: number): void {
    const canAutoPause = this.mode === 'playing' && !this.options.isHeadless;
    if (this.mode === 'playing' || this.mode === 'menu') this.session.update(seconds);
    if (canAutoPause && this.session.isInterrupted) this.pause();
    if (this.session.outcome !== 'playing') this.handleEnd();
    const isFrozen = FROZEN_MODES.includes(this.mode);
    this.renderer.draw(this.session.frame({
      showKeys: !this.isTouch,
      showHud: HUD_MODES.includes(this.mode),
      reducedMotion: this.motion.matches,
    }), isFrozen ? 0 : seconds);
  }

  private createSession(song: SongDef, difficulty: Difficulty, isAttract: boolean): Session {
    this.renderer.effects.clear();
    return new Session({
      song,
      difficulty,
      engine: isAttract ? null : this.engine,
      offset: this.settings.offsetMs / MS_PER_SECOND,
      isBot: isAttract || this.options.isBot,
      effects: this.renderer.effects,
      getLayout: () => this.renderer.layout,
      onBanner: (text) => { if (!isAttract) showBanner(text); },
    });
  }

  /** A silent computer played song that runs behind the menus. */
  private createAttract(): Session {
    const song = SONGS[this.attractIndex % SONGS.length] ?? SONGS[0];
    if (!song) throw new Error('There are no songs to play.');
    this.attractIndex += 1;
    const session = this.createSession(song, 'hard', true);
    session.start();
    return session;
  }

  private async play(song: SongDef, difficulty: Difficulty): Promise<void> {
    if (this.mode === 'starting') return;
    this.mode = 'starting';
    this.lastPick = { song, difficulty };
    this.session.stop();
    await this.startAudio();
    this.blip();
    this.session = this.createSession(song, difficulty, false);
    setPauseSong(`${song.title} on ${difficultyLabel(difficulty)}`);
    showScreen(null);
    showPlayControls(true);
    this.session.start();
    this.mode = 'playing';
  }

  /** Start the audio engine. The song still plays, silent, when the browser refuses. */
  private async startAudio(): Promise<void> {
    try {
      this.engine ??= new AudioEngine(this.settings.volume);
      await this.engine.unlock();
    } catch (error) {
      console.error('Audio is not available, playing without sound', error);
      this.engine = null;
    }
  }

  private togglePause(): void {
    if (this.mode === 'paused') void this.resume();
    else if (this.mode === 'countdown') this.cancelCountdown();
    else this.pause();
  }

  private pause(): void {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.session.pause();
    this.showPauseMenu();
  }

  private showPauseMenu(): void {
    showCountdown(null);
    showPlayControls(false);
    showScreen('pause');
  }

  /**
   * Count down, then carry on. Audio is asked to start right here, inside the tap
   * or key press, because iOS only allows it there. It is raced against a timeout,
   * so a browser that never answers leaves the song silent instead of stuck.
   */
  private async resume(): Promise<void> {
    if (this.mode !== 'paused') return;
    const audioReady = this.engine ? this.engine.unlock() : Promise.resolve(false);
    this.mode = 'countdown';
    this.countdownRun += 1;
    const run = this.countdownRun;
    showScreen(null);
    for (const step of COUNTDOWN_STEPS) {
      showCountdown(step);
      await wait(COUNTDOWN_STEP_MS);
      if (run !== this.countdownRun) return;
    }
    await audioReady;
    if (run !== this.countdownRun) return;
    showCountdown(null);
    showPlayControls(true);
    this.session.resume();
    this.mode = 'playing';
  }

  /** Esc during the countdown goes back to the pause menu. */
  private cancelCountdown(): void {
    this.countdownRun += 1;
    this.mode = 'paused';
    this.showPauseMenu();
  }

  private quit(): void {
    this.countdownRun += 1;
    this.session.stop();
    this.blip();
    this.toMenu();
  }

  /** Back to the set list, with a silent demo song playing behind it. */
  private toMenu(): void {
    this.session = this.createAttract();
    this.mode = 'menu';
    showPlayControls(false);
    this.refreshSongList();
    showScreen('title');
  }

  /** Show the results over the frozen last frame of the song. */
  private toResults(): void {
    this.mode = 'results';
    showPlayControls(false);
    this.refreshSongList();
    showScreen('results');
  }

  private handleEnd(): void {
    const { session } = this;
    if (this.mode !== 'playing') {
      if (this.mode === 'menu') this.session = this.createAttract();
      return;
    }
    const hasFailed = session.outcome === 'failed';
    const isNewBest = !hasFailed && !session.isBot && this.saveResult(session);
    if (!hasFailed && this.engine) playCheer(this.engine);
    this.lastResult = {
      songTitle: session.song.title,
      difficultyLabel: difficultyLabel(session.difficulty),
      score: session.score.score,
      stars: hasFailed ? 0 : session.score.stars,
      hasFailed,
    };
    renderResults({
      song: session.song,
      difficulty: session.difficulty,
      score: session.score,
      hasFailed,
      isNewBest,
      progress: Math.max(0, session.time / session.chart.duration),
    });
    this.toResults();
  }

  private async share(): Promise<void> {
    if (!this.lastResult) return;
    setShareStatus(await shareScore(this.lastResult));
  }

  private saveResult(session: Session): boolean {
    const { score } = session;
    return saveBest(this.options.store, session.song.id, session.difficulty, {
      score: Math.round(score.score),
      stars: score.stars,
      accuracy: score.accuracy,
      maxCombo: score.maxCombo,
      isFullCombo: score.isFullCombo,
    });
  }

  private applySettings(settings: Settings): void {
    Object.assign(this.settings, settings);
    saveSettings(this.options.store, this.settings);
    this.engine?.setVolume(settings.volume);
    this.session.setOffset(settings.offsetMs / MS_PER_SECOND);
  }

  private refreshSongList(): void {
    renderSongList(
      byId('song-list', HTMLElement),
      SONGS,
      (songId, difficulty) => loadBest(this.options.store, songId, difficulty),
      (song, difficulty) => { void this.play(song, difficulty); },
    );
  }

  private setTouch(isTouch: boolean): void {
    if (this.isTouch === isTouch) return;
    this.isTouch = isTouch;
    setControlsHint(isTouch);
  }

  private handleResize(): void {
    this.renderer.resize();
    placeSurgeButton(surgeButtonRect(this.renderer.layout));
  }

  private blip(): void {
    if (this.engine) playBlip(this.engine);
  }
}
