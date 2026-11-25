import { invoke } from '@tauri-apps/api/core'
import type { Section } from '../domain/content/types'
import type { QuestionSummary } from '../domain/practice/filterQuestions'

/** Matches the Rust types in src-tauri/src/bank.rs. */
export interface QuestionIndex {
  categories: { id: string; section: Section; name: string }[]
  questions: QuestionSummary[]
}

/** Active categories and every question that can be practiced, without question text. */
export function getQuestionIndex() {
  return invoke<QuestionIndex>('question_index')
}
