import { useState } from 'react'
import { SelectField } from '../../components/SelectField'
import type { QuestionIndex } from '../../data/questionBank'
import { difficultyNames, sectionNames } from '../../domain/content/names'
import { DIFFICULTIES, type Difficulty, type Section } from '../../domain/content/types'
import { filterQuestions } from '../../domain/practice/filterQuestions'
import { count } from '../../components/count'

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
        <SelectField
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
        </SelectField>
        <SelectField label="Category" value={category} onChange={setCategory}>
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {section === '' ? `${sectionNames[item.section]}: ${item.name}` : item.name}
            </option>
          ))}
        </SelectField>
        <SelectField
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
        </SelectField>
      </div>
      <p className="mt-5 text-lg font-medium" role="status">
        {count(found.length, 'question')}
      </p>
    </div>
  )
}
