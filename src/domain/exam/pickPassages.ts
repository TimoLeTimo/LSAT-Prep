import { pickRandom } from '../practice/shuffle'
import type { Amount } from './formats'

/**
 * Picks whole passages at random so their questions come as close as possible to the
 * target. Returns null if no choice fits the range.
 */
export function pickPassages(
  pool: readonly string[][],
  { passages, questions }: Amount,
  random: () => number,
): string[][] | null {
  const wanted = passages ?? 0
  const shuffled = pickRandom(pool, pool.length, random)
  // reach[n] maps a question total to one random set of n passages that adds up to it.
  const reach: Map<number, number[]>[] = Array.from({ length: wanted + 1 }, () => new Map())
  reach[0].set(0, [])
  shuffled.forEach((ids, index) => {
    for (let chosen = Math.min(wanted, index + 1); chosen >= 1; chosen--) {
      for (const [total, set] of reach[chosen - 1]) {
        const sum = total + ids.length
        // The first set found is kept; the order is already random.
        if (sum <= questions.max && !reach[chosen].has(sum)) reach[chosen].set(sum, [...set, index])
      }
    }
  })
  const best = [...reach[wanted].keys()]
    .filter((total) => total >= questions.min && total <= questions.max)
    .toSorted((a, b) => Math.abs(a - questions.target) - Math.abs(b - questions.target) || a - b)[0]
  if (best === undefined) return null
  const set = reach[wanted].get(best)!.map((index) => shuffled[index])
  return pickRandom(set, set.length, random)
}
