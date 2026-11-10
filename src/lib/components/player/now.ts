import type { Song } from '#lib/api/library.js';
import type { PlayerState } from '#lib/app/player.js';

export const currentSong = (player: PlayerState): Song | null =>
  player.current === null ? null : player.queue[player.current].song;

export const shownDuration = (player: PlayerState): number =>
  player.duration ?? (currentSong(player)?.duration ?? 0) / 1000;

export const progressOf = (player: PlayerState): number => {
  const duration = shownDuration(player);
  return duration > 0 ? Math.min(1, player.position / duration) : 0;
};
