import { invoke } from '@tauri-apps/api/core'
import type { ChoiceLabel, Difficulty, Section } from '../domain/content/types'

/** These shapes match the Rust types in src-tauri/src/practice/model.rs. */
export type Subset = 'any' | 'new' | 'missed' | 'bookmarked'

/** Choices that only custom sessions have. */
export interface CustomOptions {
  lr_count: number
  subset: Subset
  /** Leaves out questions whose most recent attempt was right. */
  exclude_correct: boolean
  shuffle_questions: boolean
  shuffle_answers: boolean
}

export type ExamKind = 'test' | 'full_simulation'

export interface SessionConfig {
  /** Null for custom sessions, which can mix sections. */
  section: Section | null
  /** Empty means any. In a custom session, this applies within each section separately. */
  category_ids: string[]
  /** Empty means any. */
  difficulties: Difficulty[]
  question_count: number
  explanations: 'after_each' | 'at_end'
  /** How many whole RC passage sets. Null for targeted LR. */
  passage_count: number | null
  /** Null means untimed. */
  time_limit_seconds: number | null
  /** Null for a targeted session. */
  custom: CustomOptions | null
  /** Missing or null for practice. */
  exam?: { kind: ExamKind; name: string } | null
  /** A session started from Review, to try questions again. */
  review?: boolean
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
  passage: { id: string; title: string; texts: { label: 'A' | 'B'; text: string }[] } | null
  selected: ChoiceLabel | null
  /** Lasts only for this session. */
  is_flagged: boolean
  /** Stays with the question after the session. */
  is_bookmarked: boolean
  time_spent_seconds: number
  is_submitted: boolean
  /** Position in the whole session. */
  display_order: number
  /** Exams only. */
  exam_section: number | null
  /** Null until an exam is completed, and outside exams. */
  is_scored: boolean | null
  outcome: Outcome | null
}

export interface Session {
  id: string
  config: SessionConfig
  status: 'in_progress' | 'completed' | 'abandoned'
  current_position: number
  /** Time the clock has run, as of the last save. */
  active_ms: number
  created_at: string
  completed_at: string | null
  questions: SessionQuestion[]
}

export interface ClockReading {
  /** Null when the session has no time limit. */
  remaining_ms: number | null
  /** The final session, once it has ended. */
  ended: Session | null
}

/** Each call rejects with a message that can be shown to the user. */
export const practiceSession = {
  /** With a null section, finds the unfinished custom session. */
  unfinished: (section: Section | null) => invoke<Session | null>('unfinished_session', { section }),
  create: (config: SessionConfig, questionIds: string[]) =>
    invoke<Session>('create_session', { config, questionIds }),
  select: (id: string, choice: ChoiceLabel | null) => invoke<void>('select_answer', { id, choice }),
  flag: (id: string, flagged: boolean) => invoke<void>('flag_question', { id, flagged }),
  bookmark: (questionId: string, bookmarked: boolean) =>
    invoke<void>('set_bookmark', { questionId, bookmarked }),
  addTime: (id: string, seconds: number) => invoke<void>('add_question_time', { id, seconds }),
  setPosition: (sessionId: string, position: number) =>
    invoke<void>('set_session_position', { sessionId, position }),
  submit: (id: string) => invoke<Session>('submit_answer', { id }),
  finish: (sessionId: string) => invoke<Session>('finish_session', { sessionId }),
  startClock: (sessionId: string) => invoke<ClockReading>('start_clock', { sessionId }),
  saveClock: (sessionId: string) => invoke<ClockReading>('save_clock', { sessionId }),
  pauseClock: (sessionId: string) => invoke<ClockReading>('pause_clock', { sessionId }),
  abandon: (sessionId: string) => invoke<void>('abandon_session', { sessionId }),
}

export type PracticeSessionApi = typeof practiceSession
