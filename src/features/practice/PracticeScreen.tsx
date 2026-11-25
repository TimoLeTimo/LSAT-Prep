import { isTauri } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import { routeHref } from '../../app/routes'
import { BackLink } from '../../components/BackLink'
import { Button } from '../../components/Button'
import { PageHeading } from '../../components/PageHeading'
import { errorMessage } from '../../data/errorMessage'
import { practiceSession, type Session } from '../../data/practiceSession'
import { getQuestionIndex, type QuestionIndex } from '../../data/questionBank'
import { sectionNames } from '../../domain/content/names'
import type { Section } from '../../domain/content/types'
import { CustomSetup } from './CustomSetup'
import { ResumePanel } from './ResumePanel'
import { SessionScreen } from './SessionScreen'
import { SessionSetup } from './SessionSetup'

interface PracticeProps {
  /** Null for custom practice, which can mix sections. */
  section: Section | null
}

/** Setup, practice, and results. */
export function PracticeScreen({ section }: PracticeProps) {
  return (
    <>
      <BackLink href={routeHref('menu')}>Main Menu</BackLink>
      <PageHeading>{section === null ? 'Custom Practice' : sectionNames[section]}</PageHeading>
      <div className="mt-8">
        {isTauri() ? (
          <Practice section={section} />
        ) : (
          <p className="text-muted">Practice is only available in the desktop app.</p>
        )}
      </div>
    </>
  )
}

type View =
  | { name: 'loading' }
  | { name: 'error'; message: string }
  | { name: 'setup' }
  | { name: 'resume'; session: Session }
  | { name: 'session'; session: Session }

function Practice({ section }: PracticeProps) {
  const [view, setView] = useState<View>({ name: 'loading' })
  const [index, setIndex] = useState<QuestionIndex | null>(null)

  const load = useCallback(() => {
    Promise.all([getQuestionIndex(), practiceSession.unfinished(section)]).then(
      ([found, session]) => {
        setIndex(found)
        setView(session === null ? { name: 'setup' } : { name: 'resume', session })
      },
      (error) => {
        setView({ name: 'error', message: errorMessage(error, 'Practice could not be opened.') })
      },
    )
  }, [section])
  useEffect(load, [load])

  // Read again, so the newest saved answers are used.
  async function resume() {
    try {
      const session = await practiceSession.unfinished(section)
      setView(session === null ? { name: 'setup' } : { name: 'session', session })
    } catch (error) {
      setView({ name: 'error', message: errorMessage(error, 'The session could not be opened.') })
    }
  }

  const refreshIndex = () => {
    getQuestionIndex().then(setIndex, () => {})
  }

  if (view.name === 'error') {
    return (
      <div role="alert" className="space-y-4">
        <p>{view.message}</p>
        <Button onClick={load}>Try Again</Button>
      </div>
    )
  }
  if (view.name === 'session') return <SessionScreen session={view.session} onDone={load} />
  if (view.name === 'resume') {
    return (
      <ResumePanel
        session={view.session}
        onResume={resume}
        onEnded={load}
      />
    )
  }
  if (view.name === 'loading' || index === null) return <p role="status">Loading…</p>
  const setup = {
    index,
    onStarted: (session: Session) => setView({ name: 'session', session }),
    onStale: refreshIndex,
  }
  return section === null ? <CustomSetup {...setup} /> : <SessionSetup section={section} {...setup} />
}
