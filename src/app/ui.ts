import type { Settings } from '../game/storage.ts';
import type { Rect } from '../render/meters.ts';
import { byId } from './dom.ts';

const PERCENT = 100;

export type ScreenName = 'title' | 'pause' | 'results';
const SCREEN_IDS: Record<ScreenName, string> = {
  title: 'screen-title',
  pause: 'screen-pause',
  results: 'screen-results',
};
const FOCUS_IDS: Record<ScreenName, string | null> = {
  title: null,
  pause: 'resume-button',
  results: 'again-button',
};

export interface UiHandlers {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  quit: () => void;
  surge: () => void;
  share: () => void;
  /** A menu button was pressed, for the click sound. */
  click: () => void;
  changeSettings: (settings: Settings) => void;
}

function onClick(id: string, handler: () => void): void {
  byId(id, HTMLButtonElement).addEventListener('click', handler);
}

/** Show one menu screen, or none while playing. */
export function showScreen(name: ScreenName | null): void {
  for (const [screen, id] of Object.entries(SCREEN_IDS)) {
    byId(id, HTMLElement).hidden = screen !== name;
  }
  const focusId = name ? FOCUS_IDS[name] : null;
  if (focusId) byId(focusId, HTMLButtonElement).focus({ preventScroll: true });
}

/** Show or hide the pause and surge buttons that sit over the highway. */
export function showPlayControls(isVisible: boolean): void {
  byId('play-controls', HTMLElement).hidden = !isVisible;
}

/** Put the see through surge button over its touch area. */
export function placeSurgeButton(area: Rect): void {
  const button = byId('surge-button', HTMLButtonElement);
  button.hidden = false;
  button.style.left = `${area.x}px`;
  button.style.top = `${area.y}px`;
  button.style.width = `${area.width}px`;
  button.style.height = `${area.height}px`;
}

/** Flash a short message over the highway. */
export function showBanner(text: string): void {
  const banner = byId('banner', HTMLElement);
  banner.textContent = text;
  banner.classList.remove('is-showing');
  void banner.offsetWidth;
  banner.classList.add('is-showing');
}

/** Show a countdown number, or hide it with null. */
export function showCountdown(text: string | null): void {
  const countdown = byId('countdown', HTMLElement);
  countdown.hidden = text === null;
  countdown.textContent = text ?? '';
}

/** Show the result of a share attempt under the results buttons. */
export function setShareStatus(text: string): void {
  byId('share-status', HTMLElement).textContent = text;
}

/** Name the song on the pause screen. */
export function setPauseSong(text: string): void {
  byId('pause-song', HTMLElement).textContent = text;
}

/** Tell the player which controls fit their device. */
export function setControlsHint(isTouch: boolean): void {
  byId('controls-hint', HTMLElement).textContent = isTouch
    ? 'Tap the lanes as notes cross the line. Tap the Surge meter to double your score.'
    : 'Play with A S D F G or 1 to 5. Space fires Surge. Esc pauses.';
}

/** Offset sliders live in Settings and on the pause menu. They always show the same value. */
const OFFSET_SLIDERS = [
  { input: 'offset-input', output: 'offset-output' },
  { input: 'pause-offset-input', output: 'pause-offset-output' },
];

function bindSettings(settings: Settings, handlers: UiHandlers): void {
  const volume = byId('volume-input', HTMLInputElement);
  const offsets = OFFSET_SLIDERS.map((slider) => ({
    input: byId(slider.input, HTMLInputElement),
    output: byId(slider.output, HTMLOutputElement),
  }));
  let offsetMs = settings.offsetMs;
  const refresh = (): void => {
    byId('volume-output', HTMLOutputElement).textContent = `${volume.value}%`;
    for (const slider of offsets) {
      slider.input.value = String(offsetMs);
      slider.output.textContent = `${offsetMs} ms`;
    }
  };
  const publish = (): void => {
    refresh();
    handlers.changeSettings({ volume: Number(volume.value) / PERCENT, offsetMs });
  };
  volume.value = String(Math.round(settings.volume * PERCENT));
  refresh();
  volume.addEventListener('input', publish);
  for (const slider of offsets) {
    slider.input.addEventListener('input', () => {
      offsetMs = Number(slider.input.value);
      publish();
    });
  }
}

function bindDialog(buttonId: string, dialogId: string, handlers: UiHandlers): void {
  const dialog = byId(dialogId, HTMLDialogElement);
  onClick(buttonId, () => {
    handlers.click();
    dialog.showModal();
  });
}

/** Wire up every button on the page. */
export function bindUi(settings: Settings, handlers: UiHandlers): void {
  onClick('pause-button', handlers.pause);
  onClick('surge-button', handlers.surge);
  byId('surge-button', HTMLButtonElement).addEventListener('pointerdown', handlers.surge);
  onClick('resume-button', handlers.resume);
  onClick('restart-button', handlers.restart);
  onClick('again-button', handlers.restart);
  onClick('quit-button', handlers.quit);
  onClick('back-button', handlers.quit);
  onClick('share-button', handlers.share);
  bindDialog('how-button', 'how-dialog', handlers);
  bindDialog('settings-button', 'settings-dialog', handlers);
  bindSettings(settings, handlers);
}
