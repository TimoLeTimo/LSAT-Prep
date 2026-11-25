interface ToggleButtonProps {
  isOn: boolean
  onLabel: string
  offLabel: string
  onClick: () => void
}

export function ToggleButton({ isOn, onLabel, offLabel, onClick }: ToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium ${
        isOn
          ? 'border-rose-accent bg-blush text-rose-deep'
          : 'border-line bg-surface hover:bg-blush'
      }`}
    >
      {isOn ? onLabel : offLabel}
    </button>
  )
}
