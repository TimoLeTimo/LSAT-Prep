import { useState } from 'react'
import { Button } from '../../components/Button'
import type { SessionRecord, SessionType } from '../../data/records'
import { sectionNames } from '../../domain/content/names'
import { duration } from '../../domain/statistics/format'

const PAGE = 50

const typeNames: Record<SessionType, string> = {
  targeted: 'Practice',
  custom: 'Custom practice',
  test: 'Custom test',
  full_simulation: 'Full simulation',
  review: 'Review',
}

function nameOf({ session_type, section }: SessionRecord): string {
  return session_type === 'targeted' && section !== null ? sectionNames[section] : typeNames[session_type]
}

/** Give this a key that changes with the filter, so it starts again from the top. */
export function SessionList({ sessions }: { sessions: readonly SessionRecord[] }) {
  const [limit, setLimit] = useState(PAGE)
  if (sessions.length === 0) return <p className="text-muted">No finished sessions.</p>
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <caption className="sr-only">Finished sessions, newest first</caption>
          <thead className="border-b border-line text-sm text-muted">
            <tr>
              <th scope="col" className="py-2 pr-4 font-medium">Session</th>
              <th scope="col" className="py-2 pr-4 font-medium">Finished</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Correct</th>
              <th scope="col" className="py-2 text-right font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {sessions.slice(0, limit).map((session) => (
              <tr key={session.id} className="border-b border-line last:border-0">
                <th scope="row" className="py-2.5 pr-4 font-normal">
                  {nameOf(session)}
                  {session.status === 'abandoned' && (
                    <span className="block text-sm text-muted">Ended early</span>
                  )}
                </th>
                <td className="py-2.5 pr-4">
                  {session.completed_at !== null && new Date(session.completed_at).toLocaleString()}
                </td>
                <td className="py-2.5 pr-4 text-right whitespace-nowrap tabular-nums">
                  {session.correct} of {session.answered}
                  {session.answered < session.questions && (
                    <span className="block text-sm text-muted">
                      {session.questions - session.answered} not answered
                    </span>
                  )}
                </td>
                <td className="py-2.5 text-right whitespace-nowrap">{duration(session.practice_ms)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sessions.length > limit && (
        <div className="mt-4">
          <Button variant="secondary" onClick={() => setLimit(limit + PAGE)}>
            Show More ({sessions.length - limit} left)
          </Button>
        </div>
      )}
    </>
  )
}
