import { endpoints } from '#lib/api/endpoints.js';
import type { LyricsResponse } from '#lib/api/playback.js';

import type { SessionApi, SessionFailure, SessionRound } from './session-round';

type LyricsFailure = SessionFailure;

export type LyricsState =
  | { songId: number; status: 'loading' }
  | { songId: number; status: 'failed'; failure: LyricsFailure }
  | { songId: number; status: 'shown'; lyrics: LyricsResponse };

export interface LyricsContext {
  api: SessionApi;
  session: SessionRound;
  read: () => LyricsState | null;
  write: (lyrics: LyricsState | null) => void;
  stored: (songId: number) => LyricsResponse | null;
}

export interface Lyrics {
  open: (songId: number) => Promise<void>;
}

export const createLyrics = (context: LyricsContext): Lyrics => {
  const { api } = context;

  const clear = (): void => {
    context.write(null);
  };

  context.session.onChange((change) => {
    if (change.kind !== 'signedIn') clear();
  });

  return {
    async open(songId) {
      const shown = context.read();
      if (shown?.songId === songId && shown.status !== 'failed') return;
      const stored = context.stored(songId);
      if (stored)
        return context.write({ songId, status: 'shown', lyrics: stored });
      context.write({ songId, status: 'loading' });
      const result = await api.get(endpoints.lyrics, { id: songId });
      if (!result) return;
      if (context.read()?.songId !== songId) return;
      if (result.ok)
        return context.write({ songId, status: 'shown', lyrics: result.value });
      context.write({ songId, status: 'failed', failure: result.failure });
    },
  };
};
