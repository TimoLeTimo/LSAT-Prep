import { useState } from 'react'
import { Button } from '../../components/Button'
import { errorMessage } from '../../data/errorMessage'
import type { Exam } from '../../data/exam'
import { practiceSession } from '../../data/practiceSession'
import { StartError } from '../practice/fields'

interface ResumeExamProps {
  exam: Exam
  onResume: () => void
  onEnded: () => void
}

export function ResumeExam({ exam, onResume, onEnded }: ResumeExamProps) {
  const { session, sections, phase } = exam
  const [isConfirming, setIsConfirming] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const done = sections.filter(({ status }) => status === 'done').length
  const keepsRunning = session.config.exam?.kind === 'full_simulation'

  async function end() {
    if (isEnding) return
    setIsEnding(true)
    setError(null)
    try {
      await practiceSession.abandon(session.id)
      onEnded()
    } catch (reason) {
      setError(errorMessage(reason, 'The test could not be ended.'))
      setIsEnding(false)
    }
  }

  return (
    <section
      aria-labelledby="resume-exam"
      className="rounded-2xl border border-line bg-surface p-8 shadow-card"
    >
      <h2 id="resume-exam" className="font-serif text-2xl font-semibold">
        Unfinished Test
      </h2>
      <p className="mt-3">
        {session.config.exam?.name}: {done} of {sections.length} sections finished, created{' '}
        {new Date(session.created_at).toLocaleString()}.
      </p>
      {phase.name === 'section' && (
        <p className="mt-1 text-muted">
          Section {phase.position + 1} is in progress.{' '}
          {keepsRunning ? 'The timer is still running.' : 'The timer is paused.'}
        </p>
      )}
      {isConfirming && (
        <p className="mt-3" role="status">
          End this test? None of its answers will be submitted or scored.
        </p>
      )}
      <div className="mt-4">
        <StartError message={error} />
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {isConfirming ? (
          <>
            <Button variant="secondary" onClick={() => setIsConfirming(false)} disabled={isEnding}>
              Keep Test
            </Button>
            <Button onClick={end} disabled={isEnding}>
              End Test
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
