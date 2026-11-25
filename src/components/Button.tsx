import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
}

const styles = {
  primary: 'border-rose-accent bg-rose-accent text-white hover:border-rose-deep hover:bg-rose-deep',
  secondary: 'border-line bg-surface text-ink hover:bg-blush',
}

export function Button({ variant = 'primary', ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`cursor-pointer rounded-lg border px-5 py-2.5 font-medium transition-colors disabled:cursor-default disabled:opacity-60 ${styles[variant]}`}
      {...props}
    />
  )
}
