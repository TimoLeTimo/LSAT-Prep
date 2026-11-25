import type { ReactNode } from 'react'

interface CheckProps {
  type?: 'checkbox' | 'radio'
  name?: string
  label: string
  checked: boolean
  onChange: () => void
}

export function Check({ type = 'checkbox', name, label, checked, onChange }: CheckProps) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-1 size-4 shrink-0 accent-rose-accent"
      />
      <span>{label}</span>
    </label>
  )
}

interface NumberFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  /** Shown beside the field, such as what is available or what is wrong. */
  help: string
  isInvalid: boolean
}

export function NumberField({ id, label, value, onChange, help, isInvalid }: NumberFieldProps) {
  return (
    <div>
      <label className="font-semibold" htmlFor={id}>
        {label}
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <input
          id={id}
          inputMode="numeric"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={`${id}-help`}
          aria-invalid={isInvalid}
          className="w-24 rounded-lg border border-line bg-surface px-3 py-2"
        />
        <span id={`${id}-help`} role="status" className="text-sm text-muted">
          {help}
        </span>
      </div>
    </div>
  )
}

export function Group({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="font-semibold">{legend}</legend>
      {children}
    </fieldset>
  )
}

export function StartError({ message }: { message: string | null }) {
  if (message === null) return null
  return (
    <p role="alert" className="rounded-lg border border-rose-accent bg-blush p-4">
      {message}
    </p>
  )
}
