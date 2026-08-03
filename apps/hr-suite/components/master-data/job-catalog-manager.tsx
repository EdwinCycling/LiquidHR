'use client'

import { ArrowDownUp, ChevronDown, Network, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

interface Family { id: string; code: string; name: string; description: string | null; status: string }
interface Group { id: string; code: string; name: string; description: string | null; is_active: boolean; job_family_id: string | null }
interface JobRevision { id: string; name: string; description: string | null; valid_from: string; valid_until: string | null }
interface Seniority { id: string; code: string; name: string; description: string | null; sort_order: number; status: string }
interface Job { id: string; code: string; job_group_id: string; job_group_ids: string[]; seniority_id: string | null; is_active: boolean; job_revisions: JobRevision[] }
interface Labels {
  groups: string; jobs: string; code: string; name: string; description: string; relatedJobs: string; selectGroup: string
  noGroupSelected: string; createGroup: string; createJob: string; edit: string; save: string; delete: string; deleteConfirm: string
  inUse: string; saving: string; failed: string; empty: string; active: string; inactive: string; activate: string; deactivate: string
  groupSelection: string; groupRequired: string; search: string; sortBy: string; sortCode: string; sortName: string; sortStatus: string
  allGroups: string; addNew: string; cancel: string; close: string; create: string; editGroup: string; editJob: string
  confirmDeleteTitle: string; confirmDeleteBody: string; confirmDelete: string; noResults: string; listDescription: string
  filters: string; graphTitle: string; graphSubtitle: string; jobsInGroup: string; noJobsInGroup: string; family: string
  allFamilies: string; noFamily: string; seniority: string; noSeniority: string; familyContext: string
}

type ModalState = { kind: 'group' | 'job'; mode: 'create' | 'edit'; id?: string } | null
type DeleteState = { kind: 'group' | 'job'; id: string; label: string } | null
type SortMode = 'code' | 'name' | 'status'

const inputClass = 'mt-1 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15'
const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition hover:border-primary/50 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50'

function latestRevision(job: Job): JobRevision | undefined {
  return [...job.job_revisions].sort((left, right) => right.valid_from.localeCompare(left.valid_from))[0]
}

function presentationName(job: Job, seniorities: Seniority[]): string {
  const baseName = latestRevision(job)?.name ?? ''
  const seniority = job.seniority_id ? seniorities.find((item) => item.id === job.seniority_id)?.name : undefined
  return seniority ? `${baseName} — ${seniority}` : baseName
}

function statusClass(active: boolean): string {
  return active ? 'bg-success-surface text-success' : 'bg-muted text-muted-foreground'
}

export function JobCatalogManager({ groups, jobs, families, seniorities, labels }: { groups: Group[]; jobs: Job[]; families: Family[]; seniorities: Seniority[]; labels: Labels }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('code')
  const [sortAscending, setSortAscending] = useState(true)
  const [groupFilter, setGroupFilter] = useState('')
  const [familyFilter, setFamilyFilter] = useState('')
  const [modal, setModal] = useState<ModalState>(null)
  const [deleteState, setDeleteState] = useState<DeleteState>(null)

  const activeGroups = groups.filter((group) => group.is_active)
  const filteredGroups = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('nl-NL')
    return [...groups].filter((group) => {
      const matchesFamily = !familyFilter || group.job_family_id === familyFilter
      return matchesFamily && `${group.code} ${group.name} ${group.description ?? ''}`.toLocaleLowerCase('nl-NL').includes(query)
    }).sort((left, right) => compareItems(left.code, right.code, sortMode, left.name, right.name, left.is_active, right.is_active, sortAscending))
  }, [familyFilter, groups, search, sortAscending, sortMode])
  const filteredJobs = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('nl-NL')
    return [...jobs].filter((job) => {
      const revision = latestRevision(job)
      const matchesGroup = !groupFilter || job.job_group_ids.includes(groupFilter)
      const matchesFamily = !familyFilter || job.job_group_ids.some((groupId) => groups.find((group) => group.id === groupId)?.job_family_id === familyFilter)
      return matchesGroup && matchesFamily && `${job.code} ${revision?.name ?? ''} ${revision?.description ?? ''}`.toLocaleLowerCase('nl-NL').includes(query)
    }).sort((left, right) => {
      const leftRevision = latestRevision(left)
      const rightRevision = latestRevision(right)
      return compareItems(left.code, right.code, sortMode, leftRevision?.name ?? '', rightRevision?.name ?? '', left.is_active, right.is_active, sortAscending)
    })
  }, [familyFilter, groupFilter, groups, jobs, search, sortAscending, sortMode])

  async function request(endpoint: string, method: 'POST' | 'PATCH' | 'DELETE', body?: Record<string, unknown>): Promise<boolean> {
    setSaving(true); setMessage(null)
    try {
      const response = await fetch(endpoint, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { code?: string } | null
        setMessage(payload?.code === 'JOB_IN_USE' || payload?.code === 'JOB_GROUP_IN_USE' ? labels.inUse : labels.failed)
        return false
      }
      router.refresh()
      return true
    } catch {
      setMessage(labels.failed)
      return false
    } finally { setSaving(false) }
  }

  async function submitGroup(event: FormEvent<HTMLFormElement>, groupId?: string): Promise<void> {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const body = { code: form.get('code'), name: form.get('name'), description: form.get('description') || null, jobFamilyId: form.get('jobFamilyId') || null }
    if (await request(groupId ? `/api/master-data/job-groups/${groupId}` : '/api/master-data/job-groups', groupId ? 'PATCH' : 'POST', body)) setModal(null)
  }

  async function submitJob(event: FormEvent<HTMLFormElement>, jobId?: string): Promise<void> {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const jobGroupIds = form.getAll('jobGroupIds').map(String)
    if (jobGroupIds.length === 0) { setMessage(labels.groupRequired); return }
    const body = { code: form.get('code'), name: form.get('name'), description: form.get('description') || null, jobGroupIds, seniorityId: form.get('seniorityId') || null }
    if (await request(jobId ? `/api/master-data/jobs/${jobId}` : '/api/master-data/jobs', jobId ? 'PATCH' : 'POST', body)) setModal(null)
  }

  async function toggleGroup(group: Group): Promise<void> { await request(`/api/master-data/job-groups/${group.id}`, 'PATCH', { isActive: !group.is_active }) }
  async function toggleJob(job: Job): Promise<void> { await request(`/api/master-data/jobs/${job.id}`, 'PATCH', { isActive: !job.is_active }) }

  async function confirmDelete(): Promise<void> {
    if (!deleteState) return
    const endpoint = deleteState.kind === 'group' ? `/api/master-data/job-groups/${deleteState.id}` : `/api/master-data/jobs/${deleteState.id}`
    if (await request(endpoint, 'DELETE')) setDeleteState(null)
  }

  const selectedGroup = modal?.kind === 'group' && modal.id ? groups.find((group) => group.id === modal.id) : undefined
  const selectedJob = modal?.kind === 'job' && modal.id ? jobs.find((job) => job.id === modal.id) : undefined
  const selectedRevision = selectedJob ? latestRevision(selectedJob) : undefined
  const hasFilters = Boolean(search || groupFilter || familyFilter)

  return <div className="space-y-6">
    {message ? <p aria-live="polite" className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">{message}</p> : null}
    <section className="rounded-2xl border bg-surface p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="eyebrow text-primary">{labels.groups} &amp; {labels.jobs}</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">{groups.length + jobs.length}</h2><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{labels.listDescription}</p></div>
        <div className="flex flex-wrap gap-2"><button className="button-secondary" disabled={saving} onClick={() => setModal({ kind: 'group', mode: 'create' })} type="button"><Plus size={16} />{labels.createGroup}</button><button className="button-primary" disabled={saving || activeGroups.length === 0} onClick={() => setModal({ kind: 'job', mode: 'create' })} type="button"><Plus size={16} />{labels.createJob}</button></div>
      </div>
      <details className="group mt-6 rounded-xl border bg-muted/20">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold"><span className="inline-flex items-center gap-2"><Search size={16} />{labels.filters}</span><ChevronDown className="transition group-open:rotate-180" size={17} /></summary>
        <div className="border-t p-4"><div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_14rem_14rem]">
          <label className="relative block"><span className="sr-only">{labels.search}</span><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} /><input className={`${inputClass} pl-10`} onChange={(event) => setSearch(event.target.value)} placeholder={labels.search} value={search} /></label>
          <label><span className="sr-only">{labels.sortBy}</span><select className={inputClass} onChange={(event) => setSortMode(event.target.value as SortMode)} value={sortMode}><option value="code">{labels.sortCode}</option><option value="name">{labels.sortName}</option><option value="status">{labels.sortStatus}</option></select></label>
          <label><span className="sr-only">{labels.selectGroup}</span><select className={inputClass} onChange={(event) => setGroupFilter(event.target.value)} value={groupFilter}><option value="">{labels.allGroups}</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.code} · {group.name}</option>)}</select></label>
          <label><span className="sr-only">{labels.family}</span><select className={inputClass} onChange={(event) => setFamilyFilter(event.target.value)} value={familyFilter}><option value="">{labels.allFamilies}</option>{families.map((family) => <option key={family.id} value={family.id}>{family.code} · {family.name}</option>)}</select></label>
        </div><button className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground" onClick={() => setSortAscending((current) => !current)} type="button"><ArrowDownUp size={14} />{labels.sortBy}: {sortAscending ? 'A-Z' : 'Z-A'}</button></div>
      </details>
    </section>

    <section className="rounded-2xl border bg-surface p-5 shadow-sm sm:p-6">
      <header className="flex items-start gap-3"><span className="rounded-xl bg-primary/10 p-2 text-primary"><Network size={19} /></span><div><h2 className="text-lg font-semibold">{labels.graphTitle}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.graphSubtitle}</p></div></header>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{groups.map((group) => {
        const related = jobs.filter((job) => job.job_group_ids.includes(group.id))
        const family = group.job_family_id ? families.find((item) => item.id === group.job_family_id) : undefined
        return <button className="rounded-2xl border bg-background p-4 text-left transition hover:border-primary/50 hover:shadow-sm" key={group.id} onClick={() => setModal({ kind: 'group', mode: 'edit', id: group.id })} type="button">
          <div className="flex items-center justify-between gap-3"><span className="font-semibold">{group.code} · {group.name}</span><StatusPill active={group.is_active} labels={labels} /></div><p className="mt-1 text-xs text-muted-foreground">{family?.name ?? labels.noFamily}</p>
           <div className="mt-4 border-l-2 border-primary/30 pl-4">{related.length === 0 ? <p className="text-xs text-muted-foreground">{labels.noJobsInGroup}</p> : <ul className="space-y-2">{related.map((job) => <li className="rounded-lg bg-muted/60 px-3 py-2 text-sm" key={job.id}><strong>{job.code}</strong><span className="ml-2">{presentationName(job, seniorities)}</span></li>)}</ul>}</div>
        </button>
      })}</div>
    </section>

    <div className="grid gap-6 xl:grid-cols-2">
      <CatalogList title={labels.groups} count={filteredGroups.length} empty={hasFilters ? labels.noResults : labels.empty}>{filteredGroups.map((group) => <div className="flex flex-col gap-3 border-b py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between" key={group.id}>
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong>{group.code}</strong><span className="truncate">{group.name}</span><StatusPill active={group.is_active} labels={labels} /></div><p className="mt-1 text-xs text-muted-foreground">{group.job_family_id ? families.find((family) => family.id === group.job_family_id)?.name : labels.noFamily} · {jobs.filter((job) => job.job_group_ids.includes(group.id)).length} {labels.relatedJobs}{group.description ? ` · ${group.description}` : ''}</p></div>
        <RowActions disabled={saving} onEdit={() => setModal({ kind: 'group', mode: 'edit', id: group.id })} onToggle={() => void toggleGroup(group)} onDelete={() => setDeleteState({ kind: 'group', id: group.id, label: `${group.code} · ${group.name}` })} active={group.is_active} labels={labels} />
      </div>)}</CatalogList>
      <CatalogList title={labels.jobs} count={filteredJobs.length} empty={hasFilters ? labels.noResults : labels.empty}>{filteredJobs.map((job) => { const revision = latestRevision(job); return <div className="flex flex-col gap-3 border-b py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between" key={job.id}>
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong>{job.code}</strong><span className="truncate">{revision?.name}</span><StatusPill active={job.is_active} labels={labels} /></div><div className="mt-2 flex flex-wrap gap-1.5">{job.job_group_ids.map((groupId) => { const group = groups.find((item) => item.id === groupId); return group ? <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground" key={groupId}>{group.code}</span> : null })}<span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] text-primary">{job.seniority_id ? seniorities.find((item) => item.id === job.seniority_id)?.name ?? labels.noSeniority : labels.noSeniority}</span></div></div>
        <RowActions disabled={saving} onEdit={() => setModal({ kind: 'job', mode: 'edit', id: job.id })} onToggle={() => void toggleJob(job)} onDelete={() => setDeleteState({ kind: 'job', id: job.id, label: `${job.code} · ${revision?.name ?? ''}` })} active={job.is_active} labels={labels} />
      </div> })}</CatalogList>
    </div>

    {modal ? <div aria-label={labels.close} className="fixed inset-0 z-50 grid place-items-center bg-sidebar/60 p-4 backdrop-blur-sm" onMouseDown={() => setModal(null)} role="presentation"><section aria-labelledby="job-catalog-modal-title" aria-modal="true" className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border bg-surface p-5 shadow-2xl sm:p-6" onMouseDown={(event) => event.stopPropagation()} role="dialog"><header className="flex items-start justify-between gap-4"><div><p className="eyebrow text-primary">{modal.mode === 'create' ? labels.create : labels.edit}</p><h2 className="mt-1 text-xl font-semibold" id="job-catalog-modal-title">{modal.kind === 'group' ? (modal.mode === 'create' ? labels.createGroup : labels.editGroup) : (modal.mode === 'create' ? labels.createJob : labels.editJob)}</h2></div><button aria-label={labels.close} className={secondaryButton} onClick={() => setModal(null)} type="button"><X size={17} /></button></header>
      {modal.kind === 'group' ? <form className="mt-6 grid gap-4" key={`${modal.kind}-${modal.mode}-${modal.id ?? 'new'}`} onSubmit={(event) => void submitGroup(event, selectedGroup?.id)}><Field label={labels.code} name="code" defaultValue={selectedGroup?.code} /><Field label={labels.name} name="name" defaultValue={selectedGroup?.name} /><TextAreaField label={labels.description} name="description" defaultValue={selectedGroup?.description ?? ''} /><label className="text-sm font-semibold">{labels.family}<select className={inputClass} defaultValue={selectedGroup?.job_family_id ?? ''} name="jobFamilyId"><option value="">{labels.noFamily}</option>{families.filter((family) => family.status === 'ACTIVE' || family.id === selectedGroup?.job_family_id).map((family) => <option key={family.id} value={family.id}>{family.code} · {family.name}</option>)}</select></label>{selectedGroup ? <section className="rounded-xl border p-4"><h3 className="text-sm font-semibold">{labels.jobsInGroup}</h3>{jobs.filter((job) => job.job_group_ids.includes(selectedGroup.id)).length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{labels.noJobsInGroup}</p> : <ul className="mt-3 grid gap-2">{jobs.filter((job) => job.job_group_ids.includes(selectedGroup.id)).map((job) => <li className="rounded-lg bg-muted px-3 py-2 text-sm" key={job.id}><strong>{job.code}</strong><span className="ml-2">{latestRevision(job)?.name}</span></li>)}</ul>}</section> : null}<ModalButtons cancel={labels.cancel} save={modal.mode === 'create' ? labels.create : labels.save} saving={saving} savingLabel={labels.saving} onCancel={() => setModal(null)} /></form> : <form className="mt-6 grid gap-4" key={`${modal.kind}-${modal.mode}-${modal.id ?? 'new'}`} onSubmit={(event) => void submitJob(event, selectedJob?.id)}><Field label={labels.code} name="code" defaultValue={selectedJob?.code} /><Field label={labels.name} name="name" defaultValue={selectedRevision?.name} /><TextAreaField label={labels.description} name="description" defaultValue={selectedRevision?.description ?? ''} /><label className="text-sm font-semibold">{labels.seniority}<select className={inputClass} defaultValue={selectedJob?.seniority_id ?? ''} name="seniorityId"><option value="">{labels.noSeniority}</option>{seniorities.filter((seniority) => seniority.status === 'ACTIVE' || seniority.id === selectedJob?.seniority_id).map((seniority) => <option key={seniority.id} value={seniority.id}>{seniority.code} · {seniority.name}</option>)}</select></label><fieldset className="rounded-xl border p-4"><legend className="px-1 text-sm font-semibold">{labels.groupSelection}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{groups.filter((group) => group.is_active || selectedJob?.job_group_ids.includes(group.id)).map((group) => <label className="flex items-center gap-2 text-sm" key={group.id}><input defaultChecked={modal.mode === 'edit' ? selectedJob?.job_group_ids.includes(group.id) : group.id === activeGroups[0]?.id} name="jobGroupIds" type="checkbox" value={group.id} />{group.code} · {group.name}</label>)}</div></fieldset><ModalButtons cancel={labels.cancel} save={modal.mode === 'create' ? labels.create : labels.save} saving={saving} savingLabel={labels.saving} onCancel={() => setModal(null)} /></form>}
    </section></div> : null}
    {deleteState ? <div aria-label={labels.close} className="fixed inset-0 z-[60] grid place-items-center bg-sidebar/60 p-4 backdrop-blur-sm" onMouseDown={() => setDeleteState(null)} role="presentation"><section aria-labelledby="delete-modal-title" aria-modal="true" className="w-full max-w-md rounded-2xl border bg-surface p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()} role="dialog"><h2 className="text-xl font-semibold" id="delete-modal-title">{labels.confirmDeleteTitle}</h2><p className="mt-3 text-sm text-muted-foreground">{labels.confirmDeleteBody} <strong className="text-foreground">{deleteState.label}</strong></p><div className="mt-6 flex justify-end gap-2"><button className={secondaryButton} disabled={saving} onClick={() => setDeleteState(null)} type="button">{labels.cancel}</button><button className="inline-flex items-center gap-2 rounded-xl bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground" disabled={saving} onClick={() => void confirmDelete()} type="button"><Trash2 size={16} />{labels.confirmDelete}</button></div></section></div> : null}
  </div>
}

function compareItems(leftCode: string, rightCode: string, mode: SortMode, leftName: string, rightName: string, leftActive: boolean, rightActive: boolean, ascending: boolean): number {
  const result = mode === 'name' ? leftName.localeCompare(rightName, 'nl-NL') : mode === 'status' ? Number(rightActive) - Number(leftActive) || leftCode.localeCompare(rightCode, 'nl-NL') : leftCode.localeCompare(rightCode, 'nl-NL')
  return ascending ? result : -result
}

function CatalogList({ title, count, empty, children }: { title: string; count: number; empty: string; children: ReactNode }) {
  return <section className="rounded-2xl border bg-surface p-5 shadow-sm sm:p-6"><header className="flex items-center justify-between gap-3 border-b pb-4"><div><p className="eyebrow text-primary">{title}</p><h2 className="mt-1 text-2xl font-semibold">{count}</h2></div><span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">{title}</span></header>{count === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">{empty}</p> : <div>{children}</div>}</section>
}

function StatusPill({ active, labels }: { active: boolean; labels: Labels }) {
  return <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusClass(active)}`}>{active ? labels.active : labels.inactive}</span>
}

function RowActions({ active, disabled, labels, onEdit, onToggle, onDelete }: { active: boolean; disabled: boolean; labels: Labels; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  return <div className="flex shrink-0 flex-wrap gap-2"><button aria-label={labels.edit} className={secondaryButton} disabled={disabled} onClick={onEdit} type="button"><Pencil size={15} />{labels.edit}</button><button className={secondaryButton} disabled={disabled} onClick={onToggle} type="button">{active ? labels.deactivate : labels.activate}</button><button aria-label={labels.delete} className="inline-flex items-center justify-center rounded-xl border border-destructive/30 px-3 py-2 text-destructive transition hover:bg-destructive/10 disabled:opacity-50" disabled={disabled} onClick={onDelete} type="button"><Trash2 size={15} /></button></div>
}

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string }) {
  return <label className="text-sm font-semibold">{label}<input className={inputClass} defaultValue={defaultValue} name={name} required /></label>
}

function TextAreaField({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return <label className="text-sm font-semibold">{label}<textarea className={inputClass} defaultValue={defaultValue} name={name} rows={3} /></label>
}

function ModalButtons({ cancel, save, saving, savingLabel, onCancel }: { cancel: string; save: string; saving: boolean; savingLabel: string; onCancel: () => void }) {
  return <div className="flex justify-end gap-2 border-t pt-4"><button className={secondaryButton} disabled={saving} onClick={onCancel} type="button">{cancel}</button><button className="button-primary" disabled={saving} type="submit">{saving ? savingLabel : save}</button></div>
}
