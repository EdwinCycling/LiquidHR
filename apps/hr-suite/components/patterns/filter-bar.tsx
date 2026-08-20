import type { HTMLAttributes, ReactNode } from 'react'

export type FilterBarProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children: ReactNode
  actions?: ReactNode
}

export function FilterBar({ actions, children, className, ...props }: FilterBarProps) {
  return (
    <div {...props} className={`flex min-w-0 flex-wrap items-end gap-3 rounded-[var(--radius-surface)] border border-subtle bg-surface-subtle p-3 ${className ?? ''}`.trim()}>
      <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">{children}</div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
