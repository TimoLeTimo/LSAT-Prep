import { isTauri } from '@tauri-apps/api/core'
import { useRef, useState } from 'react'
import { routeHref } from '../../app/routes'
import { BackLink } from '../../components/BackLink'
import { Button } from '../../components/Button'
import { PageHeading } from '../../components/PageHeading'
import { backupApi } from '../../data/backup'
import { errorMessage } from '../../data/errorMessage'
import { RestorePanel } from './RestorePanel'

export function BackupScreen() {
  return (
    <>
      <BackLink href={routeHref('settings')}>Settings</BackLink>
      <PageHeading>Backup and Restore</PageHeading>
      {isTauri() ? (
        <div className="mt-8 space-y-8">
          <BackupPanel />
          <RestorePanel />
        </div>
      ) : (
        <p className="mt-8 text-muted">Backups are only available in the desktop app.</p>
      )}
    </>
  )
}

function BackupPanel() {
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isBusy = useRef(false)

  async function save() {
    if (isBusy.current) return
    isBusy.current = true
    setIsSaving(true)
    setSaved(null)
    setError(null)
    try {
      setSaved(await backupApi.save())
    } catch (reason) {
      setError(errorMessage(reason, 'The backup could not be saved.'))
    }
    setIsSaving(false)
    isBusy.current = false
  }

  return (
    <section
      aria-labelledby="backup"
      className="rounded-2xl border border-line bg-surface p-8 shadow-card"
    >
      <h2 id="backup" className="font-serif text-2xl font-semibold">
        Back Up
      </h2>
      <p className="mt-4 text-muted">
        Save everything in one file: questions, answers, sessions, bookmarks, and templates. Keep it
        somewhere other than this computer, such as an external drive.
      </p>
      <div className="mt-4">
        <Button onClick={save} disabled={isSaving}>
          Back Up Now
        </Button>
      </div>
      <p role="status" className="mt-3 min-h-6 text-sm wrap-anywhere">
        {saved !== null && `Saved and checked: ${saved}`}
      </p>
      {error !== null && (
        <p role="alert" className="rounded-lg border border-rose-accent bg-blush p-4">
          {error}
        </p>
      )}
    </section>
  )
}
