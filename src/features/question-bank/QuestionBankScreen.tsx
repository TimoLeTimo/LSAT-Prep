import { isTauri } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import { routeHref } from '../../app/routes'
import { BackLink } from '../../components/BackLink'
import { PageHeading } from '../../components/PageHeading'
import { questionImport, type ImportHistoryEntry } from '../../data/questionImport'
import { ImportHistory } from './ImportHistory'
import { ImportPanel } from './ImportPanel'

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

  const loadHistory = useCallback(() => {
    questionImport.history().then(setHistory, () => setHistory('The import history could not be read.'))
  }, [])
  useEffect(loadHistory, [loadHistory])

  return (
    <>
      <ImportPanel onRecorded={loadHistory} />
      <ImportHistory history={history} />
    </>
  )
}
