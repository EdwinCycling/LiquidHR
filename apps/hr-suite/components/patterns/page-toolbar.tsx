import type { HTMLAttributes, ReactNode } from 'react'

export type PageToolbarProps = HTMLAttributes<HTMLDivElement> & {
  start?: ReactNode
  end?: ReactNode
}

export function PageToolbar({ className, end, start, ...props }: PageToolbarProps) {
  return (
    <div {...props} className={`flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className ?? ''}`.trim()}>
      {start ? <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{start}</div> : <span aria-hidden="true" />}
      {end ? <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{end}</div> : null}
    </div>
  )
}
