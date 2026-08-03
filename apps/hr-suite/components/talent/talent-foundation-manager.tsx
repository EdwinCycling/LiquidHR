'use client'

import { useMemo, useState } from 'react'
import { PencilLine, Plus, Search, Trash2, X } from 'lucide-react'
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
}

type Modal =
  | { kind: 'seniority'; id: string | null; code: string; name: string; description: string; sortOrder: string; status: Status }
  | { kind: 'family'; id: string | null; code: string; name: string; description: string; status: Status }
  | { kind: 'category'; id: string | null; code: string; name: string; description: string; capabilityTypes: CapabilityType[]; status: Status }
  | { kind: 'capability'; id: string | null; capabilityType: CapabilityType; code: string; name: string; description: string; categoryId: string; status: Status; languageCode: string; languageCefr: string; languageIsNative: boolean; certificateIssuingBody: string; certificateValidityMonths: string; certificateIsPermanent: boolean; certificateCode: string; certificateRenewalRequired: boolean }
  | { kind: 'model'; id: string; code: string; name: string; description: string; status: Status }
  | { kind: 'level'; id: string | null; levelModelId: string; code: string; name: string; description: string; sortOrder: string }

const capabilityTypes: CapabilityType[] = ['COMPETENCY', 'SKILL', 'KNOWLEDGE', 'LANGUAGE', 'CERTIFICATE']

function typeLabel(type: CapabilityType, labels: Labels): string {
  return ({ COMPETENCY: labels.typeCompetency, SKILL: labels.typeSkill, KNOWLEDGE: labels.typeKnowledge, LANGUAGE: labels.typeLanguage, CERTIFICATE: labels.typeCertificate })[type]
}

function statusLabel(status: Status, labels: Labels): string { return status === 'ACTIVE' ? labels.active : labels.inactive }

function inputValue(value: string | null | undefined): string { return value ?? '' }

export function TalentFoundationManager({ initial, labels, canManage = true }: { initial: Foundation; labels: Labels; canManage?: boolean }) {
  const [foundation, setFoundation] = useState(initial)
  const [modal, setModal] = useState<Modal | null>(null)
  const [capabilitySearch, setCapabilitySearch] = useState('')
  const [capabilityTypeFilter, setCapabilityTypeFilter] = useState<CapabilityType | ''>('')
  const [capabilityStatusFilter, setCapabilityStatusFilter] = useState<Status | ''>('')
  const [capabilityCategoryFilter, setCapabilityCategoryFilter] = useState('')
  const [capabilityTagFilter, setCapabilityTagFilter] = useState('')
  const [capabilityTagIds, setCapabilityTagIds] = useState<string[]>([])
  const [levelContentDraft, setLevelContentDraft] = useState<Record<string, LevelContentDraft>>({})
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

  function closeModal() { if (!saving) setModal(null) }

  async function refresh() {
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

  async function saveModal() {
    if (!modal) return
    if (modal.kind === 'seniority') {
      const body = { code: modal.code, name: modal.name, description: modal.description || null, sortOrder: Number(modal.sortOrder), ...(modal.id ? { status: modal.status } : {}) }
      if (await mutate(modal.id ? `/api/talent/seniorities/${modal.id}` : '/api/talent/seniorities', modal.id ? 'PATCH' : 'POST', body)) setModal(null)
      return
    }
    if (modal.kind === 'family') {
      const body = { code: modal.code, name: modal.name, description: modal.description || null, ...(modal.id ? { status: modal.status } : {}) }
      if (await mutate(modal.id ? `/api/talent/job-families/${modal.id}` : '/api/talent/job-families', modal.id ? 'PATCH' : 'POST', body)) setModal(null)
      return
    }
    if (modal.kind === 'category') {
      const body = { code: modal.code, name: modal.name, description: modal.description || null, capabilityTypes: modal.capabilityTypes, ...(modal.id ? { status: modal.status } : {}) }
      if (await mutate(modal.id ? `/api/talent/categories/${modal.id}` : '/api/talent/categories', modal.id ? 'PATCH' : 'POST', body)) setModal(null)
      return
    }
    if (modal.kind === 'level') {
      const body = { levelModelId: modal.levelModelId, code: modal.code, name: modal.name, description: modal.description || null, sortOrder: Number(modal.sortOrder) }
      if (await mutate(modal.id ? `/api/talent/level-model/levels/${modal.id}` : '/api/talent/level-model/levels', modal.id ? 'PATCH' : 'POST', body)) setModal(null)
      return
    }
    if (modal.kind === 'model') {
      const body = { code: modal.code, name: modal.name, description: modal.description || null, status: modal.status }
      if (await mutate(`/api/talent/level-model/${modal.id}`, 'PATCH', body)) setModal(null)
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
    setModal(null)
  }

  function openCapability(item?: Foundation['capabilities'][number]) {
    setCapabilityTagIds(item ? foundation.capabilityTagRelations.filter((relation) => relation.capability_id === item.id).map((relation) => relation.tag_id) : [])
    setLevelContentDraft(item ? Object.fromEntries(foundation.capabilityLevelContent.filter((content) => content.capability_id === item.id).map((content) => [content.talent_level_id, { id: content.id, indicatorText: content.indicator_text, examples: inputValue(content.examples), coachingNotes: inputValue(content.coaching_notes) }])) : {})
    setModal(item ? {
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

  const levelModel = foundation.models[0]
  const levels = foundation.levels.filter((level) => level.level_model_id === levelModel?.id).sort((left, right) => left.sort_order - right.sort_order)

  return <div className="space-y-5">
    {canManage ? <div className="flex flex-wrap items-center gap-2"><button className="button-secondary inline-flex items-center gap-2" onClick={() => setModal({ kind: 'seniority', id: null, code: '', name: '', description: '', sortOrder: String(foundation.seniorities.length + 1), status: 'ACTIVE' })} type="button"><Plus size={16} />{labels.addSeniority}</button><button className="button-secondary inline-flex items-center gap-2" onClick={() => setModal({ kind: 'category', id: null, code: '', name: '', description: '', capabilityTypes: ['COMPETENCY', 'SKILL', 'KNOWLEDGE'], status: 'ACTIVE' })} type="button"><Plus size={16} />{labels.addCategory}</button><button className="button-primary inline-flex items-center gap-2" onClick={() => openCapability()} type="button"><Plus size={16} />{labels.addCapability}</button>{message ? <span className="text-sm text-muted-foreground" role="status">{message}</span> : null}</div> : null}


    <SettingsAccordion initialOpen="models" sections={[
      { id: 'models', title: labels.models, children: (
        <section className="rounded-2xl border bg-surface p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">{labels.models}</p><h2 className="mt-1 text-lg font-semibold">{levelModel?.name ?? labels.empty}</h2></div>{levelModel ? <div className="flex items-center gap-2"><span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{levelModel.locked_at ? labels.locked : labels.configurable}</span>{canManage && !levelModel.locked_at ? <button aria-label={`${labels.edit}: ${levelModel.name}`} className="button-secondary px-2" onClick={() => setModal({ kind: 'model', id: levelModel.id, code: levelModel.code, name: levelModel.name, description: inputValue(levelModel.description), status: levelModel.status as Status })} type="button"><PencilLine size={15} /></button> : null}</div> : null}</div>{levelModel ? <><p className="mt-2 text-sm text-muted-foreground">{levelModel.description ?? levelModel.code}{levelModel.locked_at ? ` Â· ${labels.lockedHint}` : ''}</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{levels.map((level) => <article className="rounded-xl border bg-background p-4" key={level.id}><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{level.code}</p><h3 className="mt-1 font-semibold">{level.name}</h3></div>{canManage && !levelModel.locked_at ? <div className="flex gap-2"><button aria-label={`${labels.edit}: ${level.name}`} className="button-secondary px-2" onClick={() => setModal({ kind: 'level', id: level.id, levelModelId: levelModel.id, code: level.code, name: level.name, description: inputValue(level.description), sortOrder: String(level.sort_order) })} type="button"><PencilLine size={15} /></button><button aria-label={`${labels.delete}: ${level.name}`} className="button-secondary px-2 text-destructive" onClick={() => { if (window.confirm(labels.confirmDelete)) void mutate(`/api/talent/level-model/levels/${level.id}`, 'DELETE') }} type="button"><Trash2 size={15} /></button></div> : null}</div><p className="mt-2 text-sm text-muted-foreground">{level.description}</p></article>)}{canManage && !levelModel.locked_at ? <button className="rounded-xl border border-dashed p-4 text-left text-sm font-semibold text-primary" onClick={() => setModal({ kind: 'level', id: null, levelModelId: levelModel.id, code: '', name: '', description: '', sortOrder: String(levels.length + 1) })} type="button"><Plus className="mb-2" size={17} />{labels.addLevel}</button> : null}</div></> : null}</section>
      ) },
      { id: 'seniorities', title: labels.seniorities, children: (
        <section className="rounded-2xl border bg-surface p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">{labels.seniorities}</p><h2 className="mt-1 text-lg font-semibold">{foundation.seniorities.length}</h2></div></div><div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">{foundation.seniorities.map((item) => <article className="flex items-center justify-between gap-3 rounded-xl border bg-background p-4" key={item.id}><div className="min-w-0"><p className="font-semibold">{item.name}</p><p className="text-sm text-muted-foreground">{item.code} Â· {item.sort_order}</p></div>{canManage ? <div className="flex gap-2"><button aria-label={`${labels.edit}: ${item.name}`} className="button-secondary px-2" onClick={() => setModal({ kind: 'seniority', id: item.id, code: item.code, name: item.name, description: inputValue(item.description), sortOrder: String(item.sort_order), status: item.status as Status })} type="button"><PencilLine size={15} /></button><button aria-label={`${labels.delete}: ${item.name}`} className="button-secondary px-2 text-destructive" onClick={() => { if (window.confirm(labels.confirmDelete)) void mutate(`/api/talent/seniorities/${item.id}`, 'DELETE') }} type="button"><Trash2 size={15} /></button></div> : <span className="text-xs text-muted-foreground">{statusLabel(item.status as Status, labels)}</span>}</article>)}{foundation.seniorities.length === 0 ? <p className="text-sm text-muted-foreground">{labels.empty}</p> : null}</div></section>
      ) },
      { id: 'families', title: labels.families, children: (
        <section className="rounded-2xl border bg-surface p-5 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">{labels.families}</p><h2 className="mt-1 text-lg font-semibold">{foundation.families.length}</h2></div>{canManage ? <button className="button-secondary inline-flex items-center gap-2" onClick={() => setModal({ kind: 'family', id: null, code: '', name: '', description: '', status: 'ACTIVE' })} type="button"><Plus size={16} />{labels.addFamily}</button> : null}</div><div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">{foundation.families.map((item) => <article className="flex items-center justify-between gap-3 rounded-xl border bg-background p-4" key={item.id}><div className="min-w-0"><p className="font-semibold">{item.name}</p><p className="text-sm text-muted-foreground">{item.code}</p></div>{canManage ? <div className="flex gap-2"><button aria-label={`${labels.edit}: ${item.name}`} className="button-secondary px-2" onClick={() => setModal({ kind: 'family', id: item.id, code: item.code, name: item.name, description: inputValue(item.description), status: item.status as Status })} type="button"><PencilLine size={15} /></button><button aria-label={`${labels.delete}: ${item.name}`} className="button-secondary px-2 text-destructive" onClick={() => { if (window.confirm(labels.confirmDelete)) void mutate(`/api/talent/job-families/${item.id}`, 'DELETE') }} type="button"><Trash2 size={15} /></button></div> : <span className="text-xs text-muted-foreground">{statusLabel(item.status as Status, labels)}</span>}</article>)}{foundation.families.length === 0 ? <p className="text-sm text-muted-foreground">{labels.empty}</p> : null}</div></section>
      ) },
      { id: 'categories', title: labels.categories, children: (
        <section className="rounded-2xl border bg-surface p-5 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">{labels.categories}</p><h2 className="mt-1 text-lg font-semibold">{foundation.categories.length}</h2></div>{canManage ? <button className="button-secondary inline-flex items-center gap-2" onClick={() => setModal({ kind: 'category', id: null, code: '', name: '', description: '', capabilityTypes: ['COMPETENCY', 'SKILL', 'KNOWLEDGE'], status: 'ACTIVE' })} type="button"><Plus size={16} />{labels.addCategory}</button> : null}</div><div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">{foundation.categories.map((item) => <article className="flex items-center justify-between gap-3 rounded-xl border bg-background p-4" key={item.id}><div className="min-w-0"><p className="font-semibold">{item.name}</p><p className="text-sm text-muted-foreground">{item.code} Â· {item.capability_types.join(', ')}</p></div>{canManage ? <div className="flex gap-2"><button aria-label={`${labels.edit}: ${item.name}`} className="button-secondary px-2" onClick={() => setModal({ kind: 'category', id: item.id, code: item.code, name: item.name, description: inputValue(item.description), capabilityTypes: item.capability_types as CapabilityType[], status: item.status as Status })} type="button"><PencilLine size={15} /></button><button aria-label={`${labels.delete}: ${item.name}`} className="button-secondary px-2 text-destructive" onClick={() => { if (window.confirm(labels.confirmDelete)) void mutate(`/api/talent/categories/${item.id}`, 'DELETE') }} type="button"><Trash2 size={15} /></button></div> : <span className="text-xs text-muted-foreground">{statusLabel(item.status as Status, labels)}</span>}</article>)}</div></section>
      ) },
      { id: 'capabilities', title: labels.capabilities, children: (
        <section className="rounded-2xl border bg-surface p-5 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">{labels.capabilities}</p><h2 className="mt-1 text-lg font-semibold">{visibleCapabilities.length} / {foundation.capabilities.length}</h2></div>{canManage ? <button className="button-primary inline-flex items-center gap-2" onClick={() => openCapability()} type="button"><Plus size={16} />{labels.addCapability}</button> : null}</div><div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-6"><label className="relative md:col-span-2"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><input aria-label={labels.search} className="form-field pl-9" onChange={(event) => setCapabilitySearch(event.target.value)} placeholder={labels.search} value={capabilitySearch} /></label><select aria-label={labels.filterType} className="form-field" onChange={(event) => setCapabilityTypeFilter(event.target.value as CapabilityType | '')} value={capabilityTypeFilter}><option value="">{labels.all} Â· {labels.type}</option>{capabilityTypes.map((type) => <option key={type} value={type}>{typeLabel(type, labels)}</option>)}</select><select aria-label={labels.status} className="form-field" onChange={(event) => setCapabilityStatusFilter(event.target.value as Status | '')} value={capabilityStatusFilter}><option value="">{labels.all} Â· {labels.status}</option><option value="ACTIVE">{labels.active}</option><option value="INACTIVE">{labels.inactive}</option></select><select aria-label={labels.filterCategory} className="form-field" onChange={(event) => setCapabilityCategoryFilter(event.target.value)} value={capabilityCategoryFilter}><option value="">{labels.all} Â· {labels.categories}</option>{foundation.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label={labels.filterTag} className="form-field" onChange={(event) => setCapabilityTagFilter(event.target.value)} value={capabilityTagFilter}><option value="">{labels.all} Â· {labels.tags}</option>{foundation.tags.filter((tag) => tag.is_active).map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></div><div className="mt-4 divide-y rounded-xl border">{visibleCapabilities.map((item) => { const itemTags = foundation.capabilityTagRelations.filter((relation) => relation.capability_id === item.id).map((relation) => tagsById.get(relation.tag_id)).filter((tag): tag is Foundation['tags'][number] => Boolean(tag)); return <article className="flex flex-wrap items-center justify-between gap-3 p-4" key={item.id}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.name}</h3><span className="rounded-full bg-accent px-2 py-1 text-xs font-medium text-primary">{typeLabel(item.capability_type as CapabilityType, labels)}</span><span className="text-xs text-muted-foreground">{statusLabel(item.status as Status, labels)}</span></div><p className="mt-1 text-sm text-muted-foreground">{item.code}{item.category_id ? ` Â· ${categoriesById.get(item.category_id)?.name ?? ''}` : ''}</p><div className="mt-2 flex flex-wrap gap-1">{itemTags.map((tag) => <span className="rounded-full bg-muted px-2 py-1 text-xs" key={tag.id}>{tag.name}</span>)}</div></div>{canManage ? <div className="flex gap-2"><button aria-label={`${labels.edit}: ${item.name}`} className="button-secondary px-2" onClick={() => openCapability(item)} type="button"><PencilLine size={15} /></button><button aria-label={`${labels.delete}: ${item.name}`} className="button-secondary px-2 text-destructive" onClick={() => { if (window.confirm(labels.confirmDelete)) void mutate(`/api/talent/capabilities/${item.id}`, 'DELETE') }} type="button"><Trash2 size={15} /></button></div> : null}</article> })}{visibleCapabilities.length === 0 ? <p className="p-5 text-sm text-muted-foreground">{foundation.capabilities.length ? labels.noResults : labels.empty}</p> : null}</div></section>
      ) },
      { id: 'profiles', title: labels.profiles, children: (
        <section className="rounded-2xl border bg-surface p-5 shadow-sm"><p className="eyebrow">{labels.profiles}</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[42rem] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-3 py-3">{labels.job}</th><th className="px-3 py-3">{labels.group}</th><th className="px-3 py-3">{labels.family}</th><th className="px-3 py-3">{labels.seniority}</th><th className="px-3 py-3">{labels.status}</th></tr></thead><tbody className="divide-y">{foundation.profiles.map((profile) => <tr key={profile.job_profile_id}><td className="px-3 py-3 font-medium">{profile.job_code}</td><td className="px-3 py-3">{profile.job_group_name}</td><td className="px-3 py-3">{profile.job_family_name ?? labels.empty}</td><td className="px-3 py-3">{profile.seniority_name ?? labels.empty}</td><td className="px-3 py-3">{profile.status ?? labels.empty}</td></tr>)}</tbody></table>{foundation.profiles.length === 0 ? <p className="p-5 text-sm text-muted-foreground">{labels.empty}</p> : null}</div></section>
      ) },
    ]} />

    {modal ? <div className="fixed inset-0 z-[80] grid place-items-center bg-sidebar/70 p-4" onMouseDown={closeModal} role="presentation"><section aria-modal="true" className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border bg-surface p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()} role="dialog"><header className="flex items-start justify-between gap-4"><div><p className="eyebrow">{modal.id ? labels.edit : labels.save}</p><h2 className="mt-1 text-xl font-semibold">{modal.kind === 'capability' ? labels.capabilityDetails : modal.kind === 'level' ? labels.levels : modal.kind === 'model' ? labels.models : modal.kind === 'category' ? labels.categories : labels.seniorities}</h2></div><button aria-label={labels.cancel} className="button-secondary px-2" onClick={closeModal} type="button"><X size={17} /></button></header><div className="mt-5 grid gap-4 md:grid-cols-2">{'code' in modal ? <label className="grid gap-1 text-sm font-medium">{labels.code}<input autoFocus className="form-field uppercase" onChange={(event) => setModal({ ...modal, code: event.target.value })} value={modal.code} /></label> : null}{'name' in modal ? <label className="grid gap-1 text-sm font-medium">{labels.name}<input className="form-field" onChange={(event) => setModal({ ...modal, name: event.target.value })} value={modal.name} /></label> : null}{'description' in modal ? <label className="grid gap-1 text-sm font-medium md:col-span-2">{labels.description}<textarea className="form-field min-h-24" onChange={(event) => setModal({ ...modal, description: event.target.value })} value={modal.description} /> </label> : null}{modal.kind === 'seniority' ? <label className="grid gap-1 text-sm font-medium">{labels.levels}<input className="form-field" min="1" type="number" onChange={(event) => setModal({ ...modal, sortOrder: event.target.value })} value={modal.sortOrder} /></label> : null}{modal.kind === 'level' ? <label className="grid gap-1 text-sm font-medium">{labels.levels}<input className="form-field" min="1" type="number" onChange={(event) => setModal({ ...modal, sortOrder: event.target.value })} value={modal.sortOrder} /></label> : null}{'status' in modal ? <label className="grid gap-1 text-sm font-medium">{labels.status}<select className="form-field" onChange={(event) => setModal({ ...modal, status: event.target.value as Status })} value={modal.status}><option value="ACTIVE">{labels.active}</option><option value="INACTIVE">{labels.inactive}</option></select></label> : null}{modal.kind === 'category' ? <fieldset className="md:col-span-2"><legend className="text-sm font-medium">{labels.type}</legend><div className="mt-2 flex flex-wrap gap-2">{capabilityTypes.map((type) => <label className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" key={type}><input checked={modal.capabilityTypes.includes(type)} className="accent-primary" onChange={(event) => setModal({ ...modal, capabilityTypes: event.target.checked ? [...modal.capabilityTypes, type] : modal.capabilityTypes.filter((item) => item !== type) })} type="checkbox" />{typeLabel(type, labels)}</label>)}</div></fieldset> : null}{modal.kind === 'capability' ? <><label className="grid gap-1 text-sm font-medium">{labels.type}<select className="form-field" disabled={Boolean(modal.id)} onChange={(event) => setModal({ ...modal, capabilityType: event.target.value as CapabilityType })} value={modal.capabilityType}>{capabilityTypes.map((type) => <option key={type} value={type}>{typeLabel(type, labels)}</option>)}</select></label><label className="grid gap-1 text-sm font-medium">{labels.categories}<select className="form-field" onChange={(event) => setModal({ ...modal, categoryId: event.target.value })} value={modal.categoryId}><option value="">{labels.all}</option>{foundation.categories.filter((category) => category.status === 'ACTIVE' && category.capability_types.includes(modal.capabilityType)).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>{modal.capabilityType === 'LANGUAGE' ? <><label className="grid gap-1 text-sm font-medium">{labels.languageCode}<input className="form-field" onChange={(event) => setModal({ ...modal, languageCode: event.target.value })} value={modal.languageCode} /></label><label className="grid gap-1 text-sm font-medium">{labels.languageCefr}<select className="form-field" onChange={(event) => setModal({ ...modal, languageCefr: event.target.value })} value={modal.languageCefr}><option value="">{labels.all}</option>{['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level) => <option key={level} value={level}>{level}</option>)}</select></label><label className="inline-flex items-center gap-2 text-sm font-medium"><input checked={modal.languageIsNative} className="accent-primary" onChange={(event) => setModal({ ...modal, languageIsNative: event.target.checked })} type="checkbox" />{labels.nativeLanguage}</label></> : null}{modal.capabilityType === 'CERTIFICATE' ? <><label className="grid gap-1 text-sm font-medium">{labels.certificateIssuer}<input className="form-field" onChange={(event) => setModal({ ...modal, certificateIssuingBody: event.target.value })} value={modal.certificateIssuingBody} /></label><label className="grid gap-1 text-sm font-medium">{labels.certificateValidity}<input className="form-field" min="1" type="number" onChange={(event) => setModal({ ...modal, certificateValidityMonths: event.target.value })} value={modal.certificateValidityMonths} /></label><label className="grid gap-1 text-sm font-medium">{labels.certificateCode}<input className="form-field" onChange={(event) => setModal({ ...modal, certificateCode: event.target.value })} value={modal.certificateCode} /></label><label className="inline-flex items-center gap-2 text-sm font-medium"><input checked={modal.certificateIsPermanent} className="accent-primary" onChange={(event) => setModal({ ...modal, certificateIsPermanent: event.target.checked })} type="checkbox" />{labels.permanentCertificate}</label><label className="inline-flex items-center gap-2 text-sm font-medium"><input checked={modal.certificateRenewalRequired} className="accent-primary" onChange={(event) => setModal({ ...modal, certificateRenewalRequired: event.target.checked })} type="checkbox" />{labels.renewalRequired}</label></> : null}{(modal.capabilityType === 'COMPETENCY' || modal.capabilityType === 'SKILL' || modal.capabilityType === 'KNOWLEDGE') ? <fieldset className="md:col-span-2"><legend className="text-sm font-medium">{labels.levelContent}</legend><div className="mt-2 space-y-3">{levels.map((level) => { const draft = levelContentDraft[level.id] ?? { indicatorText: '', examples: '', coachingNotes: '' }; return <div className="rounded-xl border p-3" key={level.id}><p className="font-semibold">{level.code} Â· {level.name}</p><label className="mt-2 grid gap-1 text-sm font-medium">{labels.indicator}<textarea className="form-field min-h-20" onChange={(event) => setLevelContentDraft((current) => ({ ...current, [level.id]: { ...draft, indicatorText: event.target.value } }))} value={draft.indicatorText} /></label><div className="mt-2 grid gap-2 md:grid-cols-2"><label className="grid gap-1 text-sm font-medium">{labels.examples}<textarea className="form-field min-h-16" onChange={(event) => setLevelContentDraft((current) => ({ ...current, [level.id]: { ...draft, examples: event.target.value } }))} value={draft.examples} /></label><label className="grid gap-1 text-sm font-medium">{labels.coachingNotes}<textarea className="form-field min-h-16" onChange={(event) => setLevelContentDraft((current) => ({ ...current, [level.id]: { ...draft, coachingNotes: event.target.value } }))} value={draft.coachingNotes} /></label></div></div> })}</div></fieldset> : null}<fieldset className="md:col-span-2"><legend className="text-sm font-medium">{labels.tags}</legend><div className="mt-2 flex flex-wrap gap-2">{foundation.tags.filter((tag) => tag.is_active).map((tag) => <label className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" key={tag.id}><input checked={capabilityTagIds.includes(tag.id)} className="accent-primary" onChange={(event) => setCapabilityTagIds(event.target.checked ? [...capabilityTagIds, tag.id] : capabilityTagIds.filter((id) => id !== tag.id))} type="checkbox" />{tag.name}</label>)}</div></fieldset></> : null}</div><div className="mt-6 flex justify-end gap-2 border-t pt-5"><button className="button-secondary" disabled={saving} onClick={closeModal} type="button">{labels.cancel}</button><button className="button-primary" disabled={saving} onClick={() => void saveModal()} type="button">{labels.save}</button></div></section></div> : null}
  </div>
}
