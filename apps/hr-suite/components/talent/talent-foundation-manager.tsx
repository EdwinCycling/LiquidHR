'use client'

import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { DataTableShell } from '@/components/patterns/data-table-shell'
import { FilterBar } from '@/components/patterns/filter-bar'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { RowActions } from '@/components/patterns/row-actions'
import { SettingsAccordion } from '@/components/settings/settings-accordion'
import type { listTalentFoundation } from '@/lib/talent/service'

type Foundation = Awaited<ReturnType<typeof listTalentFoundation>>
type CapabilityType = 'COMPETENCY' | 'SKILL' | 'KNOWLEDGE' | 'LANGUAGE' | 'CERTIFICATE'
type Status = 'ACTIVE' | 'INACTIVE'
type LevelContentDraft = { id?: string; indicatorText: string; examples: string; coachingNotes: string }

interface Labels {
  code: string
  name: string
  type: string
  status: string
  job: string
  group: string
  family: string
  seniority: string
  levels: string
  models: string
  seniorities: string
  families: string
  categories: string
  capabilities: string
  profiles: string
  empty: string
  addSeniority: string
  addCapability: string
  addFamily: string
  addCategory: string
  addLevel: string
  save: string
  cancel: string
  saved: string
  failed: string
  active: string
  inactive: string
  search: string
  filterType: string
  filterCategory: string
  filterTag: string
  all: string
  edit: string
  delete: string
  confirmDelete: string
  description: string
  capabilityDetails: string
  levelContent: string
  indicator: string
  examples: string
  coachingNotes: string
  tags: string
  languageCode: string
  languageCefr: string
  nativeLanguage: string
  certificateIssuer: string
  certificateValidity: string
  permanentCertificate: string
  certificateCode: string
  renewalRequired: string
  locked: string
  configurable: string
  lockedHint: string
  usage: string
  typeCompetency: string
  typeSkill: string
  typeKnowledge: string
  typeLanguage: string
  typeCertificate: string
  noResults: string
  discardTitle: string
  discardDescription: string
  discardConfirm: string
  keepEditing: string
}

type Modal =
  | { kind: 'seniority'; id: string | null; code: string; name: string; description: string; sortOrder: string; status: Status }
  | { kind: 'family'; id: string | null; code: string; name: string; description: string; status: Status }
  | { kind: 'category'; id: string | null; code: string; name: string; description: string; capabilityTypes: CapabilityType[]; status: Status }
  | { kind: 'capability'; id: string | null; capabilityType: CapabilityType; code: string; name: string; description: string; categoryId: string; status: Status; languageCode: string; languageCefr: string; languageIsNative: boolean; certificateIssuingBody: string; certificateValidityMonths: string; certificateIsPermanent: boolean; certificateCode: string; certificateRenewalRequired: boolean }
  | { kind: 'model'; id: string; code: string; name: string; description: string; status: Status }
  | { kind: 'level'; id: string | null; levelModelId: string; code: string; name: string; description: string; sortOrder: string }

type DeleteTarget = { id: string; name: string; url: string }

const capabilityTypes: CapabilityType[] = ['COMPETENCY', 'SKILL', 'KNOWLEDGE', 'LANGUAGE', 'CERTIFICATE']

function typeLabel(type: CapabilityType, labels: Labels): string {
  return ({ COMPETENCY: labels.typeCompetency, SKILL: labels.typeSkill, KNOWLEDGE: labels.typeKnowledge, LANGUAGE: labels.typeLanguage, CERTIFICATE: labels.typeCertificate })[type]
}

function statusLabel(status: Status, labels: Labels): string { return status === 'ACTIVE' ? labels.active : labels.inactive }

function inputValue(value: string | null | undefined): string { return value ?? '' }

function modalTitle(modal: Modal, labels: Labels): string {
  if (modal.kind === 'capability') return labels.capabilityDetails
  if (modal.kind === 'level') return labels.levels
  if (modal.kind === 'model') return labels.models
  if (modal.kind === 'category') return labels.categories
  if (modal.kind === 'family') return labels.families
  return labels.seniorities
}

export function TalentFoundationManager({ initial, labels, canManage = true }: { initial: Foundation; labels: Labels; canManage?: boolean }) {
  const [foundation, setFoundation] = useState(initial)
  const [modal, setModal] = useState<Modal | null>(null)
  const [modalOriginal, setModalOriginal] = useState<Modal | null>(null)
  const [capabilitySearch, setCapabilitySearch] = useState('')
  const [capabilityTypeFilter, setCapabilityTypeFilter] = useState<CapabilityType | ''>('')
  const [capabilityStatusFilter, setCapabilityStatusFilter] = useState<Status | ''>('')
  const [capabilityCategoryFilter, setCapabilityCategoryFilter] = useState('')
  const [capabilityTagFilter, setCapabilityTagFilter] = useState('')
  const [capabilityTagIds, setCapabilityTagIds] = useState<string[]>([])
  const [originalCapabilityTagIds, setOriginalCapabilityTagIds] = useState<string[]>([])
  const [levelContentDraft, setLevelContentDraft] = useState<Record<string, LevelContentDraft>>({})
  const [originalLevelContentDraft, setOriginalLevelContentDraft] = useState<Record<string, LevelContentDraft>>({})
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const categoriesById = useMemo(() => new Map(foundation.categories.map((item) => [item.id, item])), [foundation.categories])
  const tagsById = useMemo(() => new Map(foundation.tags.map((item) => [item.id, item])), [foundation.tags])
  const visibleCapabilities = useMemo(() => {
    const query = capabilitySearch.trim().toLocaleLowerCase('nl-NL')
    return foundation.capabilities
      .filter((item) => !query || [item.name, item.code, item.description ?? ''].some((value) => value.toLocaleLowerCase('nl-NL').includes(query)))
      .filter((item) => !capabilityTypeFilter || item.capability_type === capabilityTypeFilter)
      .filter((item) => !capabilityStatusFilter || item.status === capabilityStatusFilter)
      .filter((item) => !capabilityCategoryFilter || item.category_id === capabilityCategoryFilter)
      .filter((item) => !capabilityTagFilter || foundation.capabilityTagRelations.some((relation) => relation.capability_id === item.id && relation.tag_id === capabilityTagFilter))
      .sort((left, right) => left.name.localeCompare(right.name, 'nl-NL'))
  }, [capabilityCategoryFilter, capabilitySearch, capabilityStatusFilter, capabilityTagFilter, capabilityTypeFilter, foundation.capabilities, foundation.capabilityTagRelations])

  function resetModal(): void {
    setModal(null)
    setModalOriginal(null)
    setCapabilityTagIds([])
    setOriginalCapabilityTagIds([])
    setLevelContentDraft({})
    setOriginalLevelContentDraft({})
  }

  function closeModal(): void {
    if (!saving) resetModal()
  }

  function openModal(next: Modal): void {
    setModal(next)
    setModalOriginal(next)
    if (next.kind !== 'capability') {
      setCapabilityTagIds([])
      setOriginalCapabilityTagIds([])
      setLevelContentDraft({})
      setOriginalLevelContentDraft({})
    }
  }

  function updateModal(update: (current: Modal) => Modal): void {
    setModal((current) => current ? update(current) : current)
  }

  function toggleCategoryType(type: CapabilityType, checked: boolean): void {
    updateModal((current) => current.kind === 'category'
      ? { ...current, capabilityTypes: checked ? [...current.capabilityTypes, type] : current.capabilityTypes.filter((item) => item !== type) }
      : current)
  }

  async function refresh(): Promise<void> {
    const response = await fetch('/api/talent', { cache: 'no-store' })
    if (response.ok) setFoundation((await response.json() as { data: Foundation }).data)
  }

  async function mutate(url: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown): Promise<boolean> {
    setSaving(true)
    setMessage(null)
    const response = await fetch(url, { method, headers: body === undefined ? undefined : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
    setSaving(false)
    if (!response.ok) { setMessage(labels.failed); return false }
    await refresh()
    setMessage(labels.saved)
    return true
  }

  async function saveModal(): Promise<void> {
    if (!modal) return
    if (modal.kind === 'seniority') {
      const body = { code: modal.code, name: modal.name, description: modal.description || null, sortOrder: Number(modal.sortOrder), ...(modal.id ? { status: modal.status } : {}) }
      if (await mutate(modal.id ? `/api/talent/seniorities/${modal.id}` : '/api/talent/seniorities', modal.id ? 'PATCH' : 'POST', body)) resetModal()
      return
    }
    if (modal.kind === 'family') {
      const body = { code: modal.code, name: modal.name, description: modal.description || null, ...(modal.id ? { status: modal.status } : {}) }
      if (await mutate(modal.id ? `/api/talent/job-families/${modal.id}` : '/api/talent/job-families', modal.id ? 'PATCH' : 'POST', body)) resetModal()
      return
    }
    if (modal.kind === 'category') {
      const body = { code: modal.code, name: modal.name, description: modal.description || null, capabilityTypes: modal.capabilityTypes, ...(modal.id ? { status: modal.status } : {}) }
      if (await mutate(modal.id ? `/api/talent/categories/${modal.id}` : '/api/talent/categories', modal.id ? 'PATCH' : 'POST', body)) resetModal()
      return
    }
    if (modal.kind === 'level') {
      const body = { levelModelId: modal.levelModelId, code: modal.code, name: modal.name, description: modal.description || null, sortOrder: Number(modal.sortOrder) }
      if (await mutate(modal.id ? `/api/talent/level-model/levels/${modal.id}` : '/api/talent/level-model/levels', modal.id ? 'PATCH' : 'POST', body)) resetModal()
      return
    }
    if (modal.kind === 'model') {
      const body = { code: modal.code, name: modal.name, description: modal.description || null, status: modal.status }
      if (await mutate(`/api/talent/level-model/${modal.id}`, 'PATCH', body)) resetModal()
      return
    }

    const body = {
      ...(modal.id ? {} : { capabilityType: modal.capabilityType }),
      code: modal.code,
      name: modal.name,
      description: modal.description || null,
      categoryId: modal.categoryId || null,
      languageCode: modal.languageCode || null,
      languageCefr: modal.languageCefr || null,
      languageIsNative: modal.languageIsNative,
      certificateIssuingBody: modal.certificateIssuingBody || null,
      certificateValidityMonths: modal.certificateValidityMonths ? Number(modal.certificateValidityMonths) : null,
      certificateIsPermanent: modal.certificateIsPermanent,
      certificateCode: modal.certificateCode || null,
      certificateRenewalRequired: modal.certificateRenewalRequired,
      ...(modal.id ? { status: modal.status } : {}),
    }
    setSaving(true)
    const response = await fetch(modal.id ? `/api/talent/capabilities/${modal.id}` : '/api/talent/capabilities', { method: modal.id ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (!response.ok) { setSaving(false); setMessage(labels.failed); return }
    const payload = await response.json() as { data: { id: string } }
    const capabilityId = modal.id ?? payload.data.id
    const tagResponse = await fetch(`/api/talent/capabilities/${capabilityId}/tags`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(capabilityTagIds.map((tagId) => ({ tagId }))) })
    if (!tagResponse.ok) { setSaving(false); setMessage(labels.failed); return }
    const contentResponses = modal.capabilityType === 'COMPETENCY' || modal.capabilityType === 'SKILL' || modal.capabilityType === 'KNOWLEDGE'
      ? await Promise.all(Object.entries(levelContentDraft).filter(([, draft]) => draft.indicatorText.trim()).map(([talentLevelId, draft]) => fetch(`/api/talent/capabilities/${capabilityId}/level-content`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ talentLevelId, indicatorText: draft.indicatorText, examples: draft.examples || null, coachingNotes: draft.coachingNotes || null }) })))
      : []
    if (contentResponses.some((item) => !item.ok)) { setSaving(false); setMessage(labels.failed); return }
    await refresh()
    setSaving(false)
    setMessage(labels.saved)
    resetModal()
  }

  function openCapability(item?: Foundation['capabilities'][number]): void {
    const tagIds = item ? foundation.capabilityTagRelations.filter((relation) => relation.capability_id === item.id).map((relation) => relation.tag_id) : []
    const content = item ? Object.fromEntries(foundation.capabilityLevelContent.filter((entry) => entry.capability_id === item.id).map((entry) => [entry.talent_level_id, { id: entry.id, indicatorText: entry.indicator_text, examples: inputValue(entry.examples), coachingNotes: inputValue(entry.coaching_notes) }])) : {}
    setCapabilityTagIds(tagIds)
    setOriginalCapabilityTagIds(tagIds)
    setLevelContentDraft(content)
    setOriginalLevelContentDraft(content)
    openModal(item ? {
      kind: 'capability', id: item.id, capabilityType: item.capability_type as CapabilityType, code: item.code, name: item.name,
      description: inputValue(item.description), categoryId: inputValue(item.category_id), status: item.status as Status,
      languageCode: inputValue(item.language_code), languageCefr: inputValue(item.language_cefr), languageIsNative: item.language_is_native,
      certificateIssuingBody: inputValue(item.certificate_issuing_body), certificateValidityMonths: item.certificate_validity_months?.toString() ?? '', certificateIsPermanent: item.certificate_is_permanent,
      certificateCode: inputValue(item.certificate_code), certificateRenewalRequired: item.certificate_renewal_required,
    } : {
      kind: 'capability', id: null, capabilityType: 'COMPETENCY', code: '', name: '', description: '', categoryId: '', status: 'ACTIVE', languageCode: '', languageCefr: '', languageIsNative: false,
      certificateIssuingBody: '', certificateValidityMonths: '', certificateIsPermanent: false, certificateCode: '', certificateRenewalRequired: false,
    })
  }

  function requestDelete(target: DeleteTarget): void { setDeleteTarget(target) }

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget) return
    const target = deleteTarget
    if (await mutate(target.url, 'DELETE')) {
      setDeleteTarget(null)
      if (modal?.id === target.id) resetModal()
    }
  }

  const levelModel = foundation.models[0]
  const levels = foundation.levels.filter((level) => level.level_model_id === levelModel?.id).sort((left, right) => left.sort_order - right.sort_order)
  const modalDirty = modal !== null && (modalOriginal === null || JSON.stringify(modal) !== JSON.stringify(modalOriginal) || (modal.kind === 'capability' && (JSON.stringify(capabilityTagIds) !== JSON.stringify(originalCapabilityTagIds) || JSON.stringify(levelContentDraft) !== JSON.stringify(originalLevelContentDraft))))

  return <div className="space-y-5">
    <SettingsAccordion initialOpen="models" sections={[
      { id: 'models', title: labels.models, children: (
        <Surface className="p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">{labels.models}</p><h2 className="mt-1 text-lg font-semibold">{levelModel?.name ?? labels.empty}</h2></div>{levelModel ? <div className="flex items-center gap-2"><Badge tone={levelModel.locked_at ? 'neutral' : 'info'}>{levelModel.locked_at ? labels.locked : labels.configurable}</Badge>{canManage && !levelModel.locked_at ? <RowActions menuLabel={`${labels.edit}: ${levelModel.name}`} menuItems={[{ id: 'edit-model', label: labels.edit, onSelect: () => openModal({ kind: 'model', id: levelModel.id, code: levelModel.code, name: levelModel.name, description: inputValue(levelModel.description), status: levelModel.status as Status }) }]} /> : null}</div> : null}</div>{levelModel ? <><p className="mt-2 text-sm text-muted-foreground">{levelModel.description ?? levelModel.code}{levelModel.locked_at ? ` · ${labels.lockedHint}` : ''}</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{levels.map((level) => <Surface className="p-4" key={level.id} variant="subtle"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{level.code}</p><h3 className="mt-1 font-semibold">{level.name}</h3></div>{canManage && !levelModel.locked_at ? <RowActions menuLabel={`${labels.edit}: ${level.name}`} menuItems={[{ id: 'edit-level', label: labels.edit, onSelect: () => openModal({ kind: 'level', id: level.id, levelModelId: levelModel.id, code: level.code, name: level.name, description: inputValue(level.description), sortOrder: String(level.sort_order) }) }, { id: 'delete-level', label: labels.delete, destructive: true, onSelect: () => requestDelete({ id: level.id, name: level.name, url: `/api/talent/level-model/levels/${level.id}` }) }]} /> : null}</div><p className="mt-2 text-sm text-muted-foreground">{level.description}</p></Surface>)}{canManage && !levelModel.locked_at ? <Button className="min-h-full justify-start border-dashed text-left" onClick={() => openModal({ kind: 'level', id: null, levelModelId: levelModel.id, code: '', name: '', description: '', sortOrder: String(levels.length + 1) })} type="button" variant="secondary"><Plus aria-hidden="true" size={17} />{labels.addLevel}</Button> : null}</div></> : null}</Surface>
      ) },
      { id: 'seniorities', title: labels.seniorities, children: (
        <Surface className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">{labels.seniorities}</p><h2 className="mt-1 text-lg font-semibold">{foundation.seniorities.length}</h2></div></div><div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">{foundation.seniorities.map((item) => <Surface className="flex items-center justify-between gap-3 p-4" key={item.id} variant="subtle"><div className="min-w-0"><p className="font-semibold">{item.name}</p><p className="text-sm text-muted-foreground">{item.code} · {item.sort_order}</p></div>{canManage ? <RowActions menuLabel={`${labels.edit}: ${item.name}`} menuItems={[{ id: 'edit-seniority', label: labels.edit, onSelect: () => openModal({ kind: 'seniority', id: item.id, code: item.code, name: item.name, description: inputValue(item.description), sortOrder: String(item.sort_order), status: item.status as Status }) }, { id: 'delete-seniority', label: labels.delete, destructive: true, onSelect: () => requestDelete({ id: item.id, name: item.name, url: `/api/talent/seniorities/${item.id}` }) }]} /> : <Badge tone="neutral">{statusLabel(item.status as Status, labels)}</Badge>}</Surface>)}{foundation.seniorities.length === 0 ? <p className="text-sm text-muted-foreground">{labels.empty}</p> : null}</div></Surface>
      ) },
      { id: 'seniority-add', title: labels.addSeniority, children: (
        <Surface className="p-5"><p className="text-sm text-muted-foreground">{labels.seniorities}</p>{canManage ? <Button className="mt-4" onClick={() => openModal({ kind: 'seniority', id: null, code: '', name: '', description: '', sortOrder: String(foundation.seniorities.length + 1), status: 'ACTIVE' })} type="button" variant="secondary"><Plus aria-hidden="true" size={16} />{labels.addSeniority}</Button> : null}</Surface>
      ) },
      { id: 'families', title: labels.families, children: (
        <Surface className="p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">{labels.families}</p><h2 className="mt-1 text-lg font-semibold">{foundation.families.length}</h2></div>{canManage ? <Button onClick={() => openModal({ kind: 'family', id: null, code: '', name: '', description: '', status: 'ACTIVE' })} type="button" variant="secondary"><Plus aria-hidden="true" size={16} />{labels.addFamily}</Button> : null}</div><div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">{foundation.families.map((item) => <Surface className="flex items-center justify-between gap-3 p-4" key={item.id} variant="subtle"><div className="min-w-0"><p className="font-semibold">{item.name}</p><p className="text-sm text-muted-foreground">{item.code}</p></div>{canManage ? <RowActions menuLabel={`${labels.edit}: ${item.name}`} menuItems={[{ id: 'edit-family', label: labels.edit, onSelect: () => openModal({ kind: 'family', id: item.id, code: item.code, name: item.name, description: inputValue(item.description), status: item.status as Status }) }, { id: 'delete-family', label: labels.delete, destructive: true, onSelect: () => requestDelete({ id: item.id, name: item.name, url: `/api/talent/job-families/${item.id}` }) }]} /> : <Badge tone="neutral">{statusLabel(item.status as Status, labels)}</Badge>}</Surface>)}{foundation.families.length === 0 ? <p className="text-sm text-muted-foreground">{labels.empty}</p> : null}</div></Surface>
      ) },
      { id: 'categories', title: labels.categories, children: (
        <Surface className="p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">{labels.categories}</p><h2 className="mt-1 text-lg font-semibold">{foundation.categories.length}</h2></div>{canManage ? <Button onClick={() => openModal({ kind: 'category', id: null, code: '', name: '', description: '', capabilityTypes: ['COMPETENCY', 'SKILL', 'KNOWLEDGE'], status: 'ACTIVE' })} type="button" variant="secondary"><Plus aria-hidden="true" size={16} />{labels.addCategory}</Button> : null}</div><div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">{foundation.categories.map((item) => <Surface className="flex items-center justify-between gap-3 p-4" key={item.id} variant="subtle"><div className="min-w-0"><p className="font-semibold">{item.name}</p><p className="text-sm text-muted-foreground">{item.code} · {item.capability_types.join(', ')}</p></div>{canManage ? <RowActions menuLabel={`${labels.edit}: ${item.name}`} menuItems={[{ id: 'edit-category', label: labels.edit, onSelect: () => openModal({ kind: 'category', id: item.id, code: item.code, name: item.name, description: inputValue(item.description), capabilityTypes: item.capability_types as CapabilityType[], status: item.status as Status }) }, { id: 'delete-category', label: labels.delete, destructive: true, onSelect: () => requestDelete({ id: item.id, name: item.name, url: `/api/talent/categories/${item.id}` }) }]} /> : <Badge tone="neutral">{statusLabel(item.status as Status, labels)}</Badge>}</Surface>)}</div></Surface>
      ) },
      { id: 'capabilities', title: labels.capabilities, children: (
        <Surface className="p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">{labels.capabilities}</p><h2 className="mt-1 text-lg font-semibold">{visibleCapabilities.length} / {foundation.capabilities.length}</h2></div>{canManage ? <Button onClick={() => openCapability()} type="button"><Plus aria-hidden="true" size={16} />{labels.addCapability}</Button> : null}</div><FilterBar className="mt-4"><FormField className="min-w-52 flex-1" control={<TextInput aria-label={labels.search} leadingIcon={<Search aria-hidden="true" />} onChange={(event) => setCapabilitySearch(event.target.value)} placeholder={labels.search} value={capabilitySearch} />} label={labels.search} /><FormField className="min-w-40 flex-1" control={<DropdownSelect aria-label={labels.filterType} onChange={(event) => setCapabilityTypeFilter(event.target.value as CapabilityType | '')} searchable searchPlaceholder={labels.search} value={capabilityTypeFilter}><option value="">{labels.all} · {labels.type}</option>{capabilityTypes.map((type) => <option key={type} value={type}>{typeLabel(type, labels)}</option>)}</DropdownSelect>} label={labels.filterType} /><FormField className="min-w-40 flex-1" control={<DropdownSelect aria-label={labels.status} onChange={(event) => setCapabilityStatusFilter(event.target.value as Status | '')} value={capabilityStatusFilter}><option value="">{labels.all} · {labels.status}</option><option value="ACTIVE">{labels.active}</option><option value="INACTIVE">{labels.inactive}</option></DropdownSelect>} label={labels.status} /><FormField className="min-w-40 flex-1" control={<DropdownSelect aria-label={labels.filterCategory} onChange={(event) => setCapabilityCategoryFilter(event.target.value)} searchable searchPlaceholder={labels.search} value={capabilityCategoryFilter}><option value="">{labels.all} · {labels.categories}</option>{foundation.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</DropdownSelect>} label={labels.filterCategory} /><FormField className="min-w-40 flex-1" control={<DropdownSelect aria-label={labels.filterTag} onChange={(event) => setCapabilityTagFilter(event.target.value)} searchable searchPlaceholder={labels.search} value={capabilityTagFilter}><option value="">{labels.all} · {labels.tags}</option>{foundation.tags.filter((tag) => tag.is_active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</DropdownSelect>} label={labels.filterTag} /></FilterBar><Surface className="mt-4 overflow-hidden" variant="subtle"><div className="divide-y divide-border-subtle">{visibleCapabilities.map((item) => { const itemTags = foundation.capabilityTagRelations.filter((relation) => relation.capability_id === item.id).map((relation) => tagsById.get(relation.tag_id)).filter((tag): tag is Foundation['tags'][number] => Boolean(tag)); return <article className="flex flex-wrap items-center justify-between gap-3 p-4" key={item.id}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.name}</h3><Badge tone="info">{typeLabel(item.capability_type as CapabilityType, labels)}</Badge><Badge tone={item.status === 'ACTIVE' ? 'success' : 'neutral'}>{statusLabel(item.status as Status, labels)}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{item.code}{item.category_id ? ` · ${categoriesById.get(item.category_id)?.name ?? ''}` : ''}</p><div className="mt-2 flex flex-wrap gap-1">{itemTags.map((tag) => <Badge key={tag.id} tone="neutral">{tag.name}</Badge>)}</div></div>{canManage ? <RowActions menuLabel={`${labels.edit}: ${item.name}`} menuItems={[{ id: 'edit-capability', label: labels.edit, onSelect: () => openCapability(item) }, { id: 'delete-capability', label: labels.delete, destructive: true, onSelect: () => requestDelete({ id: item.id, name: item.name, url: `/api/talent/capabilities/${item.id}` }) }]} /> : null}</article> })}{visibleCapabilities.length === 0 ? <p className="p-5 text-sm text-muted-foreground">{foundation.capabilities.length ? labels.noResults : labels.empty}</p> : null}</div></Surface></Surface>
      ) },
      { id: 'profiles', title: labels.profiles, children: foundation.profiles.length === 0 ? <Surface className="p-5 text-sm text-muted-foreground" variant="subtle">{labels.empty}</Surface> : <DataTableShell caption={labels.profiles}><thead className="border-b text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-3 py-3" scope="col">{labels.job}</th><th className="px-3 py-3" scope="col">{labels.group}</th><th className="px-3 py-3" scope="col">{labels.family}</th><th className="px-3 py-3" scope="col">{labels.seniority}</th><th className="px-3 py-3" scope="col">{labels.status}</th></tr></thead><tbody className="divide-y">{foundation.profiles.map((profile) => <tr key={profile.job_profile_id}><td className="px-3 py-3 font-medium">{profile.job_code}</td><td className="px-3 py-3">{profile.job_group_name}</td><td className="px-3 py-3">{profile.job_family_name ?? labels.empty}</td><td className="px-3 py-3">{profile.seniority_name ?? labels.empty}</td><td className="px-3 py-3"><Badge tone={profile.status === 'ACTIVE' ? 'success' : 'neutral'}>{profile.status ?? labels.empty}</Badge></td></tr>)}</tbody></DataTableShell> },
    ]} />
    {message ? <Surface className="p-3 text-sm text-muted-foreground" role="status" variant="subtle">{message}</Surface> : null}
    {modal ? <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.cancel} description={modal.kind === 'capability' ? labels.capabilityDetails : labels.description} dirty={Boolean(modalDirty)} dirtyProtection={{ title: labels.discardTitle, description: labels.discardDescription, discardLabel: labels.discardConfirm, keepEditingLabel: labels.keepEditing }} onDiscard={resetModal} onOpenChange={(open) => { if (!open && !modalDirty) closeModal() }} onSubmit={(event) => { event.preventDefault(); void saveModal() }} open saveLabel={labels.save} saving={saving} title={modalTitle(modal, labels)}>
      <div className="grid gap-4 md:grid-cols-2"><FormField control={<TextInput autoFocus={modal.kind !== 'capability' || !modal.id} onChange={(event) => updateModal((current) => ({ ...current, code: event.target.value }))} value={modal.code} />} label={labels.code} /><FormField control={<TextInput onChange={(event) => updateModal((current) => ({ ...current, name: event.target.value }))} value={modal.name} />} label={labels.name} /><FormField className="md:col-span-2" control={<Textarea onChange={(event) => updateModal((current) => ({ ...current, description: event.target.value }))} value={modal.description} />} label={labels.description} />{modal.kind === 'seniority' || modal.kind === 'level' ? <FormField control={<TextInput min="1" onChange={(event) => updateModal((current) => ({ ...current, sortOrder: event.target.value }))} type="number" value={modal.sortOrder} />} label={labels.levels} /> : null}{'status' in modal ? <FormField control={<DropdownSelect onChange={(event) => updateModal((current) => ({ ...current, status: event.target.value as Status }))} value={modal.status}><option value="ACTIVE">{labels.active}</option><option value="INACTIVE">{labels.inactive}</option></DropdownSelect>} label={labels.status} /> : null}</div>
      {modal.kind === 'category' ? <fieldset><legend className="text-sm font-medium">{labels.type}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{capabilityTypes.map((type) => <Checkbox checked={modal.capabilityTypes.includes(type)} key={type} label={typeLabel(type, labels)} onChange={(event) => toggleCategoryType(type, event.target.checked)} />)}</div></fieldset> : null}
      {modal.kind === 'capability' ? <div className="grid gap-4 md:grid-cols-2"><FormField control={<DropdownSelect disabled={Boolean(modal.id)} onChange={(event) => updateModal((current) => current.kind === 'capability' ? { ...current, capabilityType: event.target.value as CapabilityType } : current)} value={modal.capabilityType}>{capabilityTypes.map((type) => <option key={type} value={type}>{typeLabel(type, labels)}</option>)}</DropdownSelect>} label={labels.type} /><FormField control={<DropdownSelect onChange={(event) => updateModal((current) => current.kind === 'capability' ? { ...current, categoryId: event.target.value } : current)} searchable searchPlaceholder={labels.search} value={modal.categoryId}><option value="">{labels.all}</option>{foundation.categories.filter((category) => category.status === 'ACTIVE' && category.capability_types.includes(modal.capabilityType)).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</DropdownSelect>} label={labels.categories} />{modal.capabilityType === 'LANGUAGE' ? <><FormField control={<TextInput onChange={(event) => updateModal((current) => current.kind === 'capability' ? { ...current, languageCode: event.target.value } : current)} value={modal.languageCode} />} label={labels.languageCode} /><FormField control={<DropdownSelect onChange={(event) => updateModal((current) => current.kind === 'capability' ? { ...current, languageCefr: event.target.value } : current)} value={modal.languageCefr}><option value="">{labels.all}</option>{['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level) => <option key={level} value={level}>{level}</option>)}</DropdownSelect>} label={labels.languageCefr} /><Checkbox checked={modal.languageIsNative} label={labels.nativeLanguage} onChange={(event) => updateModal((current) => current.kind === 'capability' ? { ...current, languageIsNative: event.target.checked } : current)} /></> : null}{modal.capabilityType === 'CERTIFICATE' ? <><FormField control={<TextInput onChange={(event) => updateModal((current) => current.kind === 'capability' ? { ...current, certificateIssuingBody: event.target.value } : current)} value={modal.certificateIssuingBody} />} label={labels.certificateIssuer} /><FormField control={<TextInput min="1" onChange={(event) => updateModal((current) => current.kind === 'capability' ? { ...current, certificateValidityMonths: event.target.value } : current)} type="number" value={modal.certificateValidityMonths} />} label={labels.certificateValidity} /><FormField control={<TextInput onChange={(event) => updateModal((current) => current.kind === 'capability' ? { ...current, certificateCode: event.target.value } : current)} value={modal.certificateCode} />} label={labels.certificateCode} /><Checkbox checked={modal.certificateIsPermanent} label={labels.permanentCertificate} onChange={(event) => updateModal((current) => current.kind === 'capability' ? { ...current, certificateIsPermanent: event.target.checked } : current)} /><Checkbox checked={modal.certificateRenewalRequired} label={labels.renewalRequired} onChange={(event) => updateModal((current) => current.kind === 'capability' ? { ...current, certificateRenewalRequired: event.target.checked } : current)} /></> : null}</div> : null}
      {modal.kind === 'capability' && (modal.capabilityType === 'COMPETENCY' || modal.capabilityType === 'SKILL' || modal.capabilityType === 'KNOWLEDGE') ? <fieldset><legend className="text-sm font-medium">{labels.levelContent}</legend><div className="mt-2 space-y-3">{levels.map((level) => { const draft = levelContentDraft[level.id] ?? { indicatorText: '', examples: '', coachingNotes: '' }; return <Surface className="p-3" key={level.id} variant="subtle"><p className="font-semibold">{level.code} · {level.name}</p><FormField className="mt-2" control={<Textarea onChange={(event) => setLevelContentDraft((current) => ({ ...current, [level.id]: { ...draft, indicatorText: event.target.value } }))} value={draft.indicatorText} />} label={labels.indicator} /><div className="mt-2 grid gap-3 md:grid-cols-2"><FormField control={<Textarea onChange={(event) => setLevelContentDraft((current) => ({ ...current, [level.id]: { ...draft, examples: event.target.value } }))} value={draft.examples} />} label={labels.examples} /><FormField control={<Textarea onChange={(event) => setLevelContentDraft((current) => ({ ...current, [level.id]: { ...draft, coachingNotes: event.target.value } }))} value={draft.coachingNotes} />} label={labels.coachingNotes} /></div></Surface> })}</div></fieldset> : null}
      {modal.kind === 'capability' ? <fieldset><legend className="text-sm font-medium">{labels.tags}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{foundation.tags.filter((tag) => tag.is_active).map((tag) => <Checkbox checked={capabilityTagIds.includes(tag.id)} key={tag.id} label={tag.name} onChange={(event) => setCapabilityTagIds((current) => event.target.checked ? [...current, tag.id] : current.filter((id) => id !== tag.id))} />)}</div></fieldset> : null}
      {modal.id && modal.kind !== 'model' ? <div className="border-t border-border-subtle pt-4"><Button onClick={() => requestDelete({ id: modal.id as string, name: modal.name, url: modal.kind === 'capability' ? `/api/talent/capabilities/${modal.id}` : modal.kind === 'level' ? `/api/talent/level-model/levels/${modal.id}` : modal.kind === 'category' ? `/api/talent/categories/${modal.id}` : modal.kind === 'family' ? `/api/talent/job-families/${modal.id}` : `/api/talent/seniorities/${modal.id}` })} type="button" variant="danger">{labels.delete}</Button></div> : null}
    </FormDrawer> : null}
    <ConfirmDialog cancelLabel={labels.cancel} confirmLabel={labels.delete} description={deleteTarget ? `${labels.confirmDelete}: ${deleteTarget.name}` : labels.confirmDelete} destructive onConfirm={() => void confirmDelete()} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }} open={deleteTarget !== null} pending={saving} title={labels.delete} />
  </div>
}
