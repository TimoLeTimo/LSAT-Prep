import { routeHref } from '../../app/routes'

export function EmptyBank({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-8 shadow-card">
      <p>{message}</p>
      <a
        href={routeHref('question-bank')}
        className="mt-3 inline-block rounded-md font-medium text-rose-deep underline"
      >
        Import questions in Question Bank Management
      </a>
    </div>
  )
}
