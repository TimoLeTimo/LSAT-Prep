import { describe, expect, it } from 'vitest'
import type { QuestionSummary } from '../practice/filterQuestions'
import { assembleExam, type ExamSection } from './assembleExam'
import { examFormats } from './formats'
import { pickPassages } from './pickPassages'

const base = { difficulty: 2 as const, last_correct: null, is_bookmarked: false }
const lrBank = (count: number): QuestionSummary[] =>
  Array.from({ length: count }, (_, index) => ({
    ...base, id: `lr${index}`, section: 'logical_reasoning', category_id: 'lr-flaw', passage_id: null,
  }))
const rcBank = (lengths: number[]): QuestionSummary[] =>
  lengths.flatMap((length, passage) =>
    Array.from({ length }, (_, index) => ({
      ...base, id: `p${passage}-${index}`, section: 'reading_comprehension' as const, category_id: 'rc-detail', passage_id: `p${passage}`,
    })),
  )
const mixedLengths = Array.from({ length: 16 }, (_, index) => 5 + (index % 4))
const bank = [...lrBank(110), ...rcBank(mixedLengths)]
const [four, three] = examFormats

function built(questions: QuestionSummary[], format: (typeof examFormats)[number]): ExamSection[] {
  const exam = assembleExam(questions, format)
  if (!exam.ok) throw new Error(JSON.stringify(exam.shortfall))
  return exam.sections
}
const scoredCount = (sections: ExamSection[], kind: string) =>
  sections
    .filter(({ section }) => section === kind)
    .reduce((sum, { question_ids, unscored_ids }) => sum + question_ids.length - unscored_ids.length, 0)

describe('every format', () => {
  it.each(examFormats)('$id is assembled correctly', (format) => {
    for (let run = 0; run < 60; run++) {
      const sections = built(bank, format)
      const ids = sections.flatMap(({ question_ids }) => question_ids)
      expect(new Set(ids).size).toBe(ids.length)
      expect(scoredCount(sections, 'logical_reasoning')).toBe(50)
      expect(scoredCount(sections, 'reading_comprehension')).toBeGreaterThanOrEqual(26)
      expect(scoredCount(sections, 'reading_comprehension')).toBeLessThanOrEqual(28)
      for (const { section, question_ids, unscored_ids } of sections) {
        expect(unscored_ids.every((id) => question_ids.includes(id))).toBe(true)
        expect(question_ids.every((id) => id.startsWith(section === 'logical_reasoning' ? 'lr' : 'p'))).toBe(true)
        if (section === 'logical_reasoning') continue
        // Passages are whole, in order, and scored or unscored as a unit.
        const groups = new Map<string, string[]>()
        for (const id of question_ids) {
          const passage = id.split('-')[0]
          groups.set(passage, [...(groups.get(passage) ?? []), id])
        }
        expect([...groups.values()].flat()).toEqual(question_ids)
        for (const [passage, inPassage] of groups) {
          expect(inPassage).toEqual(bank.filter((q) => q.passage_id === passage).map((q) => q.id))
          const unscored = inPassage.filter((id) => unscored_ids.includes(id)).length
          expect([0, inPassage.length]).toContain(unscored)
        }
      }
    }
  })

  it.each(examFormats)('$id never ends with a break or has one out of range', ({ sections, breaksAfter }) => {
    for (const position of Object.keys(breaksAfter)) {
      expect(Number(position)).toBeLessThan(sections.length - 1)
    }
  })
})

describe('the four-section format', () => {
  it('has four 35-minute sections, one unscored, and a break after the second', () => {
    const sections = built(bank, four)
    expect(sections.map((section) => section.time_limit_seconds)).toEqual([2100, 2100, 2100, 2100])
    expect(sections.map((section) => section.break_after_seconds)).toEqual([0, 600, 0, 0])
    const unscored = sections.filter(({ unscored_ids }) => unscored_ids.length > 0)
    expect(unscored).toHaveLength(1)
    expect(unscored[0].unscored_ids.length).toBe(unscored[0].question_ids.length)
  })

  it('puts the unscored section anywhere, as either kind', () => {
    const seen = new Set<string>()
    for (let run = 0; run < 200; run++) {
      const sections = built(bank, four)
      const position = sections.findIndex(({ unscored_ids }) => unscored_ids.length > 0)
      seen.add(`${position}${sections[position].section[0]}`)
    }
    expect(seen.size).toBe(8)
  })

  it('falls back to the only unscored kind the bank can fill', () => {
    for (let run = 0; run < 20; run++) {
      const fewLr = built([...lrBank(50), ...rcBank(mixedLengths)], four)
      expect(fewLr.filter(({ section }) => section === 'logical_reasoning')).toHaveLength(2)
      const fewRc = built([...lrBank(75), ...rcBank([7, 7, 7, 6])], four)
      expect(fewRc.filter(({ section }) => section === 'logical_reasoning')).toHaveLength(3)
    }
  })
})

describe('the three-section format', () => {
  it('starts with RC and mixes unscored questions into each section', () => {
    const sections = built(bank, three)
    expect(sections.map(({ section }) => section[0])).toEqual(['r', 'l', 'l'])
    expect(sections.map((section) => section.time_limit_seconds)).toEqual([3120, 2700, 2700])
    expect(sections.map((section) => section.break_after_seconds)).toEqual([600, 600, 0])
    expect(sections.slice(1).map(({ question_ids, unscored_ids }) => [question_ids.length, unscored_ids.length])).toEqual([[32, 7], [32, 7]])
    expect(sections[0].unscored_ids.length).toBeGreaterThanOrEqual(12)
  })

  it('does not put the unscored questions in fixed places', () => {
    const positions = new Set<number>()
    for (let run = 0; run < 60; run++) {
      const { question_ids, unscored_ids } = built(bank, three)[1]
      for (const id of unscored_ids) positions.add(question_ids.indexOf(id))
    }
    expect(positions.size).toBe(32)
  })
})

describe('shortfalls', () => {
  it.each([
    ['an empty bank', [], { lrNeeded: 50, lrAvailable: 0, passagesNeeded: 8, passagesAvailable: 0 }],
    ['one LR short', [...lrBank(49), ...rcBank(mixedLengths)], { lrNeeded: 50, lrAvailable: 49, passagesNeeded: 8, passagesAvailable: 16 }],
    ['one passage short', [...lrBank(110), ...rcBank([7, 7, 7])], { lrNeeded: 75, lrAvailable: 110, passagesNeeded: 4, passagesAvailable: 3 }],
  ])('explains %s', (_, questions, expected) => {
    const exam = assembleExam(questions, four)
    expect(exam).toEqual({ ok: false, shortfall: { ...expected, lengthsDoNotFit: false } })
  })

  it('explains passages that cannot add up', () => {
    const exam = assembleExam([...lrBank(110), ...rcBank([5, 5, 5, 5, 5])], four)
    expect(exam).toMatchObject({ ok: false, shortfall: { lengthsDoNotFit: true, passagesAvailable: 5 } })
  })
})

describe('pickPassages', () => {
  const pool = (lengths: number[]) =>
    lengths.map((length, passage) => Array.from({ length }, (_, index) => `${passage}-${index}`))
  const amount = { passages: 2, questions: { target: 13, min: 12, max: 14 } }

  it('finds the exact target whenever it exists', () => {
    for (let run = 0; run < 100; run++) {
      const picked = pickPassages(pool([5, 5, 5, 5, 5, 8, 5, 5]), amount, Math.random)
      expect(picked?.flat()).toHaveLength(13)
    }
  })

  it('takes the closest total in range, or nothing', () => {
    expect(pickPassages(pool([6, 6]), amount, Math.random)?.flat()).toHaveLength(12)
    expect(pickPassages(pool([5, 5]), amount, Math.random)).toBeNull()
    expect(pickPassages(pool([8, 8]), amount, Math.random)).toBeNull()
    expect(pickPassages(pool([13]), amount, Math.random)).toBeNull()
  })

  it('can pick any passage', () => {
    const seen = new Set<string>()
    for (let run = 0; run < 300; run++) {
      for (const [id] of pickPassages(pool([6, 7, 6, 7, 6, 7]), amount, Math.random) ?? []) seen.add(id)
    }
    expect(seen.size).toBe(6)
  })
})

describe('preferring new questions', () => {
  const used = (questions: QuestionSummary[], isUsed: (question: QuestionSummary, index: number) => boolean) =>
    questions.map((question, index) => (isUsed(question, index) ? { ...question, last_correct: true } : question))
  const usedIds = (questions: QuestionSummary[]) =>
    new Set(questions.filter(({ last_correct }) => last_correct !== null).map(({ id }) => id))

  it('uses only new ones when there are enough', () => {
    const questions = [
      ...used(lrBank(160), (_, index) => index < 80),
      ...used(rcBank([...mixedLengths, ...mixedLengths]), ({ passage_id }) => Number(passage_id!.slice(1)) < 16),
    ]
    const old = usedIds(questions)
    for (let run = 0; run < 30; run++) {
      for (const format of examFormats) {
        const ids = built(questions, format).flatMap(({ question_ids }) => question_ids)
        expect(ids.filter((id) => old.has(id))).toEqual([])
      }
    }
  })

  it('uses every new LR question before repeating any', () => {
    const questions = [...used(lrBank(110), (_, index) => index >= 30), ...rcBank(mixedLengths)]
    const old = usedIds(questions)
    for (let run = 0; run < 30; run++) {
      const ids = built(questions, three).flatMap(({ question_ids }) => question_ids)
      expect(ids.filter((id) => id.startsWith('lr') && !old.has(id))).toHaveLength(30)
    }
  })

  it('counts a passage as used if any of it was submitted', () => {
    const lengths = [7, 7, 7, 6, 7, 7, 7, 6]
    const questions = [...lrBank(75), ...used(rcBank(lengths), ({ id }) => /^p[0-3]-0$/.test(id))]
    for (let run = 0; run < 30; run++) {
      const rc = built(questions, { ...four, sections: four.sections.slice(0, 3) })
        .filter(({ section }) => section === 'reading_comprehension')
        .flatMap(({ question_ids }) => question_ids)
      expect(rc.every((id) => /^p[4-7]/.test(id))).toBe(true)
    }
  })

  it('does not put the repeats where they would reveal the unscored section', () => {
    // Enough new LR for two of three LR sections.
    const questions = [...used(lrBank(75), (_, index) => index >= 50), ...rcBank([7, 7, 7, 6])]
    const old = usedIds(questions)
    let inUnscored = 0
    const runs = 200
    for (let run = 0; run < runs; run++) {
      const unscored = built(questions, four).find(({ unscored_ids }) => unscored_ids.length > 0)!
      inUnscored += unscored.question_ids.filter((id) => old.has(id)).length
    }
    // A third of the 25 repeats, on average.
    expect(inUnscored / runs).toBeGreaterThan(7.3)
    expect(inUnscored / runs).toBeLessThan(9.3)
  })

  it('reaches past the newest passages when their lengths do not fit', () => {
    const lengths = [5, 5, 5, 5, 8, 8, 8, 7]
    const questions = [...lrBank(75), ...used(rcBank(lengths), ({ passage_id }) => Number(passage_id!.slice(1)) >= 4)]
    expect(assembleExam(questions, { ...four, sections: four.sections.slice(0, 3) }).ok).toBe(true)
  })

  it('is quick with a large bank, even when nothing fits', () => {
    const started = performance.now()
    const exam = assembleExam([...lrBank(3500), ...rcBank(Array.from({ length: 300 }, () => 5))], four)
    expect(exam.ok).toBe(false)
    expect(performance.now() - started).toBeLessThan(3000)
  })
})
