/** The first `count` items of a fair shuffle. Does not change its input. */
export function pickRandom<T>(items: readonly T[], count: number, random: () => number): T[] {
  const pool = [...items]
  // Fisher–Yates, stopping once enough have been picked.
  for (let index = 0; index < count; index++) {
    const other = index + Math.floor(random() * (pool.length - index))
    ;[pool[index], pool[other]] = [pool[other], pool[index]]
  }
  return pool.slice(0, count)
}
