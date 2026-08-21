import type { ReactNode } from 'react'
import { Pagination, type PaginationProps } from '@/components/ui/pagination'

export type CollectionPaginationProps = {
  resultRange?: ReactNode
  pageSize?: ReactNode
  pagination?: PaginationProps
  className?: string
}

export function CollectionPagination({ className, pageSize, pagination, resultRange }: CollectionPaginationProps) {
  if (!resultRange && !pageSize && !pagination) return null

  return (
    <div className={`flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className ?? ''}`.trim()}>
      <div className="flex min-w-0 flex-wrap items-center gap-3 text-sm text-muted-foreground">{resultRange}{pageSize}</div>
      {pagination ? <Pagination {...pagination} /> : null}
    </div>
  )
}
