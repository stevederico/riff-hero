import type { ScoreKeeper } from '../game/scoring.ts';
import type { Difficulty, SongDef } from '../game/types.ts';
import { byId, formatNumber, make, makeStar } from './dom.ts';
import { difficultyLabel } from './songList.ts';

const STAR_COUNT = 5;
const PERCENT = 100;
const TITLES = ['Rough Night', 'Rough Night', 'Getting There', 'Solid Show', 'Crowd Favorite', 'Legendary Set'];

export interface ResultsData {
  song: SongDef;
  difficulty: Difficulty;
  score: ScoreKeeper;
  hasFailed: boolean;
  isNewBest: boolean;
  /** Share of the song played, 0 to 1. */
  progress: number;
}

const percent = (share: number): string => `${Math.floor(share * PERCENT)}%`;

function headline(data: ResultsData): { kicker: string; title: string } {
  if (data.hasFailed) return { kicker: 'Show Over', title: 'The Crowd Walked Out' };
  const title = TITLES[data.score.stars] ?? 'Solid Show';
  return { kicker: data.score.isFullCombo ? 'Full Combo' : 'Song Complete', title };
}

function makeStat(label: string, value: string): HTMLDivElement {
  const stat = make('div');
  stat.append(make('dt', '', label), make('dd', '', value));
  return stat;
}

/** Fill the results screen. */
export function renderResults(data: ResultsData): void {
  const { score } = data;
  const { kicker, title } = headline(data);
  const kickerElement = byId('results-kicker', HTMLElement);
  kickerElement.textContent = kicker;
  kickerElement.classList.toggle('is-fail', data.hasFailed);
  byId('results-title', HTMLElement).textContent = title;
  const where = data.hasFailed ? `, made it ${percent(data.progress)} of the way` : '';
  byId('results-song', HTMLElement).textContent =
    `${data.song.title} on ${difficultyLabel(data.difficulty)}${where}`;

  const stars = data.hasFailed ? 0 : score.stars;
  const starRow = byId('results-stars', HTMLElement);
  starRow.setAttribute('aria-label', `${stars} of ${STAR_COUNT} stars`);
  starRow.replaceChildren(
    ...Array.from({ length: STAR_COUNT }, (_, index) => makeStar(index < stars, index)),
  );

  byId('results-score', HTMLElement).textContent = formatNumber(score.score);
  byId('results-best', HTMLElement).hidden = !data.isNewBest;
  byId('results-stats', HTMLElement).replaceChildren(
    makeStat('Accuracy', percent(score.accuracy)),
    makeStat('Max Combo', formatNumber(score.maxCombo)),
    makeStat('Missed', formatNumber(score.counts.miss)),
    makeStat('Perfect', formatNumber(score.counts.perfect)),
    makeStat('Great', formatNumber(score.counts.great)),
    makeStat('Good', formatNumber(score.counts.good)),
  );
  byId('again-button', HTMLButtonElement).textContent = data.hasFailed ? 'Try Again' : 'Play Again';
  byId('share-status', HTMLElement).textContent = '';
}
