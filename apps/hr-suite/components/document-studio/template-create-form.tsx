'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { emptyCanonicalDocument, CATEGORY_CODES, TEMPLATE_KINDS, TEMPLATE_LANGUAGES, type TemplateKind, type TemplateLanguage } from '@/lib/document-studio/canonical-document'
import type { DocumentStudioProfileRow, DocumentStudioTypeRow } from '@/lib/document-studio/repository'

export interface TemplateCreateLabels {
  readonly title: string
  readonly templateKey: string
  readonly name: string
  readonly description: string
  readonly kind: string
  readonly language: string
  readonly documentType: string
  readonly profile: string
  readonly category: string
  readonly defaultDossier: string
  readonly save: string
  readonly cancel: string
  readonly failed: string
  readonly noOptions: string
  readonly categories: Readonly<Record<string, string>>
  readonly kinds: Readonly<Record<string, string>>
}

export interface CreatedTemplateResult {
  readonly templateId: string
  readonly draftId: string
}

export function parseCreatedTemplateResponse(value: unknown): CreatedTemplateResult | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const data = (value as { data?: unknown }).data
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
  const templateId = (data as { templateId?: unknown }).templateId
  const draftId = (data as { draftId?: unknown }).draftId
  if (typeof templateId !== 'string' || typeof draftId !== 'string') return null
  return { templateId, draftId }
}

export function TemplateCreateForm({ types, profiles, labels }: { types: readonly DocumentStudioTypeRow[]; profiles: readonly DocumentStudioProfileRow[]; labels: TemplateCreateLabels }) {
  const [kind, setKind] = useState<TemplateKind>('DOCUMENT')
  const [language, setLanguage] = useState<TemplateLanguage>('NL')
  const [documentTypeId, setDocumentTypeId] = useState(types[0]?.id ?? '')
  const [profileId, setProfileId] = useState('')
  const [category, setCategory] = useState<(typeof CATEGORY_CODES)[number]>('GENERAL')
  const [defaultDossier, setDefaultDossier] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true); setError(null)
    const form = new FormData(event.currentTarget)
    try {
      const response = await fetch('/api/document-studio/templates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          metadata: {
            templateKey: String(form.get('templateKey') ?? ''),
            kind,
            language,
            name: String(form.get('name') ?? ''),
            description: String(form.get('description') ?? '').trim() || null,
            documentTypeId,
            categoryCode: category,
            defaultDossier,
            documentProfileId: profileId || null,
          },
          document: emptyCanonicalDocument(kind),
          composition: [],
          assetRefs: [],
        }),
      })
      const result = parseCreatedTemplateResponse(await response.json())
      if (!response.ok || !result) throw new Error(labels.failed)
      router.push(`/document-studio/templates/${result.templateId}/edit?version=${result.draftId}`)
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : labels.failed)
      setPending(false)
    }
  }

  const noTypes = types.length === 0
  return (
    <form className="space-y-6" onSubmit={submit}>
      {error ? <p className="rounded-[var(--radius-control)] border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5 text-sm font-medium"><span>{labels.templateKey}</span><TextInput name="templateKey" pattern="[a-z][a-z0-9_-]{0,79}" required /></label>
        <label className="space-y-1.5 text-sm font-medium"><span>{labels.name}</span><TextInput name="name" required /></label>
        <label className="space-y-1.5 text-sm font-medium"><span>{labels.kind}</span><DropdownSelect aria-label={labels.kind} onChange={(event) => setKind(event.target.value as TemplateKind)} searchable searchPlaceholder={labels.kind} value={kind}>{TEMPLATE_KINDS.map((value) => <option key={value} value={value}>{labels.kinds[value] ?? value}</option>)}</DropdownSelect></label>
        <label className="space-y-1.5 text-sm font-medium"><span>{labels.language}</span><DropdownSelect aria-label={labels.language} onChange={(event) => setLanguage(event.target.value as TemplateLanguage)} value={language}>{TEMPLATE_LANGUAGES.map((value) => <option key={value} value={value}>{value}</option>)}</DropdownSelect></label>
        <label className="space-y-1.5 text-sm font-medium"><span>{labels.documentType}</span><DropdownSelect aria-label={labels.documentType} disabled={noTypes} emptyLabel={labels.noOptions} onChange={(event) => setDocumentTypeId(event.target.value)} searchable searchPlaceholder={labels.documentType} value={documentTypeId}>{types.map((type) => <option key={type.id} value={type.id}>{type.name.nl}</option>)}</DropdownSelect></label>
        <label className="space-y-1.5 text-sm font-medium"><span>{labels.profile}</span><DropdownSelect aria-label={labels.profile} emptyLabel={labels.noOptions} onChange={(event) => setProfileId(event.target.value)} searchable searchPlaceholder={labels.profile} value={profileId}><option value="">—</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</DropdownSelect></label>
        <label className="space-y-1.5 text-sm font-medium"><span>{labels.category}</span><DropdownSelect aria-label={labels.category} onChange={(event) => setCategory(event.target.value as (typeof CATEGORY_CODES)[number])} searchable searchPlaceholder={labels.category} value={category}>{CATEGORY_CODES.map((value) => <option key={value} value={value}>{labels.categories[value] ?? value}</option>)}</DropdownSelect></label>
        <label className="flex min-h-10 items-center gap-2 self-end text-sm font-medium"><input checked={defaultDossier} className="size-4 accent-primary" onChange={(event) => setDefaultDossier(event.target.checked)} type="checkbox" />{labels.defaultDossier}</label>
      </div>
      <label className="block space-y-1.5 text-sm font-medium"><span>{labels.description}</span><textarea className="min-h-24 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm outline-none focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-focus/50" name="description" /></label>
      <div className="flex flex-wrap gap-2"><Button disabled={noTypes} loading={pending} type="submit">{labels.save}</Button><Button type="button" variant="secondary" onClick={() => router.push('/document-studio')}>{labels.cancel}</Button></div>
    </form>
  )
}
