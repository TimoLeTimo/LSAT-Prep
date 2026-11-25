import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { errorMessage } from '../../data/errorMessage'
import { templateStore, type Template, type TemplateChoices } from '../../data/templates'
import { findByName } from '../../domain/practice/templateCategories'

interface TemplatePanelProps {
  /** The builder's current choices, or null if they cannot be saved yet. */
  current: TemplateChoices | null
  onUse: (choices: TemplateChoices) => string[]
}

type Asking = { kind: 'delete' | 'rename'; id: string } | { kind: 'replace'; template: Template }

export function TemplatePanel({ current, onUse }: TemplatePanelProps) {
  const [templates, setTemplates] = useState<Template[] | null>(null)
  const [name, setName] = useState('')
  const [newName, setNewName] = useState('')
  const [asking, setAsking] = useState<Asking | null>(null)
  const [messages, setMessages] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const isBusy = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)

  const load = useCallback(
    () =>
      templateStore.list().then(setTemplates, (reason) => {
        setError(errorMessage(reason, 'Your templates could not be read.'))
      }),
    [],
  )
  useEffect(() => void load(), [load])

  /** Runs one change at a time, then shows the saved list. */
  async function change(action: () => Promise<void>, done: string) {
    if (isBusy.current) return
    isBusy.current = true
    setError(null)
    setMessages([])
    try {
      await action()
      setMessages([done])
      setAsking(null)
      heading.current?.focus() // the button that was pressed may be gone
    } catch (reason) {
      setError(errorMessage(reason, 'The template could not be saved.'))
    }
    await load()
    isBusy.current = false
  }

  function ask(next: Asking | null) {
    setError(null)
    setMessages([])
    setAsking(next)
  }

  function use({ name: used, choices }: Template) {
    if (choices === null) return
    ask(null)
    setMessages([`“${used}” is loaded below.`, ...onUse(choices)])
  }

  function save() {
    if (current === null || templates === null) return
    const existing = findByName(templates, name)
    if (existing !== undefined) return ask({ kind: 'replace', template: existing })
    const trimmed = name.trim()
    void change(async () => {
      await templateStore.create(trimmed, current)
      setName('')
    }, `“${trimmed}” is saved.`)
  }

  function replace(template: Template) {
    if (current === null) return
    void change(async () => {
      await templateStore.update(template.id, current)
      setName('')
    }, `“${template.name}” is replaced.`)
  }

  return (
    <section
      aria-labelledby="templates"
      className="mb-8 rounded-2xl border border-line bg-surface p-8 shadow-card"
    >
      <h2 id="templates" ref={heading} tabIndex={-1} className="font-semibold outline-none">
        Saved templates
      </h2>
      {templates?.length === 0 && (
        <p className="mt-2 text-sm text-muted">
          Save your choices under a name to reuse them. Each use picks fresh questions.
        </p>
      )}
      {templates !== null && templates.length > 0 && (
        <ul className="mt-3 max-h-80 divide-y divide-line overflow-y-auto rounded-xl border border-line">
          {templates.map((template) => (
            <li key={template.id} className="px-5 py-3">
              {asking?.kind === 'rename' && asking.id === template.id ? (
                <form
                  className="flex flex-wrap items-center gap-3"
                  onSubmit={(event) => {
                    event.preventDefault()
                    const trimmed = newName.trim()
                    void change(
                      () => templateStore.rename(template.id, trimmed),
                      `Renamed to “${trimmed}”.`,
                    )
                  }}
                >
                  <input
                    aria-label={`New name for ${template.name}`}
                    value={newName}
                    maxLength={60}
                    onChange={(event) => setNewName(event.target.value)}
                    className="min-w-0 grow rounded-lg border border-line bg-surface px-3 py-2"
                  />
                  <Button type="submit" disabled={newName.trim() === ''}>
                    Save Name
                  </Button>
                  <Button variant="secondary" onClick={() => ask(null)}>
                    Cancel
                  </Button>
                </form>
              ) : asking?.kind === 'delete' && asking.id === template.id ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="grow wrap-anywhere" role="status">
                    Delete “{template.name}”? This cannot be undone.
                  </span>
                  <Button variant="secondary" onClick={() => ask(null)}>
                    Keep
                  </Button>
                  <Button
                    onClick={() =>
                      change(
                        () => templateStore.remove(template.id),
                        `“${template.name}” is deleted.`,
                      )
                    }
                  >
                    Delete Template
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <span className="grow wrap-anywhere">
                    {template.name}
                    {template.choices === null && (
                      <span className="block text-sm text-muted">
                        These saved choices cannot be read.
                      </span>
                    )}
                  </span>
                  {template.choices !== null && (
                    <RowButton label="Use" name={template.name} onClick={() => use(template)} />
                  )}
                  <RowButton
                    label="Rename"
                    name={template.name}
                    onClick={() => {
                      setNewName(template.name)
                      ask({ kind: 'rename', id: template.id })
                    }}
                  />
                  <RowButton
                    label="Delete"
                    name={template.name}
                    onClick={() => ask({ kind: 'delete', id: template.id })}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {templates !== null && (
        <form
          className="mt-5 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
        >
          <label className="min-w-0 grow">
            <span className="text-sm text-muted">Name for the choices below</span>
            <input
              value={name}
              maxLength={60}
              onChange={(event) => {
                setName(event.target.value)
                if (asking?.kind === 'replace') ask(null)
              }}
              className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2"
            />
          </label>
          <Button
            type="submit"
            variant="secondary"
            disabled={current === null || name.trim() === '' || asking?.kind === 'replace'}
          >
            Save Template
          </Button>
        </form>
      )}
      {asking?.kind === 'replace' && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="grow wrap-anywhere" role="status">
            Replace the choices saved as “{asking.template.name}”?
          </span>
          <Button variant="secondary" onClick={() => ask(null)}>
            Keep
          </Button>
          <Button onClick={() => replace(asking.template)} disabled={current === null}>
            Replace Template
          </Button>
        </div>
      )}
      {name.trim() !== '' && current === null && (
        <p className="mt-2 text-sm text-muted">Fix the amounts or time below before saving.</p>
      )}
      <div role="status" className="mt-3 space-y-1 text-sm">
        {messages.map((message) => (
          <p key={message} className="wrap-anywhere">
            {message}
          </p>
        ))}
      </div>
      {error !== null && (
        <p role="alert" className="mt-3 rounded-lg border border-rose-accent bg-blush p-4">
          {error}
        </p>
      )}
    </section>
  )
}

interface RowButtonProps {
  label: string
  name: string
  onClick: () => void
}

function RowButton({ label, name, onClick }: RowButtonProps) {
  return (
    <button
      type="button"
      aria-label={`${label} ${name}`}
      onClick={onClick}
      className="cursor-pointer rounded-md font-medium text-rose-deep hover:underline"
    >
      {label}
    </button>
  )
}
