/** Short mm:ss countdown, for the away/injury/boost/construction timers. */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/** Adaptive duration (e.g. "19m 7s", "1h 30m", "1d 2h") — largest unit plus the next one down. */
export function formatDurationAdaptive(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds))
  if (seconds < 60) return `${seconds}s`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`

  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}
