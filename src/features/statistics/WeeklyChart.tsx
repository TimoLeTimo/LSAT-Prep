import { useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { Week } from '../../domain/statistics/calculate'
import { FEW_ANSWERS, labelEvery, percent, shortDate } from '../../domain/statistics/format'
import { useWidth } from './useWidth'

const LEFT = 44
const RIGHT = 20
const TOP = 12
const LINE_HEIGHT = 170
const GAP = 34
const BAR_HEIGHT = 56
const AXIS = 26
/** Matches the w-52 class. */
const TOOLTIP = 208
const HEIGHT = TOP + LINE_HEIGHT + GAP + BAR_HEIGHT + AXIS

/**
 * Accuracy by week, with the number of answers in a strip below on its own scale. Weeks
 * without answers leave a gap in the line.
 */
export function WeeklyChart({ weeks }: { weeks: readonly Week[] }) {
  const [box, width] = useWidth()
  const [chosen, setActive] = useState<number | null>(null)
  // A filter may have removed the week.
  const active = chosen !== null && chosen < weeks.length ? chosen : null

  if (weeks.length === 0) return <p className="text-muted">No answers.</p>

  const plotWidth = Math.max(0, width - LEFT - RIGHT)
  const slot = plotWidth / weeks.length
  const x = (index: number) => LEFT + slot * (index + 0.5)
  const y = (accuracy: number) => TOP + LINE_HEIGHT * (1 - accuracy)
  const baseline = TOP + LINE_HEIGHT + GAP + BAR_HEIGHT
  const most = Math.max(...weeks.map(({ answered }) => answered))
  const barWidth = Math.max(2, Math.min(24, slot - 2))
  const every = labelEvery(weeks.length, plotWidth)
  const radius = slot >= 16 ? 5 : 4

  // Separate paths, so the line is not drawn across weeks without answers.
  let path = ''
  weeks.forEach(({ accuracy }, index) => {
    if (accuracy === null) return
    const joins = index > 0 && weeks[index - 1].accuracy !== null
    path += `${joins ? 'L' : 'M'}${x(index)},${y(accuracy)}`
  })

  function point(event: PointerEvent<HTMLDivElement>) {
    const left = event.clientX - event.currentTarget.getBoundingClientRect().left - LEFT
    const index = Math.floor(left / slot)
    setActive(index >= 0 && index < weeks.length ? index : null)
  }

  function onKeyDown(event: KeyboardEvent) {
    const last = weeks.length - 1
    const from = active ?? last
    const next = {
      ArrowLeft: Math.max(0, active === null ? last : from - 1),
      ArrowRight: Math.min(last, active === null ? last : from + 1),
      Home: 0,
      End: last,
    }[event.key]
    if (event.key === 'Escape') setActive(null)
    else if (next !== undefined) setActive(next)
    else return
    event.preventDefault()
  }

  const shown = active === null ? null : weeks[active]
  // Beside the week, on the side with more room, so that its point stays visible.
  const at = active === null ? 0 : x(active)
  const tooltipLeft = Math.max(0, at > width / 2 ? at - TOOLTIP - 12 : at + 12)

  return (
    <div>
      <div
        ref={box}
        role="group"
        aria-label="Weekly accuracy chart. Use the left and right arrow keys to read each week, or open the table below."
        tabIndex={0}
        onPointerMove={point}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive((current) => current ?? weeks.length - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={onKeyDown}
        className="relative rounded-md"
      >
        {width > 0 && (
          <svg width={width} height={HEIGHT} aria-hidden="true" className="block">
            {[0, 0.25, 0.5, 0.75, 1].map((level) => (
              <g key={level}>
                <line x1={LEFT} x2={width - RIGHT} y1={y(level)} y2={y(level)} className="stroke-line" />
                <text x={LEFT - 8} y={y(level) + 4} textAnchor="end" className="fill-muted text-xs tabular-nums">
                  {percent(level)}
                </text>
              </g>
            ))}
            {active !== null && (
              <line x1={x(active)} x2={x(active)} y1={TOP} y2={baseline} className="stroke-muted" />
            )}
            <path d={path} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-rose-accent" />
            {weeks.map(({ start, accuracy, answered }, index) =>
              accuracy === null ? null : answered < FEW_ANSWERS ? (
                <circle key={start} cx={x(index)} cy={y(accuracy)} r={radius} strokeWidth={2} className="fill-surface stroke-rose-accent" />
              ) : (
                <circle key={start} cx={x(index)} cy={y(accuracy)} r={radius} strokeWidth={2} className="fill-rose-accent stroke-surface" />
              ),
            )}
            <line x1={LEFT} x2={width - RIGHT} y1={baseline} y2={baseline} className="stroke-line" />
            <text x={LEFT - 8} y={baseline - BAR_HEIGHT + 4} textAnchor="end" className="fill-muted text-xs tabular-nums">
              {most}
            </text>
            <text x={LEFT - 8} y={baseline + 4} textAnchor="end" className="fill-muted text-xs tabular-nums">
              0
            </text>
            <text x={LEFT} y={baseline - BAR_HEIGHT - 10} className="fill-muted text-xs">
              Answers
            </text>
            {weeks.map(({ start, answered }, index) =>
              answered === 0 ? null : (
                <path
                  key={start}
                  d={column(x(index) - barWidth / 2, baseline, barWidth, (BAR_HEIGHT * answered) / most)}
                  className={index === active ? 'fill-rose-deep' : 'fill-bar'}
                />
              ),
            )}
            {weeks.map(({ start }, index) =>
              (weeks.length - 1 - index) % every !== 0 ? null : (
                <text key={start} x={x(index)} y={baseline + 18} textAnchor="middle" className="fill-muted text-xs">
                  {shortDate(start)}
                </text>
              ),
            )}
          </svg>
        )}
        {shown !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 w-52 rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-card"
            style={{ left: tooltipLeft }}
          >
            <p className="font-semibold">
              {shown.accuracy === null ? 'No answers' : percent(shown.accuracy)}
            </p>
            {shown.accuracy !== null && (
              <p className="text-muted">
                {shown.correct} of {shown.answered} correct
                {shown.answered < FEW_ANSWERS && ', few answers'}
              </p>
            )}
            <p className="text-muted">
              Week of {new Date(`${shown.start}T12:00`).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>
      <p className="mt-2 flex items-center gap-2 text-sm text-muted">
        <svg width="14" height="14" aria-hidden="true">
          <circle cx="7" cy="7" r="5" strokeWidth={2} className="fill-surface stroke-rose-accent" />
        </svg>
        Open circles are weeks with fewer than {FEW_ANSWERS} answers.
      </p>
      <details className="mt-3">
        <summary className="cursor-pointer rounded-md font-medium">Show as a table</summary>
        <div className="mt-2 max-h-80 overflow-y-auto" tabIndex={0} role="region" aria-label="Weekly table">
          <table className="w-full text-left">
            <thead className="border-b border-line text-sm text-muted">
              <tr>
                <th scope="col" className="py-2 font-medium">Week of</th>
                <th scope="col" className="py-2 font-medium">Accuracy</th>
                <th scope="col" className="py-2 font-medium">Correct</th>
              </tr>
            </thead>
            <tbody>
              {weeks.toReversed().map(({ start, accuracy, correct, answered }) => (
                <tr key={start} className="border-b border-line last:border-0">
                  <th scope="row" className="py-2 font-normal">
                    {new Date(`${start}T12:00`).toLocaleDateString()}
                  </th>
                  <td className="tabular-nums">{percent(accuracy)}</td>
                  <td className="tabular-nums">
                    {correct} of {answered}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}

/** A column with rounded top corners, square at the baseline. */
function column(left: number, baseline: number, width: number, height: number): string {
  const tall = Math.max(1, height)
  const corner = Math.min(4, width / 2, tall)
  return `M${left},${baseline}v${corner - tall}q0,${-corner} ${corner},${-corner}h${width - 2 * corner}q${corner},0 ${corner},${corner}v${tall - corner}z`
}
