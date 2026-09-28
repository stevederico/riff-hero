/** Where shared scores point. Set VITE_SHARE_URL at build time to point somewhere else. */
export const DEFAULT_SHARE_URL = 'https://rockstar-hero.grok.me';
const STAR = '★';

export interface ShareResult {
  songTitle: string;
  difficultyLabel: string;
  score: number;
  stars: number;
  hasFailed: boolean;
}

/** The share link, from the build setting or the default. */
export function shareUrl(): string {
  const configured: unknown = import.meta.env.VITE_SHARE_URL;
  return typeof configured === 'string' && configured ? configured : DEFAULT_SHARE_URL;
}

/** One line brag about a result. */
export function buildShareText(result: ShareResult): string {
  const score = Math.round(result.score).toLocaleString('en-US');
  const where = `${result.songTitle} on ${result.difficultyLabel}`;
  if (result.hasFailed) return `The crowd walked out on me during ${where} in Rockstar Hero. Can you finish it?`;
  const stars = result.stars > 0 ? ` ${STAR.repeat(result.stars)}` : '';
  return `I scored ${score} on ${where} in Rockstar Hero${stars}. Can you beat it?`;
}

/** Open the share sheet, or copy the text when there is none. Returns a status line for the player. */
export async function shareScore(result: ShareResult): Promise<string> {
  const text = buildShareText(result);
  const url = shareUrl();
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ title: 'Rockstar Hero', text, url });
      return '';
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    return 'Copied to your clipboard.';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return '';
    console.error('Sharing failed', error);
    return `Could not share. Copy this link instead: ${url}`;
  }
}
