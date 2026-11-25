import { errorMessage } from '../../data/errorMessage'
import type { ClockReading, PracticeSessionApi, Session, SessionQuestion } from '../../data/practiceSession'
import type { ChoiceLabel } from '../../domain/content/types'

type Api = Pick<
  PracticeSessionApi,
  | 'select'
  | 'flag'
  | 'bookmark'
  | 'addTime'
  | 'setPosition'
  | 'submit'
  | 'finish'
  | 'startClock'
  | 'saveClock'
  | 'pauseClock'
>

export interface SessionState {
  /** What to show. An unsaved selection is listed in `unsaved` until it is saved. */
  session: Session
  position: number
  /** IDs of session questions with a change still being saved. */
  unsaved: ReadonlySet<string>
  /** Set while an answer or the whole session is being submitted. */
  isSubmitting: boolean
  error: { message: string; retry: () => void } | null
  /** The last reading of the clock, and the local time it was taken. Null before it starts. */
  clock: { remainingMs: number | null; readAt: number } | null
}

const MAX_SECONDS_PER_SAVE = 600

type SavedField = 'selected' | 'is_flagged' | 'is_bookmarked'
const SAVED_FIELDS: readonly SavedField[] = ['selected', 'is_flagged', 'is_bookmarked']

/**
 * Runs one practice session. Saves happen one at a time, in order. A change that cannot
 * be saved is put back to the last saved value, so the screen never claims otherwise.
 */
export class SessionController {
  private state: SessionState
  private readonly listeners = new Set<() => void>()
  private queue: Promise<unknown> = Promise.resolve()
  /** The last values known to be saved. */
  private readonly saved = new Map<string, Pick<SessionQuestion, SavedField>>()
  /** The newest change to each value; older results must not overwrite it. */
  private readonly latest = new Map<string, number>()
  private changes = 0
  private readonly unsavedTime = new Map<string, number>()
  private readonly beforeSubmit = new Set<() => void>()

  private readonly api: Api
  private readonly now: () => number
  private isClockWanted = false

  constructor(api: Api, session: Session, now: () => number = () => performance.now()) {
    this.api = api
    this.now = now
    this.state = {
      session,
      position: session.current_position,
      unsaved: new Set(),
      isSubmitting: false,
      error: null,
      clock: null,
    }
    this.remember(session)
  }

  readonly getState = () => this.state

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Runs just before an answer or session is submitted, such as to count final seconds. */
  readonly onBeforeSubmit = (listener: () => void) => {
    this.beforeSubmit.add(listener)
    return () => {
      this.beforeSubmit.delete(listener)
    }
  }

  get current(): SessionQuestion {
    return this.state.session.questions[this.state.position]
  }

  readonly select = (choice: ChoiceLabel) => {
    const { id, selected, is_submitted } = this.current
    if (!this.canChange || is_submitted || selected === choice) return
    this.change(id, 'selected', choice, () => this.api.select(id, choice))
  }

  readonly toggleFlag = () => {
    const { id, is_flagged } = this.current
    if (!this.canChange) return
    this.change(id, 'is_flagged', !is_flagged, () => this.api.flag(id, !is_flagged))
  }

  /** Bookmarks can change after the session too, while reviewing it. */
  readonly toggleBookmark = (id: string) => {
    const question = this.state.session.questions.find((item) => item.id === id)
    if (!question || this.state.isSubmitting) return
    const { question_id, is_bookmarked } = question
    this.change(id, 'is_bookmarked', !is_bookmarked, () =>
      this.api.bookmark(question_id, !is_bookmarked),
    )
  }

  readonly goTo = (position: number) => {
    const { session } = this.state
    if (!this.canChange || position === this.state.position) return
    if (position < 0 || position >= session.questions.length) return
    this.update({ position })
    const save = () => {
      void this.enqueue(async () => {
        // Skip positions that have already been left.
        if (this.state.position === position) await this.api.setPosition(session.id, position)
      }).catch((error) => this.fail(error, save))
    }
    save()
  }

  readonly next = () => this.goTo(this.state.position + 1)
  readonly previous = () => this.goTo(this.state.position - 1)

  /** Check Answer. Resolves once the answer is submitted or an error is shown. */
  readonly submit = async () => {
    const { id, selected, is_submitted } = this.current
    if (is_submitted || selected === null) return
    await this.finalize(() => this.api.submit(id), this.submit)
  }

  readonly finish = async () => {
    const { session } = this.state
    if (session.status !== 'in_progress') return
    await this.finalize(() => this.api.finish(session.id), this.finish)
  }

  /** Counts whole seconds spent on a question. Saved together with other changes. */
  readonly addTime = (id: string, seconds: number) => {
    const question = this.state.session.questions.find((item) => item.id === id)
    if (!question || question.is_submitted || seconds <= 0) return
    this.unsavedTime.set(id, (this.unsavedTime.get(id) ?? 0) + seconds)
  }

  /** Saves counted time. If that fails, the time is kept for the next try. */
  readonly saveTime = (): Promise<void> =>
    this.enqueue(async () => {
      for (const [id, total] of this.unsavedTime) {
        const seconds = Math.min(Math.floor(total), MAX_SECONDS_PER_SAVE)
        if (seconds < 1) continue
        try {
          await this.api.addTime(id, seconds)
        } catch {
          continue
        }
        // Subtract rather than clear: more may have been counted meanwhile.
        this.unsavedTime.set(id, (this.unsavedTime.get(id) ?? 0) - seconds)
      }
    })

  /** Starts or resumes the clock. Timed answers are refused until it is running. */
  readonly startClock = () => {
    this.isClockWanted = true
    const start = () => {
      if (!this.isClockWanted || !this.isActive) return
      void this.enqueue(async () => {
        // Sent even if a pause is already waiting: answers queued in between need it.
        this.readClock(await this.api.startClock(this.state.session.id))
      }).catch((error) => {
        if (this.isClockWanted) this.fail(error, start)
      })
    }
    start()
  }

  /**
   * Saves the clock, after any answers already waiting. The backend decides when time is
   * up; a failure is tried again at the next save.
   */
  readonly saveClock = (): Promise<void> =>
    this.enqueue(async () => {
      if (!this.isClockWanted || !this.isActive || this.state.clock === null) return
      this.readClock(await this.api.saveClock(this.state.session.id))
    }).catch(() => {})

  /** Pauses once everything already waiting is saved. */
  readonly pauseClock = (): Promise<void> => {
    this.isClockWanted = false
    return this.enqueue(async () => {
      if (this.isActive) await this.api.pauseClock(this.state.session.id)
    }).catch(() => {})
  }

  /** Time left now, or null when untimed or not started. */
  readonly getRemainingMs = (): number | null => {
    const { clock } = this.state
    if (clock === null || clock.remainingMs === null) return null
    return Math.max(0, clock.remainingMs - (this.now() - clock.readAt))
  }

  readonly dismissError = () => this.update({ error: null })

  private get isActive() {
    return this.state.session.status === 'in_progress'
  }

  private get canChange() {
    return !this.state.isSubmitting && this.isActive
  }

  private readClock({ remaining_ms, ended }: ClockReading) {
    if (ended !== null) {
      this.remember(ended)
      // Anything not saved in time is dropped, and its error would no longer matter.
      this.latest.clear()
      this.update({ session: ended, unsaved: new Set(), isSubmitting: false, error: null })
    } else {
      this.update({ clock: { remainingMs: remaining_ms, readAt: this.now() } })
    }
  }

  private change<K extends SavedField>(
    id: string,
    field: K,
    value: SessionQuestion[K],
    save: () => Promise<void>,
  ) {
    const key = `${field}:${id}`
    const number = ++this.changes
    this.latest.set(key, number)
    this.show(id, { [field]: value })
    this.update({ unsaved: new Set(this.state.unsaved).add(id), error: null })

    this.enqueue(async () => {
      if (this.latest.get(key) !== number) return // replaced before it was sent
      await save()
      this.saved.set(id, { ...this.saved.get(id)!, [field]: value })
    })
      .catch((error) => {
        if (this.latest.get(key) !== number) return
        void this.saveClock() // the answer may have been refused because time is up
        this.show(id, { [field]: this.saved.get(id)![field] })
        const canRetry = () =>
          field === 'is_bookmarked' ? !this.state.isSubmitting : this.canChange
        if (!this.isActive && field !== 'is_bookmarked') return
        this.showError(error, () => {
          if (canRetry()) this.change(id, field, value, save)
        })
      })
      .finally(() => {
        if (this.latest.get(key) !== number) return
        this.latest.delete(key)
        const stillSaving = SAVED_FIELDS.some((name) => this.latest.has(`${name}:${id}`))
        if (stillSaving) return
        const unsaved = new Set(this.state.unsaved)
        unsaved.delete(id)
        this.update({ unsaved })
      })
  }

  /** Submits only after every earlier change is safely saved. */
  private async finalize(send: () => Promise<Session>, retry: () => void) {
    if (!this.canChange) return
    this.update({ isSubmitting: true, error: null })
    for (const listener of this.beforeSubmit) listener()
    await this.saveTime()
    await this.settled()
    if (this.state.error !== null) {
      // A change just failed; its message and Try Again are already showing.
      this.update({ isSubmitting: false })
      return
    }
    if (!this.isActive) return // time ran out first
    try {
      const session = await this.enqueue(send)
      this.remember(session)
      this.update({ session, isSubmitting: false })
    } catch (error) {
      this.update({ isSubmitting: false })
      void this.saveClock()
      this.fail(error, retry)
    }
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task)
    this.queue = result.catch(() => {}) // one failure must not stop later saves
    return result
  }

  /** Waits for queued saves and for their failures to be shown. */
  private async settled() {
    await this.queue
    while (this.state.unsaved.size > 0) await new Promise((resolve) => setTimeout(resolve))
  }

  private remember({ questions }: Session) {
    for (const { id, selected, is_flagged, is_bookmarked } of questions) {
      this.saved.set(id, { selected, is_flagged, is_bookmarked })
    }
  }

  private show(id: string, values: Partial<SessionQuestion>) {
    const { session } = this.state
    const questions = session.questions.map((item) => (item.id === id ? { ...item, ...values } : item))
    this.update({ session: { ...session, questions } })
  }

  private fail(error: unknown, retry: () => void) {
    if (this.isActive) this.showError(error, retry)
  }

  private showError(error: unknown, retry: () => void) {
    const message = errorMessage(error, 'Your work could not be saved.')
    this.update({
      error: {
        message,
        retry: () => {
          this.dismissError()
          retry()
        },
      },
    })
  }

  private update(values: Partial<SessionState>) {
    this.state = { ...this.state, ...values }
    for (const listener of this.listeners) listener()
  }
}
