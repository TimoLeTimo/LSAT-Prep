import type { Section } from '../content/types'
import { findPassageSets } from '../practice/choosePassages'
import { anyQuestion, type QuestionSummary } from '../practice/filterQuestions'
import { pickRandom } from '../practice/shuffle'
import type { Amount, ExamFormat, SectionSpec } from './formats'
import { pickPassages } from './pickPassages'

export interface ExamSection {
  section: Section
  time_limit_seconds: number
  break_after_seconds: number
  question_ids: string[]
  unscored_ids: string[]
}

/** What an exam needs, and what the bank has. */
export interface Shortfall {
  lrNeeded: number
  lrAvailable: number
  passagesNeeded: number
  passagesAvailable: number
  /** Enough passages, but their lengths cannot add up to the right number of questions. */
  lengthsDoNotFit: boolean
}

export type AssembledExam =
  | { ok: true; sections: ExamSection[] }
  | { ok: false; shortfall: Shortfall }

const LR: Section = 'logical_reasoning'
const ATTEMPTS = 8

interface Pool {
  lr: string[]
  passages: string[][]
}

/**
 * Builds an exam at random, never using a question or passage twice. Questions never
 * submitted are preferred, for the exam as a whole rather than section by section, so that
 * which sections have repeats says nothing about which are unscored.
 */
export function assembleExam(
  questions: readonly QuestionSummary[],
  format: Pick<ExamFormat, 'sections' | 'shuffleSections' | 'breaksAfter'>,
  random: () => number = Math.random,
): AssembledExam {
  const pool = newFirst(questions, random)
  const options = kindChoices(format.sections)
  const possible = options.filter((kinds) => hasEnough(pool, needs(format.sections, kinds)))
  if (possible.length === 0) return { ok: false, shortfall: shortfall(pool, format, options, false) }

  const kinds = pickRandom(possible, 1, random)[0]
  for (const choice of [kinds, ...possible.filter((other) => other !== kinds)]) {
    const sections = fillFromNewest(pool, format.sections, choice, random)
    if (sections === null) continue
    const ordered = format.shuffleSections ? pickRandom(sections, sections.length, random) : sections
    return {
      ok: true,
      sections: ordered.map((section, position) => ({
        ...section,
        break_after_seconds: (format.breaksAfter[position] ?? 0) * 60,
      })),
    }
  }
  return { ok: false, shortfall: shortfall(pool, format, possible, true) }
}

/** In random order, with those never submitted first. A passage is new if all of it is. */
function newFirst(questions: readonly QuestionSummary[], random: () => number): Pool {
  const isNew = new Set(
    questions.filter(({ last_correct }) => last_correct === null).map(({ id }) => id),
  )
  const order = <T>(items: T[], isFresh: (item: T) => boolean) => {
    const shuffled = pickRandom(items, items.length, random)
    return [...shuffled.filter(isFresh), ...shuffled.filter((item) => !isFresh(item))]
  }
  const lr = questions.filter(({ section }) => section === LR).map(({ id }) => id)
  const passages = findPassageSets(questions, anyQuestion).map(({ questionIds }) => questionIds)
  return {
    lr: order(lr, (id) => isNew.has(id)),
    passages: order(passages, (ids) => ids.every((id) => isNew.has(id))),
  }
}

/** Uses as few passages beyond the newest as will fit the required numbers of questions. */
function fillFromNewest(
  pool: Pool,
  specs: readonly SectionSpec[],
  kinds: Section[],
  random: () => number,
) {
  const need = needs(specs, kinds)
  const lr = pool.lr.slice(0, need.lr)
  let size = need.passages
  for (;;) {
    // A random choice of passages can leave too few for a later section, so try again.
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const passages = pool.passages.slice(0, size)
      const sections = fill({ lr, passages }, specs, kinds, random)
      if (sections !== null) return sections
    }
    if (size >= pool.passages.length) return null
    // One at a time at first, then faster, so a large bank stays quick.
    size = Math.min(pool.passages.length, Math.max(size + 1, Math.floor(size * 1.2)))
  }
}

/** Every way to settle the sections that can be either kind. */
function kindChoices(specs: readonly SectionSpec[]): Section[][] {
  return specs.reduce<Section[][]>(
    (choices, { kinds }) => choices.flatMap((choice) => kinds.map((kind) => [...choice, kind])),
    [[]],
  )
}

function amounts(spec: SectionSpec, kind: Section): Amount[] {
  return [spec.scored?.[kind], spec.unscored?.[kind]].filter((amount) => amount !== undefined)
}

function needs(specs: readonly SectionSpec[], kinds: Section[]) {
  let lr = 0
  let passages = 0
  specs.forEach((spec, index) => {
    for (const amount of amounts(spec, kinds[index])) {
      if (kinds[index] === LR) lr += amount.questions.target
      else passages += amount.passages ?? 0
    }
  })
  return { lr, passages }
}

function hasEnough(pool: Pool, need: { lr: number; passages: number }) {
  return pool.lr.length >= need.lr && pool.passages.length >= need.passages
}

function fill(
  pool: Pool,
  specs: readonly SectionSpec[],
  kinds: Section[],
  random: () => number,
): Omit<ExamSection, 'break_after_seconds'>[] | null {
  const lr = pickRandom(pool.lr, pool.lr.length, random)
  let passages = pool.passages
  const sections = []
  for (const [index, spec] of specs.entries()) {
    const kind = kinds[index]
    const units: string[][] = []
    const unscored: string[] = []
    for (const part of ['scored', 'unscored'] as const) {
      const amount = spec[part]?.[kind]
      if (amount === undefined) continue
      let picked: string[][]
      if (kind === LR) {
        picked = lr.splice(0, amount.questions.target).map((id) => [id])
      } else {
        const found = pickPassages(passages, amount, random)
        if (found === null) return null
        picked = found
        const used = new Set(found)
        passages = passages.filter((passage) => !used.has(passage))
      }
      units.push(...picked)
      if (part === 'unscored') unscored.push(...picked.flat())
    }
    sections.push({
      section: kind,
      time_limit_seconds: spec.minutes * 60,
      // Mixes scored and unscored questions. Passages stay whole.
      question_ids: pickRandom(units, units.length, random).flat(),
      unscored_ids: unscored,
    })
  }
  return sections
}

/** Compared with the easiest choice: the one the bank comes closest to filling. */
function shortfall(
  pool: Pool,
  { sections }: Pick<ExamFormat, 'sections'>,
  options: Section[][],
  lengthsDoNotFit: boolean,
): Shortfall {
  const missing = ({ lr, passages }: { lr: number; passages: number }) =>
    Math.max(0, lr - pool.lr.length) + 6 * Math.max(0, passages - pool.passages.length)
  const easiest = options
    .map((kinds) => needs(sections, kinds))
    .toSorted((a, b) => missing(a) - missing(b))[0]
  return {
    lrNeeded: easiest.lr,
    lrAvailable: pool.lr.length,
    passagesNeeded: easiest.passages,
    passagesAvailable: pool.passages.length,
    lengthsDoNotFit,
  }
}
