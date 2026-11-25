import { useState } from 'react'
import { Button } from '../../components/Button'
import { count } from '../../components/count'
import { errorMessage } from '../../data/errorMessage'
import { examApi, type Exam } from '../../data/exam'
import type { QuestionIndex } from '../../data/questionBank'
import { sectionNames } from '../../domain/content/names'
import type { Section } from '../../domain/content/types'
import { assembleTest, findTestPool, testNeeds, type TestSection } from '../../domain/exam/assembleTest'
import { Check, Group, NumberField, StartError } from '../practice/fields'
import { wholeNumber } from '../practice/wholeNumber'

const MAX_SECTIONS = 6
const MAX_LR = 100
const MAX_PASSAGES = 12
const MAX_MINUTES = 360
const MAX_BREAK = 60

interface Draft {
  key: number
  section: Section
  amount: string
  minutes: string
  breakAfter: string
}

interface TestBuilderProps {
  index: QuestionIndex
  onCreated: (exam: Exam) => void
  /** Called when creating fails, because the question bank may have changed. */
  onStale: () => void
}

export function TestBuilder({ index, onCreated, onStale }: TestBuilderProps) {
  const pool = findTestPool(index.questions)
  const [nextKey, setNextKey] = useState(1)
  const [drafts, setDrafts] = useState<Draft[]>(() => [newDraft(0, pool.lr.length > 0)])
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  function newDraft(key: number, isLr: boolean): Draft {
    return {
      key,
      section: isLr ? 'logical_reasoning' : 'reading_comprehension',
      amount: String(isLr ? Math.min(25, pool.lr.length) : Math.min(4, pool.passages.length)),
      minutes: '35',
      breakAfter: '0',
    }
  }

  function change(key: number, values: Partial<Draft>) {
    setDrafts(drafts.map((draft) => (draft.key === key ? { ...draft, ...values } : draft)))
  }

  const sections = drafts.map(readDraft)
  const isComplete = sections.every((section) => section !== null)
  const problem = isComplete ? shortage(pool, sections) : null
  const canCreate = isComplete && problem === null

  async function create() {
    if (!canCreate || isCreating) return
    const assembled = assembleTest(pool, sections)
    if (assembled === null) return
    setIsCreating(true)
    setError(null)
    try {
      onCreated(await examApi.create('test', 'Custom test', assembled))
    } catch (reason) {
      setError(errorMessage(reason, 'The test could not be created.'))
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
      <div>
        <h2 className="font-serif text-2xl font-semibold">Custom Test</h2>
        <p className="mt-2 text-muted">
          Timed sections, taken in order. Answers are scored at the end. The bank has{' '}
          {count(pool.lr.length, 'Logical Reasoning question')} and{' '}
          {count(pool.passages.length, 'passage')}.
        </p>
      </div>
      {drafts.map((draft, position) => (
        <SectionFields
          key={draft.key}
          draft={draft}
          position={position}
          isLast={position === drafts.length - 1}
          onChange={(values) => change(draft.key, values)}
          onRemove={
            drafts.length > 1
              ? () => setDrafts(drafts.filter(({ key }) => key !== draft.key))
              : null
          }
        />
      ))}
      {drafts.length < MAX_SECTIONS && (
        <Button
          variant="secondary"
          onClick={() => {
            setDrafts([...drafts, newDraft(nextKey, pool.lr.length > 0)])
            setNextKey(nextKey + 1)
          }}
        >
          Add Section
        </Button>
      )}
      <StartError message={error} />
      <div className="border-t border-line pt-6">
        <Button type="submit" disabled={!canCreate || isCreating}>
          Create Test
        </Button>
        <p role="status" className="mt-3 min-h-6 text-sm text-muted">
          {!isComplete
            ? 'Fix the numbers above to continue.'
            : (problem ?? 'The timer starts when you start the first section.')}
        </p>
      </div>
    </form>
  )
}

interface SectionFieldsProps {
  draft: Draft
  position: number
  isLast: boolean
  onChange: (values: Partial<Draft>) => void
  onRemove: (() => void) | null
}

function SectionFields({ draft, position, isLast, onChange, onRemove }: SectionFieldsProps) {
  const isLr = draft.section === 'logical_reasoning'
  const max = isLr ? MAX_LR : MAX_PASSAGES
  const outside = (text: string, min: number, limit: number) => {
    const number = wholeNumber(text)
    return number === null || number < min || number > limit
  }
  const badAmount = outside(draft.amount, 1, max)
  const badMinutes = outside(draft.minutes, 1, MAX_MINUTES)
  const badBreak = !isLast && outside(draft.breakAfter, 0, MAX_BREAK)
  return (
    <div className="rounded-xl border border-line p-5">
      <Group legend={`Section ${position + 1}`}>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {(['logical_reasoning', 'reading_comprehension'] as const).map((section) => (
            <Check
              key={section}
              type="radio"
              name={`kind-${draft.key}`}
              label={sectionNames[section]}
              checked={draft.section === section}
              onChange={() =>
                onChange({ section, amount: section === 'logical_reasoning' ? '25' : '4' })
              }
            />
          ))}
        </div>
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          <NumberField
            id={`amount-${draft.key}`}
            label={isLr ? 'Questions' : 'Passages'}
            value={draft.amount}
            onChange={(amount) => onChange({ amount })}
            help={badAmount ? `Enter a number from 1 to ${max}.` : ''}
            isInvalid={badAmount}
          />
          <NumberField
            id={`minutes-${draft.key}`}
            label="Minutes"
            value={draft.minutes}
            onChange={(minutes) => onChange({ minutes })}
            help={badMinutes ? `Enter a number from 1 to ${MAX_MINUTES}.` : ''}
            isInvalid={badMinutes}
          />
          {!isLast && (
            <NumberField
              id={`break-${draft.key}`}
              label="Break after (minutes)"
              value={draft.breakAfter}
              onChange={(breakAfter) => onChange({ breakAfter })}
              help={badBreak ? `Enter a number from 0 to ${MAX_BREAK}.` : ''}
              isInvalid={badBreak}
            />
          )}
        </div>
        {onRemove !== null && (
          <div className="mt-4">
            <Button variant="secondary" onClick={onRemove} aria-label={`Remove section ${position + 1}`}>
              Remove
            </Button>
          </div>
        )}
      </Group>
    </div>
  )
}

function readDraft(draft: Draft, position: number, all: Draft[]): TestSection | null {
  const isLast = position === all.length - 1
  const amount = wholeNumber(draft.amount)
  const minutes = wholeNumber(draft.minutes)
  const breakAfter = isLast ? 0 : wholeNumber(draft.breakAfter)
  const max = draft.section === 'logical_reasoning' ? MAX_LR : MAX_PASSAGES
  if (amount === null || amount < 1 || amount > max) return null
  if (minutes === null || minutes < 1 || minutes > MAX_MINUTES) return null
  if (breakAfter === null || breakAfter > MAX_BREAK) return null
  return { section: draft.section, amount, minutes, breakAfter }
}

function shortage(pool: ReturnType<typeof findTestPool>, sections: TestSection[]): string | null {
  const needs = testNeeds(sections)
  const missing = []
  if (needs.lr > pool.lr.length) {
    missing.push(`${count(needs.lr, 'Logical Reasoning question')} (you have ${pool.lr.length})`)
  }
  if (needs.passages > pool.passages.length) {
    missing.push(`${count(needs.passages, 'passage')} (you have ${pool.passages.length})`)
  }
  return missing.length === 0 ? null : `This test needs ${missing.join(' and ')}.`
}
