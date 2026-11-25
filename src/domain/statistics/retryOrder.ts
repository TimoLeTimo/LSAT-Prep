import type { ReviewItem } from '../../data/records'

/** Questions to try again: LR first, then RC with each passage's questions together. */
export function retryOrder(items: readonly ReviewItem[]): string[] {
  const usable = items.filter(({ can_retry }) => can_retry)
  const passages = new Map<string, string[]>()
  const lr: string[] = []
  for (const { question_id, passage_id } of usable) {
    if (passage_id === null) {
      lr.push(question_id)
      continue
    }
    const found = passages.get(passage_id)
    if (found) found.push(question_id)
    else passages.set(passage_id, [question_id])
  }
  return [...lr, ...[...passages.values()].flat()]
}
