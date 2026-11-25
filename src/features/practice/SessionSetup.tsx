import { useState } from 'react'
import { Button } from '../../components/Button'
import { count } from '../../components/count'
import type { Session, SessionConfig } from '../../data/practiceSession'
import type { QuestionIndex } from '../../data/questionBank'
import type { Section } from '../../domain/content/types'
import { choosePassages, findPassageSets } from '../../domain/practice/choosePassages'
import { chooseQuestions } from '../../domain/practice/chooseQuestions'
import { filterQuestions, type QuestionFilter } from '../../domain/practice/filterQuestions'
import { EmptyBank } from './EmptyBank'
import { Check, Group, NumberField, StartError } from './fields'
import { DifficultyFields, ExplanationFields, TimeFields } from './sharedFields'
import { useStart } from './useStart'
import { useTimeLimit } from './useTimeLimit'
import { toggle, wholeNumber } from './wholeNumber'

/** LR sessions are chosen by question, and RC sessions by whole passage. */
const amounts = {
  logical_reasoning: { unit: 'question', label: 'Number of questions', max: 500, usual: 10 },
  reading_comprehension: { unit: 'passage', label: 'Number of passages', max: 50, usual: 4 },
}

interface SessionSetupProps {
  section: Section
  index: QuestionIndex
  onStarted: (session: Session) => void
  onStale: () => void
}

/** Setup for one section. */
export function SessionSetup({ section, index, onStarted, onStale }: SessionSetupProps) {
  const { unit, label, max, usual } = amounts[section]
  const isByPassage = unit === 'passage'
  const countAvailable = (filter: QuestionFilter) =>
    isByPassage
      ? findPassageSets(index.questions, filter).length
      : filterQuestions(index.questions, filter).length
  const total = countAvailable({ section, categoryIds: [], difficulties: [] })

  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [difficulties, setDifficulties] = useState<SessionConfig['difficulties']>([])
  const [wanted, setWanted] = useState(String(Math.min(usual, total)))
  const [explanations, setExplanations] = useState<SessionConfig['explanations']>('after_each')
  const time = useTimeLimit()
  const { start, error, isStarting } = useStart({ onStarted, onStale })

  if (total === 0) return <EmptyBank message="There are no questions for this section yet." />

  const filter = { section, categoryIds, difficulties }
  const available = countAvailable(filter)
  const number = wholeNumber(wanted) ?? 0
  const problem =
    number < 1 || number > max
      ? `Enter a number from 1 to ${max}.`
      : number > available
        ? `Only ${count(available, `matching ${unit}`)} available. Choose fewer, or widen your choices.`
        : null

  function choose(): string[] | null {
    if (isByPassage) {
      const chosen = choosePassages(index.questions, filter, number)
      return chosen.ok ? chosen.questionIds : null
    }
    const chosen = chooseQuestions(index.questions, filter, number)
    return chosen.ok ? chosen.ids : null
  }

  function submit() {
    const ids = problem === null && time.problem === null ? choose() : null
    if (ids === null) return
    const config: SessionConfig = {
      section,
      category_ids: categoryIds,
      difficulties,
      question_count: ids.length,
      explanations,
      passage_count: isByPassage ? number : null,
      time_limit_seconds: time.seconds,
      custom: null,
    }
    void start(config, ids)
  }

  function availableText() {
    if (!isByPassage) return `${count(available, 'question')} available`
    const questions = findPassageSets(index.questions, filter).flatMap((set) => set.questionIds)
    return `${count(available, 'passage')} available, with ${count(questions.length, 'question')}`
  }

  const categories = index.categories.filter((category) => category.section === section)
  return (
    <form
      className="space-y-8 rounded-2xl border border-line bg-surface p-8 shadow-card"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <Group legend="Categories">
        <p className="text-sm text-muted">
          Choose none to include all.
          {isByPassage && ' Counts are passages. A chosen passage keeps all of its questions.'}
        </p>
        <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {categories.map(({ id, name }) => (
            <Check
              key={id}
              label={`${name} (${countAvailable({ section, categoryIds: [id], difficulties })})`}
              checked={categoryIds.includes(id)}
              onChange={() => setCategoryIds(toggle(categoryIds, id))}
            />
          ))}
        </div>
      </Group>
      <DifficultyFields value={difficulties} onChange={setDifficulties} />
      <NumberField
        id="question-count"
        label={label}
        value={wanted}
        onChange={setWanted}
        help={problem ?? availableText()}
        isInvalid={problem !== null}
      />
      <TimeFields time={time} />
      <ExplanationFields value={explanations} onChange={setExplanations} />
      <StartError message={error} />
      <Button type="submit" disabled={problem !== null || time.problem !== null || isStarting}>
        Start Practice
      </Button>
    </form>
  )
}
