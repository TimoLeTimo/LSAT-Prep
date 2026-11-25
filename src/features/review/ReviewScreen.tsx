import { isTauri } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import { routeHref } from '../../app/routes'
import { BackLink } from '../../components/BackLink'
import { Button } from '../../components/Button'
import { PageHeading } from '../../components/PageHeading'
import { errorMessage } from '../../data/errorMessage'
import type { Session, SessionConfig } from '../../data/practiceSession'
import { recordsApi, type ReviewItem } from '../../data/records'
import { retryOrder } from '../../domain/statistics/retryOrder'
import { ResumePanel } from '../practice/ResumePanel'
import { SessionScreen } from '../practice/SessionScreen'
import { useStart } from '../practice/useStart'
import { QuestionDetail } from './QuestionDetail'
import { ReviewList } from './ReviewList'
import type { ReviewFilter } from './reviewList'

export function ReviewScreen() {
  return (
    <>
      <BackLink href={routeHref('menu')}>Main Menu</BackLink>
      <PageHeading>Review</PageHeading>
      <div className="mt-8">
        {isTauri() ? (
          <Review />
        ) : (
          <p className="text-muted">Review is only available in the desktop app.</p>
        )}
      </div>
    </>
  )
}

type View =
  | { name: 'loading' }
  | { name: 'error'; message: string }
  | { name: 'list' }
  | { name: 'question'; item: ReviewItem }
  | { name: 'resume'; session: Session }
  | { name: 'session'; session: Session }

function Review() {
  const [view, setView] = useState<View>({ name: 'loading' })
  const [items, setItems] = useState<ReviewItem[]>([])
  // Kept here so that the list is as it was after a question or a retry.
  const [filter, setFilter] = useState<ReviewFilter>({ tab: 'missed', section: null, category: '' })
  const [page, setPage] = useState(0)

  const load = useCallback(() => {
    Promise.all([recordsApi.reviewItems(), recordsApi.unfinishedReview()]).then(
      ([found, session]) => {
        setItems(found)
        setView(session === null ? { name: 'list' } : { name: 'resume', session })
      },
      (error) => {
        setView({ name: 'error', message: errorMessage(error, 'Review could not be opened.') })
      },
    )
  }, [])
  useEffect(load, [load])

  const { start, error, isStarting } = useStart({
    onStarted: (session) => setView({ name: 'session', session }),
    onStale: () => {
      recordsApi.reviewItems().then(setItems, () => {})
    },
  })

  function retry(chosen: readonly ReviewItem[]) {
    const ids = retryOrder(chosen)
    if (ids.length === 0) return
    const config: SessionConfig = {
      section: null,
      category_ids: [],
      difficulties: [],
      question_count: ids.length,
      explanations: 'after_each',
      passage_count: null,
      time_limit_seconds: null,
      custom: null,
      review: true,
    }
    void start(config, ids)
  }

  // Read again, so the newest saved answers are used.
  async function resume() {
    try {
      const session = await recordsApi.unfinishedReview()
      setView(session === null ? { name: 'list' } : { name: 'session', session })
    } catch (reason) {
      setView({ name: 'error', message: errorMessage(reason, 'The session could not be opened.') })
    }
  }

  switch (view.name) {
    case 'loading':
      return <p role="status">Loading…</p>
    case 'error':
      return (
        <div role="alert" className="space-y-4">
          <p>{view.message}</p>
          <Button onClick={load}>Try Again</Button>
        </div>
      )
    case 'resume':
      return <ResumePanel session={view.session} onResume={resume} onEnded={load} />
    case 'session':
      return <SessionScreen key={view.session.id} session={view.session} onDone={load} />
    case 'question':
      return (
        <QuestionDetail
          item={view.item}
          error={error}
          isStarting={isStarting}
          onRetry={() => retry([view.item])}
          onBack={load}
        />
      )
    case 'list':
      return (
        <ReviewList
          items={items}
          filter={filter}
          page={page}
          error={error}
          isStarting={isStarting}
          onFilter={(next) => {
            setFilter(next)
            setPage(0)
          }}
          onPage={setPage}
          onOpen={(item) => setView({ name: 'question', item })}
          onRetry={retry}
        />
      )
  }
}
