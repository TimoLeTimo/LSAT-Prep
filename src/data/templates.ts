import { invoke } from '@tauri-apps/api/core'
import type { Difficulty, Section } from '../domain/content/types'
import type { SessionConfig, Subset } from './practiceSession'

/** These shapes match the Rust types in src-tauri/src/templates.rs. */
export interface TemplateChoices {
  /** Section and name explain a category that is no longer available. */
  categories: { id: string; section: Section; name: string }[]
  difficulties: Difficulty[]
  lr_count: number
  passage_count: number
  subset: Subset
  exclude_correct: boolean
  shuffle_questions: boolean
  shuffle_answers: boolean
  explanations: SessionConfig['explanations']
  time_limit_seconds: number | null
}

export interface Template {
  id: string
  name: string
  /** Null if the saved choices cannot be read. */
  choices: TemplateChoices | null
}

/** Each call rejects with a message that can be shown to the user. */
export const templateStore = {
  list: () => invoke<Template[]>('list_templates'),
  create: (name: string, choices: TemplateChoices) =>
    invoke<void>('create_template', { name, choices }),
  update: (id: string, choices: TemplateChoices) => invoke<void>('update_template', { id, choices }),
  rename: (id: string, name: string) => invoke<void>('rename_template', { id, name }),
  remove: (id: string) => invoke<void>('delete_template', { id }),
}
