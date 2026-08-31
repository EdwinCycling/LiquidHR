'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Button, buttonClasses } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { TextInput } from '@/components/ui/text-input'
import { Dialog } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { EntityList } from '@/components/patterns/entity-list'
import { FormField } from '@/components/patterns/form-field'
import { PageHeader } from '@/components/patterns/page-header'
import { SectionHeader } from '@/components/patterns/section-header'
import type { SavedAnalysisListItem } from '@/lib/insights/saved-analysis-definition'

export interface MyAnalysesLabels {
  readonly eyebrow: string
  readonly title: string
  readonly intro: string
  readonly empty: string
  readonly emptyDescription: string
  readonly open: string
  readonly rename: string
  readonly delete: string
  readonly renameTitle: string
  readonly renameDescription: string
  readonly cancel: string
  readonly save: string
  readonly saving: string
  readonly deleteTitle: string
  readonly deleteDescription: string
  readonly deleteConfirm: string
  readonly deleted: string
  readonly updated: string
  readonly loadFailed: string
  readonly backToExplore: string
}

type ApiDefinitionPayload = {
  readonly data: SavedAnalysisListItem
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSavedAnalysisListItem(value: unknown): value is SavedAnalysisListItem {
  if (!isRecord(value)) return false
  return typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.createdAt === 'string'
    && typeof value.updatedAt === 'string'
}

function readDefinitionPayload(value: unknown): ApiDefinitionPayload | null {
  if (!isRecord(value) || !isSavedAnalysisListItem(value.data)) return null
  return { data: value.data }
}

export function MyAnalyses({ initialItems, labels, loadError = false }: { readonly initialItems: readonly SavedAnalysisListItem[]; readonly labels: MyAnalysesLabels; readonly loadError?: boolean }) {
  const [items, setItems] = useState<readonly SavedAnalysisListItem[]>(initialItems)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedForRename = items.find((item) => item.id === renameId) ?? null
  const selectedForDelete = items.find((item) => item.id === deleteId) ?? null

  function openRename(item: SavedAnalysisListItem): void {
    setRenameId(item.id)
    setRenameValue(item.name)
    setError(null)
    setFeedback(null)
  }

  async function handleRename(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!selectedForRename || !renameValue.trim()) return
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/insights/saved-analyses/${selectedForRename.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: renameValue.trim() }),
      })
      const payload: unknown = await response.json()
      const parsed = readDefinitionPayload(payload)
      if (!response.ok || !parsed) throw new Error(labels.loadFailed)
      setItems((current) => current.map((item) => item.id === parsed.data.id ? { ...item, name: parsed.data.name, updatedAt: parsed.data.updatedAt } : item))
      setRenameId(null)
      setFeedback(labels.updated)
    } catch {
      setError(labels.loadFailed)
    } finally {
      setPending(false)
    }
  }

  async function handleDelete(): Promise<void> {
    if (!selectedForDelete) return
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/insights/saved-analyses/${selectedForDelete.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(labels.loadFailed)
      setItems((current) => current.filter((item) => item.id !== selectedForDelete.id))
      setDeleteId(null)
      setFeedback(labels.deleted)
    } catch {
      setError(labels.loadFailed)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-6" data-my-analyses="v1">
      <div>
        <p className="eyebrow">{labels.eyebrow}</p>
        <PageHeader className="mt-2" description={labels.intro} title={labels.title} />
      </div>

      {loadError ? <EmptyState title={labels.loadFailed} /> : items.length === 0 ? (
        <EmptyState actions={<Link className={buttonClasses({ size: 'sm' })} href="/insights/analysis/explore">{labels.backToExplore}</Link>} description={labels.emptyDescription} title={labels.empty} />
      ) : (
        <section>
          <SectionHeader title={labels.title} />
          <EntityList
            ariaLabel={labels.title}
            className="mt-4"
            items={items.map((item) => ({
              actions: <div className="flex flex-wrap gap-2"><Button onClick={() => openRename(item)} size="sm" type="button" variant="secondary">{labels.rename}</Button><Button onClick={() => setDeleteId(item.id)} size="sm" type="button" variant="danger">{labels.delete}</Button></div>,
              href: `/insights/analysis/my-analyses/${item.id}`,
              id: item.id,
              primary: item.name,
              secondary: labels.open,
            }))}
          />
        </section>
      )}

      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      {feedback ? <p className="text-sm text-success" role="status">{feedback}</p> : null}

      <Dialog description={labels.renameDescription} onOpenChange={(open) => { if (!pending && !open) setRenameId(null) }} open={selectedForRename !== null} title={labels.renameTitle}>
        <form className="space-y-5" onSubmit={(event) => void handleRename(event)}>
          <FormField control={<TextInput onChange={(event) => setRenameValue(event.target.value)} value={renameValue} />} label={labels.rename} required />
          <div className="flex flex-wrap justify-end gap-2">
            <Button disabled={pending} onClick={() => setRenameId(null)} size="sm" type="button" variant="secondary">{labels.cancel}</Button>
            <Button disabled={!renameValue.trim()} loading={pending} size="sm" type="submit">{pending ? labels.saving : labels.save}</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        cancelLabel={labels.cancel}
        confirmLabel={labels.deleteConfirm}
        description={selectedForDelete ? `${labels.deleteDescription} ${selectedForDelete.name}` : labels.deleteDescription}
        destructive
        onConfirm={handleDelete}
        onOpenChange={(open) => { if (!pending && !open) setDeleteId(null) }}
        open={selectedForDelete !== null}
        pending={pending}
        title={labels.deleteTitle}
      />
    </div>
  )
}
