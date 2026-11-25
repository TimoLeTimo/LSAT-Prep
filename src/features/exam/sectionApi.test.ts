import { expect, it, vi } from 'vitest'
import type { Exam, ExamPhase } from '../../data/exam'
import { SessionController } from '../practice/SessionController'
import { testSession } from '../practice/testSession'
import { sectionApi, sectionSession } from './sectionApi'

const tick = () => new Promise((resolve) => setTimeout(resolve, 5))

function exam(phase: ExamPhase, position = 12): Exam {
  const session = testSession(['a', 'b', 'c'])
  session.config.explanations = 'at_end'
  session.questions = session.questions.map((question, index) => ({
    ...question,
    display_order: 10 + index,
    exam_section: 1,
  }))
  return { session: { ...session, current_position: position }, sections: [], phase }
}
const active: ExamPhase = { name: 'section', position: 1, remaining_ms: 60_000 }
const next: ExamPhase = { name: 'ready', position: 2 }

function setup() {
  const log: string[] = []
  const record = (name: string) => async (...args: unknown[]) => void log.push([name, ...args].join(' '))
  const respond = (name: string, phase: ExamPhase) => async () => {
    log.push(name)
    return exam(phase)
  }
  const practice = {
    select: vi.fn(record('select')), flag: vi.fn(record('flag')), bookmark: vi.fn(record('bookmark')),
    addTime: vi.fn(record('time')), setPosition: vi.fn(record('position')),
  }
  const timer = {
    open: vi.fn(respond('open', active)), save: vi.fn(respond('save', active)),
    leave: vi.fn(record('leave')), endSection: vi.fn(respond('end', next)),
  }
  const onEnded = vi.fn()
  const time = { now: 0 }
  const session = sectionSession(exam(active))
  const api = sectionApi(practice, timer, session, 1, onEnded)
  const controller = new SessionController(api, session, () => time.now)
  return { log, practice, timer, onEnded, time, controller }
}

it('starts at the saved question, or the first one', () => {
  expect(sectionSession(exam(active, 12)).current_position).toBe(2)
  expect(sectionSession(exam(active, 10)).current_position).toBe(0)
  expect(sectionSession(exam(active, 0)).current_position).toBe(0)
})

it('saves positions for the whole exam', async () => {
  const test = setup()
  test.controller.previous()
  await tick()
  expect(test.log).toEqual(['position session 11'])
})

it('runs the clock and pauses it', async () => {
  const test = setup()
  test.controller.startClock()
  await tick()
  expect(test.controller.getRemainingMs()).toBe(60_000)
  await test.controller.pauseClock()
  expect(test.log).toEqual(['open', 'leave session'])
  expect(test.onEnded).not.toHaveBeenCalled()
})

it('ends the section only after the last answer is saved, and passes on the exam', async () => {
  const test = setup()
  test.controller.startClock()
  test.controller.select('B')
  await test.controller.finish()
  expect(test.log).toEqual(['open', 'select c B', 'end'])
  expect(test.timer.endSection).toHaveBeenCalledWith('session', 1)
  expect(test.onEnded).toHaveBeenCalledExactlyOnceWith(exam(next))
  expect(test.controller.getState().session.status).toBe('completed')
})

it('does not end the section when the last answer could not be saved', async () => {
  const test = setup()
  test.controller.startClock()
  test.practice.select.mockRejectedValueOnce('Disk full.')
  test.controller.select('B')
  await test.controller.finish()
  expect(test.timer.endSection).not.toHaveBeenCalled()
  expect(test.onEnded).not.toHaveBeenCalled()
  expect(test.controller.getState().error?.message).toBe('Disk full.')
})

it.each<ExamPhase>([
  next,
  { name: 'break', next_position: 2, remaining_ms: 5, can_skip: false },
  { name: 'section', position: 2, remaining_ms: 5 },
  { name: 'ended' },
])('moves on when the time is up and the exam is now at %o', async (phase) => {
  const test = setup()
  test.controller.startClock()
  await tick()
  test.timer.save.mockResolvedValueOnce(exam(phase))
  await test.controller.saveClock()
  expect(test.onEnded).toHaveBeenCalledExactlyOnceWith(exam(phase))
  expect(test.controller.getState()).toMatchObject({ error: null, session: { status: 'completed' } })
})

it('moves on when an answer arrives too late', async () => {
  const test = setup()
  test.controller.startClock()
  await tick()
  test.practice.select.mockRejectedValueOnce('This section has ended.')
  test.timer.save.mockResolvedValueOnce(exam(next))
  test.controller.select('A')
  await tick()
  expect(test.onEnded).toHaveBeenCalledOnce()
  expect(test.controller.getState().error).toBeNull()
})

it('can try again when ending the section fails', async () => {
  const test = setup()
  test.controller.startClock()
  test.timer.endSection.mockRejectedValueOnce('Failed.')
  await test.controller.finish()
  expect(test.onEnded).not.toHaveBeenCalled()
  test.controller.getState().error!.retry()
  await tick()
  expect(test.onEnded).toHaveBeenCalledOnce()
})
