export function msToSeconds(ms: number) {
  return ms / 1000
}

export function secondsToMs(seconds: number) {
  return seconds * 1000
}

export function durationFormatter(duration: number) {
  const totalSeconds = msToSeconds(duration)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const mm = minutes.toString().padStart(2, '0')
  const ss = seconds.toString().padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`
}
