import { useState } from 'react'
import { practiceSession, type Session } from '../../data/practiceSession'
import { ActiveSession, type SessionOptions } from './ActiveSession'
import { SessionController } from './SessionController'
import { SessionResults } from './SessionResults'
import { useSessionState } from './useSessionState'

interface SessionScreenProps {
  session: Session
  onDone: () => void
}

/** A practice session, and its results. */
export function SessionScreen({ session: initial, onDone }: SessionScreenProps) {
  const [controller] = useState(() => new SessionController(practiceSession, initial))
  const state = useSessionState(controller)
  if (state.session.status !== 'in_progress') {
    return <SessionResults controller={controller} state={state} onDone={onDone} />
  }
  const options: SessionOptions = {
    showCategory: true,
    showBookmark: true,
    limitSeconds: initial.config.time_limit_seconds,
    finishLabel: 'Finish',
    finishTitle: 'Finish this session?',
    finishNote: 'Selected answers will be submitted and cannot be changed afterward.',
    finishConfirm: 'Finish Session',
  }
  return <ActiveSession controller={controller} state={state} options={options} />
}
