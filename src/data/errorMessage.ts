/** Backend errors are plain-language text. Anything else gets the fallback. */
export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  return typeof error === 'string' ? error : fallback
}
