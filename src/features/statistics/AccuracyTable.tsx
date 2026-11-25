import type { Accuracy } from '../../domain/statistics/calculate'
import { FEW_ANSWERS, percent, perQuestion } from '../../domain/statistics/format'

export interface AccuracyRow extends Accuracy {
  key: string | number
  label: string
  averageSeconds: number | null
}

interface AccuracyTableProps {
  caption: string
  /** The name of the first column. */
  heading: string
  rows: readonly AccuracyRow[]
}

/** Bars inside a real table, so every value can be read without the bars. */
export function AccuracyTable({ caption, heading, rows }: AccuracyTableProps) {
  if (rows.length === 0) return <p className="text-muted">No answers.</p>
  return (
    <table className="w-full text-left">
      <caption className="sr-only">{caption}</caption>
      <thead className="border-b border-line text-sm text-muted">
        <tr>
          <th scope="col" className="py-2 pr-4 font-medium">
            {heading}
          </th>
          <th scope="col" className="w-[38%] py-2 pr-4 font-medium">
            Accuracy
          </th>
          <th scope="col" className="py-2 pr-4 text-right font-medium">
            Correct
          </th>
          <th scope="col" className="py-2 text-right font-medium">
            Avg. time
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ key, label, answered, correct, accuracy, averageSeconds }) => (
          <tr key={key} className="border-b border-line last:border-0">
            <th scope="row" className="py-2.5 pr-4 font-normal wrap-anywhere">
              {label}
            </th>
            <td className="py-2.5 pr-4">
              <span className="flex items-center gap-3">
                <span className="w-11 shrink-0 text-right font-medium tabular-nums">
                  {percent(accuracy)}
                </span>
                <span aria-hidden="true" className="h-2.5 min-w-10 grow rounded-r bg-rose-track">
                  <span
                    className="block h-full rounded-r bg-rose-accent"
                    style={{ width: `${(accuracy ?? 0) * 100}%` }}
                  />
                </span>
              </span>
              {answered > 0 && answered < FEW_ANSWERS && (
                <span className="block text-sm text-muted">Few answers</span>
              )}
            </td>
            <td className="py-2.5 pr-4 text-right whitespace-nowrap tabular-nums">
              {correct} of {answered}
            </td>
            <td className="py-2.5 text-right tabular-nums">{perQuestion(averageSeconds)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
