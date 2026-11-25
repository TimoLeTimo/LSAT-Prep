import { useState } from 'react'
import { examApi, type Exam } from '../../data/exam'
import { practiceSession } from '../../data/practiceSession'
import { ActiveSession, type SessionOptions } from '../practice/ActiveSession'
import { SessionController } from '../practice/SessionController'
import { useSessionState } from '../practice/useSessionState'
import { sectionApi, sectionSession } from './sectionApi'

interface ExamSectionScreenProps {
  exam: Exam
  position: number
  onEnded: (exam: Exam) => void
}

/** Give this a key with the section's position, so each section starts fresh. */
export function ExamSectionScreen({ exam, position, onEnded }: ExamSectionScreenProps) {
  const [controller] = useState(() => {
    const session = sectionSession(exam)
    const api = sectionApi(practiceSession, examApi, session, position, onEnded)
    return new SessionController(api, session)
  })
  const state = useSessionState(controller)
  // The next screen is on its way.
  if (state.session.status !== 'in_progress') return <p role="status">Saving…</p>

  const isLast = position === exam.sections.length - 1
  const options: SessionOptions = {
    showCategory: false,
    showBookmark: false,
    limitSeconds: exam.sections[position].time_limit_ms / 1000,
    finishLabel: 'End Section',
    finishTitle: 'End this section?',
    finishNote: isLast
      ? 'This is the last section. Your answers will be submitted and scored.'
      : 'You cannot return to this section.',
    finishConfirm: 'End Section Now',
  }
  return (
    <>
      <p className="mb-4 text-muted">
        Section {position + 1} of {exam.sections.length}
      </p>
      <ActiveSession controller={controller} state={state} options={options} />
    </>
  )
}
