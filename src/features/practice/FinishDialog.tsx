import { useEffect, useRef } from 'react'
import { Button } from '../../components/Button'

interface FinishDialogProps {
  message: string
  onCancel: () => void
  onConfirm: () => void
}

export function FinishDialog({ message, onCancel, onConfirm }: FinishDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  return (
    <dialog
      ref={dialog}
      aria-labelledby="finish-title"
      onCancel={(event) => {
        event.preventDefault() // closed by its parent
        onCancel()
      }}
      className="m-auto max-w-md rounded-2xl border border-line bg-surface p-8 text-ink shadow-card backdrop:bg-ink/40"
    >
      <h2 id="finish-title" className="font-serif text-2xl font-semibold">
        Finish this session?
      </h2>
      <p className="mt-4">{message}</p>
      <p className="mt-2 text-muted">
        Selected answers will be submitted and cannot be changed afterward.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Keep Working
        </Button>
        <Button onClick={onConfirm}>Finish Session</Button>
      </div>
    </dialog>
  )
}
