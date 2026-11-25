import { useState } from 'react'
import { Button } from '../../components/Button'
import { errorMessage } from '../../data/errorMessage'
import { examApi, type Exam } from '../../data/exam'
import type { QuestionIndex } from '../../data/questionBank'
import { assembleExam } from '../../domain/exam/assembleExam'
import { defaultFormat, examFormats } from '../../domain/exam/formats'
import { shortfallText } from '../../domain/exam/shortfallText'
import { Check, Group, StartError } from '../practice/fields'

interface SimulationSetupProps {
  index: QuestionIndex
  onCreated: (exam: Exam) => void
  /** Called when creating fails, because the question bank may have changed. */
  onStale: () => void
}

export function SimulationSetup({ index, onCreated, onStale }: SimulationSetupProps) {
  const [formatId, setFormatId] = useState(() => defaultFormat(new Date()).id)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const format = examFormats.find(({ id }) => id === formatId) ?? examFormats[0]

  // Which questions are picked does not matter here, only whether it can be done.
  const [checked, setChecked] = useState(() => check())
  if (checked.index !== index || checked.format !== format) setChecked(check())

  function check() {
    const trial = assembleExam(index.questions, format)
    return { index, format, missing: trial.ok ? null : shortfallText(trial.shortfall) }
  }

  async function create() {
    if (isCreating) return
    const assembled = assembleExam(index.questions, format)
    if (!assembled.ok) return
    setIsCreating(true)
    setError(null)
    try {
      const name = `Full simulation (${format.name.toLowerCase()})`
      onCreated(await examApi.create('full_simulation', name, assembled.sections))
    } catch (reason) {
      setError(errorMessage(reason, 'The simulation could not be created.'))
      setIsCreating(false)
      onStale()
    }
  }

  return (
    <form
      className="space-y-6 rounded-2xl border border-line bg-surface p-8 shadow-card"
      onSubmit={(event) => {
        event.preventDefault()
        void create()
      }}
    >
      <h2 className="font-serif text-2xl font-semibold">Full Simulation</h2>
      <Group legend="Format">
        <div className="mt-3 space-y-2">
          {examFormats.map(({ id, name, period }) => (
            <Check
              key={id}
              type="radio"
              name="format"
              label={`${name} (${period})`}
              checked={id === format.id}
              onChange={() => setFormatId(id)}
            />
          ))}
        </div>
      </Group>
      <ul className="list-disc space-y-1 pl-5 text-muted">
        {format.summary.map((line) => (
          <li key={line}>{line}</li>
        ))}
        <li>The timer keeps running if you leave or close the app, and breaks cannot be skipped</li>
        <li>Only a raw score is given, not a scaled score</li>
      </ul>
      {checked.missing !== null && (
        <div className="rounded-lg border border-line bg-canvas p-4">
          <p className="font-medium">This simulation cannot be built yet. It needs:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {checked.missing.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-2 text-muted">You can build a shorter custom test below.</p>
        </div>
      )}
      <StartError message={error} />
      <Button type="submit" disabled={checked.missing !== null || isCreating}>
        Create Simulation
      </Button>
    </form>
  )
}
