import { useState } from 'react'
import { errorMessage } from '../../data/errorMessage'
import { practiceSession, type Session, type SessionConfig } from '../../data/practiceSession'

interface StartCallbacks {
  onStarted: (session: Session) => void
  /** Called when starting fails, because the question bank may have changed. */
  onStale: () => void
}

/** Creates a session once, and reports why if it cannot. */
export function useStart({ onStarted, onStale }: StartCallbacks) {
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)

  async function start(config: SessionConfig, questionIds: string[]) {
    if (isStarting) return
    setIsStarting(true)
    setError(null)
    try {
      onStarted(await practiceSession.create(config, questionIds))
    } catch (reason) {
      setError(errorMessage(reason, 'The session could not be started.'))
      setIsStarting(false)
      onStale()
    }
  }

  return { start, error, isStarting }
}
