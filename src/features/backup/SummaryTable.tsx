import type { DataSummary } from '../../data/backup'

const rows: { label: string; value: (summary: DataSummary) => string }[] = [
  { label: 'Questions', value: ({ questions }) => String(questions) },
  { label: 'Submitted answers', value: ({ answers }) => String(answers) },
  { label: 'Bookmarks', value: ({ bookmarks }) => String(bookmarks) },
  { label: 'Saved templates', value: ({ templates }) => String(templates) },
  { label: 'Finished sessions', value: ({ finished_sessions }) => String(finished_sessions) },
  { label: 'Unfinished sessions', value: ({ unfinished_sessions }) => String(unfinished_sessions) },
  {
    label: 'Last activity',
    value: ({ last_activity }) =>
      last_activity === null ? 'None' : new Date(last_activity).toLocaleString(),
  },
]

interface SummaryTableProps {
  backup: DataSummary
  /** Null when the current data cannot be opened. */
  current: DataSummary | null
}

export function SummaryTable({ backup, current }: SummaryTableProps) {
  return (
    <table className="w-full text-left">
      <thead className="border-b border-line text-sm text-muted">
        <tr>
          <th className="py-2 font-medium">Contents</th>
          <th className="py-2 font-medium">Backup</th>
          {current !== null && <th className="py-2 font-medium">Current data</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ label, value }) => (
          <tr key={label} className="border-b border-line">
            <th className="py-2 pr-4 font-normal">{label}</th>
            <td className="pr-4">{value(backup)}</td>
            {current !== null && <td>{value(current)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
