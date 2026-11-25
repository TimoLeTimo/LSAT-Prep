import { invoke } from '@tauri-apps/api/core'
import type { Difficulty, Section } from '../domain/content/types'
import type { Exam } from './exam'
import type { Session, SessionQuestion } from './practiceSession'

/** These shapes match the Rust types in src-tauri/src/stats.rs. */
export interface AnswerRecord {
  question_id: string
  section: Section
  category_id: string
  category_name: string
  difficulty: Difficulty
  is_correct: boolean
  seconds: number
  answered_at: string
  is_retry: boolean
}

export type SessionType = 'targeted' | 'custom' | 'test' | 'full_simulation' | 'review'

export interface SessionRecord {
  id: string
  session_type: SessionType
  section: Section | null
  /** Exams only. */
  name: string | null
  status: 'in_progress' | 'completed' | 'abandoned'
  started_at: string
  completed_at: string | null
  /** Clock time, without pauses or breaks. */
  practice_ms: number
  questions: number
  answered: number
  correct: number
  /** Counted toward an exam's raw score. */
  scored_questions: number
  scored_correct: number
}

export interface Records {
  answers: AnswerRecord[]
  sessions: SessionRecord[]
}

export interface ReviewItem {
  question_id: string
  section: Section
  category_name: string
  difficulty: Difficulty
  passage_id: string | null
  excerpt: string
  times_answered: number
  last_correct: boolean | null
  last_answered_at: string | null
  is_bookmarked: boolean
  can_retry: boolean
}

export interface PastAnswer {
  answered_at: string
  session_type: SessionType
  is_retry: boolean
  question: SessionQuestion
}

/** Each call rejects with a message that can be shown to the user. */
export const recordsApi = {
  records: () => invoke<Records>('statistics_records'),
  reviewItems: () => invoke<ReviewItem[]>('review_items'),
  history: (questionId: string) => invoke<PastAnswer[]>('question_history', { questionId }),
  unfinishedReview: () => invoke<Session | null>('unfinished_review'),
  examResults: (sessionId: string) => invoke<Exam>('exam_results', { sessionId }),
}
