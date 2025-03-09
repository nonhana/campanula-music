export function msToSeconds(ms: number) {
  return ms / 1000
}

export function secondsToMs(seconds: number) {
  return seconds * 1000
}

export function durationFormatter(duration: number) {
  const totalSeconds = msToSeconds(duration)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
