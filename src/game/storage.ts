import type { Difficulty } from './types.ts';

export const BEST_KEY = 'rockstar-hero:best:v1';
export const SETTINGS_KEY = 'rockstar-hero:settings:v1';
export const MAX_OFFSET_MS = 200;

export interface BestRecord {
  score: number;
  stars: number;
  accuracy: number;
  maxCombo: number;
  isFullCombo: boolean;
}

export interface Settings {
  /** Master volume, 0 to 1. */
  volume: number;
  /** Extra delay in milliseconds between sound and picture, for slow speakers. */
  offsetMs: number;
}

export const DEFAULT_SETTINGS: Settings = { volume: 0.8, offsetMs: 0 };

/** The part of `Storage` this module needs, so tests can pass a plain object. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

type BestTable = Record<string, BestRecord>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBestRecord(value: unknown): value is BestRecord {
  if (!isRecord(value)) return false;
  const numbers = [value.score, value.stars, value.accuracy, value.maxCombo];
  return numbers.every((item) => typeof item === 'number' && Number.isFinite(item))
    && typeof value.isFullCombo === 'boolean';
}

function readJson(store: KeyValueStore, key: string): unknown {
  try {
    const raw = store.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch (error) {
    console.error('Could not read saved data', key, error);
    return null;
  }
}

function writeJson(store: KeyValueStore, key: string, value: unknown): void {
  try {
    store.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Could not save data', key, error);
  }
}

function readBestTable(store: KeyValueStore): BestTable {
  const parsed = readJson(store, BEST_KEY);
  if (!isRecord(parsed)) return {};
  const table: BestTable = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (isBestRecord(value)) table[key] = value;
  }
  return table;
}

const bestKey = (songId: string, difficulty: Difficulty): string => `${songId}:${difficulty}`;

/** Best result for a song and difficulty, or null when never finished. */
export function loadBest(store: KeyValueStore, songId: string, difficulty: Difficulty): BestRecord | null {
  return readBestTable(store)[bestKey(songId, difficulty)] ?? null;
}

/** Save a result if it beats the stored score. Returns true for a new best. */
export function saveBest(
  store: KeyValueStore, songId: string, difficulty: Difficulty, record: BestRecord,
): boolean {
  const table = readBestTable(store);
  const key = bestKey(songId, difficulty);
  const previous = table[key];
  if (previous && previous.score >= record.score) return false;
  table[key] = record;
  writeJson(store, BEST_KEY, table);
  return true;
}

/** Saved settings, with defaults for anything missing or out of range. */
export function loadSettings(store: KeyValueStore): Settings {
  const parsed = readJson(store, SETTINGS_KEY);
  if (!isRecord(parsed)) return { ...DEFAULT_SETTINGS };
  const { volume, offsetMs } = parsed;
  return {
    volume: typeof volume === 'number' && volume >= 0 && volume <= 1
      ? volume : DEFAULT_SETTINGS.volume,
    offsetMs: typeof offsetMs === 'number' && Math.abs(offsetMs) <= MAX_OFFSET_MS
      ? offsetMs : DEFAULT_SETTINGS.offsetMs,
  };
}

/** Save settings. */
export function saveSettings(store: KeyValueStore, settings: Settings): void {
  writeJson(store, SETTINGS_KEY, settings);
}

/** A store that forgets everything, for when localStorage is blocked. */
export function createMemoryStore(): KeyValueStore {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => { items.set(key, value); },
  };
}
