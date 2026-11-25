import type { Difficulty, Section } from './types'

export const difficultyNames: Record<Difficulty, string> = {
  1: 'Introductory',
  2: 'Standard',
  3: 'Challenging',
  4: 'Advanced',
}

export const sectionNames: Record<Section, string> = {
  logical_reasoning: 'Logical Reasoning',
  reading_comprehension: 'Reading Comprehension',
}
