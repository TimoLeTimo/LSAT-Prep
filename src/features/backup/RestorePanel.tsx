import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { count } from '../../components/count'
import { backupApi, type ChosenBackup, type DataSummary } from '../../data/backup'
import { errorMessage } from '../../data/errorMessage'
import { SummaryTable } from './SummaryTable'

type State =
  | { step: 'idle' | 'choosing' | 'restoring' }
  | { step: 'failed'; message: string }
  | { step: 'preview' | 'confirming'; chosen: ChosenBackup; current: DataSummary | null }
  | { step: 'done'; savedAs: string }

const titles: Record<State['step'], string> = {
  idle: 'Restore from a Backup',
  choosing: 'Restore from a Backup',
  failed: 'Nothing Was Restored',
  preview: 'Compare Before Restoring',
  confirming: 'Replace Your Data?',
  restoring: 'Restoring',
  done: 'Backup Restored',
}

export function RestorePanel() {
  const [state, setState] = useState<State>({ step: 'idle' })
  const isBusy = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const previousStep = useRef(state.step)

  useEffect(() => {
    if (previousStep.current === state.step) return
    previousStep.current = state.step
    heading.current?.focus()
  }, [state.step])

  // Leaving the screen forgets the chosen backup.
  useEffect(() => () => void backupApi.cancel().catch(() => {}), [])

  /** Runs one step at a time, so a double click cannot start it twice. */
  async function run(working: State['step'] & ('choosing' | 'restoring'), step: () => Promise<State>) {
    if (isBusy.current) return
    isBusy.current = true
    setState({ step: working })
    try {
      setState(await step())
    } catch (error) {
      setState({ step: 'failed', message: errorMessage(error, 'The backup could not be restored.') })
    }
    isBusy.current = false
  }

  const choose = () =>
    run('choosing', async () => {
      const chosen = await backupApi.choose()
      if (chosen === null) return { step: 'idle' }
      // There is nothing to compare with when the current data cannot be opened.
      const current = await backupApi.summary().catch(() => null)
      return { step: 'preview', chosen, current }
    })

  const restore = () =>
    run('restoring', async () => ({ step: 'done', savedAs: await backupApi.restore() }))

  function cancel() {
    backupApi.cancel().catch(() => {})
    setState({ step: 'idle' })
  }

  return (
    <section
      aria-labelledby="restore"
      className="rounded-2xl border border-line bg-surface p-8 shadow-card"
    >
      <h2
        id="restore"
        ref={heading}
        tabIndex={-1}
        className="font-serif text-2xl font-semibold outline-none"
      >
        {titles[state.step]}
      </h2>
      <div className="mt-4 space-y-4">{renderStep()}</div>
    </section>
  )

  function renderStep() {
    switch (state.step) {
      case 'idle':
      case 'choosing':
        return (
          <>
            <p className="text-muted">
              Replace your data with a backup. You will see what it contains first. Backups that
              LSAT Prep makes automatically can be chosen too.
            </p>
            <Button variant="secondary" onClick={choose} disabled={state.step === 'choosing'}>
              Choose Backup
            </Button>
          </>
        )
      case 'failed':
        return (
          <>
            <p>{state.message}</p>
            <p className="text-muted">Your data was not changed.</p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={choose}>Choose Another Backup</Button>
              <Button variant="secondary" onClick={cancel}>
                Close
              </Button>
            </div>
          </>
        )
      case 'preview': {
        const { chosen, current } = state
        return (
          <>
            <p className="wrap-anywhere">
              {chosen.name}
              {chosen.modified_ms !== null && (
                <span className="text-muted">
                  , saved {new Date(chosen.modified_ms).toLocaleString()}
                </span>
              )}
            </p>
            <p>This backup was checked and can be restored. Nothing has changed yet.</p>
            <SummaryTable backup={chosen.summary} current={current} />
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setState({ ...state, step: 'confirming' })}>Continue</Button>
              <Button variant="secondary" onClick={cancel}>
                Cancel
              </Button>
            </div>
          </>
        )
      }
      case 'confirming': {
        const { current } = state
        return (
          <>
            <p>
              All of your current data will be replaced by the backup: questions, answers, sessions,
              bookmarks, and templates.
            </p>
            {current !== null && current.unfinished_sessions > 0 && (
              <p className="font-medium">
                This includes {count(current.unfinished_sessions, 'unfinished session')}.
              </p>
            )}
            <p>
              {current === null
                ? 'The data that cannot be opened will be moved to the backups folder, unchanged.'
                : 'Your current data will be saved to the backups folder first, so you can undo this.'}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={cancel}>
                Keep Current Data
              </Button>
              <Button onClick={restore}>Replace My Data</Button>
            </div>
          </>
        )
      }
      case 'restoring':
        return <p role="status">Restoring. Please keep LSAT Prep open.</p>
      case 'done':
        return (
          <>
            <p>Your data now matches the backup.</p>
            <p className="text-muted wrap-anywhere">
              The data it replaced is in the backups folder as {state.savedAs}.
            </p>
            <Button
              onClick={() => {
                // Start fresh, so no screen shows the old data.
                window.location.hash = '#/'
                window.location.reload()
              }}
            >
              Continue
            </Button>
          </>
        )
    }
  }
}
