import type { HTMLAttributes, ReactNode } from 'react'

export type EmptyStateProps = Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'children'> & {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
}

export function EmptyState({ actions, className, description, icon, title, ...props }: EmptyStateProps) {
  return (
    <div {...props} className={`flex flex-col items-center justify-center rounded-[var(--radius-surface)] border border-dashed border-subtle bg-surface-subtle px-6 py-8 text-center ${className ?? ''}`.trim()}>
      {icon ? <div className="mb-3 text-muted-foreground [&>svg]:size-6" aria-hidden="true">{icon}</div> : null}
      <div className="text-base font-semibold text-foreground">{title}</div>
      {description ? <div className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</div> : null}
      {actions ? <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
    </div>
  )
}
