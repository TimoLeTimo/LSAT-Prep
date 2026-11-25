import { routeHref } from '../app/routes'
import { BackLink } from './BackLink'
import { PageHeading } from './PageHeading'

/** Temporary screen, replaced as each feature milestone is built. */
export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <>
      <BackLink href={routeHref('menu')}>Main Menu</BackLink>
      <PageHeading>{title}</PageHeading>
      <p className="mt-8 rounded-2xl border border-line bg-surface p-8 text-muted shadow-card">
        This screen has not been built yet.
      </p>
    </>
  )
}
