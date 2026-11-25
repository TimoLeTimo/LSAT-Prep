import { invoke } from '@tauri-apps/api/core'
import type { ChoiceLabel, Difficulty, Section } from '../domain/content/types'

/** These shapes match the Rust types in src-tauri/src/practice/model.rs. */
export interface SessionConfig {
  section: Section
  /** Empty means any. */
  category_ids: string[]
  /** Empty means any. */
  difficulties: Difficulty[]
  question_count: number
  explanations: 'after_each' | 'at_end'
}

export interface Outcome {
  correct_choice: ChoiceLabel
  /** Null when the question was not answered. */
  is_correct: boolean | null
  explanations: Record<ChoiceLabel, string>
}

export interface SessionQuestion {
  id: string
  question_id: string
  category_name: string
  difficulty: Difficulty
  stimulus: string | null
  prompt: string
  choices: { label: ChoiceLabel; text: string }[]
  passage: { title: string; texts: { label: 'A' | 'B'; text: string }[] } | null
  selected: ChoiceLabel | null
  is_flagged: boolean
  time_spent_seconds: number
  is_submitted: boolean
  outcome: Outcome | null
}

export interface Session {
  id: string
  config: SessionConfig
  status: 'in_progress' | 'completed' | 'abandoned'
  current_position: number
  created_at: string
  completed_at: string | null
  questions: SessionQuestion[]
}

/** Each call rejects with a message that can be shown to the user. */
export const practiceSession = {
  unfinished: (section: Section) => invoke<Session | null>('unfinished_session', { section }),
  create: (config: SessionConfig, questionIds: string[]) =>
    invoke<Session>('create_session', { config, questionIds }),
  select: (id: string, choice: ChoiceLabel | null) => invoke<void>('select_answer', { id, choice }),
  flag: (id: string, flagged: boolean) => invoke<void>('flag_question', { id, flagged }),
  addTime: (id: string, seconds: number) => invoke<void>('add_question_time', { id, seconds }),
  setPosition: (sessionId: string, position: number) =>
    invoke<void>('set_session_position', { sessionId, position }),
  submit: (id: string) => invoke<Session>('submit_answer', { id }),
  finish: (sessionId: string) => invoke<Session>('finish_session', { sessionId }),
  abandon: (sessionId: string) => invoke<void>('abandon_session', { sessionId }),
}

export type PracticeSessionApi = typeof practiceSession
