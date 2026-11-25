import { expect, it } from 'vitest'
import { assembleTest, type TestPool, type TestSection } from './assembleTest'

const pool: TestPool = {
  lr: Array.from({ length: 10 }, (_, index) => `q${index}`),
  passages: [['a1', 'a2', 'a3'], ['b1'], ['c1', 'c2']],
}
const lr = (amount: number, breakAfter = 0): TestSection => ({ section: 'logical_reasoning', amount, minutes: 35, breakAfter })
const rc = (amount: number, breakAfter = 0): TestSection => ({ section: 'reading_comprehension', amount, minutes: 20, breakAfter })

it('fills each section without repeats and keeps passages whole', () => {
  for (let run = 0; run < 100; run++) {
    const exam = assembleTest(pool, [lr(4, 10), rc(2, 5), lr(6, 10)])!
    const ids = exam.flatMap(({ question_ids }) => question_ids)
    expect(new Set(ids).size).toBe(ids.length)
    expect(exam.map(({ question_ids }) => question_ids.length).filter((_, index) => index !== 1)).toEqual([4, 6])
    expect(['a1a2a3b1', 'b1a1a2a3', 'a1a2a3c1c2', 'c1c2a1a2a3', 'b1c1c2', 'c1c2b1']).toContain(exam[1].question_ids.join(''))
    expect(exam.map((section) => section.time_limit_seconds)).toEqual([2100, 1200, 2100])
    // No break after the last section.
    expect(exam.map((section) => section.break_after_seconds)).toEqual([600, 300, 0])
  }
})

it('counts needs across sections', () => {
  expect(assembleTest(pool, [lr(5), lr(6)])).toBeNull()
  expect(assembleTest(pool, [rc(2), rc(2)])).toBeNull()
  expect(assembleTest(pool, [lr(5), lr(5), rc(3)])).not.toBeNull()
})

it('does not change the pool', () => {
  const before = structuredClone(pool)
  assembleTest(pool, [lr(10), rc(3)])
  expect(pool).toEqual(before)
})
