import type { ReactNode } from 'react'
import { Surface } from '@/components/ui/surface'

export type EntityListItem = {
  id: string
  primary: ReactNode
  secondary?: ReactNode
  avatar?: ReactNode
  badges?: ReactNode
  actions?: ReactNode
  href?: string
}

export type EntityListProps = {
  items: readonly EntityListItem[]
  empty?: ReactNode
  ariaLabel?: string
  className?: string
}

export function EntityList({ ariaLabel, className, empty, items }: EntityListProps) {
  if (items.length === 0) return empty ? <>{empty}</> : null

  return (
    <Surface className={`overflow-hidden ${className ?? ''}`.trim()}>
      <ol aria-label={ariaLabel} className="divide-y divide-border-subtle">
        {items.map((item) => (
          <li className="flex min-w-0 flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5" key={item.id}>
            <div className="flex min-w-0 items-start gap-3">
              {item.avatar ? <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-muted-foreground [&_svg]:size-4">{item.avatar}</div> : null}
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                  {item.href ? <a className="min-w-0 break-words underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={item.href}>{item.primary}</a> : <span className="min-w-0 break-words">{item.primary}</span>}
                  {item.badges}
                </div>
                {item.secondary ? <div className="mt-1 min-w-0 text-sm text-muted-foreground">{item.secondary}</div> : null}
              </div>
            </div>
            {item.actions ? <div className="sm:pt-0.5">{item.actions}</div> : null}
          </li>
        ))}
      </ol>
    </Surface>
  )
}
