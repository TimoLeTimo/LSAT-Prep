import { useCallback, useEffect, useRef, useState } from 'react'
import { questionImport, type ImportPlan } from '../../data/questionImport'
import { checkPackage, type CheckResult } from './checkPackage'

export type ImportState =
  | { step: 'idle' | 'choosing' | 'validating' | 'importing' }
  | Exclude<CheckResult, { step: 'cancelled' }>
  | { step: 'confirming'; preview: Extract<CheckResult, { step: 'preview' }> }
  | { step: 'done'; plan: ImportPlan }
  | { step: 'failed'; message: string }

function messageFrom(error: unknown) {
  return typeof error === 'string' ? error : 'Something went wrong. Nothing was imported.'
}

/** Runs the import steps. `onRecorded` is called when the history may have changed. */
export function useImport(onRecorded: () => void) {
  const [state, setState] = useState<ImportState>({ step: 'idle' })
  // Each import gets a number. Results from an older number are ignored.
  const run = useRef(0)
  // Set at once, unlike state, so a double click cannot start the same thing twice.
  const busy = useRef(false)

  const abandon = useCallback(() => {
    run.current++
    questionImport.cancel().catch(() => {})
  }, [])

  // Leaving the screen cancels an unconfirmed import.
  useEffect(() => abandon, [abandon])

  async function start() {
    if (busy.current) return
    busy.current = true
    const current = ++run.current
    const isCancelled = () => run.current !== current
    const show = (next: ImportState) => {
      if (!isCancelled()) setState(next)
    }
    try {
      show({ step: 'choosing' })
      const fileName = await questionImport.choose()
      busy.current = false // the picker is closed; Cancel is available from here
      if (isCancelled()) return void questionImport.cancel().catch(() => {})
      if (fileName === null) return show({ step: 'idle' })
      show({ step: 'validating' })
      const result = await checkPackage(questionImport, isCancelled)
      if (result.step !== 'cancelled') show(result)
    } catch (error) {
      busy.current = false
      show({ step: 'failed', message: messageFrom(error) })
    }
    onRecorded()
  }

  async function confirm() {
    if (busy.current) return
    busy.current = true
    const current = run.current
    setState({ step: 'importing' })
    let next: ImportState
    try {
      next = { step: 'done', plan: await questionImport.confirm() }
    } catch (error) {
      next = { step: 'failed', message: messageFrom(error) }
    }
    busy.current = false
    if (run.current === current) setState(next)
    onRecorded()
  }

  return {
    state,
    start,
    confirm,
    review: () => {
      if (state.step === 'preview') setState({ step: 'confirming', preview: state })
    },
    back: () => {
      if (state.step === 'confirming') setState(state.preview)
    },
    cancel: () => {
      abandon()
      setState({ step: 'idle' })
    },
  }
}
