import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from '../../components/Button'
import type { ImportPlan } from '../../data/questionImport'
import type { Issue } from '../../domain/content/validatePackage'
import { count } from './count'
import { describePath } from './describePath'
import { useImport, type ImportState } from './useImport'

export function ImportPanel({ onRecorded }: { onRecorded: () => void }) {
  const { state, start, review, back, confirm, cancel } = useImport(onRecorded)
  const heading = useRef<HTMLHeadingElement>(null)
  const previousStep = useRef(state.step)

  // Move keyboard focus to the new step so it is announced and Tab continues from there.
  useEffect(() => {
    if (previousStep.current === state.step) return
    previousStep.current = state.step
    heading.current?.focus()
  }, [state.step])

  const chooseAnother = (
    <Actions>
      <Button onClick={start}>Choose Another File</Button>
      <Button variant="secondary" onClick={cancel}>
        Close
      </Button>
    </Actions>
  )

  return (
    <section
      aria-labelledby="import-step"
      className="mt-8 rounded-2xl border border-line bg-surface p-8 shadow-card"
    >
      <h2
        id="import-step"
        ref={heading}
        tabIndex={-1}
        className="font-serif text-2xl font-semibold outline-none"
      >
        {titles[state.step]}
      </h2>
      <div className="mt-4 space-y-4">{renderStep()}</div>
    </section>
  )

  function renderStep(): ReactNode {
    switch (state.step) {
      case 'idle':
      case 'choosing':
        return (
          <>
            <p className="text-muted">
              Choose an LSAT Prep question package, which is a JSON file. Importing works offline,
              and you will see a preview before anything is added.
            </p>
            <Actions>
              <Button onClick={start} disabled={state.step === 'choosing'}>
                Import Questions
              </Button>
            </Actions>
          </>
        )
      case 'validating':
        return (
          <>
            <p role="status">Checking the whole file. Nothing has been added.</p>
            <Actions>
              <Button variant="secondary" onClick={cancel}>
                Cancel
              </Button>
            </Actions>
          </>
        )
      case 'invalid':
        return (
          <>
            <p>
              Nothing was imported. The file has {count(state.errorCount, 'problem')} to fix.
              {state.errorCount > state.errors.length && ` The first ${state.errors.length} are shown.`}
            </p>
            <IssueList issues={state.errors} />
            {chooseAnother}
          </>
        )
      case 'blocked':
        return (
          <>
            <p>
              Nothing was imported. The package{' '}
              <strong className="wrap-anywhere">{state.plan.display_name}</strong> cannot be added.
            </p>
            <ul className={listStyle}>
              {state.plan.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
            {chooseAnother}
          </>
        )
      case 'preview':
        return (
          <>
            <p>Nothing has been added yet.</p>
            <PlanDetails plan={state.plan} categoryNames={state.categoryNames} />
            {state.warnings.length > 0 && (
              <>
                <h3 className="font-semibold">Warnings</h3>
                <IssueList issues={state.warnings} />
              </>
            )}
            <Actions>
              <Button onClick={review}>Continue</Button>
              <Button variant="secondary" onClick={cancel}>
                Cancel
              </Button>
            </Actions>
          </>
        )
      case 'confirming': {
        const { plan } = state.preview
        return (
          <>
            <p>
              This adds {count(plan.questions.new.length, 'new question')} from{' '}
              <strong className="wrap-anywhere">{plan.display_name}</strong> to your question bank.
            </p>
            <p>
              Existing questions, attempts, bookmarks, sessions, settings, and statistics will not be
              changed. If anything goes wrong, the whole import is undone.
            </p>
            <Actions>
              <Button onClick={confirm}>Import {count(plan.questions.new.length, 'Question')}</Button>
              <Button variant="secondary" onClick={back}>
                Back
              </Button>
              <Button variant="secondary" onClick={cancel}>
                Cancel
              </Button>
            </Actions>
          </>
        )
      }
      case 'importing':
        return <p role="status">Adding questions. Please keep LSAT Prep open.</p>
      case 'done':
        return (
          <>
            <p>
              Added {addedText(state.plan)}.
              {skippedCount(state.plan) > 0 &&
                ` Skipped ${count(skippedCount(state.plan), 'item')} already in the app.`}
            </p>
            <Actions>
              <Button onClick={cancel}>Done</Button>
            </Actions>
          </>
        )
      case 'failed':
        return (
          <>
            <p className="whitespace-pre-line wrap-anywhere">{state.message}</p>
            {chooseAnother}
          </>
        )
    }
  }
}

const titles: Record<ImportState['step'], string> = {
  idle: 'Import Questions',
  choosing: 'Import Questions',
  validating: 'Checking File',
  invalid: 'This File Cannot Be Imported',
  blocked: 'This Package Cannot Be Imported',
  preview: 'Preview',
  confirming: 'Confirm Import',
  importing: 'Importing',
  done: 'Import Complete',
  failed: 'Import Stopped',
}

const listStyle =
  'max-h-80 list-disc space-y-2 overflow-y-auto rounded-lg border border-line bg-canvas py-4 pr-4 pl-9 wrap-anywhere'

function Actions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-3 pt-2">{children}</div>
}

function skippedCount({ categories, passages, questions }: ImportPlan) {
  return categories.skipped.length + passages.skipped.length + questions.skipped.length
}

function addedText({ categories, passages, questions }: ImportPlan) {
  const parts = [count(questions.new.length, 'question')]
  if (passages.new.length > 0) parts.push(count(passages.new.length, 'passage'))
  if (categories.new.length > 0) parts.push(count(categories.new.length, 'category', 'categories'))
  return parts.join(', ')
}

function IssueList({ issues }: { issues: Issue[] }) {
  return (
    <ul className={listStyle} tabIndex={0} aria-label="Details">
      {issues.map(({ path, message }, index) => (
        // The list never changes while shown, so positions are stable keys.
        <li key={index}>
          {message}
          {path !== '' && <span className="block text-sm text-muted">Where: {describePath(path)}</span>}
        </li>
      ))}
    </ul>
  )
}

function PlanDetails({ plan, categoryNames }: { plan: ImportPlan; categoryNames: Map<string, string> }) {
  const { questions, passages, categories } = plan
  const rows = [
    { name: 'Questions', items: questions },
    { name: 'Passages', items: passages },
    { name: 'Categories', items: categories },
  ]
  const skipped = rows.flatMap(({ items }) => items.skipped)
  const total = plan.lr_questions + plan.rc_questions
  return (
    <>
      <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-[auto_1fr]">
        <dt className="text-muted">Package</dt>
        <dd className="wrap-anywhere">{plan.display_name}</dd>
        <dt className="text-muted">Version</dt>
        <dd>{plan.package_version}</dd>
        <dt className="text-muted">Package ID</dt>
        <dd className="wrap-anywhere">{plan.package_id}</dd>
        <dt className="text-muted">Questions in file</dt>
        <dd>
          {total} ({plan.lr_questions} Logical Reasoning, {plan.rc_questions} Reading Comprehension)
        </dd>
      </dl>
      <table className="w-full text-left">
        <thead className="border-b border-line text-sm text-muted">
          <tr>
            <th className="py-2 font-medium">Content</th>
            <th className="py-2 font-medium">New</th>
            <th className="py-2 font-medium">Already in the app (skipped)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ name, items }) => (
            <tr key={name} className="border-b border-line">
              <th className="py-2 font-normal">{name}</th>
              <td>{items.new.length}</td>
              <td>{items.skipped.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <details>
        <summary className="cursor-pointer rounded-md font-medium">Questions by category</summary>
        <ul className={`mt-2 ${listStyle}`}>
          {plan.questions_by_category.map(({ id, questions: number }) => (
            <li key={id}>
              {categoryNames.get(id) ?? id}: {number}
            </li>
          ))}
        </ul>
      </details>
      {skipped.length > 0 && (
        <details>
          <summary className="cursor-pointer rounded-md font-medium">Skipped items</summary>
          <ul className={`mt-2 ${listStyle}`}>
            {rows.flatMap(({ name, items }) =>
              items.skipped.map((id) => <li key={`${name}-${id}`}>{id}</li>),
            )}
          </ul>
        </details>
      )}
    </>
  )
}
