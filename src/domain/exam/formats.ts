import type { Section } from '../content/types'

/** How many questions to choose. Passages vary in length, so RC gives a range. */
export interface Amount {
  questions: { target: number; min: number; max: number }
  /** RC only. */
  passages?: number
}

export interface SectionSpec {
  /** More than one means one is picked at random, so the unscored section is not obvious. */
  kinds: readonly Section[]
  minutes: number
  /** Null when no question in the section counts. */
  scored: Partial<Record<Section, Amount>> | null
  /** Unscored questions in the section. */
  unscored: Partial<Record<Section, Amount>> | null
}

export interface ExamFormat {
  id: string
  name: string
  /** When this format is used, for the user's information. */
  period: string
  sections: readonly SectionSpec[]
  /** Whether the sections are put in random order. */
  shuffleSections: boolean
  /** Minutes of break after a section, by position in the final order (0 is the first). */
  breaksAfter: Readonly<Record<number, number>>
}

const exactly = (count: number) => ({ target: count, min: count, max: count })
const lr = (count: number): Amount => ({ questions: exactly(count) })
const rc = (passages: number, target: number, spread: number): Amount => ({
  passages,
  questions: { target, min: target - spread, max: target + spread },
})

const LR: Section = 'logical_reasoning'
const RC: Section = 'reading_comprehension'

/**
 * Exam formats as data. Sources, the date checked, and what LSAC does not state are in
 * docs/EXAM_FORMATS.md. Check LSAC again before each release.
 */
export const examFormats: readonly ExamFormat[] = [
  {
    id: 'four-section',
    name: 'Four sections, one unscored',
    period: 'August 2024 through June 2027',
    sections: [
      { kinds: [LR], minutes: 35, scored: { [LR]: lr(25) }, unscored: null },
      { kinds: [LR], minutes: 35, scored: { [LR]: lr(25) }, unscored: null },
      { kinds: [RC], minutes: 35, scored: { [RC]: rc(4, 27, 1) }, unscored: null },
      {
        kinds: [LR, RC],
        minutes: 35,
        scored: null,
        unscored: { [LR]: lr(25), [RC]: rc(4, 27, 1) },
      },
    ],
    shuffleSections: true,
    breaksAfter: { 1: 10 },
  },
  {
    id: 'three-section',
    name: 'Three sections, unscored questions included',
    period: 'From August 2027',
    sections: [
      {
        kinds: [RC],
        minutes: 52,
        scored: { [RC]: rc(4, 27, 1) },
        unscored: { [RC]: rc(2, 13, 1) },
      },
      { kinds: [LR], minutes: 45, scored: { [LR]: lr(25) }, unscored: { [LR]: lr(7) } },
      { kinds: [LR], minutes: 45, scored: { [LR]: lr(25) }, unscored: { [LR]: lr(7) } },
    ],
    shuffleSections: false,
    breaksAfter: { 0: 10, 1: 10 },
  },
]
