import { creditLine, songTitle, thumbnailUrl } from '#lib/api/library.js';

import type { Clock, MediaSessionCapability } from './browser';
import type { Player, PlayerState } from './player';

const ARTWORK_SIZE = 512;
// 浏览器推算的进度和实际差出这么多秒就重新告诉它
const POSITION_DRIFT = 1;

export interface MediaSessionContext {
  session: MediaSessionCapability;
  MediaMetadata: typeof MediaMetadata;
  clock: Clock;
  player: Player;
  read: () => PlayerState;
  localCover: (coverUrl: string) => string | null;
}

export const connectMediaSession = ({
  session,
  MediaMetadata,
  clock,
  player,
  read,
  localCover,
}: MediaSessionContext): ((state: PlayerState) => void) => {
  session.setActionHandler('play', () => {
    if (read().status === 'paused') player.toggle();
  });
  session.setActionHandler('pause', () => {
    if (read().status !== 'paused') player.toggle();
  });
  session.setActionHandler('previoustrack', () => player.previous());
  session.setActionHandler('nexttrack', () => player.next());
  session.setActionHandler('seekto', (details) => {
    if (details.seekTime !== undefined) player.seek(details.seekTime);
  });

  let shown: number | null = null;
  let told: {
    songId: number;
    duration: number;
    position: number;
    playing: boolean;
    at: number;
  } | null = null;

  return (state) => {
    if (state.current === null) {
      if (shown !== null) {
        shown = null;
        told = null;
        session.metadata = null;
        session.playbackState = 'none';
        session.setPositionState();
      }
      return;
    }
    const { song } = state.queue[state.current];
    if (song.id !== shown) {
      shown = song.id;
      const cover = song.album.coverUrl;
      session.metadata = new MediaMetadata({
        title: songTitle(song),
        artist: creditLine(song.artists),
        album: song.album.name ?? '',
        artwork:
          cover === null
            ? []
            : [
                {
                  src: localCover(cover) ?? thumbnailUrl(cover, ARTWORK_SIZE),
                  sizes: `${ARTWORK_SIZE}x${ARTWORK_SIZE}`,
                },
              ],
      });
    }
    const playing = state.status !== 'paused';
    session.playbackState = playing ? 'playing' : 'paused';
    const duration =
      state.duration ?? (song.duration === null ? null : song.duration / 1000);
    if (duration === null) {
      if (told) {
        told = null;
        session.setPositionState();
      }
      return;
    }
    const position = Math.min(state.position, duration);
    const now = clock.now();
    if (
      told &&
      told.songId === song.id &&
      told.duration === duration &&
      told.playing === playing
    ) {
      const guessed = told.position + (playing ? (now - told.at) / 1000 : 0);
      if (Math.abs(position - guessed) <= POSITION_DRIFT) return;
    }
    told = {
      songId: song.id,
      duration,
      position,
      playing,
      at: now,
    };
    session.setPositionState({ duration, position, playbackRate: 1 });
  };
};
