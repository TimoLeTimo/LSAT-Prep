import { useEffect, useState } from 'react'
import { formatTime, timeNotice } from './formatTime'
import type { SessionController } from './SessionController'

interface SessionTimerProps {
  controller: SessionController
  limitSeconds: number
}

export function SessionTimer({ controller, limitSeconds }: SessionTimerProps) {
  const [remaining, setRemaining] = useState(controller.getRemainingMs)

  useEffect(() => {
    let wasUp = false
    const interval = setInterval(() => {
      const now = controller.getRemainingMs()
      setRemaining(now)
      // The backend confirms that time is up. Regular saves try again if this fails.
      if (now === 0 && !wasUp) void controller.saveClock()
      wasUp = now === 0
    }, 250)
    return () => clearInterval(interval)
  }, [controller])

  return (
    <div className="flex items-baseline gap-3">
      <span className="text-sm text-rose-deep" role="status">
        {remaining === null ? '' : timeNotice(remaining, limitSeconds)}
      </span>
      <span role="timer" aria-label="Time left" className="text-lg font-medium tabular-nums">
        {remaining === null ? '–:––' : formatTime(remaining)}
      </span>
    </div>
  )
}
