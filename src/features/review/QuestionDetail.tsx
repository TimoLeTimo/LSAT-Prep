import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { count } from '../../components/count'
import { errorMessage } from '../../data/errorMessage'
import { practiceSession } from '../../data/practiceSession'
import { recordsApi, type PastAnswer, type ReviewItem } from '../../data/records'
import { difficultyNames, sectionNames } from '../../domain/content/names'
import { StartError } from '../practice/fields'
import { ToggleButton } from '../practice/ToggleButton'
import { PastAnswers } from './PastAnswers'

interface QuestionDetailProps {
  item: ReviewItem
  error: string | null
  isStarting: boolean
  onRetry: () => void
  onBack: () => void
}

/** One question. Its past answers stay hidden until asked for, so a retry is not spoiled. */
export function QuestionDetail({ item, error, isStarting, onRetry, onBack }: QuestionDetailProps) {
  const [isBookmarked, setIsBookmarked] = useState(item.is_bookmarked)
  const [past, setPast] = useState<PastAnswer[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const isBusy = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    window.scrollTo(0, 0)
    heading.current?.focus()
  }, [])

  /** Runs one change at a time. What is shown changes only once it is saved. */
  async function run(action: () => Promise<void>, fallback: string) {
    if (isBusy.current) return
    isBusy.current = true
    setProblem(null)
    try {
      await action()
    } catch (reason) {
      setProblem(errorMessage(reason, fallback))
    }
    isBusy.current = false
  }

  const toggleBookmark = () =>
    run(async () => {
      await practiceSession.bookmark(item.question_id, !isBookmarked)
      setIsBookmarked(!isBookmarked)
    }, 'The bookmark could not be saved.')

  const showPast = () =>
    run(async () => {
      setPast(await recordsApi.history(item.question_id))
    }, 'Past answers could not be read.')

  return (
    <div>
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <h2 ref={heading} tabIndex={-1} className="font-serif text-2xl font-semibold outline-none">
            Question
          </h2>
          <ToggleButton
            isOn={isBookmarked}
            onLabel="Remove Bookmark"
            offLabel="Bookmark"
            onClick={toggleBookmark}
          />
        </div>
        <p className="mt-1 text-sm text-muted">
          {sectionNames[item.section]} – {item.category_name} – {difficultyNames[item.difficulty]}
        </p>
        <div className="mt-5 space-y-3 rounded-2xl border border-line bg-surface p-6 shadow-card">
          <p className="wrap-anywhere">{item.excerpt}</p>
          <p className="text-muted">
            {item.times_answered === 0
              ? 'Not answered yet.'
              : `Answered ${count(item.times_answered, 'time')}. ${item.last_correct ? 'Correct' : 'Wrong'} last time.`}
          </p>
          {!item.can_retry && (
            <p className="text-muted">
              This question is no longer used, so it cannot be tried again. Its history is kept.
            </p>
          )}
        </div>
        {problem !== null && (
          <p role="alert" className="mt-4 rounded-lg border border-rose-accent bg-blush p-4">
            {problem}
          </p>
        )}
        <div className="mt-4">
          <StartError message={error} />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          {item.can_retry && (
            <Button onClick={onRetry} disabled={isStarting}>
              {item.times_answered === 0 ? 'Answer This' : 'Retry This'}
            </Button>
          )}
          {item.times_answered > 0 && past === null && (
            <Button variant="secondary" onClick={showPast}>
              Show Past Answers
            </Button>
          )}
          <Button variant="secondary" onClick={onBack}>
            Back to List
          </Button>
        </div>
      </div>
      {past !== null && past.length > 0 && <PastAnswers past={past} />}
    </div>
  )
}
