import type { SelectHTMLAttributes } from 'react'

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`min-h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-focus/50 disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ''}`.trim()} />
}
