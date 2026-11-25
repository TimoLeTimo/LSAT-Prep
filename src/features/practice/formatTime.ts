/** "4:05" or "1:02:03". Rounds up, so 0:00 appears only when time is up. */
export function formatTime(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const pad = (value: number) => String(value).padStart(2, '0')
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = pad(total % 60)
  return hours > 0 ? `${hours}:${pad(minutes)}:${seconds}` : `${minutes}:${seconds}`
}

/** A quiet notice for the last 5 minutes and the last minute, if the limit was longer. */
export function timeNotice(remainingMs: number, limitSeconds: number): string {
  if (remainingMs <= 60_000 && limitSeconds > 60) return 'Less than 1 minute left'
  if (remainingMs <= 300_000 && limitSeconds > 300) return 'Less than 5 minutes left'
  return ''
}
