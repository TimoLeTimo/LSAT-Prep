/** Fewer answers than this say little about accuracy. */
export const FEW_ANSWERS = 10

/** "67%", or a dash when there is nothing to measure. */
export function percent(accuracy: number | null): string {
  return accuracy === null ? '–' : `${Math.round(accuracy * 100)}%`
}

/** "0:45" or "1:05" for one question. */
export function perQuestion(seconds: number | null): string {
  if (seconds === null) return '–'
  const total = Math.round(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** "2 h 5 min", "12 min", or "under 1 min". */
export function duration(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes === 0) return ms > 0 ? 'under 1 min' : '0 min'
  const hours = Math.floor(minutes / 60)
  return hours === 0 ? `${minutes} min` : `${hours} h ${minutes % 60} min`
}

/** "Nov 24", from YYYY-MM-DD, in the user's own language. */
export function shortDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

/** Which of many axis labels to draw, so that they do not collide. Keeps the last one. */
export function labelEvery(count: number, width: number, labelWidth = 64): number {
  return Math.max(1, Math.ceil((count * labelWidth) / Math.max(1, width)))
}
