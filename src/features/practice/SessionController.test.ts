import { expect, it, vi } from 'vitest'
import type { ClockReading, Session } from '../../data/practiceSession'
import { SessionController } from './SessionController'
import { testSession } from './testSession'

const tick = () => new Promise((resolve) => setTimeout(resolve, 5))

/** A promise settled by hand, to control when a save finishes. */
function deferred<T = void>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

function setup(session: Session = testSession()) {
  const log: string[] = []
  const record = (name: string) => async (...args: unknown[]) => {
    log.push([name, ...args].join(' '))
  }
  const result = (name: string) => async (id: string) => {
    log.push(`${name} ${id}`)
    return { ...session, status: name === 'finish' ? 'completed' : 'in_progress' } as Session
  }
  const reading = (name: string) => async (): Promise<ClockReading> => {
    log.push(name)
    return { remaining_ms: 60_000, ended: null }
  }
  const api = {
    select: vi.fn(record('select')),
    flag: vi.fn(record('flag')),
    addTime: vi.fn(record('time')),
    setPosition: vi.fn(record('position')),
    submit: vi.fn(result('submit')),
    finish: vi.fn(result('finish')),
    startClock: vi.fn(reading('start')),
    saveClock: vi.fn(reading('save')),
    pauseClock: vi.fn(reading('pause')),
  }
  const time = { now: 0 }
  const controller = new SessionController(api, session, () => time.now)
  return { api, log, controller, time, get state() { return controller.getState() } }
}

it('saves a selection and shows when it is saved', async () => {
  const test = setup()
  const save = deferred()
  test.api.select.mockReturnValueOnce(save.promise)
  test.controller.select('B')
  expect(test.controller.current.selected).toBe('B')
  expect(test.state.unsaved.has('a')).toBe(true)
  await tick()
  expect(test.state.unsaved.has('a')).toBe(true)
  save.resolve()
  await tick()
  expect(test.state.unsaved.size).toBe(0)
})

it('puts back the last saved selection when a save fails, and can try again', async () => {
  const test = setup()
  test.controller.select('A')
  await tick()
  test.api.select.mockRejectedValueOnce('Disk full.')
  test.controller.select('D')
  expect(test.controller.current.selected).toBe('D')
  await tick()
  expect(test.controller.current.selected).toBe('A')
  expect(test.state.error?.message).toBe('Disk full.')
  expect(test.state.unsaved.size).toBe(0)
  test.state.error!.retry()
  await tick()
  expect(test.controller.current.selected).toBe('D')
  expect(test.state.error).toBeNull()
  expect(test.api.select).toHaveBeenLastCalledWith('a', 'D')
})

it('sends saves one at a time, and skips ones already replaced', async () => {
  const test = setup()
  const first = deferred()
  test.api.select.mockReturnValueOnce(first.promise)
  test.controller.select('A')
  await tick()
  test.controller.select('B')
  test.controller.select('C')
  await tick()
  expect(test.api.select).toHaveBeenCalledTimes(1)
  first.resolve()
  await tick()
  expect(test.api.select.mock.calls.map(([, choice]) => choice)).toEqual(['A', 'C'])
  expect(test.controller.current.selected).toBe('C')
})

it('keeps a newer selection when an older save fails', async () => {
  const test = setup()
  const first = deferred()
  test.api.select.mockReturnValueOnce(first.promise)
  test.controller.select('A')
  await tick()
  test.controller.select('B')
  first.reject('Failed.')
  await tick()
  expect(test.controller.current.selected).toBe('B')
  expect(test.state.error).toBeNull()
})

it('falls back to the earlier save when the newest one fails', async () => {
  const test = setup()
  const first = deferred()
  test.api.select.mockReturnValueOnce(first.promise).mockRejectedValueOnce('Failed.')
  test.controller.select('A')
  await tick()
  test.controller.select('B')
  first.resolve()
  await tick()
  expect(test.controller.current.selected).toBe('A')
})

it('saves a flag separately from the selection', async () => {
  const test = setup()
  test.api.flag.mockRejectedValueOnce('Failed.')
  test.controller.select('A')
  test.controller.toggleFlag()
  await tick()
  expect(test.controller.current).toMatchObject({ selected: 'A', is_flagged: false })
  test.controller.toggleFlag()
  await tick()
  expect(test.controller.current.is_flagged).toBe(true)
})

it('keeps selections with their own questions while moving', async () => {
  const test = setup()
  test.controller.select('A')
  test.controller.next()
  test.controller.select('B')
  await tick()
  expect(test.log).toEqual(['select a A', 'position session 1', 'select b B'])
  expect(test.state.session.questions.map(({ selected }) => selected)).toEqual(['A', 'B', null])
})

it('stays within the questions and saves only the final position', async () => {
  const test = setup()
  test.controller.previous()
  test.controller.goTo(3)
  expect(test.state.position).toBe(0)
  test.controller.next()
  test.controller.next()
  test.controller.next()
  await tick()
  expect(test.state.position).toBe(2)
  expect(test.log).toEqual(['position session 2'])
})

it('starts where the session was left', () => {
  expect(setup({ ...testSession(), current_position: 2 }).state.position).toBe(2)
})

it('submits only after the selection is saved', async () => {
  const test = setup()
  test.controller.select('B')
  await test.controller.submit()
  expect(test.log).toEqual(['select a B', 'submit a'])
})

it.each(['submit', 'finish'] as const)('does not %s when the selection could not be saved', async (action) => {
  const test = setup()
  test.controller.select('A')
  await tick()
  const save = deferred()
  test.api.select.mockReturnValueOnce(save.promise)
  test.controller.select('B')
  const done = test.controller[action]()
  save.reject('Disk full.')
  await done
  expect(test.api[action]).not.toHaveBeenCalled()
  expect(test.controller.current.selected).toBe('A')
  expect(test.state).toMatchObject({ isSubmitting: false, error: { message: 'Disk full.' } })
})

it('does not submit without a selection', async () => {
  const test = setup()
  await test.controller.submit()
  expect(test.api.submit).not.toHaveBeenCalled()
})

it('submits once when asked twice, and blocks changes meanwhile', async () => {
  const test = setup()
  test.controller.select('B')
  const answer = deferred<Session>()
  test.api.submit.mockReturnValueOnce(answer.promise)
  const first = test.controller.submit()
  const second = test.controller.submit()
  test.controller.select('C')
  test.controller.next()
  await tick()
  expect(test.controller.current.selected).toBe('B')
  expect(test.state.position).toBe(0)
  answer.resolve(test.state.session)
  await Promise.all([first, second])
  expect(test.api.submit).toHaveBeenCalledTimes(1)
})

it('cannot change a submitted answer', async () => {
  const session = testSession()
  session.questions[0] = { ...session.questions[0], selected: 'A', is_submitted: true }
  const test = setup(session)
  test.controller.select('B')
  await test.controller.submit()
  expect(test.log).toEqual([])
})

it('shows an error and can try again when submitting fails', async () => {
  const test = setup()
  test.controller.select('B')
  test.api.submit.mockRejectedValueOnce('Failed.')
  await test.controller.submit()
  expect(test.state).toMatchObject({ isSubmitting: false, error: { message: 'Failed.' } })
  test.state.error!.retry()
  await tick()
  expect(test.api.submit).toHaveBeenCalledTimes(2)
  expect(test.state.error).toBeNull()
})

it('finishes, after which nothing changes', async () => {
  const test = setup()
  await test.controller.finish()
  expect(test.state.session.status).toBe('completed')
  test.controller.select('A')
  test.controller.toggleFlag()
  await test.controller.finish()
  expect(test.log).toEqual(['finish session'])
})

it('adds up time, saves whole seconds, and keeps the rest', async () => {
  const test = setup()
  test.controller.addTime('a', 1.6)
  test.controller.addTime('a', 1.6)
  test.controller.addTime('b', 0.4)
  await test.controller.saveTime()
  test.controller.addTime('a', 0.9)
  await test.controller.saveTime()
  expect(test.log).toEqual(['time a 3', 'time a 1'])
})

it('keeps time that could not be saved, and saves it before submitting', async () => {
  const test = setup()
  test.api.addTime.mockRejectedValueOnce('Failed.')
  test.controller.addTime('a', 5)
  await test.controller.saveTime()
  expect(test.state.error).toBeNull()
  test.controller.select('A')
  await test.controller.submit()
  expect(test.log).toEqual(['select a A', 'time a 5', 'submit a'])
})

it('does not lose time counted during a save', async () => {
  const test = setup()
  const save = deferred()
  test.api.addTime.mockReturnValueOnce(save.promise)
  test.controller.addTime('a', 2)
  const saving = test.controller.saveTime()
  await tick()
  test.controller.addTime('a', 3)
  save.resolve()
  await saving
  await test.controller.saveTime()
  expect(test.api.addTime.mock.calls.map(([, seconds]) => seconds)).toEqual([2, 3])
})

it('does not count time on submitted questions', async () => {
  const session = testSession()
  session.questions[0] = { ...session.questions[0], is_submitted: true }
  const test = setup(session)
  test.controller.addTime('a', 5)
  await test.controller.saveTime()
  expect(test.log).toEqual([])
})

it('counts the final seconds before submitting', async () => {
  const test = setup()
  const stop = test.controller.onBeforeSubmit(() => test.controller.addTime('a', 7))
  test.controller.select('A')
  await test.controller.submit()
  expect(test.log).toEqual(['select a A', 'time a 7', 'submit a'])
  stop()
  test.controller.select('B')
  await test.controller.submit()
  expect(test.log.slice(3)).toEqual(['select a B', 'submit a'])
})

// Clock

const completed = (): Session => ({ ...testSession(), status: 'completed' })

it('shows the time left between readings', async () => {
  const test = setup()
  expect(test.controller.getRemainingMs()).toBeNull()
  test.time.now = 1000
  test.controller.startClock()
  await tick()
  expect(test.controller.getRemainingMs()).toBe(60_000)
  test.time.now = 11_000
  expect(test.controller.getRemainingMs()).toBe(50_000)
  test.time.now = 100_000
  expect(test.controller.getRemainingMs()).toBe(0)
})

it('trusts the backend over local time, such as after the computer sleeps', async () => {
  const test = setup()
  test.controller.startClock()
  await tick()
  test.time.now = 3_600_000
  test.api.saveClock.mockResolvedValueOnce({ remaining_ms: 58_000, ended: null })
  await test.controller.saveClock()
  expect(test.controller.getRemainingMs()).toBe(58_000)
  expect(test.state.session.status).toBe('in_progress')
})

it('sends waiting answers before checking whether time is up', async () => {
  const test = setup()
  test.controller.startClock()
  test.controller.select('B')
  test.api.saveClock.mockImplementationOnce(async () => {
    test.log.push('save')
    return { remaining_ms: 0, ended: completed() }
  })
  await test.controller.saveClock()
  expect(test.log).toEqual(['start', 'select a B', 'save'])
  expect(test.state).toMatchObject({ session: { status: 'completed' }, error: null })
})

it('shows the results when an answer is refused because time is up', async () => {
  const test = setup()
  test.controller.startClock()
  await tick()
  test.api.select.mockRejectedValueOnce('Time is up.')
  test.api.saveClock.mockResolvedValueOnce({ remaining_ms: null, ended: completed() })
  test.controller.select('B')
  await tick()
  expect(test.state).toMatchObject({ session: { status: 'completed' }, error: null })
  expect(test.state.session.questions[0].selected).toBeNull()
  expect(test.state.unsaved.size).toBe(0)
})

it.each(['submit', 'finish'] as const)('does not %s again if time runs out first', async (action) => {
  const test = setup()
  test.controller.startClock()
  test.controller.select('B')
  test.api.saveClock.mockResolvedValueOnce({ remaining_ms: null, ended: completed() })
  const saving = test.controller.saveClock()
  await Promise.all([test.controller[action](), saving])
  expect(test.api[action]).not.toHaveBeenCalled()
  expect(test.state).toMatchObject({ isSubmitting: false, error: null })
})

it('reports a clock that cannot start, and can try again', async () => {
  const test = setup()
  test.api.startClock.mockRejectedValueOnce('Failed.')
  test.controller.startClock()
  await tick()
  expect(test.state.error?.message).toBe('Failed.')
  test.state.error!.retry()
  await tick()
  expect(test.state.error).toBeNull()
  expect(test.controller.getRemainingMs()).toBe(60_000)
})

it('keeps going quietly when a clock save fails', async () => {
  const test = setup()
  test.controller.startClock()
  await tick()
  test.api.saveClock.mockRejectedValueOnce('Failed.')
  await test.controller.saveClock()
  expect(test.state.error).toBeNull()
  await test.controller.saveClock()
  expect(test.api.saveClock).toHaveBeenCalledTimes(2)
})

it('pauses after waiting answers, and does not save while paused', async () => {
  const test = setup()
  test.controller.startClock()
  test.controller.select('B')
  await test.controller.pauseClock()
  await test.controller.saveClock()
  expect(test.log).toEqual(['start', 'select a B', 'pause'])
})

it('ends up running when the screen closes and reopens at once', async () => {
  const test = setup()
  test.controller.startClock()
  void test.controller.pauseClock()
  test.controller.startClock()
  await tick()
  expect(test.log.at(-1)).toBe('start')
})

it('does not start the clock of a session that has ended', async () => {
  const test = setup(completed())
  test.controller.startClock()
  await test.controller.pauseClock()
  expect(test.log).toEqual([])
})
