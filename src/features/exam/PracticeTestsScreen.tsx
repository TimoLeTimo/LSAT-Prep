import { isTauri } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import { routeHref } from '../../app/routes'
import { BackLink } from '../../components/BackLink'
import { Button } from '../../components/Button'
import { PageHeading } from '../../components/PageHeading'
import { errorMessage } from '../../data/errorMessage'
import { examApi, type Exam } from '../../data/exam'
import { getQuestionIndex, type QuestionIndex } from '../../data/questionBank'
import { BetweenSections } from './BetweenSections'
import { ExamResults } from './ExamResults'
import { ExamSectionScreen } from './ExamSectionScreen'
import { ResumeExam } from './ResumeExam'
import { TestBuilder } from './TestBuilder'

export function PracticeTestsScreen() {
  return (
    <>
      <BackLink href={routeHref('menu')}>Main Menu</BackLink>
      <PageHeading>Practice Tests</PageHeading>
      <div className="mt-8">
        {isTauri() ? (
          <Tests />
        ) : (
          <p className="text-muted">Practice tests are only available in the desktop app.</p>
        )}
      </div>
    </>
  )
}

type View =
  | { name: 'loading' }
  | { name: 'error'; message: string }
  | { name: 'setup' }
  | { name: 'resume'; exam: Exam }
  | { name: 'exam'; exam: Exam }

function Tests() {
  const [view, setView] = useState<View>({ name: 'loading' })
  const [index, setIndex] = useState<QuestionIndex | null>(null)

  const load = useCallback(() => {
    Promise.all([getQuestionIndex(), examApi.unfinished()]).then(
      ([found, exam]) => {
        setIndex(found)
        if (exam === null) setView({ name: 'setup' })
        // Time may have run out while the app was closed.
        else if (exam.phase.name === 'ended') setView({ name: 'exam', exam })
        else setView({ name: 'resume', exam })
      },
      (error) => {
        setView({ name: 'error', message: errorMessage(error, 'Practice tests could not be opened.') })
      },
    )
  }, [])
  useEffect(load, [load])

  const show = useCallback((exam: Exam) => setView({ name: 'exam', exam }), [])

  // Read again, so the newest saved answers and time are used.
  async function resume() {
    try {
      const exam = await examApi.unfinished()
      setView(exam === null ? { name: 'setup' } : { name: 'exam', exam })
    } catch (error) {
      setView({ name: 'error', message: errorMessage(error, 'The test could not be opened.') })
    }
  }

  if (view.name === 'error') {
    return (
      <div role="alert" className="space-y-4">
        <p>{view.message}</p>
        <Button onClick={load}>Try Again</Button>
      </div>
    )
  }
  if (view.name === 'resume') {
    return <ResumeExam exam={view.exam} onResume={resume} onEnded={load} />
  }
  if (view.name === 'exam') {
    const { exam } = view
    if (exam.phase.name === 'ended') return <ExamResults exam={exam} onDone={load} />
    if (exam.phase.name !== 'section') return <BetweenSections exam={exam} onChange={show} />
    const { position } = exam.phase
    return <ExamSectionScreen key={position} exam={exam} position={position} onEnded={show} />
  }
  if (view.name === 'loading' || index === null) return <p role="status">Loading…</p>
  const refreshIndex = () => {
    getQuestionIndex().then(setIndex, () => {})
  }
  return <TestBuilder index={index} onCreated={show} onStale={refreshIndex} />
}
