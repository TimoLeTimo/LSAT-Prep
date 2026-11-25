import { invoke, isTauri } from '@tauri-apps/api/core'

/**
 * Resolves with null when saved data is available, or a message when it is not.
 * A plain browser (`npm run dev`) has no database, so there is nothing to check.
 */
export async function getDatabaseProblem(): Promise<string | null> {
  if (!isTauri()) return null
  try {
    await invoke('database_status')
    return null
  } catch (error) {
    return typeof error === 'string' ? error : 'The data is unavailable.'
  }
}
