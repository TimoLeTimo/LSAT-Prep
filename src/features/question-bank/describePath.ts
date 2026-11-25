const singular: Record<string, string> = {
  categories: 'category',
  passages: 'passage',
  questions: 'question',
  choices: 'choice',
  texts: 'text',
  secondary_tags: 'tag',
}

/** Turns `questions[2].choices[0].text` into "Question 3, choice 1, text". */
export function describePath(path: string): string {
  const words = path.split('.').map((part) => {
    const [, name, index] = /^(\w+)(?:\[(\d+)\])?$/.exec(part) ?? []
    if (name === undefined) return part
    if (index === undefined) return name.replaceAll('_', ' ')
    return `${singular[name] ?? name} ${Number(index) + 1}`
  })
  const text = words.join(', ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
