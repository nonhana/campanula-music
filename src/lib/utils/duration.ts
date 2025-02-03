/**
 * Handle duration
 * @param duration - Duration
 * @returns Formatted duration
 */
export function handleDuration(duration: number) {
  const minutes = Math.floor(duration / 60)
  const seconds = duration % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
