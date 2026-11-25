import type { DestinationId } from '../app/routes'

type IconName = DestinationId | 'settings' | 'back'

const paths: Record<IconName, string> = {
  'logical-reasoning': 'M12 4v5M12 9 6 15M12 9l6 6M4 15h4v4H4zM16 15h4v4h-4zM10 2h4v4h-4z',
  'reading-comprehension': 'M12 6C9.5 4.5 6.5 4.2 3 5v13c3.5-.8 6.5-.5 9 1 2.5-1.5 5.5-1.8 9-1V5c-3.5-.8-6.5-.5-9 1v13',
  'custom-practice': 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  'practice-tests': 'M8 4H5v17h14V4h-3M8 2h8v4H8zM9 14l2 2 4-4',
  review: 'M4 12a8 8 0 1 0 2.5-5.8L4 8.5M4 4v4.5h4.5M12 8v4l3 2',
  statistics: 'M4 4v16h16M8 16v-4M13 16V7M18 16v-6',
  settings:
    'M19.0 10.1L21.7 10.5L21.7 13.5L19.0 13.9L18.2 15.6L19.9 17.8L17.8 19.9L15.6 18.2L13.9 19.0L13.5 21.7L10.5 21.7L10.1 19.0L8.4 18.2L6.2 19.9L4.1 17.8L5.8 15.6L5.0 13.9L2.3 13.5L2.3 10.5L5.0 10.1L5.8 8.4L4.1 6.2L6.2 4.1L8.4 5.8L10.1 5.0L10.5 2.3L13.5 2.3L13.9 5.0L15.6 5.8L17.8 4.1L19.9 6.2L18.2 8.4ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  back: 'M19 12H5M11 6l-6 6 6 6',
}

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={paths[name]} />
    </svg>
  )
}
