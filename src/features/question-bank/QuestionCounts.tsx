import { useState, type ReactNode } from 'react'
import type { QuestionIndex } from '../../data/questionBank'
import { DIFFICULTIES, type Difficulty, type Section } from '../../domain/content/types'
import { filterQuestions } from '../../domain/practice/filterQuestions'
import { count } from './count'

const difficultyNames: Record<Difficulty, string> = {
  1: 'Introductory',
  2: 'Standard',
  3: 'Challenging',
  4: 'Advanced',
}

const sectionNames: Record<Section, string> = {
  logical_reasoning: 'Logical Reasoning',
  reading_comprehension: 'Reading Comprehension',
}

export function QuestionCounts({ index }: { index: QuestionIndex | string | null }) {
  return (
    <section className="mt-12" aria-labelledby="question-counts">
      <h2 id="question-counts" className="font-serif text-2xl font-semibold">
        Available Questions
      </h2>
      {typeof index === 'string' && <p className="mt-4 text-muted">{index}</p>}
      {index !== null && typeof index !== 'string' && <Filters index={index} />}
    </section>
  )
}

function Filters({ index }: { index: QuestionIndex }) {
  const [section, setSection] = useState<Section | ''>('')
  const [category, setCategory] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty | 0>(0)

  const categories = index.categories.filter((item) => section === '' || item.section === section)
  const found = filterQuestions(index.questions, {
    section: section || null,
    categoryIds: category === '' ? [] : [category],
    difficulties: difficulty === 0 ? [] : [difficulty],
  })

  return (
    <div className="mt-4 rounded-2xl border border-line bg-surface p-6 shadow-card">
      <div className="grid gap-4 sm:grid-cols-3">
        <Select
          label="Section"
          value={section}
          onChange={(value) => {
            setSection(value as Section | '')
            setCategory('') // it may belong to the other section
          }}
        >
          <option value="">All sections</option>
          <option value="logical_reasoning">{sectionNames.logical_reasoning}</option>
          <option value="reading_comprehension">{sectionNames.reading_comprehension}</option>
        </Select>
        <Select label="Category" value={category} onChange={setCategory}>
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {section === '' ? `${sectionNames[item.section]}: ${item.name}` : item.name}
            </option>
          ))}
        </Select>
        <Select
          label="Difficulty"
          value={String(difficulty)}
          onChange={(value) => setDifficulty(Number(value) as Difficulty | 0)}
        >
          <option value="0">All difficulties</option>
          {DIFFICULTIES.map((level) => (
            <option key={level} value={level}>
              {level} – {difficultyNames[level]}
            </option>
          ))}
        </Select>
      </div>
      <p className="mt-5 text-lg font-medium" role="status">
        {count(found.length, 'question')}
      </p>
    </div>
  )
}

interface SelectProps {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}

function Select({ label, value, onChange, children }: SelectProps) {
  return (
    <label className="block min-w-0">
      <span className="text-sm text-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2"
      >
        {children}
      </select>
    </label>
  )
}
