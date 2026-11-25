/** The number in a text field, or null if it is not a whole number. */
export function wholeNumber(text: string): number | null {
  return /^\d{1,6}$/.test(text.trim()) ? Number(text) : null
}

export function toggle<T>(items: readonly T[], item: T): T[] {
  return items.includes(item) ? items.filter((other) => other !== item) : [...items, item]
}
