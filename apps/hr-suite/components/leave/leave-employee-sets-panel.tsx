'use client'

import { Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LeaveCatalog } from '@/lib/leave/leave-service'

type Labels = {
  title: string
  description: string
  empty: string
  add: string
  addMember: string
  name: string
  profile: string
  priority: string
  members: string
  active: string
  inactive: string
  search: string
  showInactive: string
  modalTitle: string
  memberModalTitle: string
  employee: string
  validFrom: string
  validUntil: string
  descriptionField: string
  save: string
  cancel: string
  saving: string
  saved: string
  failed: string
}

export function LeaveEmployeeSetsPanel({ catalog, labels }: { catalog: LeaveCatalog; labels: Labels }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [setOpen, setSetOpen] = useState(false)
  const [memberOpen, setMemberOpen] = useState(false)
  const [setName, setSetName] = useState('')
  const [setDescription, setSetDescription] = useState('')
  const [setProfileId, setSetProfileId] = useState(catalog.profiles[0]?.id ?? '')
  const [setPriority, setSetPriority] = useState('100')
  const [setActive, setSetActive] = useState(true)
  const [memberSetId, setMemberSetId] = useState('')
  const [memberEmployeeId, setMemberEmployeeId] = useState(catalog.employeeSetEmployees[0]?.id ?? '')
  const [memberFrom, setMemberFrom] = useState(new Date().toISOString().slice(0, 10))
  const [memberUntil, setMemberUntil] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')

  const profileNames = useMemo(() => new Map(catalog.profiles.map((profile) => [profile.id, profile.name])), [catalog.profiles])
  const memberCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const member of catalog.employeeSetMembers) counts.set(member.employee_set_id, (counts.get(member.employee_set_id) ?? 0) + 1)
    return counts
  }, [catalog.employeeSetMembers])
  const rows = useMemo(() => catalog.employeeSets.filter((item) => (showInactive || item.is_active) && item.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name)), [catalog.employeeSets, search, showInactive])

  const close = () => {
    setSetOpen(false)
    setMemberOpen(false)
    setStatus('idle')
    router.refresh()
  }

  const saveSet = async () => {
    if (!setName.trim() || !setProfileId) { setStatus('failed'); return }
    setStatus('saving')
    try {
      const response = await fetch('/api/leave/catalog', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'EMPLOYEE_SET', name: setName.trim(), description: setDescription.trim() || null, leaveProfileId: setProfileId, priority: Number(setPriority), isActive: setActive }) })
      if (!response.ok) throw new Error('EMPLOYEE_SET_SAVE_FAILED')
      setStatus('saved')
      window.setTimeout(close, 250)
    } catch { setStatus('failed') }
  }

  const saveMember = async () => {
    if (!memberSetId || !memberEmployeeId || !memberFrom) { setStatus('failed'); return }
    setStatus('saving')
    try {
      const response = await fetch('/api/leave/catalog', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'EMPLOYEE_SET_MEMBER', employeeSetId: memberSetId, employeeId: memberEmployeeId, validFrom: memberFrom, validUntil: memberUntil || null }) })
      if (!response.ok) throw new Error('EMPLOYEE_SET_MEMBER_SAVE_FAILED')
      setStatus('saved')
      window.setTimeout(close, 250)
    } catch { setStatus('failed') }
  }

  return <>
    <section className="overflow-hidden rounded-2xl border bg-surface shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4"><div><h2 className="font-semibold">{labels.title}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.description}</p></div><div className="flex flex-wrap gap-2"><button className="button-secondary" onClick={() => { setMemberSetId(catalog.employeeSets[0]?.id ?? ''); setMemberOpen(true) }} type="button">{labels.addMember}</button><button className="button-primary" onClick={() => setSetOpen(true)} type="button">{labels.add}</button></div></div>
      <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3"><label className="relative min-w-56 flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><input aria-label={labels.search} className="form-field pl-9" onChange={(event) => setSearch(event.target.value)} placeholder={labels.search} value={search} /></label><label className="inline-flex items-center gap-2 text-sm text-muted-foreground"><input checked={showInactive} className="size-4 accent-primary" onChange={(event) => setShowInactive(event.target.checked)} type="checkbox" />{labels.showInactive}</label></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[48rem] text-left text-sm"><thead className="bg-muted/40 text-xs uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-5 py-3">{labels.name}</th><th className="px-5 py-3">{labels.profile}</th><th className="px-5 py-3">{labels.priority}</th><th className="px-5 py-3">{labels.members}</th><th className="px-5 py-3">{labels.active}</th></tr></thead><tbody className="divide-y">{rows.map((row) => <tr className="transition hover:bg-accent/30" key={row.id}><td className="px-5 py-4 font-semibold">{row.name}</td><td className="px-5 py-4">{profileNames.get(row.leave_profile_id) ?? row.leave_profile_id}</td><td className="px-5 py-4">{row.priority}</td><td className="px-5 py-4">{memberCounts.get(row.id) ?? 0}</td><td className="px-5 py-4">{row.is_active ? labels.active : labels.inactive}</td></tr>)}{rows.length === 0 ? <tr><td className="px-5 py-7 text-sm text-muted-foreground" colSpan={5}>{labels.empty}</td></tr> : null}</tbody></table></div>
    </section>
    {setOpen ? <div aria-modal="true" className="fixed inset-0 z-40 grid place-items-center bg-foreground/30 p-4" role="dialog"><section className="w-full max-w-2xl rounded-2xl border bg-surface p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><h2 className="text-xl font-semibold">{labels.modalTitle}</h2><button aria-label={labels.cancel} className="button-secondary px-3" onClick={close} type="button"><X size={17} /></button></div><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium"><span>{labels.name}</span><input className="form-field" onChange={(event) => setSetName(event.target.value)} value={setName} /></label><label className="grid gap-1.5 text-sm font-medium"><span>{labels.profile}</span><select className="form-field" onChange={(event) => setSetProfileId(event.target.value)} value={setProfileId}>{catalog.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label><label className="grid gap-1.5 text-sm font-medium"><span>{labels.priority}</span><input className="form-field" min="1" onChange={(event) => setSetPriority(event.target.value)} type="number" value={setPriority} /></label><label className="inline-flex items-center gap-2 self-end text-sm font-medium"><input checked={setActive} className="size-4 accent-primary" onChange={(event) => setSetActive(event.target.checked)} type="checkbox" />{labels.active}</label><label className="grid gap-1.5 text-sm font-medium md:col-span-2"><span>{labels.descriptionField}</span><textarea className="form-field min-h-20" onChange={(event) => setSetDescription(event.target.value)} value={setDescription} /></label></div><div className="mt-6 flex justify-end gap-2"><button className="button-secondary" onClick={close} type="button">{labels.cancel}</button><button className="button-primary" disabled={status === 'saving'} onClick={() => void saveSet()} type="button">{status === 'saving' ? labels.saving : labels.save}</button></div>{status === 'saved' ? <p className="mt-3 text-sm text-success">{labels.saved}</p> : status === 'failed' ? <p className="mt-3 text-sm text-destructive">{labels.failed}</p> : null}</section></div> : null}
    {memberOpen ? <div aria-modal="true" className="fixed inset-0 z-40 grid place-items-center bg-foreground/30 p-4" role="dialog"><section className="w-full max-w-2xl rounded-2xl border bg-surface p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><h2 className="text-xl font-semibold">{labels.memberModalTitle}</h2><button aria-label={labels.cancel} className="button-secondary px-3" onClick={close} type="button"><X size={17} /></button></div><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium"><span>{labels.name}</span><select className="form-field" onChange={(event) => setMemberSetId(event.target.value)} value={memberSetId}><option value="" />{catalog.employeeSets.map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}</select></label><label className="grid gap-1.5 text-sm font-medium"><span>{labels.employee}</span><select className="form-field" onChange={(event) => setMemberEmployeeId(event.target.value)} value={memberEmployeeId}><option value="" />{catalog.employeeSetEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employee_number} · {employee.employee_name}</option>)}</select></label><label className="grid gap-1.5 text-sm font-medium"><span>{labels.validFrom}</span><input className="form-field" onChange={(event) => setMemberFrom(event.target.value)} type="date" value={memberFrom} /></label><label className="grid gap-1.5 text-sm font-medium"><span>{labels.validUntil}</span><input className="form-field" onChange={(event) => setMemberUntil(event.target.value)} type="date" value={memberUntil} /></label></div><div className="mt-6 flex justify-end gap-2"><button className="button-secondary" onClick={close} type="button">{labels.cancel}</button><button className="button-primary" disabled={status === 'saving'} onClick={() => void saveMember()} type="button">{status === 'saving' ? labels.saving : labels.save}</button></div>{status === 'saved' ? <p className="mt-3 text-sm text-success">{labels.saved}</p> : status === 'failed' ? <p className="mt-3 text-sm text-destructive">{labels.failed}</p> : null}</section></div> : null}
  </>
}
