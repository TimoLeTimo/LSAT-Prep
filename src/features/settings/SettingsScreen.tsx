import { routeHref } from '../../app/routes'
import { BackLink } from '../../components/BackLink'
import { PageHeading } from '../../components/PageHeading'

export function SettingsScreen() {
  return (
    <>
      <BackLink href={routeHref('menu')}>Main Menu</BackLink>
      <PageHeading>Settings</PageHeading>
      <div className="mt-8 space-y-4">
        <SettingsLink
          href={routeHref('question-bank')}
          title="Question Bank Management"
          detail="Import questions and see past imports."
        />
        <SettingsLink
          href={routeHref('backup')}
          title="Backup and Restore"
          detail="Save a copy of your data, or restore one."
        />
      </div>
      <p className="mt-10 text-sm text-muted">
        LSAT Prep is an independent, unofficial study application. It is not affiliated with,
        endorsed by, or sponsored by the Law School Admission Council (LSAC). Questions in this
        application are original practice materials unless otherwise explicitly identified and
        licensed.
      </p>
    </>
  )
}

interface SettingsLinkProps {
  href: string
  title: string
  detail: string
}

function SettingsLink({ href, title, detail }: SettingsLinkProps) {
  return (
    <a
      href={href}
      className="block rounded-2xl border border-line bg-surface p-6 shadow-card transition-colors hover:border-rose-accent hover:bg-blush"
    >
      <span className="block font-serif text-xl font-semibold">{title}</span>
      <span className="mt-1 block text-muted">{detail}</span>
    </a>
  )
}
