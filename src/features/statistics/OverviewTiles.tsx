import { count } from '../../components/count'
import type { Overview } from '../../domain/statistics/calculate'
import { duration, FEW_ANSWERS, percent, perQuestion } from '../../domain/statistics/format'

interface OverviewTilesProps {
  overview: Overview
  /** Practice time cannot be divided in sessions that mix sections. */
  isOneSection: boolean
}

export function OverviewTiles({ overview, isOneSection }: OverviewTilesProps) {
  const { answered, correct, accuracy, differentQuestions, averageSeconds, practiceMs, retries } =
    overview
  const tiles = [
    {
      label: 'Accuracy',
      value: percent(accuracy),
      note:
        answered === 0
          ? 'No answers'
          : `${correct} of ${answered} correct${answered < FEW_ANSWERS ? ', few answers' : ''}`,
    },
    {
      label: 'Answers',
      value: answered.toLocaleString(),
      note: count(differentQuestions, 'different question'),
    },
    { label: 'Average time', value: perQuestion(averageSeconds), note: 'per question' },
    {
      label: 'Practice time',
      value: isOneSection ? '–' : duration(practiceMs),
      note: isOneSection ? 'Shown for all sections only' : 'without pauses or breaks',
    },
    {
      label: 'Retries',
      value: percent(retries.accuracy),
      note:
        retries.answered === 0
          ? 'None yet'
          : `${retries.correct} of ${retries.answered} correct${retries.answered < FEW_ANSWERS ? ', few answers' : ''}, counted separately`,
    },
  ]
  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {tiles.map(({ label, value, note }) => (
        <div key={label} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <dt className="text-sm text-muted">{label}</dt>
          <dd className="mt-1 text-2xl font-semibold">{value}</dd>
          <dd className="mt-1 text-sm text-muted">{note}</dd>
        </div>
      ))}
    </dl>
  )
}
