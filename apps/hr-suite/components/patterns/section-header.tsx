import type { HTMLAttributes, ReactNode } from 'react'

export type SectionHeaderProps = Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'children'> & {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

export function SectionHeader({ actions, className, description, title, ...props }: SectionHeaderProps) {
  return (
    <div {...props} className={`flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between ${className ?? ''}`.trim()}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
    </div>
  )
}
