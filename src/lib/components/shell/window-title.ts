import type { Song } from '#lib/api/library.ts';
import { creditLine, songTitle } from '#lib/api/library.ts';

export interface WindowTitleEnvironment {
  readTitle: () => string;
  writeTitle: (title: string) => void;
  observeTitle: (onChange: () => void) => () => void;
}

export interface WindowTitleController {
  setPlaying: (title: string | null) => void;
  destroy: () => void;
}

export const formatPlayingTitle = (
  song: Pick<Song, 'name' | 'artists'>,
): string => `${songTitle(song)} · ${creditLine(song.artists)} — Campanula`;

const defaultEnvironment = (): WindowTitleEnvironment => ({
  readTitle: () => (typeof document !== 'undefined' ? document.title : ''),
  writeTitle: (title) => {
    if (typeof document !== 'undefined') document.title = title;
  },
  observeTitle: (onChange) => {
    if (typeof document === 'undefined' || !document.head) return () => {};
    const observer = new MutationObserver(onChange);
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => observer.disconnect();
  },
});

export const createWindowTitle = (
  environment: WindowTitleEnvironment = defaultEnvironment(),
): WindowTitleController => {
  let routeTitle = environment.readTitle();
  let desired: string | null = null;
  let applied: string | null = null;
  let disposed = false;

  const sync = (): void => {
    if (disposed) return;
    const current = environment.readTitle();
    if (applied === null || current !== applied) {
      routeTitle = current;
    }
    if (desired !== null) {
      if (current !== desired) {
        applied = desired;
        environment.writeTitle(desired);
      } else {
        applied = desired;
      }
      return;
    }
    if (applied !== null && current === applied) {
      applied = null;
      environment.writeTitle(routeTitle);
    } else {
      applied = null;
    }
  };

  const stop = environment.observeTitle(sync);

  return {
    setPlaying(title) {
      if (disposed) return;
      desired = title;
      sync();
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      stop();
      if (applied !== null && environment.readTitle() === applied) {
        environment.writeTitle(routeTitle);
      }
      desired = null;
      applied = null;
    },
  };
};
