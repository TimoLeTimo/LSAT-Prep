import type { Shortfall } from './assembleExam'

const plural = (number: number, noun: string) => `${number} ${noun}${number === 1 ? '' : 's'}`

/** Exactly what is missing, in plain language. */
export function shortfallText(shortfall: Shortfall): string[] {
  const { lrNeeded, lrAvailable, passagesNeeded, passagesAvailable, lengthsDoNotFit } = shortfall
  if (lengthsDoNotFit) {
    return [
      'You have enough questions, but the passages cannot be combined into sections of the right length. Import passages with different numbers of questions.',
    ]
  }
  const lines = []
  if (lrAvailable < lrNeeded) {
    lines.push(
      `${plural(lrNeeded - lrAvailable, 'more Logical Reasoning question')} (${lrNeeded} needed, ${lrAvailable} in the bank)`,
    )
  }
  if (passagesAvailable < passagesNeeded) {
    lines.push(
      `${plural(passagesNeeded - passagesAvailable, 'more passage')} (${passagesNeeded} needed, ${passagesAvailable} in the bank)`,
    )
  }
  return lines
}
