import { invoke } from '@tauri-apps/api/core'
import type { Section } from '../domain/content/types'
import type { ExamSection } from '../domain/exam/assembleExam'
import type { ExamKind, Session } from './practiceSession'

/** These shapes match the Rust types in src-tauri/src/practice/exam.rs. */
export type ExamPhase =
  | { name: 'ready'; position: number }
  | { name: 'section'; position: number; remaining_ms: number }
  | { name: 'break'; next_position: number; remaining_ms: number; can_skip: boolean }
  | { name: 'ended' }

export interface ExamSectionInfo {
  position: number
  section: Section
  time_limit_ms: number
  status: 'waiting' | 'active' | 'done'
  question_count: number
}

export interface Exam {
  /** While in progress, holds only the active section's questions. */
  session: Session
  sections: ExamSectionInfo[]
  phase: ExamPhase
}

/** Each call rejects with a message that can be shown to the user. */
export const examApi = {
  create: (kind: ExamKind, name: string, sections: ExamSection[]) =>
    invoke<Exam>('create_exam', { kind, name, sections }),
  unfinished: () => invoke<Exam | null>('unfinished_exam'),
  /** The most recently completed exam. */
  latest: () => invoke<Exam | null>('latest_exam'),
  /** Resumes the clock of a paused test. */
  open: (sessionId: string) => invoke<Exam>('open_exam', { sessionId }),
  save: (sessionId: string) => invoke<Exam>('save_exam', { sessionId }),
  leave: (sessionId: string) => invoke<void>('leave_exam', { sessionId }),
  startSection: (sessionId: string) => invoke<Exam>('start_exam_section', { sessionId }),
  endSection: (sessionId: string, position: number) =>
    invoke<Exam>('end_exam_section', { sessionId, position }),
}

export type ExamApi = typeof examApi
