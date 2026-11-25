import { invoke } from '@tauri-apps/api/core'
import type { Section } from '../domain/content/types'

/** These shapes match the Rust types in src-tauri/src/import/. */
export interface Items {
  new: string[]
  skipped: string[]
  conflicts: string[]
}

export interface ImportPlan {
  package_id: string
  package_version: string
  display_name: string
  content_hash: string
  lr_questions: number
  rc_questions: number
  questions_by_category: { id: string; questions: number }[]
  categories: Items
  passages: Items
  questions: Items
  problems: string[]
}

export interface ImportCatalog {
  categories: { id: string; section: Section; name: string }[]
  approved_passage_ids: string[]
}

export interface ImportHistoryEntry {
  id: string
  package_id: string | null
  package_version: string | null
  display_name: string | null
  attempted_at: string
  status: 'succeeded' | 'rejected_validation' | 'failed_rollback'
  questions_added: number
  passages_added: number
  categories_added: number
  duplicates_skipped: number
  summary: string
}

/** Each call rejects with a message that can be shown to the user. */
export const questionImport = {
  /** Opens the file picker. Resolves with the file name, or null if cancelled. */
  choose: () => invoke<string | null>('choose_package'),
  bytes: async () => new Uint8Array(await invoke<ArrayBuffer>('package_bytes')),
  catalog: () => invoke<ImportCatalog>('import_catalog'),
  reject: (summary: string) => invoke<void>('reject_package', { summary }),
  preview: () => invoke<ImportPlan>('preview_package'),
  confirm: () => invoke<ImportPlan>('confirm_import'),
  cancel: () => invoke<void>('cancel_import'),
  history: () => invoke<ImportHistoryEntry[]>('import_history'),
}

export type QuestionImport = typeof questionImport
