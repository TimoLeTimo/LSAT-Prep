import { useState } from 'react'
import { Button } from '../../components/Button'
import { count } from '../../components/count'
import { errorMessage } from '../../data/errorMessage'
import { practiceSession, type Session } from '../../data/practiceSession'

interface ResumePanelProps {
  session: Session
  onResume: () => void
  onEnded: () => void
}

export function ResumePanel({ session, onResume, onEnded }: ResumePanelProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const answered = session.questions.filter(({ selected }) => selected !== null).length

  async function end() {
    if (isEnding) return
    setIsEnding(true)
    setError(null)
    try {
      await practiceSession.abandon(session.id)
      onEnded()
    } catch (reason) {
      setError(errorMessage(reason, 'The session could not be ended.'))
      setIsEnding(false)
    }
  }

  return (
    <section
      aria-labelledby="resume-title"
      className="rounded-2xl border border-line bg-surface p-8 shadow-card"
    >
      <h2 id="resume-title" className="font-serif text-2xl font-semibold">
        Unfinished Session
      </h2>
      <p className="mt-3">
        {answered} of {count(session.questions.length, 'question')} answered, started{' '}
        {new Date(session.created_at).toLocaleString()}.
      </p>
      {isConfirming && (
        <p className="mt-3" role="status">
          End this session? Answers you already checked are kept. Other selected answers will not be
          submitted.
        </p>
      )}
      {error !== null && (
        <p role="alert" className="mt-3 rounded-lg border border-rose-accent bg-blush p-4">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        {isConfirming ? (
          <>
            <Button variant="secondary" onClick={() => setIsConfirming(false)} disabled={isEnding}>
              Keep Session
            </Button>
            <Button onClick={end} disabled={isEnding}>
              End Session
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onResume}>Resume</Button>
            <Button variant="secondary" onClick={() => setIsConfirming(true)}>
              End
            </Button>
          </>
        )}
      </div>
    </section>
  )
}
