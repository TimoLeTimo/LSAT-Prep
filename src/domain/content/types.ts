/**
 * Content package format, schema version 1.
 * Field names match the JSON file. See docs/CONTENT_PACKAGE_FORMAT.md.
 */
export const PACKAGE_FORMAT = 'lsat-prep-package'
export const SCHEMA_VERSION = 1

export const SECTIONS = ['logical_reasoning', 'reading_comprehension'] as const
export type Section = (typeof SECTIONS)[number]

export const CHOICE_LABELS = ['A', 'B', 'C', 'D', 'E'] as const
export type ChoiceLabel = (typeof CHOICE_LABELS)[number]

export const DIFFICULTIES = [1, 2, 3, 4] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

export const ORIGINS = [
  'original_human_written',
  'original_ai_assisted_human_reviewed',
  'licensed',
] as const
export type Origin = (typeof ORIGINS)[number]

export interface Category {
  id: string
  section: Section
  name: string
  description: string
  sort_order: number
}

export interface Provenance {
  origin: Origin
  source_material_used: string
  authoring_batch: string
  /** Required when origin is "licensed"; otherwise null. */
  license_reference: string | null
}

export interface PassageText {
  label: 'A' | 'B'
  text: string
}

/** A single passage has one text (A); a comparative passage has two (A and B). */
export interface Passage {
  id: string
  title: string
  passage_type: 'single' | 'comparative'
  texts: PassageText[]
  content_version: number
  status: 'approved'
  provenance: Provenance
}

export interface Choice {
  label: ChoiceLabel
  text: string
}

export interface Quality {
  draft_status: 'approved'
  independent_solve: 'passed'
  ambiguity_review: 'passed'
  human_review: 'passed'
  reviewer_notes: string
}

export interface Question {
  id: string
  section: Section
  primary_category: string
  secondary_tags: string[]
  difficulty: Difficulty
  /** The argument or statements. Required for LR; null for RC. */
  stimulus: string | null
  /** The question being asked. */
  prompt: string
  choices: Choice[]
  correct_choice: ChoiceLabel
  explanations: Record<ChoiceLabel, string>
  estimated_time_seconds: number | null
  /** Required for RC; null for LR. */
  passage_id: string | null
  content_version: number
  provenance: Provenance
  quality: Quality
}

export interface ContentPackage {
  format: typeof PACKAGE_FORMAT
  schema_version: typeof SCHEMA_VERSION
  package_id: string
  package_version: string
  display_name: string
  created_at: string
  categories: Category[]
  passages: Passage[]
  questions: Question[]
}
