export const SPEED_WINDOW_MS = 3000;

export interface SpeedSample {
  at: number;
  received: number;
}

export const bytesPerSecond = (
  samples: readonly SpeedSample[],
  now: number,
  windowMs = SPEED_WINDOW_MS,
): number => {
  const recent = samples.filter((sample) => now - sample.at <= windowMs);
  if (recent.length < 2) return 0;
  const first = recent[0];
  const last = recent[recent.length - 1];
  const seconds = (last.at - first.at) / 1000;
  return seconds <= 0
    ? 0
    : Math.max(0, (last.received - first.received) / seconds);
};

export const formatSpeed = (bytes: number): string => {
  if (bytes < 1024) return `${Math.round(bytes)} B/s`;
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1).replace(/\.0$/, '')} KB/s`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB/s`;
};
