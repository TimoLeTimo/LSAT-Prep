import type { Section } from '../content/types'
import { findPassageSets } from '../practice/choosePassages'
import { anyQuestion, type QuestionSummary } from '../practice/filterQuestions'
import { pickRandom } from '../practice/shuffle'
import type { ExamSection } from './assembleExam'

/** One section of a custom test. LR counts questions, and RC counts passages. */
export interface TestSection {
  section: Section
  amount: number
  minutes: number
  breakAfter: number
}

export interface TestPool {
  lr: string[]
  passages: string[][]
}

export function findTestPool(questions: readonly QuestionSummary[]): TestPool {
  return {
    lr: questions.filter(({ section }) => section === 'logical_reasoning').map(({ id }) => id),
    passages: findPassageSets(questions, anyQuestion).map(({ questionIds }) => questionIds),
  }
}

export function testNeeds(sections: readonly TestSection[]) {
  const total = (kind: Section) =>
    sections.filter(({ section }) => section === kind).reduce((sum, { amount }) => sum + amount, 0)
  return { lr: total('logical_reasoning'), passages: total('reading_comprehension') }
}

/** Fills the sections at random without repeats, or returns null if there are too few. */
export function assembleTest(
  pool: TestPool,
  sections: readonly TestSection[],
  random: () => number = Math.random,
): ExamSection[] | null {
  const needs = testNeeds(sections)
  if (needs.lr > pool.lr.length || needs.passages > pool.passages.length) return null
  const lr = pickRandom(pool.lr, needs.lr, random)
  const passages = pickRandom(pool.passages, needs.passages, random)
  return sections.map(({ section, amount, minutes, breakAfter }, index) => ({
    section,
    time_limit_seconds: minutes * 60,
    break_after_seconds: index < sections.length - 1 ? breakAfter * 60 : 0,
    question_ids:
      section === 'logical_reasoning' ? lr.splice(0, amount) : passages.splice(0, amount).flat(),
    unscored_ids: [],
  }))
}
