import { haptic } from '../shared/haptic.ts';

export const EXIT_CONFIRM_MS = 2_000;

export interface CloseWatcherLike {
  destroy: () => void;
  addEventListener: (type: 'close', listener: () => void) => void;
  removeEventListener: (type: 'close', listener: () => void) => void;
}

export interface ExitGuardEnvironment {
  enabled: () => boolean;
  createWatcher?: () => CloseWatcherLike;
  visibilityState: () => DocumentVisibilityState;
  addVisibilityListener: (listener: () => void) => void;
  removeVisibilityListener: (listener: () => void) => void;
  addPageHideListener: (listener: () => void) => void;
  removePageHideListener: (listener: () => void) => void;
  after: (ms: number, callback: () => void) => () => void;
  vibrate: () => void;
}

export interface ExitGuard {
  setActive: (active: boolean) => void;
  dismiss: () => void;
  destroy: () => void;
}

type CloseWatcherConstructor = new () => CloseWatcherLike;

const defaultEnvironment = (): ExitGuardEnvironment => {
  const Ctor =
    typeof window !== 'undefined'
      ? (window as Window & { CloseWatcher?: CloseWatcherConstructor })
          .CloseWatcher
      : undefined;
  return {
    enabled: () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches,
    createWatcher: typeof Ctor === 'function' ? () => new Ctor() : undefined,
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
    addPageHideListener: (listener) => {
      if (typeof window !== 'undefined')
        window.addEventListener('pagehide', listener);
    },
    removePageHideListener: (listener) => {
      if (typeof window !== 'undefined')
        window.removeEventListener('pagehide', listener);
    },
    after: (ms, callback) => {
      const id = setTimeout(callback, ms);
      return () => clearTimeout(id);
    },
    vibrate: () => haptic(),
  };
};

export const createExitGuard = (
  onConfirmChange: (confirming: boolean) => void,
  environment: ExitGuardEnvironment = defaultEnvironment(),
): ExitGuard => {
  let desired = false;
  let confirming = false;
  let disposed = false;
  let listening = false;
  let watcher: CloseWatcherLike | null = null;
  let cancelTimer: (() => void) | null = null;

  const setConfirming = (next: boolean): void => {
    if (confirming === next) return;
    confirming = next;
    onConfirmChange(next);
  };

  const clearTimer = (): void => {
    if (!cancelTimer) return;
    const cancel = cancelTimer;
    cancelTimer = null;
    cancel();
  };

  const disarm = (): void => {
    if (!watcher) return;
    const current = watcher;
    watcher = null;
    current.removeEventListener('close', onWatcherClose);
    current.destroy();
  };

  const onWatcherClose = (): void => {
    if (disposed || !watcher) return;
    const current = watcher;
    watcher = null;
    current.removeEventListener('close', onWatcherClose);
    if (!desired || environment.visibilityState() !== 'visible') return;
    clearTimer();
    environment.vibrate();
    setConfirming(true);
    cancelTimer = environment.after(EXIT_CONFIRM_MS, () => {
      cancelTimer = null;
      setConfirming(false);
      arm();
    });
  };

  const arm = (): void => {
    if (
      disposed ||
      !desired ||
      confirming ||
      watcher ||
      !environment.createWatcher ||
      !environment.enabled() ||
      environment.visibilityState() !== 'visible'
    )
      return;
    try {
      const next = environment.createWatcher();
      watcher = next;
      next.addEventListener('close', onWatcherClose);
    } catch {
      watcher = null;
    }
  };

  // 页面隐藏或进入 bfcache 时销毁 watcher，回前台再重建，避免 Chromium 焦点丢失导致拦截失效
  const suspend = (): void => {
    clearTimer();
    setConfirming(false);
    disarm();
  };

  const onVisibilityChange = (): void => {
    if (environment.visibilityState() === 'visible') arm();
    else suspend();
  };

  return {
    setActive(active) {
      if (disposed) return;
      desired = active;
      if (active) {
        if (!listening && environment.createWatcher) {
          listening = true;
          environment.addVisibilityListener(onVisibilityChange);
          environment.addPageHideListener(suspend);
        }
        arm();
      } else {
        suspend();
      }
    },
    dismiss() {
      if (disposed || !confirming) return;
      clearTimer();
      setConfirming(false);
      arm();
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      desired = false;
      if (listening) {
        listening = false;
        environment.removeVisibilityListener(onVisibilityChange);
        environment.removePageHideListener(suspend);
      }
      suspend();
    },
  };
};
