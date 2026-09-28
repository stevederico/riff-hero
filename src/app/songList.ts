import { songDuration } from '../game/timing.ts';
import { DIFFICULTIES } from '../game/types.ts';
import type { BestRecord } from '../game/storage.ts';
import type { Difficulty, SongDef } from '../game/types.ts';
import { formatDuration, formatNumber, make } from './dom.ts';

const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const INTENSITY_LABELS = ['Chill', 'Chill', 'Lively', 'Frantic'];
const STAR = '★';

export type BestLookup = (songId: string, difficulty: Difficulty) => BestRecord | null;
export type SongPick = (song: SongDef, difficulty: Difficulty) => void;

/** Display name of a difficulty. */
export function difficultyLabel(difficulty: Difficulty): string {
  return DIFFICULTY_LABELS[difficulty];
}

/** "1 star", "3 stars". */
export function starCount(stars: number): string {
  return `${stars} ${stars === 1 ? 'star' : 'stars'}`;
}

function bestText(best: BestRecord | null): string {
  if (!best) return 'Not Played';
  const stars = best.stars > 0 ? `${STAR.repeat(best.stars)} ` : '';
  return `${stars}${formatNumber(best.score)}`;
}

function makeDifficultyButton(
  song: SongDef, difficulty: Difficulty, best: BestRecord | null, onPick: SongPick,
): HTMLButtonElement {
  const button = make('button', 'difficulty-button');
  button.type = 'button';
  const label = DIFFICULTY_LABELS[difficulty];
  const summary = best ? `best ${formatNumber(best.score)}, ${starCount(best.stars)}` : 'not played yet';
  button.setAttribute('aria-label', `Play ${song.title} on ${label}, ${summary}`);
  button.dataset.song = song.id;
  button.dataset.difficulty = difficulty;
  button.append(
    make('span', '', label),
    make('span', best ? 'difficulty-best has-best' : 'difficulty-best', bestText(best)),
  );
  button.addEventListener('click', () => onPick(song, difficulty));
  return button;
}

function makeSongCard(song: SongDef, getBest: BestLookup, onPick: SongPick): HTMLLIElement {
  const card = make('li', 'song-card');
  card.style.setProperty('--hue', String(song.theme.hue));
  const heading = make('div');
  heading.append(make('h3', 'song-title', song.title), make('p', 'song-artist', song.artist));
  const meta = make('p', 'song-meta');
  meta.append(
    make('span', '', `${song.bpm} BPM`),
    make('span', '', formatDuration(songDuration(song))),
    make('span', '', INTENSITY_LABELS[song.intensity] ?? ''),
  );
  const row = make('div', 'difficulty-row');
  row.append(...DIFFICULTIES.map((difficulty) =>
    makeDifficultyButton(song, difficulty, getBest(song.id, difficulty), onPick)));
  card.append(heading, make('p', 'song-blurb', song.blurb), meta, row);
  return card;
}

/** Fill the set list with a card per song. */
export function renderSongList(
  list: HTMLElement, songs: readonly SongDef[], getBest: BestLookup, onPick: SongPick,
): void {
  list.replaceChildren(...songs.map((song) => makeSongCard(song, getBest, onPick)));
}
