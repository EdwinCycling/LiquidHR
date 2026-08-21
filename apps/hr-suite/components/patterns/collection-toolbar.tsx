import type { ReactNode } from 'react'
import { PageToolbar } from './page-toolbar'

export type CollectionToolbarProps = {
  search?: ReactNode
  filters?: ReactNode
  sort?: ReactNode
  view?: ReactNode
  createAction?: ReactNode
  actions?: ReactNode
  context?: ReactNode
  className?: string
}

export function CollectionToolbar({ actions, className, context, createAction, filters, search, sort, view }: CollectionToolbarProps) {
  const secondary = [filters, sort, view, actions, context].filter(Boolean)

  return (
    <div className={`grid gap-3 ${className ?? ''}`.trim()}>
      <PageToolbar end={createAction} start={search} />
      {secondary.length > 0 ? <div className="flex min-w-0 flex-wrap items-center gap-2">{secondary.map((item, index) => <span key={index}>{item}</span>)}</div> : null}
    </div>
  )
}
