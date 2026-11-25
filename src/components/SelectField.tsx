import type { ReactNode } from 'react'
import { Icon } from './Icon'

interface SelectFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}

export function SelectField({ label, value, onChange, children }: SelectFieldProps) {
  return (
    <label className="block min-w-0">
      <span className="text-sm text-muted">{label}</span>
      {/* Drawn here because each system styles these differently. */}
      <span className="relative mt-1 block">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="block w-full appearance-none rounded-lg border border-line bg-surface py-2 pr-10 pl-3"
        >
          {children}
        </select>
        <Icon
          name="down"
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
        />
      </span>
    </label>
  )
}
