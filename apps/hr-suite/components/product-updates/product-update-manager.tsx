'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import type { ProductUpdate, ProductUpdateAudience, ProductUpdateChannel, ProductUpdateKind, ProductUpdateScope } from '@/lib/product-updates/service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { CollectionToolbar } from '@/components/patterns/collection-toolbar'
import { EntityList } from '@/components/patterns/entity-list'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { RowActions } from '@/components/patterns/row-actions'

interface ManagerLabels {
  title: string
  subtitle: string
  add: string
  edit: string
  delete: string
  deleteConfirm: string
  titleLabel: string
  summaryLabel: string
  contentLabel: string
  kindLabel: string
  channelsLabel: string
  audienceLabel: string
  activeLabel: string
  hrAdmin: string
  manager: string
  employee: string
  newFeature: string
  improvement: string
  giftWindow: string
  loginPopup: string
  topBanner: string
  dateFrom: string
  dateUntil: string
  save: string
  cancel: string
  saving: string
  failed: string
  invalid: string
  noResults: string
  scopeLabel: string
  globalScope: string
  tenantScope: string
  readOnly: string
  ownerNotice: string
  created: string
  deleted: string
  discardTitle: string
  discardDescription: string
  discardConfirm: string
  keepEditing: string
}

type Draft = {
  scope: ProductUpdateScope
  kind: ProductUpdateKind
  title: string
  summary: string
  content: string
  startsAt: string
  endsAt: string
  displayChannels: ProductUpdateChannel[]
  audienceRoles: ProductUpdateAudience[]
  isActive: boolean
}

type EditorState = { id?: string; draft: Draft; original: Draft }

const channels: ProductUpdateChannel[] = ['GIFT_WINDOW', 'LOGIN_POPUP', 'TOP_BANNER']
const audiences: ProductUpdateAudience[] = ['TENANT_ADMIN', 'DIRECT_MANAGER', 'EMPLOYEE']

function localDateTime(value: string | null): string {
  return value ? new Date(value).toISOString().slice(0, 16) : ''
}

function copyDraft(draft: Draft): Draft {
  return { ...draft, displayChannels: [...draft.displayChannels], audienceRoles: [...draft.audienceRoles] }
}

function draftFromUpdate(update: ProductUpdate | undefined, defaultScope: ProductUpdateScope): Draft {
  return update
    ? { scope: update.scope, kind: update.kind, title: update.title, summary: update.summary, content: update.content, startsAt: localDateTime(update.startsAt), endsAt: localDateTime(update.endsAt), displayChannels: [...update.displayChannels], audienceRoles: [...update.audienceRoles], isActive: update.isActive }
    : { scope: defaultScope, kind: 'IMPROVEMENT', title: '', summary: '', content: '', startsAt: '', endsAt: '', displayChannels: ['GIFT_WINDOW'], audienceRoles: ['EMPLOYEE'], isActive: true }
}

function payload(draft: Draft): object {
  return {
    scope: draft.scope,
    update: {
      kind: draft.kind,
      title: draft.title,
      summary: draft.summary,
      content: draft.content,
      startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : null,
      endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
      displayChannels: draft.displayChannels,
      audienceRoles: draft.audienceRoles,
      isActive: draft.isActive,
    },
  }
}

export function ProductUpdateManager({ initial, canManageGlobal, canManageTenant, labels }: { initial: ProductUpdate[]; canManageGlobal: boolean; canManageTenant: boolean; labels: ManagerLabels }) {
  const [items, setItems] = useState(initial)
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProductUpdate | null>(null)
  const [state, setState] = useState<'idle' | 'saving' | 'failed'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const defaultScope: ProductUpdateScope = canManageGlobal ? 'GLOBAL' : 'TENANT'
  const visible = useMemo(() => {
    const value = query.trim().toLocaleLowerCase()
    return items.filter((item) => `${item.title} ${item.summary}`.toLocaleLowerCase().includes(value))
  }, [items, query])
  const canEdit = (item: ProductUpdate): boolean => item.scope === 'GLOBAL' ? canManageGlobal : canManageTenant

  function openEditor(update?: ProductUpdate): void {
    const draft = draftFromUpdate(update, defaultScope)
    setMessage(null)
    setState('idle')
    setEditor({ id: update?.id, draft, original: copyDraft(draft) })
  }

  function updateDraft(patch: Partial<Draft>): void {
    setEditor((current) => current ? { ...current, draft: { ...current.draft, ...patch } } : current)
  }

  function toggle<T extends string>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!editor) return
    setState('saving')
    setMessage(null)
    try {
      const response = await fetch(editor.id ? `/api/product-updates/${editor.id}` : '/api/product-updates', { method: editor.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload(editor.draft)) })
      const result = await response.json() as { data?: ProductUpdate }
      if (!response.ok || !result.data) {
        setState('failed')
        setMessage(labels.failed)
        return
      }
      const saved = result.data
      setItems((current) => editor.id ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current])
      setEditor(null)
      setState('idle')
      setMessage(labels.created)
    } catch {
      setState('failed')
      setMessage(labels.failed)
    }
  }

  async function remove(): Promise<void> {
    if (!deleteTarget) return
    setState('saving')
    setMessage(null)
    try {
      const response = await fetch(`/api/product-updates/${deleteTarget.id}`, { method: 'DELETE' })
      if (!response.ok) {
        setState('failed')
        setMessage(labels.failed)
        return
      }
      setItems((current) => current.filter((item) => item.id !== deleteTarget.id))
      setDeleteTarget(null)
      setState('idle')
      setMessage(labels.deleted)
    } catch {
      setState('failed')
      setMessage(labels.failed)
    }
  }

  const labelForChannel = (channel: ProductUpdateChannel): string => channel === 'GIFT_WINDOW' ? labels.giftWindow : channel === 'LOGIN_POPUP' ? labels.loginPopup : labels.topBanner
  const labelForAudience = (role: ProductUpdateAudience): string => role === 'TENANT_ADMIN' ? labels.hrAdmin : role === 'DIRECT_MANAGER' ? labels.manager : labels.employee
  const scopeLabel = (scope: ProductUpdateScope): string => scope === 'GLOBAL' ? labels.globalScope : labels.tenantScope
  const isDirty = editor ? JSON.stringify(editor.draft) !== JSON.stringify(editor.original) : false

  return <div className="mt-8 grid gap-5">
    <CollectionToolbar
      createAction={<Button onClick={() => openEditor()} type="button"><Plus aria-hidden="true" />{labels.add}</Button>}
      search={<TextInput aria-label={labels.title} onChange={(event) => setQuery(event.target.value)} placeholder={`${labels.title}...`} type="search" value={query} />}
    />
    {canManageGlobal ? <Surface className="p-4 text-sm text-muted-foreground" variant="subtle"><p>{labels.ownerNotice}</p></Surface> : null}
    {message ? <p aria-live="polite" className="rounded-[var(--radius-control)] border border-border-subtle bg-surface-subtle px-3 py-2 text-sm text-muted-foreground">{message}</p> : null}
    {visible.length === 0 ? <Surface className="p-8 text-center text-sm text-muted-foreground" variant="subtle"><p>{labels.noResults}</p></Surface> : <EntityList
      ariaLabel={labels.title}
      items={visible.map((item) => ({
        id: item.id,
        primary: <Button className="justify-start px-0 text-left font-semibold" onClick={() => openEditor(item)} size="sm" type="button" variant="ghost">{item.title}</Button>,
        secondary: <>{item.summary}<span className="mx-2" aria-hidden="true">·</span>{scopeLabel(item.scope)}</>,
        badges: <><Badge tone={item.kind === 'NEW_FEATURE' ? 'info' : 'neutral'}>{item.kind === 'NEW_FEATURE' ? labels.newFeature : labels.improvement}</Badge><Badge tone={item.isActive ? 'success' : 'neutral'}>{item.isActive ? labels.activeLabel : labels.readOnly}</Badge>{item.displayChannels.map((channel) => <Badge key={channel}>{labelForChannel(channel)}</Badge>)}</>,
        actions: canEdit(item) ? <RowActions menuLabel={`${labels.edit}: ${item.title}`} menuItems={[{ id: 'edit', label: labels.edit, onSelect: () => openEditor(item) }, { id: 'delete', label: labels.delete, destructive: true, onSelect: () => setDeleteTarget(item) }]} /> : <Badge>{labels.readOnly}</Badge>,
      }))}
    />}
    {editor ? <FormDrawer
      cancelLabel={labels.cancel}
      closeLabel={labels.cancel}
      description={labels.subtitle}
      dirty={isDirty}
      dirtyProtection={{ title: labels.discardTitle, description: labels.discardDescription, discardLabel: labels.discardConfirm, keepEditingLabel: labels.keepEditing }}
      onDiscard={() => setEditor(null)}
      onOpenChange={(open) => { if (!open && !isDirty) setEditor(null) }}
      onSubmit={(event) => void save(event)}
      open
      saveLabel={state === 'saving' ? labels.saving : labels.save}
      saving={state === 'saving'}
      title={editor.id ? labels.edit : labels.add}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField control={<TextInput onChange={(event) => updateDraft({ title: event.target.value })} required value={editor.draft.title} />} label={labels.titleLabel} required />
        <FormField control={<TextInput onChange={(event) => updateDraft({ summary: event.target.value })} required value={editor.draft.summary} />} label={labels.summaryLabel} required />
      </div>
      <FormField control={<Textarea className="min-h-32" onChange={(event) => updateDraft({ content: event.target.value })} required value={editor.draft.content} />} label={labels.contentLabel} required />
      <div className="grid gap-4 sm:grid-cols-2">
        {!editor.id && canManageGlobal && canManageTenant ? <FormField control={<DropdownSelect onChange={(event) => updateDraft({ scope: event.target.value as ProductUpdateScope })} value={editor.draft.scope}><option value="GLOBAL">{labels.globalScope}</option><option value="TENANT">{labels.tenantScope}</option></DropdownSelect>} label={labels.scopeLabel} /> : null}
        <FormField control={<DropdownSelect onChange={(event) => updateDraft({ kind: event.target.value as ProductUpdateKind })} value={editor.draft.kind}><option value="NEW_FEATURE">{labels.newFeature}</option><option value="IMPROVEMENT">{labels.improvement}</option></DropdownSelect>} label={labels.kindLabel} />
      </div>
      <Checkbox checked={editor.draft.isActive} label={labels.activeLabel} onChange={(event) => updateDraft({ isActive: event.target.checked })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField control={<TextInput onChange={(event) => updateDraft({ startsAt: event.target.value })} type="datetime-local" value={editor.draft.startsAt} />} label={labels.dateFrom} />
        <FormField control={<TextInput onChange={(event) => updateDraft({ endsAt: event.target.value })} type="datetime-local" value={editor.draft.endsAt} />} label={labels.dateUntil} />
      </div>
      <fieldset className="grid gap-3"><legend className="text-sm font-medium text-foreground">{labels.channelsLabel}</legend>{channels.map((channel) => <Checkbox checked={editor.draft.displayChannels.includes(channel)} key={channel} label={labelForChannel(channel)} onChange={() => updateDraft({ displayChannels: toggle(editor.draft.displayChannels, channel) })} />)}</fieldset>
      <fieldset className="grid gap-3"><legend className="text-sm font-medium text-foreground">{labels.audienceLabel}</legend>{audiences.map((role) => <Checkbox checked={editor.draft.audienceRoles.includes(role)} key={role} label={labelForAudience(role)} onChange={() => updateDraft({ audienceRoles: toggle(editor.draft.audienceRoles, role) })} />)}</fieldset>
    </FormDrawer> : null}
    <ConfirmDialog cancelLabel={labels.cancel} confirmLabel={labels.delete} description={labels.deleteConfirm} destructive onConfirm={() => void remove()} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }} open={deleteTarget !== null} pending={state === 'saving'} title={labels.delete} />
  </div>
}
