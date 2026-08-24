'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Plus, Route, Search } from 'lucide-react'
import { CollectionToolbar } from '@/components/patterns/collection-toolbar'
import { EntityList } from '@/components/patterns/entity-list'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { TextInput } from '@/components/ui/text-input'
import type { JourneyTemplateDraft } from '@/lib/journeys'
import type { JourneyLabels } from '@/lib/journeys/labels'

export interface TemplateCatalogRow {
  readonly id: string
  readonly key: string
  readonly name: string
  readonly description: string
  readonly journeyType: JourneyTemplateDraft['journeyType']
  readonly lifecycle: 'DRAFT' | 'PUBLISHED' | 'RETIRED'
  readonly draftRevision: number
  readonly publishedVersionNumber: number | null
  readonly updatedAt: string
}

type CreateForm = {
  key: string
  nameNl: string
  nameEn: string
  journeyType: JourneyTemplateDraft['journeyType']
}

const emptyCreateForm: CreateForm = { key: '', nameNl: '', nameEn: '', journeyType: 'ONBOARDING' }

function newDraft(nameNl: string, nameEn: string, journeyType: JourneyTemplateDraft['journeyType']): JourneyTemplateDraft {
  return {
    name: { nl: nameNl, en: nameEn }, description: { nl: nameNl, en: nameEn }, journeyType,
    anchorRule: 'EMPLOYMENT_START_DATE',
    phases: [{ key: 'start', name: { nl: 'Start', en: 'Start' }, sortOrder: 10 }],
    roles: [
      { key: 'employee', name: { nl: 'Medewerker', en: 'Employee' }, required: true, cardinality: 'ONE', resolverType: 'TARGET_EMPLOYEE', resolverRoleCode: null, resolverEmployeeId: null, sortOrder: 10 },
      { key: 'manager', name: { nl: 'Manager', en: 'Manager' }, required: true, cardinality: 'ONE', resolverType: 'DIRECT_MANAGER', resolverRoleCode: null, resolverEmployeeId: null, sortOrder: 20 },
    ],
    moments: [{ key: 'welcome', phaseKey: 'start', name: { nl: 'Welkom', en: 'Welcome' }, dateOffsetDays: 0, availabilityOffsetDays: 0, sortOrder: 10 }],
    topics: [{ key: 'welcome', momentKey: 'welcome', ownerRoleKey: 'manager', topicType: 'INFORMATION', title: { nl: 'Welkom', en: 'Welcome' }, body: { nl: 'Welkom bij de organisatie.', en: 'Welcome to the organisation.' }, actionUrl: null, required: true, sortOrder: 10, audienceRoleKeys: ['employee', 'manager'] }],
  }
}

function errorCode(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) return null
  return typeof payload.error === 'string' ? payload.error : null
}

function createdTemplateId(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null || !('data' in payload)) return null
  const data = payload.data
  if (typeof data !== 'object' || data === null || !('id' in data)) return null
  return typeof data.id === 'string' && data.id.length > 0 ? data.id : null
}

function lifecycleTone(lifecycle: TemplateCatalogRow['lifecycle']): BadgeTone {
  if (lifecycle === 'PUBLISHED') return 'success'
  if (lifecycle === 'RETIRED') return 'neutral'
  return 'info'
}

function lifecycleLabel(item: TemplateCatalogRow, labels: JourneyLabels): string {
  if (item.lifecycle === 'PUBLISHED') return `${labels.published} v${item.publishedVersionNumber ?? '—'}`
  if (item.lifecycle === 'RETIRED') return labels.retired
  return labels.draft
}

export function TemplateCatalog({ items, labels, canWrite, locale }: { items: readonly TemplateCatalogRow[]; labels: JourneyLabels; canWrite: boolean; locale: 'nl' | 'en' }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB'), [locale])
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<CreateForm>(emptyCreateForm)
  const [error, setError] = useState<string | null>(null)
  const savingRef = useRef(false)
  const query = searchParams.get('q') ?? ''
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visible = useMemo(() => items.filter((item) => `${item.name} ${item.description} ${item.key}`.toLocaleLowerCase().includes(normalizedQuery)), [items, normalizedQuery])
  const formDirty = form.key.trim().length > 0 || form.nameNl.trim().length > 0 || form.nameEn.trim().length > 0 || form.journeyType !== emptyCreateForm.journeyType

  function resetForm(): void {
    setForm(emptyCreateForm)
    setError(null)
  }

  function startCreate(): void {
    resetForm()
    setOpen(true)
  }

  function updateQuery(value: string): void {
    const next = new URLSearchParams(searchParams.toString())
    const trimmed = value.trim()
    if (trimmed) next.set('q', value)
    else next.delete('q')
    const suffix = next.toString()
    router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false })
  }

  async function create(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/journeys/templates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: form.key, draft: newDraft(form.nameNl, form.nameEn, form.journeyType) }),
      })
      const payload: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        setError(response.status === 400 || response.status === 409 || response.status === 422 || errorCode(payload) === 'JOURNEY_TEMPLATE_INVALID' ? labels.invalid : labels.failed)
        return
      }
      const id = createdTemplateId(payload)
      if (!id) {
        setError(labels.failed)
        return
      }
      router.push(`/settings/journeys/templates/${id}`)
      router.refresh()
    } catch {
      setError(labels.failed)
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <CollectionToolbar
        createAction={canWrite ? <Button onClick={startCreate} type="button"><Plus aria-hidden="true" />{labels.newTemplate}</Button> : undefined}
        search={<TextInput aria-label={labels.search} className="sm:min-w-80" leadingIcon={<Search aria-hidden="true" />} onChange={(event) => updateQuery(event.currentTarget.value)} placeholder={labels.search} type="search" value={query} />}
      />

      <EntityList
        ariaLabel={labels.catalogTitle}
        empty={<EmptyState icon={<Search />} title={query.trim() ? labels.noResults : labels.noTemplates} />}
        items={visible.map((item) => ({
          badges: <Badge tone={lifecycleTone(item.lifecycle)}>{lifecycleLabel(item, labels)}</Badge>,
          id: item.id,
          primary: <span className="inline-flex min-w-0 items-start gap-2"><Route aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /><span className="min-w-0 break-words">{item.name}</span></span>,
          secondary: <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1"><span className="min-w-0 break-words">{item.description}</span><span className="font-mono text-xs">{item.key}</span><span>{labels.types[item.journeyType]}</span><time dateTime={item.updatedAt}>{labels.updated}: {dateFormatter.format(new Date(item.updatedAt))}</time></div>,
          href: `/settings/journeys/templates/${item.id}`,
        }))}
      />

      {canWrite ? <FormDrawer
        cancelLabel={labels.cancel}
        closeLabel={labels.close}
        description={labels.catalogSubtitle}
        dirty={formDirty}
        dirtyProtection={{ description: labels.discardDescription, discardLabel: labels.discardConfirm, keepEditingLabel: labels.discardCancel, title: labels.discardTitle }}
        onDiscard={resetForm}
        onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) resetForm() }}
        onSubmit={(event) => void create(event)}
        open={open}
        saveLabel={labels.create}
        saving={saving}
        title={labels.newTemplate}
      >
        {error ? <p className="border border-destructive/40 bg-destructive-surface px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}
        <FormField control={<TextInput maxLength={80} pattern="[a-z][a-z0-9_\-]*" required onChange={(event) => { const value = event.currentTarget.value; setForm((current) => ({ ...current, key: value })) }} value={form.key} />} label={labels.key} required />
        <FormField control={<TextInput required onChange={(event) => { const value = event.currentTarget.value; setForm((current) => ({ ...current, nameNl: value })) }} value={form.nameNl} />} label={`${labels.name} · ${labels.nl}`} required />
        <FormField control={<TextInput required onChange={(event) => { const value = event.currentTarget.value; setForm((current) => ({ ...current, nameEn: value })) }} value={form.nameEn} />} label={`${labels.name} · ${labels.en}`} required />
        <FormField control={<DropdownSelect aria-label={labels.type} onChange={(event) => { const value = event.target.value as JourneyTemplateDraft['journeyType']; setForm((current) => ({ ...current, journeyType: value })) }} searchable value={form.journeyType}>{Object.entries(labels.types).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</DropdownSelect>} label={labels.type} required />
      </FormDrawer> : null}
    </div>
  )
}
