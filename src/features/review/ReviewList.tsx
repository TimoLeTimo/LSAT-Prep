import { useEffect, useRef } from 'react'
import { Button } from '../../components/Button'
import { count } from '../../components/count'
import { SelectField } from '../../components/SelectField'
import type { ReviewItem } from '../../data/records'
import { sectionNames } from '../../domain/content/names'
import type { Section } from '../../domain/content/types'
import { StartError } from '../practice/fields'
import { categoriesIn, filterItems, inTab, pageOf, reviewTabs, type ReviewFilter, type ReviewTab } from './reviewList'

const tabNames: Record<ReviewTab, string> = {
  missed: 'Missed',
  bookmarked: 'Bookmarked',
  answered: 'All Answered',
}

const emptyText: Record<ReviewTab, string> = {
  missed: 'No missed questions. A question is missed if your most recent answer was wrong.',
  bookmarked: 'No bookmarked questions. Bookmark one while practicing or reviewing.',
  answered: 'No answered questions yet.',
}

interface ReviewListProps {
  items: readonly ReviewItem[]
  filter: ReviewFilter
  page: number
  error: string | null
  isStarting: boolean
  onFilter: (filter: ReviewFilter) => void
  onPage: (page: number) => void
  onOpen: (item: ReviewItem) => void
  onRetry: (items: readonly ReviewItem[]) => void
}

export function ReviewList(props: ReviewListProps) {
  const { items, filter, error, isStarting, onFilter, onPage, onOpen, onRetry } = props
  const found = filterItems(items, filter)
  const { items: shown, page, pages } = pageOf(found, props.page)
  const retryable = shown.filter(({ can_retry }) => can_retry)
  const isNarrowed = filter.section !== null || filter.category !== ''

  const summary = useRef<HTMLParagraphElement>(null)
  const previousPage = useRef(page)
  useEffect(() => {
    if (previousPage.current === page) return
    previousPage.current = page
    summary.current?.focus()
    summary.current?.scrollIntoView({ block: 'center' })
  }, [page])

  return (
    <div>
      <div role="group" aria-label="Questions to show" className="flex flex-wrap gap-2">
        {reviewTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            aria-pressed={filter.tab === tab}
            onClick={() => onFilter({ tab, section: filter.section, category: '' })}
            className="cursor-pointer rounded-lg border border-line bg-surface px-4 py-2 font-medium hover:bg-blush aria-pressed:border-rose-accent aria-pressed:bg-blush aria-pressed:text-rose-deep"
          >
            {tabNames[tab]} ({items.filter((item) => inTab(item, tab)).length})
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Section"
          value={filter.section ?? ''}
          onChange={(value) =>
            onFilter({ ...filter, section: value === '' ? null : (value as Section), category: '' })
          }
        >
          <option value="">All sections</option>
          <option value="logical_reasoning">{sectionNames.logical_reasoning}</option>
          <option value="reading_comprehension">{sectionNames.reading_comprehension}</option>
        </SelectField>
        <SelectField
          label="Category"
          value={filter.category}
          onChange={(category) => onFilter({ ...filter, category })}
        >
          <option value="">All categories</option>
          {categoriesIn(items, filter).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p ref={summary} tabIndex={-1} role="status" className="font-medium outline-none">
          {count(found.length, 'question')}
          {pages > 1 && ` (page ${page + 1} of ${pages})`}
        </p>
        {retryable.length > 0 && (
          <Button onClick={() => onRetry(shown)} disabled={isStarting}>
            Retry All Shown ({retryable.length})
          </Button>
        )}
      </div>
      <div className="mt-3">
        <StartError message={error} />
      </div>

      {found.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-line bg-surface p-8 text-muted shadow-card">
          {isNarrowed ? 'No questions match these choices.' : emptyText[filter.tab]}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          {shown.map((item) => (
            <li key={item.question_id}>
              <button
                type="button"
                onClick={() => onOpen(item)}
                className="block w-full cursor-pointer px-6 py-4 text-left -outline-offset-2 hover:bg-blush"
              >
                <span className="block wrap-anywhere">{item.excerpt}</span>
                <span className="mt-1 block text-sm text-muted">
                  {sectionNames[item.section]} – {item.category_name}
                  {item.last_correct !== null && (
                    <span className="font-medium text-ink">
                      {' · '}
                      {item.last_correct ? '✓ Correct last time' : '✗ Wrong last time'}
                    </span>
                  )}
                  {item.is_bookmarked && <span className="text-rose-deep"> · Bookmarked</span>}
                  {!item.can_retry && ' · Retired'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" onClick={() => onPage(page - 1)} disabled={page === 0}>
            Previous Page
          </Button>
          <Button variant="secondary" onClick={() => onPage(page + 1)} disabled={page === pages - 1}>
            Next Page
          </Button>
        </div>
      )}
    </div>
  )
}
