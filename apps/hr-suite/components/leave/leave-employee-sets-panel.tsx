'use client'

import { Search } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { LeaveCatalog } from '@/lib/leave/leave-service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { CollectionToolbar } from '@/components/patterns/collection-toolbar'
import { DataTableShell } from '@/components/patterns/data-table-shell'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'

type Labels = { title: string; description: string; empty: string; add: string; addMember: string; edit: string; archive: string; name: string; profile: string; priority: string; members: string; active: string; inactive: string; search: string; showInactive: string; modalTitle: string; memberModalTitle: string; employee: string; validFrom: string; validUntil: string; descriptionField: string; save: string; cancel: string; saving: string; saved: string; failed: string; flowTitle: string; flowText: string; priorityHelp: string; memberHelp: string }
type SetDraft = { id?: string; name: string; description: string; profileId: string; priority: string; active: boolean }
type MemberDraft = { setId: string; employeeId: string; from: string; until: string }

export function LeaveEmployeeSetsPanel({ catalog, labels }: { catalog: LeaveCatalog; labels: Labels }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [setOpen, setSetOpen] = useState(false)
  const [memberOpen, setMemberOpen] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'failed'>('idle')
  const [archiveId, setArchiveId] = useState<string | null>(null)
  const emptySet = (): SetDraft => ({ name: '', description: '', profileId: catalog.profiles.find((profile) => profile.is_active)?.id ?? '', priority: '100', active: true })
  const emptyMember = (): MemberDraft => ({ setId: catalog.employeeSets.find((item) => item.is_active)?.id ?? '', employeeId: catalog.employeeSetEmployees[0]?.id ?? '', from: new Date().toISOString().slice(0, 10), until: '' })
  const [setDraft, setSetDraft] = useState<SetDraft>(emptySet())
  const [initialSetDraft, setInitialSetDraft] = useState<SetDraft>(setDraft)
  const [memberDraft, setMemberDraft] = useState<MemberDraft>(emptyMember())
  const [initialMemberDraft, setInitialMemberDraft] = useState<MemberDraft>(memberDraft)
  const profileNames = useMemo(() => new Map(catalog.profiles.map((profile) => [profile.id, profile.name])), [catalog.profiles])
  const memberCounts = useMemo(() => { const counts = new Map<string, number>(); for (const member of catalog.employeeSetMembers) counts.set(member.employee_set_id, (counts.get(member.employee_set_id) ?? 0) + 1); return counts }, [catalog.employeeSetMembers])
  const rows = useMemo(() => catalog.employeeSets.filter((item) => (showInactive || item.is_active) && item.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name)), [catalog.employeeSets, search, showInactive])

  function openCreate(): void { const next = emptySet(); setSetDraft(next); setInitialSetDraft(next); setStatus('idle'); setSetOpen(true) }
  function openEdit(row: LeaveCatalog['employeeSets'][number]): void { const next = { id: row.id, name: row.name, description: row.description ?? '', profileId: row.leave_profile_id, priority: String(row.priority), active: row.is_active }; setSetDraft(next); setInitialSetDraft(next); setStatus('idle'); setSetOpen(true) }
  function openMember(): void { const next = emptyMember(); setMemberDraft(next); setInitialMemberDraft(next); setStatus('idle'); setMemberOpen(true) }
  function closeSet(): void { setSetOpen(false); setStatus('idle') }
  function closeMember(): void { setMemberOpen(false); setStatus('idle') }

  async function saveSet(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!setDraft.name.trim() || !setDraft.profileId || !Number.isInteger(Number(setDraft.priority))) { setStatus('failed'); return }
    setStatus('saving')
    try { const response = await fetch('/api/leave/catalog', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: setDraft.id ? 'UPDATE_EMPLOYEE_SET' : 'EMPLOYEE_SET', ...(setDraft.id ? { id: setDraft.id } : {}), name: setDraft.name.trim(), description: setDraft.description.trim() || null, leaveProfileId: setDraft.profileId, priority: Number(setDraft.priority), isActive: setDraft.active }) }); if (!response.ok) throw new Error('EMPLOYEE_SET_SAVE_FAILED'); closeSet(); router.refresh() } catch { setStatus('failed') }
  }
  async function saveMember(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!memberDraft.setId || !memberDraft.employeeId || !memberDraft.from) { setStatus('failed'); return }
    setStatus('saving')
    try { const response = await fetch('/api/leave/catalog', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'EMPLOYEE_SET_MEMBER', employeeSetId: memberDraft.setId, employeeId: memberDraft.employeeId, validFrom: memberDraft.from, validUntil: memberDraft.until || null }) }); if (!response.ok) throw new Error('EMPLOYEE_SET_MEMBER_SAVE_FAILED'); closeMember(); router.refresh() } catch { setStatus('failed') }
  }
  async function archive(): Promise<void> { if (!archiveId) return; try { const response = await fetch('/api/leave/catalog', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'ARCHIVE_EMPLOYEE_SET', id: archiveId }) }); if (!response.ok) throw new Error('EMPLOYEE_SET_ARCHIVE_FAILED'); setArchiveId(null); router.refresh() } catch { setStatus('failed'); setArchiveId(null) } }

  const availableProfiles = catalog.profiles.filter((profile) => profile.is_active || profile.id === setDraft.profileId)
  return <><section className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-semibold">{labels.title}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.description}</p></div><div className="flex flex-wrap gap-2"><Button onClick={openMember} size="sm" type="button" variant="secondary">{labels.addMember}</Button><Button onClick={openCreate} size="sm" type="button">{labels.add}</Button></div></div>
    <Surface className="p-4"><h3 className="font-semibold">{labels.flowTitle}</h3><p className="mt-1 text-sm text-muted-foreground">{labels.flowText}</p><p className="mt-2 text-xs text-muted-foreground">{labels.priorityHelp}</p><p className="mt-1 text-xs text-muted-foreground">{labels.memberHelp}</p></Surface>
    <CollectionToolbar search={<TextInput aria-label={labels.search} leadingIcon={<Search aria-hidden="true" />} onChange={(event) => setSearch(event.target.value)} placeholder={labels.search} type="search" value={search} />} actions={<Checkbox checked={showInactive} label={labels.showInactive} onChange={(event) => setShowInactive(event.target.checked)} />} />
    {rows.length === 0 ? <EmptyState title={labels.empty} /> : <DataTableShell caption={labels.title}><thead className="bg-muted/40 text-xs uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-5 py-3">{labels.name}</th><th className="px-5 py-3">{labels.profile}</th><th className="px-5 py-3">{labels.priority}</th><th className="px-5 py-3">{labels.members}</th><th className="px-5 py-3">{labels.active}</th><th className="px-5 py-3" /></tr></thead><tbody className="divide-y divide-border-subtle">{rows.map((row) => <tr className={row.is_active ? '' : 'opacity-60'} key={row.id}><td className="px-5 py-4 font-semibold">{row.name}<span className="mt-1 block text-xs text-muted-foreground">{row.description ?? ''}</span></td><td className="px-5 py-4">{profileNames.get(row.leave_profile_id) ?? row.leave_profile_id}</td><td className="px-5 py-4">{row.priority}</td><td className="px-5 py-4">{memberCounts.get(row.id) ?? 0}</td><td className="px-5 py-4"><Badge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? labels.active : labels.inactive}</Badge></td><td className="px-5 py-4"><div className="flex justify-end gap-2"><Button onClick={() => openEdit(row)} size="sm" type="button" variant="secondary">{labels.edit}</Button>{row.is_active ? <Button onClick={() => setArchiveId(row.id)} size="sm" type="button" variant="danger">{labels.archive}</Button> : null}</div></td></tr>)}</tbody></DataTableShell>}
  </section>
  <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.cancel} description={labels.description} dirty={JSON.stringify(setDraft) !== JSON.stringify(initialSetDraft)} dirtyProtection={{ description: labels.failed, discardLabel: labels.cancel, keepEditingLabel: labels.cancel, title: labels.cancel }} onDiscard={closeSet} onOpenChange={(open) => { if (!open && JSON.stringify(setDraft) === JSON.stringify(initialSetDraft)) closeSet() }} onSubmit={(event) => void saveSet(event)} open={setOpen} saveLabel={labels.save} saving={status === 'saving'} title={setDraft.id ? labels.edit : labels.modalTitle}><FormField control={<TextInput maxLength={160} onChange={(event) => setSetDraft((current) => ({ ...current, name: event.target.value }))} required value={setDraft.name} />} label={labels.name} required /><FormField control={<DropdownSelect aria-label={labels.profile} onChange={(event) => setSetDraft((current) => ({ ...current, profileId: event.target.value }))} searchable searchPlaceholder={labels.profile} value={setDraft.profileId}><option value="" />{availableProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</DropdownSelect>} label={labels.profile} required /><FormField control={<TextInput min="1" onChange={(event) => setSetDraft((current) => ({ ...current, priority: event.target.value }))} required type="number" value={setDraft.priority} />} label={labels.priority} required /><Checkbox checked={setDraft.active} label={labels.active} onChange={(event) => setSetDraft((current) => ({ ...current, active: event.target.checked }))} /><FormField control={<Textarea maxLength={500} onChange={(event) => setSetDraft((current) => ({ ...current, description: event.target.value }))} value={setDraft.description} />} label={labels.descriptionField} />{status === 'failed' ? <p className="text-sm text-destructive" role="alert">{labels.failed}</p> : null}</FormDrawer>
  <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.cancel} description={labels.description} dirty={JSON.stringify(memberDraft) !== JSON.stringify(initialMemberDraft)} dirtyProtection={{ description: labels.failed, discardLabel: labels.cancel, keepEditingLabel: labels.cancel, title: labels.cancel }} onDiscard={closeMember} onOpenChange={(open) => { if (!open && JSON.stringify(memberDraft) === JSON.stringify(initialMemberDraft)) closeMember() }} onSubmit={(event) => void saveMember(event)} open={memberOpen} saveLabel={labels.save} saving={status === 'saving'} title={labels.memberModalTitle}><FormField control={<DropdownSelect aria-label={labels.name} onChange={(event) => setMemberDraft((current) => ({ ...current, setId: event.target.value }))} searchable searchPlaceholder={labels.name} value={memberDraft.setId}><option value="" />{catalog.employeeSets.filter((set) => set.is_active).map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}</DropdownSelect>} label={labels.name} required /><FormField control={<DropdownSelect aria-label={labels.employee} onChange={(event) => setMemberDraft((current) => ({ ...current, employeeId: event.target.value }))} searchable searchPlaceholder={labels.employee} value={memberDraft.employeeId}><option value="" />{catalog.employeeSetEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employee_number} · {employee.employee_name}</option>)}</DropdownSelect>} label={labels.employee} required /><FormField control={<TextInput onChange={(event) => setMemberDraft((current) => ({ ...current, from: event.target.value }))} required type="date" value={memberDraft.from} />} label={labels.validFrom} required /><FormField control={<TextInput onChange={(event) => setMemberDraft((current) => ({ ...current, until: event.target.value }))} type="date" value={memberDraft.until} />} label={labels.validUntil} />{status === 'failed' ? <p className="text-sm text-destructive" role="alert">{labels.failed}</p> : null}</FormDrawer>
  <ConfirmDialog cancelLabel={labels.cancel} confirmLabel={labels.archive} description={labels.description} destructive onConfirm={() => void archive()} onOpenChange={(open) => { if (!open) setArchiveId(null) }} open={archiveId !== null} title={labels.archive} />
  </>
}
