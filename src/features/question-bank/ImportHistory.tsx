import type { ImportHistoryEntry } from '../../data/questionImport'
import { count } from '../../components/count'

const statusNames = {
  succeeded: 'Imported',
  rejected_validation: 'Not imported',
  failed_rollback: 'Failed and undone',
}

export function ImportHistory({ history }: { history: ImportHistoryEntry[] | string | null }) {
  return (
    <section className="mt-12" aria-labelledby="import-history">
      <h2 id="import-history" className="font-serif text-2xl font-semibold">
        Import History
      </h2>
      {typeof history === 'string' && <p className="mt-4 text-muted">{history}</p>}
      {Array.isArray(history) && history.length === 0 && (
        <p className="mt-4 text-muted">No imports yet.</p>
      )}
      {Array.isArray(history) && history.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface shadow-card">
          {history.map((entry) => (
            <li key={entry.id} className="px-6 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6">
                <span className="font-medium wrap-anywhere">
                  {entry.display_name ?? 'Unreadable or invalid file'}
                  {entry.package_version !== null && (
                    <span className="font-normal text-muted"> {entry.package_version}</span>
                  )}
                </span>
                <time dateTime={entry.attempted_at} className="text-sm text-muted">
                  {new Date(entry.attempted_at).toLocaleString()}
                </time>
              </div>
              <p className="mt-1 text-sm whitespace-pre-line text-muted wrap-anywhere">
                <span className="font-medium text-ink">{statusNames[entry.status]}.</span>{' '}
                {entry.summary}
                {entry.duplicates_skipped > 0 &&
                  ` Skipped ${count(entry.duplicates_skipped, 'item')} already in the app.`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
