import type { SessionConfig } from '../../data/practiceSession'
import { difficultyNames } from '../../domain/content/names'
import { DIFFICULTIES, type Difficulty } from '../../domain/content/types'
import { Check, Group, NumberField } from './fields'
import type { TimeLimit } from './useTimeLimit'
import { toggle } from './wholeNumber'

interface DifficultyFieldsProps {
  value: Difficulty[]
  onChange: (value: Difficulty[]) => void
}

export function DifficultyFields({ value, onChange }: DifficultyFieldsProps) {
  return (
    <Group legend="Difficulty">
      <p className="text-sm text-muted">Choose none to include all.</p>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        {DIFFICULTIES.map((level) => (
          <Check
            key={level}
            label={difficultyNames[level]}
            checked={value.includes(level)}
            onChange={() => onChange(toggle(value, level))}
          />
        ))}
      </div>
    </Group>
  )
}

export function TimeFields({ time }: { time: TimeLimit }) {
  return (
    <Group legend="Time">
      <div className="mt-3 space-y-2">
        <Check
          type="radio"
          name="timing"
          label="Untimed"
          checked={!time.isTimed}
          onChange={() => time.setIsTimed(false)}
        />
        <Check
          type="radio"
          name="timing"
          label="Timed"
          checked={time.isTimed}
          onChange={() => time.setIsTimed(true)}
        />
      </div>
      {time.isTimed && (
        <div className="mt-3">
          <NumberField
            id="minutes"
            label="Minutes"
            value={time.minutes}
            onChange={time.setMinutes}
            help={time.problem ?? 'The timer pauses when you leave the session.'}
            isInvalid={time.problem !== null}
          />
        </div>
      )}
    </Group>
  )
}

interface ExplanationFieldsProps {
  value: SessionConfig['explanations']
  onChange: (value: SessionConfig['explanations']) => void
}

export function ExplanationFields({ value, onChange }: ExplanationFieldsProps) {
  return (
    <Group legend="Explanations">
      <div className="mt-3 space-y-2">
        <Check
          type="radio"
          name="explanations"
          label="After each question (checking an answer locks it)"
          checked={value === 'after_each'}
          onChange={() => onChange('after_each')}
        />
        <Check
          type="radio"
          name="explanations"
          label="At the end (answers can change until you finish)"
          checked={value === 'at_end'}
          onChange={() => onChange('at_end')}
        />
      </div>
    </Group>
  )
}
