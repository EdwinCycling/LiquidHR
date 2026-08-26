'use client'

import { Download, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { FilterBar, type FilterBarProps } from '@/components/patterns/filter-bar'

export interface InsightActiveFilter {
  key: string
  label: string
  value?: string
  onRemove?: () => void
}

export interface InsightExportLabels {
  loading: string
  success: string
  error: string
}

export function InsightsFilterBar({ actions, children, className, ...props }: FilterBarProps) {
  return <FilterBar {...props} actions={actions ? <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">{actions}</div> : undefined} className={`flex-col items-stretch sm:flex-row sm:items-end ${className ?? ''}`.trim()}>{children}</FilterBar>
}

export function InsightsActiveFilters({
  clearLabel,
  filters,
  label,
  onClear,
  onReset,
  removeLabel,
  resetLabel,
  selectedCount,
  selectedCountLabel,
}: {
  clearLabel?: string
  filters: readonly InsightActiveFilter[]
  label: string
  onClear?: () => void
  onReset?: () => void
  removeLabel: string
  resetLabel?: string
  selectedCount?: number
  selectedCountLabel?: string
}) {
  const count = selectedCount ?? filters.length
  if (!filters.length && !onClear && !onReset) return null
  return <div aria-label={label} className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
    <span className="font-medium text-muted-foreground">{label}</span>
    {selectedCountLabel ? <span className="rounded-md border border-border-subtle bg-muted px-2 py-0.5 text-xs font-medium">{selectedCountLabel.replace('{count}', String(count))}</span> : null}
    {filters.map((filter) => {
      const text = filter.value ? `${filter.label}: ${filter.value}` : filter.label
      return filter.onRemove ? <button aria-label={removeLabel.replace('{filter}', text)} className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-md border border-info-border bg-info-surface px-2 py-0.5 text-left text-xs font-medium text-info hover:border-primary focus-visible:outline-2 focus-visible:outline-focus" key={filter.key} onClick={filter.onRemove} type="button"><span className="truncate">{text}</span><X aria-hidden="true" className="size-3.5 shrink-0" /></button> : <span className="inline-flex min-w-0 max-w-full items-center rounded-md border border-info-border bg-info-surface px-2 py-0.5 text-xs font-medium text-info" key={filter.key}><span className="truncate">{text}</span></span>
    })}
    {count > 0 && clearLabel && onClear ? <Button onClick={onClear} size="sm" type="button" variant="ghost">{clearLabel}</Button> : null}
    {resetLabel && onReset ? <Button onClick={onReset} size="sm" type="button" variant="ghost">{resetLabel}</Button> : null}
  </div>
}

export function InsightsExportAction({ fileName, href, labels, label }: { fileName: string; href: string; labels: InsightExportLabels; label: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  async function exportReport(): Promise<void> {
    if (status === 'loading') return
    setStatus('loading')
    try {
      const response = await fetch(href, { cache: 'no-store' })
      if (!response.ok) throw new Error('INSIGHTS_EXPORT_FAILED')
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = fileName
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  const statusMessage: ReactNode = status === 'success' ? labels.success : status === 'error' ? labels.error : null
  return <span className="inline-flex min-w-0 flex-wrap items-center gap-2"><Button aria-describedby={statusMessage ? `${fileName}-export-status` : undefined} loading={status === 'loading'} onClick={() => { void exportReport() }} size="md" type="button" variant="secondary"><Download aria-hidden="true" />{label}</Button>{statusMessage ? <span aria-live="polite" className="text-xs text-muted-foreground" id={`${fileName}-export-status`}>{statusMessage}</span> : null}</span>
}
