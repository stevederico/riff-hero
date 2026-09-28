import { beforeEach, describe, expect, it } from 'vitest';
import {
  BEST_KEY, DEFAULT_SETTINGS, createMemoryStore, loadBest, loadSettings, saveBest, saveSettings,
} from './storage.ts';
import type { BestRecord, KeyValueStore } from './storage.ts';

const RECORD: BestRecord = { score: 5000, stars: 3, accuracy: 0.8, maxCombo: 40, isFullCombo: false };

describe('best scores', () => {
  let store: KeyValueStore;

  beforeEach(() => {
    store = createMemoryStore();
  });

  it('returns null before anything is saved', () => {
    expect(loadBest(store, 'song', 'easy')).toBeNull();
  });

  it('loads what was saved', () => {
    saveBest(store, 'song', 'easy', RECORD);
    expect(loadBest(store, 'song', 'easy')).toEqual(RECORD);
  });

  it('reports a new best', () => {
    expect(saveBest(store, 'song', 'easy', RECORD)).toBe(true);
  });

  it('keeps the old record when the new score is lower', () => {
    saveBest(store, 'song', 'easy', RECORD);
    saveBest(store, 'song', 'easy', { ...RECORD, score: 100 });
    expect(loadBest(store, 'song', 'easy')?.score).toBe(RECORD.score);
  });

  it('replaces the record when the new score is higher', () => {
    saveBest(store, 'song', 'easy', RECORD);
    saveBest(store, 'song', 'easy', { ...RECORD, score: 9000 });
    expect(loadBest(store, 'song', 'easy')?.score).toBe(9000);
  });

  it('keeps difficulties apart', () => {
    saveBest(store, 'song', 'easy', RECORD);
    expect(loadBest(store, 'song', 'hard')).toBeNull();
  });

  it('ignores corrupt data', () => {
    store.setItem(BEST_KEY, '{not json');
    expect(loadBest(store, 'song', 'easy')).toBeNull();
  });

  it('ignores records with the wrong shape', () => {
    store.setItem(BEST_KEY, JSON.stringify({ 'song:easy': { score: 'lots' } }));
    expect(loadBest(store, 'song', 'easy')).toBeNull();
  });

  it('survives a store that throws', () => {
    const broken: KeyValueStore = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    expect(saveBest(broken, 'song', 'easy', RECORD)).toBe(true);
  });
});

describe('settings', () => {
  let store: KeyValueStore;

  beforeEach(() => {
    store = createMemoryStore();
  });

  it('starts with defaults', () => {
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
  });

  it('loads what was saved', () => {
    saveSettings(store, { volume: 0.3, offsetMs: 40 });
    expect(loadSettings(store)).toEqual({ volume: 0.3, offsetMs: 40 });
  });

  it('falls back to defaults for values out of range', () => {
    saveSettings(store, { volume: 7, offsetMs: 9000 });
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
  });
});
