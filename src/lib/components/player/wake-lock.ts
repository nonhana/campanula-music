export interface WakeLockSentinelLike {
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
  removeEventListener: (type: 'release', listener: () => void) => void;
}

export interface WakeLockEnvironment {
  request?: () => Promise<WakeLockSentinelLike>;
  visibilityState: () => DocumentVisibilityState;
  addVisibilityListener: (listener: () => void) => void;
  removeVisibilityListener: (listener: () => void) => void;
}

export interface ScreenWakeLock {
  setActive: (active: boolean) => void;
  destroy: () => void;
}

const defaultEnvironment = (): WakeLockEnvironment => {
  const api =
    typeof navigator !== 'undefined' &&
    'wakeLock' in navigator &&
    navigator.wakeLock &&
    typeof navigator.wakeLock.request === 'function'
      ? navigator.wakeLock
      : undefined;
  return {
    request: api ? () => api.request('screen') : undefined,
    visibilityState: () =>
      typeof document !== 'undefined' ? document.visibilityState : 'hidden',
    addVisibilityListener: (listener) => {
      if (typeof document !== 'undefined')
        document.addEventListener('visibilitychange', listener);
    },
    removeVisibilityListener: (listener) => {
      if (typeof document !== 'undefined')
        document.removeEventListener('visibilitychange', listener);
    },
  };
};

export const createScreenWakeLock = (
  environment: WakeLockEnvironment = defaultEnvironment(),
): ScreenWakeLock => {
  let desired = false;
  let disposed = false;
  let pending = false;
  let sentinel: WakeLockSentinelLike | null = null;
  let listening = false;

  const detach = (current: WakeLockSentinelLike): void => {
    current.removeEventListener('release', onReleased);
  };

  const onReleased = (): void => {
    if (sentinel) detach(sentinel);
    sentinel = null;
  };

  const release = (): void => {
    if (!sentinel) return;
    const current = sentinel;
    sentinel = null;
    detach(current);
    void current.release().catch(() => {});
  };

  const acquire = (): void => {
    if (
      disposed ||
      !desired ||
      pending ||
      sentinel ||
      !environment.request ||
      environment.visibilityState() !== 'visible'
    )
      return;
    pending = true;
    void environment
      .request()
      .then((acquired) => {
        pending = false;
        if (
          disposed ||
          !desired ||
          environment.visibilityState() !== 'visible'
        ) {
          void acquired.release().catch(() => {});
          return;
        }
        sentinel = acquired;
        acquired.addEventListener('release', onReleased);
      })
      .catch(() => {
        pending = false;
      });
  };

  const onVisibilityChange = (): void => {
    if (environment.visibilityState() === 'visible') acquire();
    else release();
  };

  return {
    setActive(active) {
      if (disposed) return;
      desired = active;
      if (active) {
        if (!listening && environment.request) {
          listening = true;
          environment.addVisibilityListener(onVisibilityChange);
        }
        acquire();
      } else {
        release();
      }
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      desired = false;
      if (listening) {
        listening = false;
        environment.removeVisibilityListener(onVisibilityChange);
      }
      release();
    },
  };
};
