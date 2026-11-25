import type { Exam, ExamApi } from '../../data/exam'
import type { ClockReading, PracticeSessionApi, Session } from '../../data/practiceSession'
import type { SessionApi } from '../practice/SessionController'

type Practice = Pick<PracticeSessionApi, 'select' | 'flag' | 'bookmark' | 'addTime' | 'setPosition'>
type Timer = Pick<ExamApi, 'open' | 'save' | 'leave' | 'endSection'>

/**
 * Lets the practice controller run one section of an exam. When the section ends for any
 * reason, the controller sees a finished session, and `onEnded` receives the real exam.
 */
export function sectionApi(
  practice: Practice,
  timer: Timer,
  section: Session,
  position: number,
  onEnded: (exam: Exam) => void,
): SessionApi {
  const finished: Session = { ...section, status: 'completed' }

  function read(exam: Exam): ClockReading {
    const { phase } = exam
    if (phase.name === 'section' && phase.position === position) {
      return { remaining_ms: phase.remaining_ms, ended: null }
    }
    onEnded(exam)
    return { remaining_ms: null, ended: finished }
  }

  return {
    select: practice.select,
    flag: practice.flag,
    bookmark: practice.bookmark,
    addTime: practice.addTime,
    // The controller counts within the section; saved positions count the whole exam.
    setPosition: (id, index) => practice.setPosition(id, section.questions[index].display_order),
    submit: () => Promise.reject('Answers in an exam are submitted when it ends.'),
    startClock: async (id) => read(await timer.open(id)),
    saveClock: async (id) => read(await timer.save(id)),
    pauseClock: async (id) => {
      await timer.leave(id)
      return { remaining_ms: null, ended: null }
    },
    finish: async (id) => {
      read(await timer.endSection(id, position))
      return finished
    },
  }
}

/** The active section as a session of its own, starting where the user left it. */
export function sectionSession({ session }: Exam): Session {
  const index = session.questions.findIndex(
    ({ display_order }) => display_order === session.current_position,
  )
  return { ...session, current_position: Math.max(0, index) }
}
