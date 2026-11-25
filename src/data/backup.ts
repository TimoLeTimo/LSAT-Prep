import { invoke } from '@tauri-apps/api/core'

/** These shapes match the Rust types in src-tauri/src/db/backup.rs and commands.rs. */
export interface DataSummary {
  questions: number
  answers: number
  bookmarks: number
  templates: number
  finished_sessions: number
  unfinished_sessions: number
  last_activity: string | null
}

export interface ChosenBackup {
  name: string
  modified_ms: number | null
  summary: DataSummary
}

/** Each call rejects with a message that can be shown to the user. */
export const backupApi = {
  summary: () => invoke<DataSummary>('data_summary'),
  canRestore: () => invoke<boolean>('can_restore'),
  /** Asks where to save. Resolves with the file name, or null if cancelled. */
  save: () => invoke<string | null>('back_up_data'),
  /** Asks for a backup and checks it. Changes nothing. */
  choose: () => invoke<ChosenBackup | null>('choose_backup'),
  cancel: () => invoke<void>('cancel_restore'),
  /** Resolves with what the replaced data was saved as. */
  restore: () => invoke<string>('confirm_restore'),
}
