/** "1 question", "2 questions". */
export function count(number: number, singular: string, plural = `${singular}s`) {
  return `${number} ${number === 1 ? singular : plural}`
}
