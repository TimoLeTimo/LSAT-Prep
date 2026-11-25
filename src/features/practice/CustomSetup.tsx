import { useState } from 'react'
import { Button } from '../../components/Button'
import { count } from '../../components/count'
import type { Session, SessionConfig, Subset } from '../../data/practiceSession'
import type { QuestionIndex } from '../../data/questionBank'
import type { TemplateChoices } from '../../data/templates'
import { sectionNames } from '../../domain/content/names'
import { SECTIONS, type Section } from '../../domain/content/types'
import { chooseCustom, findCustomPool, type CustomFilter } from '../../domain/practice/chooseCustom'
import { customProblems, MAX_LR, MAX_PASSAGES } from '../../domain/practice/customProblem'
import { loadTemplateCategories } from '../../domain/practice/templateCategories'
import { EmptyBank } from './EmptyBank'
import { Check, Group, NumberField, StartError } from './fields'
import { DifficultyFields, ExplanationFields, TimeFields } from './sharedFields'
import { TemplatePanel } from './TemplatePanel'
import { useStart } from './useStart'
import { useTimeLimit } from './useTimeLimit'
import { toggle, wholeNumber } from './wholeNumber'

const subsets: { id: Subset; label: string }[] = [
  { id: 'any', label: 'All questions' },
  { id: 'new', label: 'New (never submitted)' },
  { id: 'missed', label: 'Missed (your most recent answer was wrong)' },
  { id: 'bookmarked', label: 'Bookmarked' },
]

const USUAL_LR = 10
const USUAL_PASSAGES = 1

interface CustomSetupProps {
  index: QuestionIndex
  onStarted: (session: Session) => void
  onStale: () => void
}

export function CustomSetup({ index, onStarted, onStale }: CustomSetupProps) {
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [difficulties, setDifficulties] = useState<SessionConfig['difficulties']>([])
  const [subset, setSubset] = useState<Subset>('any')
  const [excludeCorrect, setExcludeCorrect] = useState(false)
  const [shuffleQuestions, setShuffleQuestions] = useState(false)
  const [shuffleAnswers, setShuffleAnswers] = useState(false)
  const [explanations, setExplanations] = useState<SessionConfig['explanations']>('after_each')

  const filter: CustomFilter = {
    categories: index.categories.filter(({ id }) => categoryIds.includes(id)),
    difficulties,
    subset,
    excludeCorrect,
  }
  const pool = findCustomPool(index.questions, filter)
  const [lrText, setLrText] = useState(() => String(Math.min(USUAL_LR, pool.lrIds.length)))
  const [passageText, setPassageText] = useState(() =>
    String(Math.min(USUAL_PASSAGES, pool.passages.length)),
  )
  const time = useTimeLimit()
  const { start, error, isStarting } = useStart({ onStarted, onStale })

  if (index.questions.length === 0) return <EmptyBank message="There are no questions yet." />

  const lrCount = wholeNumber(lrText)
  const passageCount = wholeNumber(passageText)
  const problems = customProblems(pool, subset, lrCount, passageCount)
  const canStart =
    problems.lr === null &&
    problems.passages === null &&
    problems.overall === null &&
    time.problem === null

  function submit() {
    if (!canStart || lrCount === null || passageCount === null) return
    const chosen = chooseCustom(pool, { lrCount, passageCount, shuffleQuestions })
    if (!chosen.ok) return
    const config: SessionConfig = {
      section: null,
      category_ids: filter.categories.map(({ id }) => id),
      difficulties,
      question_count: chosen.ids.length,
      explanations,
      passage_count: passageCount,
      time_limit_seconds: time.seconds,
      custom: {
        lr_count: lrCount,
        subset,
        exclude_correct: excludeCorrect,
        shuffle_questions: shuffleQuestions,
        shuffle_answers: shuffleAnswers,
      },
    }
    void start(config, chosen.ids)
  }

  /** Choices can be saved even if too few questions match today. */
  function currentChoices(): TemplateChoices | null {
    if (lrCount === null || passageCount === null || time.problem !== null) return null
    if (lrCount > MAX_LR || passageCount > MAX_PASSAGES || lrCount + passageCount === 0) return null
    return {
      categories: index.categories
        .filter(({ id }) => categoryIds.includes(id))
        .map(({ id, section, name }) => ({ id, section, name })),
      difficulties,
      lr_count: lrCount,
      passage_count: passageCount,
      subset,
      exclude_correct: excludeCorrect,
      shuffle_questions: shuffleQuestions,
      shuffle_answers: shuffleAnswers,
      explanations,
      time_limit_seconds: time.seconds,
    }
  }

  /** Fills in the builder, and returns notes about anything left out. */
  function loadChoices(choices: TemplateChoices): string[] {
    const { ids, notes } = loadTemplateCategories(choices.categories, index.categories)
    setCategoryIds(ids)
    setDifficulties(choices.difficulties)
    setSubset(choices.subset)
    setExcludeCorrect(choices.exclude_correct)
    setShuffleQuestions(choices.shuffle_questions)
    setShuffleAnswers(choices.shuffle_answers)
    setExplanations(choices.explanations)
    setLrText(String(choices.lr_count))
    setPassageText(String(choices.passage_count))
    time.setSeconds(choices.time_limit_seconds)
    return notes
  }

  /** How many would be available with only this category chosen in its section. */
  function countIn(category: CustomFilter['categories'][number]) {
    const found = findCustomPool(index.questions, { ...filter, categories: [category] })
    const isLr = category.section === 'logical_reasoning'
    return isLr ? found.lrIds.length : found.passages.length
  }

  const passageQuestions = pool.passages.flat().length
  return (
    <>
      <TemplatePanel current={currentChoices()} onUse={loadChoices} />
      <form
        className="space-y-8 rounded-2xl border border-line bg-surface p-8 shadow-card"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <Group legend="Questions to use">
          <div className="mt-3 space-y-2">
            {subsets.map(({ id, label }) => (
              <Check
                key={id}
                type="radio"
                name="subset"
                label={label}
                checked={subset === id}
                onChange={() => setSubset(id)}
              />
            ))}
          </div>
          <div className="mt-4">
            <Check
              label="Exclude questions you answered correctly most recently"
              checked={excludeCorrect}
              onChange={() => setExcludeCorrect(!excludeCorrect)}
            />
          </div>
          <p className="mt-3 text-sm text-muted">
            A passage is included if any of its questions qualifies, and keeps all of its questions.
          </p>
        </Group>

        <Group legend="Categories">
          <p className="text-sm text-muted">
            Choose none in a section to include all of it. Passage categories count passages.
          </p>
          <div className="mt-3 space-y-3">
            {SECTIONS.map((section) => (
              <CategoryGroup
                key={section}
                section={section}
                categories={index.categories.filter((category) => category.section === section)}
                chosen={categoryIds}
                countIn={countIn}
                onToggle={(id) => setCategoryIds(toggle(categoryIds, id))}
              />
            ))}
          </div>
        </Group>

        <DifficultyFields value={difficulties} onChange={setDifficulties} />

        <div className="grid gap-6 sm:grid-cols-2">
          <NumberField
            id="lr-count"
            label="Logical Reasoning questions"
            value={lrText}
            onChange={setLrText}
            help={problems.lr ?? `${pool.lrIds.length} available`}
            isInvalid={problems.lr !== null}
          />
          <NumberField
            id="passage-count"
            label="Reading Comprehension passages"
            value={passageText}
            onChange={setPassageText}
            help={
              problems.passages ??
              `${pool.passages.length} available, with ${count(passageQuestions, 'question')}`
            }
            isInvalid={problems.passages !== null}
          />
        </div>

        <Group legend="Order">
          <div className="mt-3 space-y-2">
            <Check
              label="Shuffle questions (passages keep their own question order)"
              checked={shuffleQuestions}
              onChange={() => setShuffleQuestions(!shuffleQuestions)}
            />
            <Check
              label="Shuffle answer choices"
              checked={shuffleAnswers}
              onChange={() => setShuffleAnswers(!shuffleAnswers)}
            />
          </div>
          <p className="mt-2 text-sm text-muted">
            Questions whose text mentions choices by letter or position keep their answer order.
          </p>
        </Group>

        <TimeFields time={time} />
        <ExplanationFields value={explanations} onChange={setExplanations} />
        <StartError message={error} />
        <div>
          <Button type="submit" disabled={!canStart || isStarting}>
            Start Practice
          </Button>
          <p role="status" className="mt-3 min-h-6 text-sm text-muted">
            {problems.overall}
          </p>
        </div>
      </form>
    </>
  )
}

interface CategoryGroupProps {
  section: Section
  categories: QuestionIndex['categories']
  chosen: string[]
  countIn: (category: QuestionIndex['categories'][number]) => number
  onToggle: (id: string) => void
}

function CategoryGroup({ section, categories, chosen, countIn, onToggle }: CategoryGroupProps) {
  const number = categories.filter(({ id }) => chosen.includes(id)).length
  return (
    <details className="rounded-xl border border-line px-5 py-3">
      <summary className="cursor-pointer rounded-md font-medium">
        {sectionNames[section]}
        <span className="font-normal text-muted"> – {number === 0 ? 'all' : `${number} chosen`}</span>
      </summary>
      <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {categories.map((category) => (
          <Check
            key={category.id}
            label={`${category.name} (${countIn(category)})`}
            checked={chosen.includes(category.id)}
            onChange={() => onToggle(category.id)}
          />
        ))}
      </div>
    </details>
  )
}
