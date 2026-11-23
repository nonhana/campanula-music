const DEFAULT_HAPTIC_MS = 10;

export interface HapticEnvironment {
  matchMedia?: (query: string) => { matches: boolean };
  vibrate?: (pattern: number) => boolean;
}

const defaultEnvironment = (): HapticEnvironment => ({
  matchMedia:
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? (query) => window.matchMedia(query)
      : undefined,
  vibrate:
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
      ? (pattern) => navigator.vibrate(pattern)
      : undefined,
});

export const haptic = (
  ms = DEFAULT_HAPTIC_MS,
  environment: HapticEnvironment = defaultEnvironment(),
): void => {
  if (!environment.matchMedia || !environment.vibrate) return;
  if (!environment.matchMedia('(pointer: coarse)').matches) return;
  if (environment.matchMedia('(prefers-reduced-motion: reduce)').matches)
    return;
  environment.vibrate(ms);
};
