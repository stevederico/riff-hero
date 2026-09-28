import { dragonFreeway } from './dragonFreeway.ts';
import { neonBackroads } from './neonBackroads.ts';
import { voltageParade } from './voltageParade.ts';
import type { SongDef } from '../types.ts';

/** Every playable song, in set list order. */
export const SONGS: readonly SongDef[] = [neonBackroads, voltageParade, dragonFreeway];

/** Find a song by id. */
export function findSong(id: string): SongDef | undefined {
  return SONGS.find((song) => song.id === id);
}
