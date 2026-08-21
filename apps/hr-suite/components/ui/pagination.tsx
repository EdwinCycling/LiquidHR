'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './button'

type PageItem = number | 'ellipsis'

export function pageItems(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= 0) return []
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)
  if (currentPage <= 4) return [1, 2, 3, 4, 5, 'ellipsis', totalPages]
  if (currentPage >= totalPages - 3) return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages]
}

export type PaginationProps = {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  ariaLabel: string
  previousLabel: string
  nextLabel: string
}

export function Pagination({ ariaLabel, currentPage, nextLabel, onPageChange, previousLabel, totalPages }: PaginationProps) {
  if (totalPages <= 0) return null
  const items = pageItems(currentPage, totalPages)
  const pageButtonClass = 'min-w-9 px-2'

  return (
    <nav aria-label={ariaLabel}>
      <ul className="flex flex-wrap items-center gap-1">
        <li>
          <Button aria-label={previousLabel} disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} size="sm" type="button" variant="secondary">
            <ChevronLeft aria-hidden="true" /><span className="hidden sm:inline">{previousLabel}</span>
          </Button>
        </li>
        {items.map((item, index) => item === 'ellipsis' ? (
          <li aria-hidden="true" className="px-1 text-muted-foreground" key={`ellipsis-${index}`}>…</li>
        ) : (
          <li key={item}>
            <Button aria-current={item === currentPage ? 'page' : undefined} aria-label={String(item)} className={pageButtonClass} onClick={() => onPageChange(item)} size="sm" type="button" variant={item === currentPage ? 'primary' : 'secondary'}>{item}</Button>
          </li>
        ))}
        <li>
          <Button aria-label={nextLabel} disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)} size="sm" type="button" variant="secondary">
            <span className="hidden sm:inline">{nextLabel}</span><ChevronRight aria-hidden="true" />
          </Button>
        </li>
      </ul>
    </nav>
  )
}
