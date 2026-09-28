import { App } from './app/app.ts';
import { byId } from './app/dom.ts';
import { createMemoryStore } from './game/storage.ts';
import type { KeyValueStore } from './game/storage.ts';

/** Browser storage, or a throwaway store when the browser blocks it. */
function openStore(): KeyValueStore {
  try {
    const probe = 'rockstar-hero:probe';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch (error) {
    console.error('Saved scores are off because storage is blocked', error);
    return createMemoryStore();
  }
}

/** Load the optional analytics script when the build was given one. */
function loadAnalytics(): void {
  const src: unknown = import.meta.env.VITE_ANALYTICS_SRC;
  const id: unknown = import.meta.env.VITE_ANALYTICS_ID;
  if (typeof src !== 'string' || typeof id !== 'string' || !src || !id) return;
  const script = document.createElement('script');
  script.defer = true;
  script.src = src;
  script.dataset.websiteId = id;
  document.head.append(script);
}

const params = new URLSearchParams(window.location.search);
const app = new App({
  canvas: byId('stage', HTMLCanvasElement),
  store: openStore(),
  isBot: params.get('bot') === '1',
  isHeadless: params.get('headless') === '1',
});
app.start();
if (import.meta.env.DEV) Object.assign(window, { riffHero: app });
loadAnalytics();
