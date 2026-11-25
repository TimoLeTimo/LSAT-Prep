import { Icon } from '../components/Icon'
import { PageHeading } from '../components/PageHeading'
import { destinations, routeHref } from './routes'

export function MainMenu() {
  return (
    <>
      <PageHeading>Main Menu</PageHeading>
      <nav aria-label="Main" className="mt-8">
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {destinations.map(({ id, title }) => (
            <li key={id}>
              <a
                href={routeHref(id)}
                className="group flex h-full min-h-44 flex-col justify-between gap-6 rounded-2xl border border-line bg-surface p-6 shadow-card transition-colors hover:border-rose-accent hover:bg-blush"
              >
                <span className="flex size-12 items-center justify-center rounded-xl bg-blush text-rose-accent transition-colors group-hover:bg-surface group-hover:text-rose-deep">
                  <Icon name={id} className="size-6" />
                </span>
                <span className="font-serif text-xl font-semibold">{title}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
