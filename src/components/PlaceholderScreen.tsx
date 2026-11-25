import { routeHref } from '../app/routes'
import { Icon } from './Icon'
import { PageHeading } from './PageHeading'

/** Temporary screen, replaced as each feature milestone is built. */
export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <>
      <a
        href={routeHref('menu')}
        className="mb-6 inline-flex items-center gap-2 rounded-md py-1 text-sm font-medium text-rose-deep hover:underline"
      >
        <Icon name="back" className="size-4" />
        Main Menu
      </a>
      <PageHeading>{title}</PageHeading>
      <p className="mt-8 rounded-2xl border border-line bg-surface p-8 text-muted shadow-card">
        This screen has not been built yet.
      </p>
    </>
  )
}
