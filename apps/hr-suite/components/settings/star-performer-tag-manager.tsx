'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { PencilLine, Plus, Search, Tag } from 'lucide-react'
import type { StarPerformerTag } from '@/lib/star-performers/service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { Switch } from '@/components/ui/switch'
import { TextInput } from '@/components/ui/text-input'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { CollectionToolbar } from '@/components/patterns/collection-toolbar'
import { EmptyState } from '@/components/ui/empty-state'
import { EntityList } from '@/components/patterns/entity-list'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { RowActions } from '@/components/patterns/row-actions'

interface StarPerformerTagManagerLabels {
  tagManagerCardTitle: string
  tagName: string
  tagActive: string
  inactive: string
  createTag: string
  updateTag: string
  editTag: string
  newTag: string
  usageCount: string
  tagListTitle: string
  tagSearchPlaceholder: string
  tagEmpty: string
  tagSaved: string
  tagSaveFailed: string
  moreActions: string
  cancel: string
  close: string
  saving: string
  discardTitle: string
  discardDescription: string
  discardConfirm: string
  discardCancel: string
  deactivateTitle: string
  deactivateDescription: string
  deactivateConfirm: string
  activate: string
  deactivate: string
  writeRequired: string
}

type EditorState = {
  id: string | null
  name: string
  isActive: boolean
  initialValues: string
}

function editorValues(id: string | null, name: string, isActive: boolean): string {
  return JSON.stringify({ id, name, isActive })
}

export function StarPerformerTagManager({
  canWrite,
  initialTags,
  labels,
}: {
  canWrite: boolean
  initialTags: StarPerformerTag[]
  labels: StarPerformerTagManagerLabels
}) {
  const [tags, setTags] = useState(initialTags)
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [toggleCandidate, setToggleCandidate] = useState<StarPerformerTag | null>(null)

  const visibleTags = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('nl-NL')
    return tags.filter((tag) => !query || tag.name.toLocaleLowerCase('nl-NL').includes(query))
  }, [search, tags])

  function openCreate(): void {
    const name = ''
    const isActive = true
    setFeedback(null)
    setEditor({ id: null, name, isActive, initialValues: editorValues(null, name, isActive) })
  }

  function openEdit(tag: StarPerformerTag): void {
    setFeedback(null)
    setEditor({ id: tag.id, name: tag.name, isActive: tag.isActive, initialValues: editorValues(tag.id, tag.name, tag.isActive) })
  }

  function closeEditor(): void {
    setEditor(null)
    setFeedback(null)
  }

  function updateEditor(next: Partial<Pick<EditorState, 'name' | 'isActive'>>): void {
    setEditor((current) => current ? { ...current, ...next } : current)
    setFeedback(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!editor || saving || !canWrite) return

    setSaving(true)
    setFeedback(null)
    try {
      const response = await fetch(editor.id ? `/api/star-performer-tags/${editor.id}` : '/api/star-performer-tags', {
        method: editor.id ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(editor.id ? { name: editor.name, isActive: editor.isActive } : { name: editor.name }),
      })

      if (!response.ok) {
        setFeedback(labels.tagSaveFailed)
        return
      }

      if (editor.id) {
        setTags((current) => current.map((tag) => tag.id === editor.id ? { ...tag, name: editor.name.trim(), isActive: editor.isActive } : tag))
      } else {
        const payload = await response.json() as { data: { id: string } }
        setTags((current) => [...current, { id: payload.data.id, name: editor.name.trim(), isActive: true, usageCount: 0 }].sort((left, right) => left.name.localeCompare(right.name, 'nl-NL')))
      }

      closeEditor()
      setFeedback(labels.tagSaved)
    } catch {
      setFeedback(labels.tagSaveFailed)
    } finally {
      setSaving(false)
    }
  }

  async function setActive(tag: StarPerformerTag, isActive: boolean): Promise<void> {
    if (saving || !canWrite) return
    setSaving(true)
    setFeedback(null)
    try {
      const response = await fetch(`/api/star-performer-tags/${tag.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: tag.name, isActive }),
      })
      if (!response.ok) {
        setFeedback(labels.tagSaveFailed)
        return
      }
      setTags((current) => current.map((item) => item.id === tag.id ? { ...item, isActive } : item))
      setFeedback(labels.tagSaved)
    } catch {
      setFeedback(labels.tagSaveFailed)
    } finally {
      setSaving(false)
      setToggleCandidate(null)
    }
  }

  const dirty = editor ? editorValues(editor.id, editor.name, editor.isActive) !== editor.initialValues : false

  return (
    <div className="space-y-6">
      <Surface className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-accent text-primary">
                <Tag className="size-4" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-foreground">{labels.tagManagerCardTitle}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{tags.length} · {labels.tagListTitle}</p>
              </div>
            </div>
            {!canWrite ? <p className="mt-4 border border-warning/40 bg-warning-surface px-3 py-2 text-sm text-warning" role="status">{labels.writeRequired}</p> : null}
          </div>
          {canWrite ? <Button onClick={openCreate} size="sm" type="button"><Plus aria-hidden="true" />{labels.newTag}</Button> : null}
        </div>
      </Surface>

      <CollectionToolbar
        createAction={canWrite ? <Button onClick={openCreate} size="sm" type="button"><Plus aria-hidden="true" />{labels.createTag}</Button> : undefined}
        search={<TextInput aria-label={labels.tagSearchPlaceholder} leadingIcon={<Search aria-hidden="true" />} onChange={(event) => setSearch(event.currentTarget.value)} placeholder={labels.tagSearchPlaceholder} value={search} />}
      />

      {feedback ? <p aria-live="polite" className="border border-subtle bg-surface px-4 py-3 text-sm text-muted-foreground">{feedback}</p> : null}

      <section aria-labelledby="star-performer-tag-list-title">
        <h2 className="sr-only" id="star-performer-tag-list-title">{labels.tagListTitle}</h2>
        <EntityList
          ariaLabel={labels.tagListTitle}
          empty={<EmptyState icon={<Tag />} title={labels.tagEmpty} />}
          items={visibleTags.map((tag) => ({
            actions: canWrite ? <RowActions
              menuItems={[{
                destructive: tag.isActive,
                id: tag.isActive ? 'deactivate' : 'activate',
                label: tag.isActive ? labels.deactivate : labels.activate,
                onSelect: () => tag.isActive ? setToggleCandidate(tag) : void setActive(tag, true),
              }]}
              menuLabel={labels.moreActions}
              primaryAction={<Button onClick={() => openEdit(tag)} size="sm" type="button" variant="secondary"><PencilLine aria-hidden="true" />{labels.editTag}</Button>}
            /> : undefined,
            badges: <Badge tone={tag.isActive ? 'success' : 'neutral'}>{tag.isActive ? labels.tagActive : labels.inactive}</Badge>,
            id: tag.id,
            primary: tag.name,
            secondary: `${labels.usageCount}: ${tag.usageCount}`,
          }))}
        />
      </section>

      {editor ? <FormDrawer
        cancelLabel={labels.cancel}
        closeLabel={labels.close}
        description={labels.tagManagerCardTitle}
        dirty={dirty}
        dirtyProtection={{ description: labels.discardDescription, discardLabel: labels.discardConfirm, keepEditingLabel: labels.discardCancel, title: labels.discardTitle }}
        onDiscard={closeEditor}
        onOpenChange={(open) => { if (!open && !dirty) closeEditor() }}
        onSubmit={(event) => void submit(event)}
        open
        saveLabel={editor.id ? labels.updateTag : labels.createTag}
        saving={saving}
        title={editor.id ? labels.editTag : labels.newTag}
      >
        <FormField control={<TextInput maxLength={80} onChange={(event) => updateEditor({ name: event.currentTarget.value })} required value={editor.name} />} label={labels.tagName} required />
        {editor.id ? <FormField control={<Switch checked={editor.isActive} onChange={(event) => updateEditor({ isActive: event.currentTarget.checked })} />} label={labels.tagActive} /> : null}
      </FormDrawer> : null}

      <ConfirmDialog
        cancelLabel={labels.cancel}
        confirmLabel={labels.deactivateConfirm}
        description={labels.deactivateDescription}
        destructive
        onConfirm={() => toggleCandidate ? setActive(toggleCandidate, false) : Promise.resolve()}
        onOpenChange={(open) => { if (!open && !saving) setToggleCandidate(null) }}
        open={toggleCandidate !== null}
        pending={saving}
        title={labels.deactivateTitle}
      />
    </div>
  )
}
