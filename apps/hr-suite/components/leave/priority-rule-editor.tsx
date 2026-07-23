'use client'

import Link from 'next/link'
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Save, Trash2 } from 'lucide-react'
import { FormEvent, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LeaveCatalog } from '@/lib/leave/leave-service'

type PriorityItem = { leaveTypeId: string; sortOrder: number }
type ExistingRule = LeaveCatalog['priorityRules'][number]
type PriorityEditorLabels = {
  save: string
  saving: string
  back: string
  profile: string
  name: string
  validFrom: string
  validUntil: string
  noEnd: string
  active: string
  activeHint: string
  orderTitle: string
  orderHint: string
  first: string
  last: string
  addType: string
  remove: string
  moveUp: string
  moveDown: string
  noTypes: string
  failed: string
  newTitle: string
  editTitle: string
  year: string
}

export function PriorityRuleEditor({ catalog, existing, labels, year }: { catalog: LeaveCatalog; existing?: ExistingRule; labels: PriorityEditorLabels; year: number }) {
  const router = useRouter()
  const initialItems = existing ? catalog.priorityRuleItems.filter((item) => item.priority_rule_id === existing.id).sort((a, b) => a.sort_order - b.sort_order).map((item) => ({ leaveTypeId: item.leave_type_id, sortOrder: item.sort_order })) : []
  const [name, setName] = useState(existing?.name ?? '')
  const [profileId, setProfileId] = useState(existing?.leave_profile_id ?? catalog.profiles.find((profile) => profile.is_active)?.id ?? '')
  const [validFrom, setValidFrom] = useState(existing?.valid_from ?? `${year}-01-01`)
  const [validUntil, setValidUntil] = useState(existing?.valid_until ?? '')
  const [active, setActive] = useState(existing?.is_active ?? true)
  const [items, setItems] = useState<PriorityItem[]>(initialItems)
  const [selectedTypeId, setSelectedTypeId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const leaveTypes = useMemo(() => catalog.leaveTypes.filter((leaveType) => leaveType.is_active), [catalog.leaveTypes])
  const leaveTypeMap = useMemo(() => new Map(catalog.leaveTypes.map((leaveType) => [leaveType.id, leaveType])), [catalog.leaveTypes])
  const availableTypes = leaveTypes.filter((leaveType) => !items.some((item) => item.leaveTypeId === leaveType.id))

  const addType = () => {
    if (!selectedTypeId) return
    setItems((current) => [...current, { leaveTypeId: selectedTypeId, sortOrder: current.length + 1 }])
    setSelectedTypeId('')
  }
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    setItems((current) => { const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next.map((item, itemIndex) => ({ ...item, sortOrder: itemIndex + 1 })) })
  }
  const remove = (index: number) => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, sortOrder: itemIndex + 1 })))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const response = await fetch('/api/leave/catalog', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: existing ? 'UPDATE_PRIORITY_RULE' : 'PRIORITY_RULE', ...(existing ? { id: existing.id } : {}), leaveProfileId: profileId, name, validFrom, validUntil: validUntil || null, isActive: active, items: items.map((item, index) => ({ leaveTypeId: item.leaveTypeId, sortOrder: index + 1 })) }) })
    if (!response.ok) { setError(labels.failed); setSaving(false); return }
    router.push(`/settings/leave-accrual/priority-rules?year=${year}`)
    router.refresh()
  }

  return (
    <form className="space-y-6" onSubmit={submit}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Link aria-label={labels.back} className="rounded-full p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground" href={`/settings/leave-accrual/priority-rules?year=${year}`}><ArrowLeft aria-hidden="true" size={19} /></Link><div><p className="text-sm text-muted-foreground">{labels.year}</p><h2 className="text-2xl font-bold tracking-tight">{existing ? labels.editTitle : labels.newTitle}</h2></div></div><button className="button-primary gap-2" disabled={saving} type="submit"><Save aria-hidden="true" size={17} />{saving ? labels.saving : labels.save}</button></div>
      <section className="rounded-2xl border bg-surface p-6 shadow-sm"><div className="grid gap-5 md:grid-cols-2"><label className="space-y-2 text-sm font-semibold">{labels.name}<input className="field-input" onChange={(event) => setName(event.target.value)} required value={name} /></label><label className="space-y-2 text-sm font-semibold">{labels.profile}<select className="field-input" onChange={(event) => setProfileId(event.target.value)} required value={profileId}>{catalog.profiles.filter((profile) => profile.is_active).map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label><label className="space-y-2 text-sm font-semibold">{labels.validFrom}<input className="field-input" onChange={(event) => setValidFrom(event.target.value)} required type="date" value={validFrom} /></label><label className="space-y-2 text-sm font-semibold">{labels.validUntil}<input className="field-input" onChange={(event) => setValidUntil(event.target.value)} type="date" value={validUntil} /><span className="block text-xs font-normal text-muted-foreground">{labels.noEnd}</span></label></div><label className="mt-5 inline-flex items-center gap-3 text-sm font-semibold"><input checked={active} className="size-4 accent-primary" onChange={(event) => setActive(event.target.checked)} type="checkbox" />{labels.active}<span className="text-xs font-normal text-muted-foreground">{labels.activeHint}</span></label></section>
      <section className="overflow-hidden rounded-2xl border bg-surface shadow-sm"><div className="border-b px-6 py-5"><h3 className="font-semibold">{labels.orderTitle}</h3><p className="mt-1 text-sm text-muted-foreground">{labels.orderHint}</p></div>{items.length === 0 ? <p className="p-6 text-sm text-muted-foreground">{labels.noTypes}</p> : <ol className="divide-y">{items.map((item, index) => { const leaveType = leaveTypeMap.get(item.leaveTypeId); return <li className="flex items-center gap-3 px-6 py-4" key={item.leaveTypeId}><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{index + 1}</span><span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ backgroundColor: leaveType?.color_code ?? 'var(--color-primary)' }} /><span className="min-w-0 flex-1 font-semibold">{leaveType?.name ?? item.leaveTypeId}</span>{index === 0 && <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{labels.first}</span>}{index === items.length - 1 && <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">{labels.last}</span>}<button aria-label={labels.moveUp} className="rounded p-2 text-primary disabled:opacity-30" disabled={index === 0} onClick={() => move(index, -1)} type="button"><ArrowUp aria-hidden="true" size={16} /></button><button aria-label={labels.moveDown} className="rounded p-2 text-primary disabled:opacity-30" disabled={index === items.length - 1} onClick={() => move(index, 1)} type="button"><ArrowDown aria-hidden="true" size={16} /></button><button aria-label={labels.remove} className="rounded p-2 text-destructive" onClick={() => remove(index)} type="button"><Trash2 aria-hidden="true" size={16} /></button></li> })}</ol>}<div className="flex flex-wrap items-center gap-3 border-t bg-muted/30 px-6 py-4"><select aria-label={labels.addType} className="field-input max-w-md" onChange={(event) => setSelectedTypeId(event.target.value)} value={selectedTypeId}><option value="">{labels.addType}</option>{availableTypes.map((leaveType) => <option key={leaveType.id} value={leaveType.id}>{leaveType.name}</option>)}</select><button className="button-secondary gap-2" disabled={!selectedTypeId} onClick={addType} type="button"><Plus aria-hidden="true" size={16} />{labels.addType}</button></div></section>
      {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{error}</p>}
    </form>
  )
}
