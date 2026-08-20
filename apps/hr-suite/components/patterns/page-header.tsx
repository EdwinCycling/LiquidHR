import type { HTMLAttributes, ReactNode } from 'react'

export type PageHeaderProps = Omit<HTMLAttributes<HTMLElement>, 'title' | 'children'> & {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ actions, className, description, title, ...props }: PageHeaderProps) {
  return (
    <header {...props} className={`flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${className ?? ''}`.trim()}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description ? <div className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
    </header>
  )
}
