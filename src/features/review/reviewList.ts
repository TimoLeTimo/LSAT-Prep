import type { ReviewItem } from '../../data/records'
import type { Section } from '../../domain/content/types'

export const reviewTabs = ['missed', 'bookmarked', 'answered'] as const
export type ReviewTab = (typeof reviewTabs)[number]

export const PAGE_SIZE = 50

export interface ReviewFilter {
  tab: ReviewTab
  section: Section | null
  /** A category name, or empty for any. Names are unique within a section. */
  category: string
}

export function inTab(item: ReviewItem, tab: ReviewTab): boolean {
  switch (tab) {
    case 'missed':
      return item.last_correct === false
    case 'bookmarked':
      return item.is_bookmarked
    case 'answered':
      return item.times_answered > 0
  }
}

export function filterItems(items: readonly ReviewItem[], filter: ReviewFilter): ReviewItem[] {
  const { tab, section, category } = filter
  return items.filter(
    (item) =>
      inTab(item, tab) &&
      (section === null || item.section === section) &&
      (category === '' || item.category_name === category),
  )
}

/** Categories to choose from, given the tab and section. */
export function categoriesIn(
  items: readonly ReviewItem[],
  { tab, section }: Pick<ReviewFilter, 'tab' | 'section'>,
): string[] {
  const found = filterItems(items, { tab, section, category: '' })
  return [...new Set(found.map(({ category_name }) => category_name))].toSorted((a, b) =>
    a.localeCompare(b),
  )
}

/** One page, and how many pages there are. A page that no longer exists becomes the last. */
export function pageOf<T>(items: readonly T[], page: number) {
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  return { items: items.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE), page: current, pages }
}
