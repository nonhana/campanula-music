export type ShortcutRoute = '/daily' | '/search' | '/downloads' | '/playlists';

const SHORTCUT_ROUTES: ReadonlySet<string> = new Set<ShortcutRoute>([
  '/daily',
  '/search',
  '/downloads',
  '/playlists',
]);

export interface LaunchParamsLike {
  readonly targetURL?: string | null;
}

interface LaunchQueueLike {
  setConsumer: (consumer: (params: LaunchParamsLike) => void) => void;
}

export interface LaunchQueueEnvironment {
  launchQueue?: LaunchQueueLike;
  currentURL: () => URL;
}

export const parseShortcutRoute = (
  targetURL: string | null | undefined,
  origin: string,
): ShortcutRoute | null => {
  if (!targetURL) return null;
  let parsed: URL;
  try {
    parsed = new URL(targetURL, origin);
  } catch {
    return null;
  }
  if (parsed.origin !== origin) return null;
  if (parsed.searchParams.get('source') !== 'shortcut') return null;
  return SHORTCUT_ROUTES.has(parsed.pathname)
    ? (parsed.pathname as ShortcutRoute)
    : null;
};

const defaultEnvironment = (): LaunchQueueEnvironment => ({
  launchQueue:
    typeof window !== 'undefined'
      ? (window as Window & { launchQueue?: LaunchQueueLike }).launchQueue
      : undefined,
  currentURL: () => new URL(window.location.href),
});

export const consumeLaunchQueue = (
  handlers: {
    navigate: (route: ShortcutRoute) => void;
    cleanCurrent: (route: ShortcutRoute) => void;
  },
  environment: LaunchQueueEnvironment = defaultEnvironment(),
): (() => void) => {
  if (!environment.launchQueue) return () => {};
  let active = true;
  environment.launchQueue.setConsumer((params) => {
    if (!active) return;
    const current = environment.currentURL();
    const route = parseShortcutRoute(params.targetURL, current.origin);
    if (!route) return;
    if (
      current.pathname === route &&
      current.searchParams.get('source') === 'shortcut'
    ) {
      handlers.cleanCurrent(route);
      return;
    }
    handlers.navigate(route);
  });
  return () => {
    active = false;
  };
};
