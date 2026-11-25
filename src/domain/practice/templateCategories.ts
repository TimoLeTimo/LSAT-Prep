import { sectionNames } from '../content/names'
import { SECTIONS, type Section } from '../content/types'

interface Category {
  id: string
  section: Section
  name: string
}

export interface LoadedCategories {
  ids: string[]
  /** Explains anything left out. Empty when everything was available. */
  notes: string[]
}

/** Keeps saved categories that are still available, and explains the others. */
export function loadTemplateCategories(
  saved: readonly Category[],
  available: readonly { id: string; section: Section }[],
): LoadedCategories {
  const isAvailable = ({ id, section }: Category) =>
    available.some((category) => category.id === id && category.section === section)
  const kept = saved.filter(isAvailable)
  const missing = saved.filter((category) => !isAvailable(category))
  if (missing.length === 0) return { ids: kept.map(({ id }) => id), notes: [] }

  const names = missing.map(({ name }) => `“${name}”`).join(', ')
  const notes = [
    missing.length === 1
      ? `The category ${names} is no longer available and was left out.`
      : `These categories are no longer available and were left out: ${names}.`,
  ]
  for (const section of SECTIONS) {
    const inSection = (category: Category) => category.section === section
    if (missing.some(inSection) && !kept.some(inSection)) {
      notes.push(`${sectionNames[section]} now includes all categories.`)
    }
  }
  return { ids: kept.map(({ id }) => id), notes }
}

/** The template that already has this name, ignoring capitals. */
export function findByName<T extends { name: string }>(templates: readonly T[], name: string) {
  const wanted = name.trim().toLowerCase()
  return templates.find((template) => template.name.toLowerCase() === wanted)
}
