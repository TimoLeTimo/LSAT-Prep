import { isTauri } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import { routeHref } from '../../app/routes'
import { BackLink } from '../../components/BackLink'
import { PageHeading } from '../../components/PageHeading'
import { getQuestionIndex, type QuestionIndex } from '../../data/questionBank'
import { questionImport, type ImportHistoryEntry } from '../../data/questionImport'
import { ImportHistory } from './ImportHistory'
import { ImportPanel } from './ImportPanel'
import { QuestionCounts } from './QuestionCounts'

export function QuestionBankScreen() {
  return (
    <>
      <BackLink href={routeHref('settings')}>Settings</BackLink>
      <PageHeading>Question Bank Management</PageHeading>
      {isTauri() ? (
        <ImportArea />
      ) : (
        <p className="mt-8 text-muted">Importing is only available in the desktop app.</p>
      )}
    </>
  )
}

function ImportArea() {
  const [history, setHistory] = useState<ImportHistoryEntry[] | string | null>(null)

  const [index, setIndex] = useState<QuestionIndex | string | null>(null)

  const load = useCallback(() => {
    getQuestionIndex().then(setIndex, () => setIndex('The question bank could not be read.'))
    questionImport.history().then(setHistory, () => setHistory('The import history could not be read.'))
  }, [])
  useEffect(load, [load])

  return (
    <>
      <ImportPanel onRecorded={load} />
      <QuestionCounts index={index} />
      <ImportHistory history={history} />
    </>
  )
}
