import { useState } from 'react'
import { routeHref } from '../../app/routes'
import { Button } from '../../components/Button'
import { count } from '../../components/count'
import { errorMessage } from '../../data/errorMessage'
import { practiceSession, type Session, type SessionConfig } from '../../data/practiceSession'
import type { QuestionIndex } from '../../data/questionBank'
import { difficultyNames } from '../../domain/content/names'
import { DIFFICULTIES, type Section } from '../../domain/content/types'
import { chooseQuestions } from '../../domain/practice/chooseQuestions'
import { filterQuestions } from '../../domain/practice/filterQuestions'

const MAX_QUESTIONS = 500
const DEFAULT_QUESTIONS = 10

interface SessionSetupProps {
  section: Section
  index: QuestionIndex
  onStarted: (session: Session) => void
  /** Called when starting fails, because the question bank may have changed. */
  onStale: () => void
}

export function SessionSetup({ section, index, onStarted, onStale }: SessionSetupProps) {
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [difficulties, setDifficulties] = useState<SessionConfig['difficulties']>([])
  const inSection = { section, categoryIds: [], difficulties: [] }
  const total = filterQuestions(index.questions, inSection).length
  const [wanted, setWanted] = useState(String(Math.min(DEFAULT_QUESTIONS, total)))
  const [explanations, setExplanations] = useState<SessionConfig['explanations']>('after_each')
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)

  if (total === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 shadow-card">
        <p>There are no questions for this section yet.</p>
        <a
          href={routeHref('question-bank')}
          className="mt-3 inline-block rounded-md font-medium text-rose-deep underline"
        >
          Import questions in Question Bank Management
        </a>
      </div>
    )
  }

  const filter = { section, categoryIds, difficulties }
  const available = filterQuestions(index.questions, filter).length
  const number = /^\d+$/.test(wanted) ? Number(wanted) : 0
  const problem =
    number < 1 || number > MAX_QUESTIONS
      ? `Enter a number from 1 to ${MAX_QUESTIONS}.`
      : number > available
        ? `Only ${count(available, 'matching question')} available. Choose fewer, or widen your choices.`
        : null

  async function start() {
    if (isStarting) return
    const chosen = chooseQuestions(index.questions, filter, number)
    if (!chosen.ok) return
    setIsStarting(true)
    setError(null)
    try {
      const config: SessionConfig = {
        section,
        category_ids: categoryIds,
        difficulties,
        question_count: number,
        explanations,
      }
      onStarted(await practiceSession.create(config, chosen.ids))
    } catch (reason) {
      setError(errorMessage(reason, 'The session could not be started.'))
      setIsStarting(false)
      onStale()
    }
  }

  const categories = index.categories.filter((category) => category.section === section)
  return (
    <form
      className="space-y-8 rounded-2xl border border-line bg-surface p-8 shadow-card"
      onSubmit={(event) => {
        event.preventDefault()
        if (problem === null) void start()
      }}
    >
      <fieldset>
        <legend className="font-semibold">Categories</legend>
        <p className="text-sm text-muted">Choose none to include all.</p>
        <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {categories.map(({ id, name }) => (
            <Check
              key={id}
              label={`${name} (${filterQuestions(index.questions, { section, categoryIds: [id], difficulties }).length})`}
              checked={categoryIds.includes(id)}
              onChange={() => setCategoryIds(toggle(categoryIds, id))}
            />
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="font-semibold">Difficulty</legend>
        <p className="text-sm text-muted">Choose none to include all.</p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {DIFFICULTIES.map((level) => (
            <Check
              key={level}
              label={difficultyNames[level]}
              checked={difficulties.includes(level)}
              onChange={() => setDifficulties(toggle(difficulties, level))}
            />
          ))}
        </div>
      </fieldset>
      <div>
        <label className="font-semibold" htmlFor="question-count">
          Number of questions
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <input
            id="question-count"
            inputMode="numeric"
            value={wanted}
            onChange={(event) => setWanted(event.target.value)}
            aria-describedby="question-count-help"
            aria-invalid={problem !== null}
            className="w-24 rounded-lg border border-line bg-surface px-3 py-2"
          />
          <span id="question-count-help" role="status" className="text-sm text-muted">
            {problem ?? `${count(available, 'question')} available`}
          </span>
        </div>
      </div>
      <fieldset>
        <legend className="font-semibold">Explanations</legend>
        <div className="mt-3 space-y-2">
          <Check
            type="radio"
            label="After each question (checking an answer locks it)"
            checked={explanations === 'after_each'}
            onChange={() => setExplanations('after_each')}
          />
          <Check
            type="radio"
            label="At the end (answers can change until you finish)"
            checked={explanations === 'at_end'}
            onChange={() => setExplanations('at_end')}
          />
        </div>
      </fieldset>
      {error !== null && (
        <p role="alert" className="rounded-lg border border-rose-accent bg-blush p-4">
          {error}
        </p>
      )}
      <Button type="submit" disabled={problem !== null || isStarting}>
        Start Practice
      </Button>
    </form>
  )
}

function toggle<T>(items: T[], item: T): T[] {
  return items.includes(item) ? items.filter((other) => other !== item) : [...items, item]
}

interface CheckProps {
  type?: 'checkbox' | 'radio'
  label: string
  checked: boolean
  onChange: () => void
}

function Check({ type = 'checkbox', label, checked, onChange }: CheckProps) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type={type}
        name={type === 'radio' ? 'explanations' : undefined}
        checked={checked}
        onChange={onChange}
        className="mt-1 size-4 shrink-0 accent-rose-accent"
      />
      <span>{label}</span>
    </label>
  )
}
