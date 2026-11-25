import { Icon } from './Icon'

export function BackLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      className="mb-6 inline-flex items-center gap-2 rounded-md py-1 text-sm font-medium text-rose-deep hover:underline"
    >
      <Icon name="back" className="size-4" />
      {children}
    </a>
  )
}
