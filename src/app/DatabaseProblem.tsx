import { PageHeading } from '../components/PageHeading'

export function DatabaseProblem({ message }: { message: string }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16" role="alert">
      <PageHeading>Your data could not be opened</PageHeading>
      <div className="mt-8 space-y-4 rounded-2xl border border-line bg-surface p-8 shadow-card">
        <p>{message}</p>
        <p className="text-muted">
          LSAT Prep has not deleted or reset your data. Close the app and open it again. If this
          message returns, keep the data file where it is and ask for help before changing it.
        </p>
      </div>
    </main>
  )
}
