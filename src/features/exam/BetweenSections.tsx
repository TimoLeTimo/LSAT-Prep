import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { count } from '../../components/count'
import { errorMessage } from '../../data/errorMessage'
import { examApi, type Exam } from '../../data/exam'
import { sectionNames } from '../../domain/content/names'
import { formatTime } from '../practice/formatTime'
import { StartError } from '../practice/fields'

interface BetweenSectionsProps {
  exam: Exam
  onChange: (exam: Exam) => void
}

/** Before a section: what is next, and any break. */
export function BetweenSections({ exam, onChange }: BetweenSectionsProps) {
  const { phase, session, sections } = exam
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const isBreak = phase.name === 'break'
  useEffect(() => {
    window.scrollTo(0, 0)
    heading.current?.focus()
  }, [isBreak])

  if (phase.name !== 'ready' && phase.name !== 'break') return null
  const position = phase.name === 'ready' ? phase.position : phase.next_position
  const next = sections[position]
  const keepsRunning = session.config.exam?.kind === 'full_simulation'

  async function start() {
    if (isStarting) return
    setIsStarting(true)
    setError(null)
    try {
      onChange(await examApi.startSection(session.id))
    } catch (reason) {
      setError(errorMessage(reason, 'The section could not be started.'))
      setIsStarting(false)
    }
  }

  return (
    <section
      aria-labelledby="next-section"
      className="mx-auto max-w-2xl space-y-5 rounded-2xl border border-line bg-surface p-8 shadow-card"
    >
      <h2
        id="next-section"
        ref={heading}
        tabIndex={-1}
        className="font-serif text-2xl font-semibold outline-none"
      >
        {isBreak ? 'Break' : `Section ${position + 1} of ${sections.length}`}
      </h2>
      {isBreak && <BreakTimer exam={exam} onChange={onChange} />}
      <div>
        {isBreak && <p className="text-muted">Next: section {position + 1} of {sections.length}</p>}
        <p className="text-lg font-medium">{sectionNames[next.section]}</p>
        <p className="text-muted">
          {count(next.question_count, 'question')}, {count(next.time_limit_ms / 60_000, 'minute')}
        </p>
      </div>
      <p className="text-muted">
        The timer starts when you start the section. You can move freely within it, but you cannot
        return to it afterward.
        {keepsRunning && ' Once started, it keeps running if you leave or close the app.'}
      </p>
      {phase.name === 'break' && !phase.can_skip && (
        <p className="text-muted">
          This break cannot be skipped. When it ends, start the next section yourself.
        </p>
      )}
      <StartError message={error} />
      {(phase.name === 'ready' || phase.can_skip) && (
        <Button onClick={start} disabled={isStarting}>
          {isBreak ? `Skip Break and Start Section ${position + 1}` : `Start Section ${position + 1}`}
        </Button>
      )}
    </section>
  )
}

function BreakTimer({ exam, onChange }: BetweenSectionsProps) {
  const { phase, session } = exam
  const total = phase.name === 'break' ? phase.remaining_ms : 0
  const [readAt] = useState(() => performance.now())
  const [remaining, setRemaining] = useState(total)

  useEffect(() => {
    let isChecking = false
    const interval = setInterval(() => {
      const left = Math.max(0, total - (performance.now() - readAt))
      setRemaining(left)
      if (left > 0 || isChecking) return
      // The backend confirms that the break is over, and is asked again if that fails.
      isChecking = true
      examApi.save(session.id).then(
        (latest) => {
          isChecking = false
          if (latest.phase.name !== 'break') onChange(latest)
        },
        () => {
          isChecking = false
        },
      )
    }, 500)
    return () => clearInterval(interval)
  }, [total, readAt, session.id, onChange])

  return (
    <p>
      <span role="timer" aria-label="Break time left" className="text-3xl font-medium tabular-nums">
        {formatTime(remaining)}
      </span>
      <span className="ml-3 text-muted">left</span>
    </p>
  )
}
