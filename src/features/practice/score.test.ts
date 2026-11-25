import { expect, it } from 'vitest'
import { score } from './score'
import { testSessionQuestion } from './testSession'

const question = (is_correct: boolean | null) => ({
  ...testSessionQuestion('a'),
  is_submitted: is_correct !== null,
  outcome: { correct_choice: 'C' as const, is_correct, explanations: { A: '', B: '', C: '', D: '', E: '' } },
})

it('counts unanswered questions separately', () => {
  const questions = [question(true), question(false), question(true), question(null)]
  expect(score(questions)).toEqual({ correct: 2, answered: 3, unanswered: 1 })
  expect(score([])).toEqual({ correct: 0, answered: 0, unanswered: 0 })
})
