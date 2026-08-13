'use client'

import { useMemo, useState } from 'react'
import type { GuidedLibraryItem, GuidedSet, RecruitmentSettings } from '@/lib/recruitment/guided-service'

type PipelineStage = { readonly id: string; readonly code: string; readonly name: string; readonly sort_order: number; readonly is_active: boolean; readonly version: number }
type Tab = 'library' | 'sets' | 'pipeline' | 'privacy'
type ItemDraft = { readonly id?: string; readonly itemType: GuidedLibraryItem['itemType']; readonly stableCode: string; readonly title: string; readonly prompt: string; readonly expectedVersion?: number }
type SetDraft = { readonly id?: string; readonly stableCode: string; readonly name: string; readonly description: string; readonly itemIds: readonly string[]; readonly isActive: boolean; readonly expectedVersion?: number }
type StageDraft = { readonly id?: string; readonly code: string; readonly name: string; readonly sortOrder: number; readonly isActive: boolean; readonly expectedVersion?: number }

interface Labels {
  readonly eyebrow: string; readonly title: string; readonly description: string; readonly library: string; readonly sets: string; readonly pipeline: string; readonly privacy: string; readonly analytics: string
  readonly search: string; readonly allTypes: string; readonly system: string; readonly hrGroup: string; readonly active: string; readonly inactive: string; readonly enabled: string; readonly disabled: string
  readonly applicationQuestion: string; readonly interviewQuestion: string; readonly criterion: string; readonly preparation: string; readonly retentionDays: string; readonly retentionHelp: string; readonly longRetentionWarning: string
  readonly saveSettings: string; readonly saved: string; readonly saveFailed: string; readonly version: string; readonly noItems: string; readonly noSets: string; readonly noStages: string
  readonly addItem: string; readonly editItem: string; readonly stableCode: string; readonly titleLabel: string; readonly contentPrompt: string; readonly type: string; readonly createItem: string; readonly updateItem: string; readonly cancel: string
  readonly addSet: string; readonly setName: string; readonly setDescription: string; readonly selectItems: string; readonly createSet: string; readonly updateSet: string; readonly setSaved: string; readonly itemSaved: string
  readonly addStage: string; readonly stageCode: string; readonly stageName: string; readonly stageSaved: string
}

interface Props { readonly initial: { readonly library: readonly GuidedLibraryItem[]; readonly sets: readonly GuidedSet[]; readonly settings: RecruitmentSettings; readonly pipeline: readonly PipelineStage[] }; readonly labels: Labels }

const typeLabels = (labels: Labels): Record<GuidedLibraryItem['itemType'], string> => ({ APPLICATION_QUESTION: labels.applicationQuestion, INTERVIEW_QUESTION: labels.interviewQuestion, CRITERION: labels.criterion, PREPARATION: labels.preparation })
const emptyItem = (): ItemDraft => ({ itemType: 'INTERVIEW_QUESTION', stableCode: '', title: '', prompt: '' })
const emptySet = (): SetDraft => ({ stableCode: '', name: '', description: '', itemIds: [], isActive: true })
const emptyStage = (): StageDraft => ({ code: '', name: '', sortOrder: 0, isActive: true })

async function readData<T>(response: Response): Promise<T> {
  const payload = await response.json() as { readonly data?: T; readonly code?: string }
  if (!response.ok || payload.data === undefined) throw new Error(payload.code ?? 'RECRUITMENT_OPERATION_FAILED')
  return payload.data
}

export function GuidedSettingsManager({ initial, labels }: Props) {
  const [tab, setTab] = useState<Tab>('library')
  const [query, setQuery] = useState('')
  const [type, setType] = useState<GuidedLibraryItem['itemType'] | ''>('')
  const [library, setLibrary] = useState([...initial.library])
  const [sets, setSets] = useState([...initial.sets])
  const [pipeline, setPipeline] = useState([...initial.pipeline])
  const [settings, setSettings] = useState(initial.settings)
  const [retentionDays, setRetentionDays] = useState(String(initial.settings.retentionDays))
  const [itemDraft, setItemDraft] = useState<ItemDraft | null>(null)
  const [setDraft, setSetDraft] = useState<SetDraft | null>(null)
  const [stageDraft, setStageDraft] = useState<StageDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const itemTypeLabels = typeLabels(labels)
  const filteredLibrary = useMemo(() => library.filter((item) => {
    const needle = query.trim().toLocaleLowerCase()
    return (!needle || `${item.title} ${item.stableCode}`.toLocaleLowerCase().includes(needle)) && (!type || item.itemType === type)
  }), [library, query, type])
  const setItems = useMemo(() => library.filter((item) => item.isActive && item.itemType !== 'APPLICATION_QUESTION'), [library])

  async function reloadLibrary() { setLibrary(await readData<GuidedLibraryItem[]>(await fetch('/api/recruitment/library', { cache: 'no-store' }))) }
  async function reloadSets() { setSets(await readData<GuidedSet[]>(await fetch('/api/recruitment/sets', { cache: 'no-store' }))) }
  async function reloadPipeline() {
    const data = await readData<{ readonly settings: RecruitmentSettings; readonly pipeline: readonly PipelineStage[] }>(await fetch('/api/recruitment/settings', { cache: 'no-store' }))
    setPipeline([...data.pipeline]); setSettings(data.settings); setRetentionDays(String(data.settings.retentionDays))
  }

  async function toggleItem(item: GuidedLibraryItem) {
    setFeedback(null)
    try { await readData(await fetch(`/api/recruitment/library/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !item.isEnabled }) })); setLibrary((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, isEnabled: !item.isEnabled } : candidate)) } catch { setFeedback(labels.saveFailed) }
  }

  async function saveItem() {
    if (!itemDraft) return
    setSaving(true); setFeedback(null)
    try {
      const content = itemDraft.itemType === 'CRITERION'
        ? { prompt: itemDraft.prompt, characteristicCode: 'COMMUNICATION', anchors: { '1': 'Onvoldoende zichtbaar', '2': 'Beperkt zichtbaar', '3': 'Passend zichtbaar', '4': 'Sterk zichtbaar', '5': 'Uitmuntend zichtbaar' } }
        : { prompt: itemDraft.prompt, inputType: itemDraft.itemType === 'APPLICATION_QUESTION' ? 'TEXTAREA' : 'NOTE' }
      const body = { itemType: itemDraft.itemType, stableCode: itemDraft.stableCode, title: itemDraft.title, content }
      if (itemDraft.id) await readData(await fetch(`/api/recruitment/library/${itemDraft.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: itemDraft.title, content: body.content, isActive: true, expectedVersion: itemDraft.expectedVersion }) }))
      else await readData(await fetch('/api/recruitment/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
      await reloadLibrary(); setItemDraft(null); setFeedback(labels.itemSaved)
    } catch { setFeedback(labels.saveFailed) } finally { setSaving(false) }
  }

  async function saveSet() {
    if (!setDraft) return
    setSaving(true); setFeedback(null)
    try {
      const body = { stableCode: setDraft.stableCode, name: setDraft.name, description: setDraft.description, itemIds: setDraft.itemIds, isActive: setDraft.isActive, expectedVersion: setDraft.expectedVersion }
      if (setDraft.id) await readData(await fetch(`/api/recruitment/sets/${setDraft.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
      else await readData(await fetch('/api/recruitment/sets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
      await reloadSets(); setSetDraft(null); setFeedback(labels.setSaved)
    } catch { setFeedback(labels.saveFailed) } finally { setSaving(false) }
  }

  async function saveStage() {
    if (!stageDraft) return
    setSaving(true); setFeedback(null)
    try {
      const body = { code: stageDraft.code, name: stageDraft.name, sortOrder: stageDraft.sortOrder, isActive: stageDraft.isActive, expectedVersion: stageDraft.expectedVersion }
      if (stageDraft.id) await readData(await fetch(`/api/recruitment/pipeline/${stageDraft.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
      else await readData(await fetch('/api/recruitment/pipeline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
      await reloadPipeline(); setStageDraft(null); setFeedback(labels.stageSaved)
    } catch { setFeedback(labels.saveFailed) } finally { setSaving(false) }
  }

  async function savePrivacy() {
    const value = Number(retentionDays)
    if (!Number.isInteger(value) || value < 1 || value > 3650) { setFeedback(labels.saveFailed); return }
    setSaving(true); setFeedback(null)
    try { const updated = await readData<{ readonly id: string; readonly version: number; readonly retentionDays: number }>(await fetch('/api/recruitment/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ retentionDays: value, expectedVersion: settings.version, publicBranding: settings.publicBranding, publicationDefaults: settings.publicationDefaults }) })); setSettings((current) => ({ ...current, version: updated.version, retentionDays: updated.retentionDays })); setFeedback(labels.saved) } catch { setFeedback(labels.saveFailed) } finally { setSaving(false) }
  }

  return <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10"><header><p className="eyebrow">{labels.eyebrow}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{labels.title}</h1><p className="mt-3 max-w-3xl text-muted-foreground">{labels.description}</p></header><nav aria-label={labels.title} className="mt-8 flex gap-2 overflow-x-auto border-b pb-px">{(['library', 'sets', 'pipeline', 'privacy'] as const).map((key) => <button className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold ${tab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`} key={key} onClick={() => setTab(key)} type="button">{labels[key]}</button>)}</nav>{feedback ? <p aria-live="polite" className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">{feedback}</p> : null}
    {tab === 'library' ? <section className="mt-6 rounded-2xl border bg-surface p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-semibold">{labels.library}</h2><p className="mt-1 text-sm text-muted-foreground">{library.length} · {labels.version} {Math.max(...library.map((item) => item.version), 1)}</p></div><div className="flex flex-col gap-2 sm:flex-row"><label className="sr-only" htmlFor="guided-library-search">{labels.search}</label><input className="input min-w-56" id="guided-library-search" onChange={(event) => setQuery(event.target.value)} placeholder={labels.search} value={query} /><label className="sr-only" htmlFor="guided-library-type">{labels.allTypes}</label><select className="input" id="guided-library-type" onChange={(event) => setType(event.target.value as GuidedLibraryItem['itemType'] | '')} value={type}><option value="">{labels.allTypes}</option>{(Object.keys(itemTypeLabels) as GuidedLibraryItem['itemType'][]).map((key) => <option key={key} value={key}>{itemTypeLabels[key]}</option>)}</select><button className="button-primary" onClick={() => setItemDraft(emptyItem())} type="button">{labels.addItem}</button></div></div>{itemDraft ? <GuidedDialog title={itemDraft.id ? labels.editItem : labels.addItem} onClose={() => setItemDraft(null)}><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm">{labels.type}<select className="input" disabled={Boolean(itemDraft.id)} onChange={(event) => setItemDraft({ ...itemDraft, itemType: event.target.value as GuidedLibraryItem['itemType'] })} value={itemDraft.itemType}>{(Object.keys(itemTypeLabels) as GuidedLibraryItem['itemType'][]).map((key) => <option key={key} value={key}>{itemTypeLabels[key]}</option>)}</select></label><label className="grid gap-1 text-sm">{labels.stableCode}<input className="input" disabled={Boolean(itemDraft.id)} onChange={(event) => setItemDraft({ ...itemDraft, stableCode: event.target.value.toUpperCase() })} value={itemDraft.stableCode} /></label><label className="grid gap-1 text-sm sm:col-span-2">{labels.titleLabel}<input className="input" onChange={(event) => setItemDraft({ ...itemDraft, title: event.target.value })} value={itemDraft.title} /></label><label className="grid gap-1 text-sm sm:col-span-2">{labels.contentPrompt}<textarea className="input min-h-24" onChange={(event) => setItemDraft({ ...itemDraft, prompt: event.target.value })} value={itemDraft.prompt} /></label></div><div className="mt-5 flex justify-end gap-2"><button className="button-secondary" onClick={() => setItemDraft(null)} type="button">{labels.cancel}</button><button className="button-primary" disabled={saving} onClick={saveItem} type="button">{itemDraft.id ? labels.updateItem : labels.createItem}</button></div></GuidedDialog> : null}<div className="mt-5 divide-y rounded-xl border">{filteredLibrary.length === 0 ? <p className="p-5 text-sm text-muted-foreground">{labels.noItems}</p> : filteredLibrary.map((item) => <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" key={item.id}><div className="min-w-0"><p className="font-medium">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{itemTypeLabels[item.itemType]} · {item.ownerType === 'SYSTEM' ? labels.system : labels.hrGroup} · {labels.version} {item.version}</p></div><div className="flex flex-wrap gap-2">{item.ownerType === 'HR_GROUP' ? <button className="button-secondary text-xs" onClick={() => setItemDraft({ id: item.id, itemType: item.itemType, stableCode: item.stableCode, title: item.title, prompt: typeof item.content.prompt === 'string' ? item.content.prompt : '', expectedVersion: item.version })} type="button">{labels.editItem}</button> : null}<button aria-pressed={item.isEnabled} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${item.isEnabled ? 'border-primary/40 text-primary' : 'text-muted-foreground'}`} onClick={() => toggleItem(item)} type="button">{item.isEnabled ? labels.enabled : labels.disabled}</button></div></div>)}</div></section> : null}
    {tab === 'sets' ? <section className="mt-6 rounded-2xl border bg-surface p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{labels.sets}</h2><button className="button-primary" onClick={() => setSetDraft(emptySet())} type="button">{labels.addSet}</button></div>{setDraft ? <GuidedDialog title={setDraft.id ? labels.updateSet : labels.addSet} onClose={() => setSetDraft(null)}><div className="grid gap-3"><label className="grid gap-1 text-sm">{labels.stableCode}<input className="input" disabled={Boolean(setDraft.id)} onChange={(event) => setSetDraft({ ...setDraft, stableCode: event.target.value.toUpperCase() })} value={setDraft.stableCode} /></label><label className="grid gap-1 text-sm">{labels.setName}<input className="input" onChange={(event) => setSetDraft({ ...setDraft, name: event.target.value })} value={setDraft.name} /></label><label className="grid gap-1 text-sm">{labels.setDescription}<textarea className="input min-h-20" onChange={(event) => setSetDraft({ ...setDraft, description: event.target.value })} value={setDraft.description} /></label><fieldset><legend className="text-sm font-medium">{labels.selectItems}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{setItems.map((item) => <label className="flex items-center gap-2 rounded-lg border p-2 text-sm" key={item.id}><input checked={setDraft.itemIds.includes(item.id)} onChange={(event) => setSetDraft({ ...setDraft, itemIds: event.target.checked ? [...setDraft.itemIds, item.id] : setDraft.itemIds.filter((id) => id !== item.id) })} type="checkbox" />{item.title}</label>)}</div></fieldset></div><div className="mt-5 flex justify-end gap-2"><button className="button-secondary" onClick={() => setSetDraft(null)} type="button">{labels.cancel}</button><button className="button-primary" disabled={saving || setDraft.itemIds.length === 0} onClick={saveSet} type="button">{setDraft.id ? labels.updateSet : labels.createSet}</button></div></GuidedDialog> : null}<div className="mt-5 divide-y rounded-xl border">{sets.length === 0 ? <p className="p-5 text-sm text-muted-foreground">{labels.noSets}</p> : sets.map((set) => <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between" key={set.id}><div><p className="font-medium">{set.name}</p><p className="mt-1 text-xs text-muted-foreground">{set.ownerType === 'SYSTEM' ? labels.system : labels.hrGroup} · {set.itemIds.length} · {labels.version} {set.version}</p></div><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{set.isActive ? labels.active : labels.inactive}</span>{set.ownerType === 'HR_GROUP' ? <button className="button-secondary text-xs" onClick={() => setSetDraft({ id: set.id, stableCode: set.stableCode, name: set.name, description: set.description ?? '', itemIds: set.itemIds, isActive: set.isActive, expectedVersion: set.version })} type="button">{labels.updateSet}</button> : null}</div></div>)}</div></section> : null}
    {tab === 'pipeline' ? <section className="mt-6 rounded-2xl border bg-surface p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{labels.pipeline}</h2><button className="button-primary" onClick={() => setStageDraft(emptyStage())} type="button">{labels.addStage}</button></div>{stageDraft ? <GuidedDialog title={stageDraft.id ? labels.stageSaved : labels.addStage} onClose={() => setStageDraft(null)}><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm">{labels.stageCode}<input className="input" disabled={Boolean(stageDraft.id)} onChange={(event) => setStageDraft({ ...stageDraft, code: event.target.value.toUpperCase() })} value={stageDraft.code} /></label><label className="grid gap-1 text-sm">{labels.stageName}<input className="input" onChange={(event) => setStageDraft({ ...stageDraft, name: event.target.value })} value={stageDraft.name} /></label><label className="grid gap-1 text-sm">{labels.version}<input className="input" min={0} onChange={(event) => setStageDraft({ ...stageDraft, sortOrder: Number(event.target.value) })} type="number" value={stageDraft.sortOrder} /></label><label className="flex items-center gap-2 self-end text-sm"><input checked={stageDraft.isActive} onChange={(event) => setStageDraft({ ...stageDraft, isActive: event.target.checked })} type="checkbox" />{labels.active}</label></div><div className="mt-5 flex justify-end gap-2"><button className="button-secondary" onClick={() => setStageDraft(null)} type="button">{labels.cancel}</button><button className="button-primary" disabled={saving} onClick={saveStage} type="button">{labels.stageSaved}</button></div></GuidedDialog> : null}<div className="mt-5 divide-y rounded-xl border">{pipeline.length === 0 ? <p className="p-5 text-sm text-muted-foreground">{labels.noStages}</p> : pipeline.map((stage) => <div className="flex items-center justify-between gap-4 p-4" key={stage.id}><div><p className="font-medium">{stage.name}</p><p className="mt-1 text-xs text-muted-foreground">{stage.code} · {labels.version} {stage.version}</p></div><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{stage.is_active ? labels.active : labels.inactive}</span><button className="button-secondary text-xs" onClick={() => setStageDraft({ id: stage.id, code: stage.code, name: stage.name, sortOrder: stage.sort_order, isActive: stage.is_active, expectedVersion: stage.version })} type="button">{labels.stageSaved}</button></div></div>)}</div></section> : null}
    {tab === 'privacy' ? <section className="mt-6 max-w-2xl rounded-2xl border bg-surface p-5"><h2 className="font-semibold">{labels.privacy}</h2><p className="mt-2 text-sm text-muted-foreground">{labels.retentionHelp}</p><div className="mt-5"><label className="text-sm font-medium" htmlFor="retention-days">{labels.retentionDays}</label><input className="input mt-2 w-full" id="retention-days" inputMode="numeric" min={1} max={3650} onChange={(event) => setRetentionDays(event.target.value)} type="number" value={retentionDays} />{Number(retentionDays) > 365 ? <p className="mt-2 text-sm text-amber-700">{labels.longRetentionWarning}</p> : null}</div><button className="button-primary mt-5" disabled={saving} onClick={savePrivacy} type="button">{labels.saveSettings}</button></section> : null}
  </main>
}

function GuidedDialog({ title, onClose, children }: { readonly title: string; readonly onClose: () => void; readonly children: React.ReactNode }) {
  return <div aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-primary/25 p-4" role="dialog"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border bg-surface p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><h2 className="text-lg font-semibold">{title}</h2><button aria-label={title} className="text-muted-foreground" onClick={onClose} type="button">×</button></div><div className="mt-5">{children}</div></div></div>
}
