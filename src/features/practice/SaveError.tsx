import { Button } from '../../components/Button'
import type { SessionState } from './SessionController'

interface SaveErrorProps {
  error: SessionState['error']
  onDismiss: () => void
}

export function SaveError({ error, onDismiss }: SaveErrorProps) {
  if (error === null) return null
  return (
    <div role="alert" className="mt-2 rounded-lg border border-rose-accent bg-blush p-4">
      <p className="font-medium">This was not saved.</p>
      <p className="mt-1 wrap-anywhere">{error.message}</p>
      <div className="mt-3 flex gap-3">
        <Button onClick={error.retry}>Try Again</Button>
        <Button variant="secondary" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  )
}
