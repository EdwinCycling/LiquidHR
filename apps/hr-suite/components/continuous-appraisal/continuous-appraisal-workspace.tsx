'use client'

import { Activity, CalendarDays, Check, ChevronDown, CircleAlert, Clock3, FileText, MessageCircle, Pencil, Plus, Search, Target, UserRound } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import { ActionMenu, type ActionMenuItem } from '@/components/ui/action-menu'
import { CollectionToolbar } from '@/components/patterns/collection-toolbar'
import { FilterBar } from '@/components/patterns/filter-bar'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { PageHeader } from '@/components/patterns/page-header'
import { RowActions } from '@/components/patterns/row-actions'
import { ScrollableTabs, TabButton } from '@/components/patterns/scrollable-tabs'
import { SectionHeader } from '@/components/patterns/section-header'
import { DetailColumns } from '@/components/layout/detail-columns'
import { PageShell } from '@/components/layout/page-shell'
import type { Locale } from '@/lib/i18n/config'
import type { ContinuousAppraisalEmployeeOption, ContinuousAppraisalItem, ContinuousAppraisalWorkspace } from '@/lib/continuous-appraisal/service'

export type ContinuousAppraisalLabels = {
  title: string; subtitle: string; employee: string; search: string; all: string; notes: string; actions: string; agreements: string; feedback: string; goals: string; meetings: string; newest: string; oldest: string; newEntry: string; addNote: string; addAction: string; addAgreement: string; addFeedback: string; addGoal: string; addMeeting: string; note: string; action: string; agreement: string; goal: string; development: string; meeting: string; entryType: string; titleLabel: string; bodyLabel: string; dateLabel: string; dueDate: string; nextMeeting: string; owner: string; status: string; priority: string; goalKind: string; open: string; waiting: string; active: string; done: string; cancelled: string; planned: string; archived: string; low: string; medium: string; high: string; save: string; cancel: string; close: string; edit: string; comments: string; addComment: string; commentPlaceholder: string; commentLimit: string; noItems: string; noItemsDescription: string; noResults: string; noResultsDescription: string; pastItem: string; futureItem: string; createdBy: string; irrelevant: string; saveFailed: string; saved: string; selectEmployee: string; managerSubtitle: string; workforceLink: string; systemEvent: string; itemCount: string; addDescription: string; editDescription: string; noEmployee: string; showComments: string; hideComments: string; dateFormatHint: string; attachments: string; addAttachment: string; attachmentTypes: string; attachmentUploadFailed: string; filters: string; filterByType: string; filterByStatus: string; filterByOwner: string; fromDate: string; toDate: string; clearFilters: string; moreActions: string; quickAdd: string; canWrite: string; readOnly: string; readOnlyDescription: string; activeFollowUp: string; upcomingItems: string; noActiveFollowUp: string; employeeNumber: string; jobTitle: string; discardTitle: string; discardDescription: string; discardConfirm: string; discardCancel: string; attachmentUnavailable: string; leftTabs: string; rightTabs: string
}

type WorkspaceMode = 'self' | 'manager' | 'hr'
export type ContinuousAppraisalFilter = 'ALL' | 'NOTE' | 'ACTION' | 'AGREEMENT' | 'FEEDBACK' | 'GOAL' | 'MEETING_SUMMARY'
type StatusFilter = 'ALL' | 'PLANNED' | 'OPEN' | 'WAITING' | 'ACTIVE' | 'DONE' | 'CANCELLED' | 'ARCHIVED'
type ItemType = Exclude<ContinuousAppraisalFilter, 'ALL'>
type Draft = { itemType: ItemType; goalKind: 'GOAL' | 'DEVELOPMENT'; title: string; body: string; occurredOn: string; dueOn: string; nextMeetingOn: string; itemStatus: Exclude<StatusFilter, 'ALL' | 'ARCHIVED'>; priority: 'LOW' | 'MEDIUM' | 'HIGH'; ownerEmployeeId: string }

export type ContinuousAppraisalInitialFilters = { search?: string; itemType?: ContinuousAppraisalFilter; itemStatus?: StatusFilter; owner?: string; fromDate?: string; toDate?: string; oldestFirst?: boolean }
type Props = { mode: WorkspaceMode; initial: ContinuousAppraisalWorkspace; employeeOptions?: ContinuousAppraisalEmployeeOption[]; labels: ContinuousAppraisalLabels; locale: Locale; initialFilters?: ContinuousAppraisalInitialFilters }

const today = () => new Date().toISOString().slice(0, 10)
const emptyDraft = (itemType: ItemType = 'NOTE', defaultOwnerId = ''): Draft => ({ itemType, goalKind: 'GOAL', title: '', body: '', occurredOn: today(), dueOn: '', nextMeetingOn: '', itemStatus: itemType === 'GOAL' ? 'ACTIVE' : 'OPEN', priority: 'MEDIUM', ownerEmployeeId: itemType === 'ACTION' ? defaultOwnerId : '' })

function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00Z`))
}

function typeLabel(value: string, labels: ContinuousAppraisalLabels): string {
  return ({ NOTE: labels.note, ACTION: labels.action, AGREEMENT: labels.agreement, FEEDBACK: labels.feedback, GOAL: labels.goal, MEETING_SUMMARY: labels.meeting, SYSTEM_EVENT: labels.systemEvent } as Record<string, string>)[value] ?? value
}

function typeTone(value: string): BadgeTone {
  return ({ ACTION: 'info', AGREEMENT: 'warning', FEEDBACK: 'warning', GOAL: 'success', MEETING_SUMMARY: 'info', NOTE: 'neutral', SYSTEM_EVENT: 'neutral' } as Record<string, BadgeTone>)[value] ?? 'neutral'
}

function statusLabel(value: string, labels: ContinuousAppraisalLabels): string {
  return ({ PLANNED: labels.planned, OPEN: labels.open, WAITING: labels.waiting, ACTIVE: labels.active, DONE: labels.done, CANCELLED: labels.cancelled, ARCHIVED: labels.archived } as Record<string, string>)[value] ?? value
}

function statusTone(value: string): BadgeTone {
  return ({ ACTIVE: 'info', CANCELLED: 'danger', DONE: 'success', OPEN: 'neutral', PLANNED: 'neutral', WAITING: 'warning', ARCHIVED: 'neutral' } as Record<string, BadgeTone>)[value] ?? 'neutral'
}

function priorityLabel(value: string | null, labels: ContinuousAppraisalLabels): string | null {
  return value ? ({ LOW: labels.low, MEDIUM: labels.medium, HIGH: labels.high } as Record<string, string>)[value] ?? value : null
}

export function filterContinuousAppraisalItems(items: readonly ContinuousAppraisalItem[], filters: { type: ContinuousAppraisalFilter; status: StatusFilter; owner: string; fromDate: string; toDate: string; search: string; oldestFirst: boolean }): ContinuousAppraisalItem[] {
  const needle = filters.search.trim().toLocaleLowerCase('nl-NL')
  return [...items].filter((item) => {
    const text = `${item.title}\n${item.body}\n${item.created_by_label}\n${item.owner_label ?? ''}`.toLocaleLowerCase('nl-NL')
    return (filters.type === 'ALL' || item.item_type === filters.type) && (filters.status === 'ALL' || item.item_status === filters.status) && (filters.owner === 'ALL' || item.owner_employee_id === filters.owner) && (!filters.fromDate || item.occurred_on >= filters.fromDate) && (!filters.toDate || item.occurred_on <= filters.toDate) && (!needle || text.includes(needle))
  }).sort((a, b) => (filters.oldestFirst ? 1 : -1) * (a.occurred_on.localeCompare(b.occurred_on) || a.created_at.localeCompare(b.created_at)))
}

export function ContinuousAppraisalWorkspace({ employeeOptions = [], initial, initialFilters, labels, locale, mode }: Props) {
  const [workspace, setWorkspace] = useState(initial)
  const [filter, setFilter] = useState<ContinuousAppraisalFilter>(initialFilters?.itemType ?? 'ALL')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialFilters?.itemStatus ?? 'ALL')
  const [ownerFilter, setOwnerFilter] = useState(initialFilters?.owner ?? 'ALL')
  const [fromDate, setFromDate] = useState(initialFilters?.fromDate ?? '')
  const [toDate, setToDate] = useState(initialFilters?.toDate ?? '')
  const [search, setSearch] = useState(initialFilters?.search ?? '')
  const [oldestFirst, setOldestFirst] = useState(initialFilters?.oldestFirst ?? false)
  const [editing, setEditing] = useState<ContinuousAppraisalItem | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft('NOTE', mode === 'self' ? initial.employeeId : ''))
  const [savedDraft, setSavedDraft] = useState<Draft>(draft)
  const [modalOpen, setModalOpen] = useState(false)
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)

  const updateUrl = (key: string, value: string) => {
    const url = new URL(window.location.href)
    if (!value || value === 'ALL') url.searchParams.delete(key)
    else url.searchParams.set(key, value)
    window.history.replaceState(null, '', url)
  }

  const items = useMemo(() => filterContinuousAppraisalItems(workspace.items, { type: filter, status: statusFilter, owner: ownerFilter, fromDate, toDate, search, oldestFirst }), [filter, fromDate, oldestFirst, ownerFilter, search, statusFilter, toDate, workspace.items])
  const ownerOptions = useMemo(() => [...new Map([...employeeOptions, workspace.employee].map((option) => [option.id, option])).values()], [employeeOptions, workspace.employee])
  const owners = useMemo(() => [...new Map(workspace.items.filter((item) => item.owner_employee_id && item.owner_label).map((item) => [item.owner_employee_id as string, item.owner_label as string])).entries()], [workspace.items])
  const activeFollowUp = workspace.items.filter((item) => item.item_type === 'ACTION' && ['PLANNED', 'OPEN', 'WAITING', 'ACTIVE'].includes(item.item_status)).length
  const upcomingItems = workspace.items.filter((item) => item.occurred_on >= today() && item.item_type !== 'SYSTEM_EVENT').length
  const dirty = modalOpen && JSON.stringify(draft) !== JSON.stringify(savedDraft)

  const reload = async (employeeId = workspace.employeeId) => {
    const response = await fetch(`/api/continuous-appraisal?employeeId=${encodeURIComponent(employeeId)}`, { cache: 'no-store' })
    if (!response.ok) throw new Error('reload')
    setWorkspace(await response.json() as ContinuousAppraisalWorkspace)
  }

  const openCreate = (itemType: ItemType = 'NOTE') => {
    const nextDraft = emptyDraft(itemType, mode === 'self' ? workspace.employeeId : '')
    setEditing(null); setDraft(nextDraft); setSavedDraft(nextDraft); setFeedback(null); setModalOpen(true)
  }

  const openEdit = (item: ContinuousAppraisalItem) => {
    const nextDraft: Draft = { itemType: item.item_type as ItemType, goalKind: item.goal_kind === 'DEVELOPMENT' ? 'DEVELOPMENT' : 'GOAL', title: item.title, body: item.body, occurredOn: item.occurred_on, dueOn: item.due_on ?? '', nextMeetingOn: item.next_meeting_on ?? '', itemStatus: item.item_status as Draft['itemStatus'], priority: (item.priority as Draft['priority']) ?? 'MEDIUM', ownerEmployeeId: item.owner_employee_id ?? '' }
    setEditing(item); setDraft(nextDraft); setSavedDraft(nextDraft); setFeedback(null); setModalOpen(true)
  }

  const closeEditor = () => { setModalOpen(false); setEditing(null); setFeedback(null) }

  const saveItem = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    if (busy || !draft.title.trim() || !draft.body.trim()) return
    setBusy(true); setFeedback(null)
    try {
      const payload = editing ? { version: editing.version, title: draft.title, body: draft.body, dueOn: draft.dueOn || null, nextMeetingOn: draft.nextMeetingOn || null, itemStatus: draft.itemStatus, priority: draft.priority, ownerEmployeeId: draft.ownerEmployeeId || null } : { employeeId: workspace.employeeId, itemType: draft.itemType, goalKind: draft.itemType === 'GOAL' ? draft.goalKind : null, title: draft.title, body: draft.body, occurredOn: draft.occurredOn, dueOn: draft.dueOn || null, nextMeetingOn: draft.nextMeetingOn || null, itemStatus: draft.itemStatus, priority: draft.priority, ownerEmployeeId: draft.ownerEmployeeId || null }
      const response = await fetch(editing ? `/api/continuous-appraisal/items/${editing.id}` : '/api/continuous-appraisal', { method: editing ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      if (!response.ok) throw new Error('save')
      await reload(); closeEditor(); setFeedback({ tone: 'success', text: labels.saved })
    } catch { setFeedback({ tone: 'danger', text: labels.saveFailed }) } finally { setBusy(false) }
  }

  const addComment = async (item: ContinuousAppraisalItem, supplied?: string) => {
    const body = (supplied ?? commentDrafts[item.id] ?? '').trim()
    if (busy || !body || body.length > 100) return
    setBusy(true); setFeedback(null)
    try {
      const response = await fetch(`/api/continuous-appraisal/items/${item.id}/comments`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body }) })
      if (!response.ok) throw new Error('comment')
      await reload(); setCommentDrafts((current) => ({ ...current, [item.id]: '' }))
    } catch { setFeedback({ tone: 'danger', text: labels.saveFailed }) } finally { setBusy(false) }
  }

  const uploadAttachment = async (item: ContinuousAppraisalItem, file: File) => {
    if (busy || !item.canEdit) return
    setBusy(true); setFeedback(null)
    try {
      const formData = new FormData(); formData.append('file', file)
      const response = await fetch(`/api/continuous-appraisal/items/${item.id}/attachments`, { method: 'POST', body: formData })
      if (!response.ok) throw new Error('attachment')
      await reload()
    } catch { setFeedback({ tone: 'danger', text: labels.attachmentUploadFailed }) } finally { setBusy(false) }
  }

  const selectEmployee = async (employeeId: string) => {
    if (!employeeId || employeeId === workspace.employeeId) return
    setBusy(true); setFeedback(null)
    try { await reload(employeeId); setOwnerFilter('ALL'); updateUrl('employeeId', employeeId); updateUrl('owner', '') } catch { setFeedback({ tone: 'danger', text: labels.saveFailed }) } finally { setBusy(false) }
  }

  const clearFilters = () => {
    setFilter('ALL'); setStatusFilter('ALL'); setOwnerFilter('ALL'); setFromDate(''); setToDate(''); setSearch(''); setOldestFirst(false)
    for (const key of ['type', 'status', 'owner', 'from', 'to', 'search', 'sort']) updateUrl(key, '')
  }

  const tabs: Array<[ContinuousAppraisalFilter, string]> = [['ALL', labels.all], ['NOTE', labels.notes], ['ACTION', labels.actions], ['AGREEMENT', labels.agreements], ['FEEDBACK', labels.feedback], ['GOAL', labels.goals], ['MEETING_SUMMARY', labels.meetings]]
  const quickItems: ActionMenuItem[] = [
    { id: 'note', label: labels.addNote, onSelect: () => openCreate('NOTE') },
    { id: 'action', label: labels.addAction, onSelect: () => openCreate('ACTION') },
    { id: 'agreement', label: labels.addAgreement, onSelect: () => openCreate('AGREEMENT') },
    { id: 'goal', label: labels.addGoal, onSelect: () => openCreate('GOAL') },
    { id: 'meeting', label: labels.addMeeting, onSelect: () => openCreate('MEETING_SUMMARY') },
    ...(workspace.canCreateFeedback ? [{ id: 'feedback', label: labels.addFeedback, onSelect: () => openCreate('FEEDBACK') }] : []),
  ]

  return <PageShell className="py-6 sm:py-8" width="wide">
    <PageHeader actions={mode !== 'self' ? <div className="grid w-full gap-1.5 sm:w-72"><label className="text-xs font-medium text-muted-foreground" htmlFor="appraisal-employee">{labels.selectEmployee}</label><DropdownSelect aria-label={labels.selectEmployee} disabled={busy} id="appraisal-employee" onChange={(event) => { void selectEmployee(event.target.value) }} searchable searchPlaceholder={labels.search} value={workspace.employeeId}>{employeeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</DropdownSelect></div> : undefined} description={mode === 'self' ? labels.subtitle : labels.managerSubtitle} title={labels.title} />
    <Surface className="mt-6 p-4 sm:p-5" variant="subtle"><div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex min-w-0 items-start gap-3"><span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] bg-accent text-primary"><UserRound size={18} /></span><div className="min-w-0"><p className="break-words text-base font-semibold">{workspace.employee.label}</p><p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{labels.employeeNumber}: {workspace.employee.employeeNumber}</span>{workspace.employee.jobTitle ? <span>{labels.jobTitle}: {workspace.employee.jobTitle}</span> : null}</p></div></div><div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:flex sm:flex-wrap sm:items-center sm:justify-end sm:gap-x-8"><div><p className="text-xs text-muted-foreground">{labels.itemCount}</p><p className="mt-0.5 font-semibold tabular-nums">{workspace.items.length}</p></div><div><p className="text-xs text-muted-foreground">{labels.activeFollowUp}</p><p className="mt-0.5 font-semibold tabular-nums">{activeFollowUp}</p></div><div><p className="text-xs text-muted-foreground">{labels.upcomingItems}</p><p className="mt-0.5 font-semibold tabular-nums">{upcomingItems}</p></div><Badge tone={workspace.canWrite ? 'success' : 'neutral'}>{workspace.canWrite ? labels.canWrite : labels.readOnly}</Badge></div></div>{!workspace.canWrite ? <p className="mt-4 flex items-start gap-2 border-t border-border-subtle pt-3 text-sm text-muted-foreground"><CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{labels.readOnlyDescription}</p> : null}</Surface>
    <div className="mt-7"><CollectionToolbar createAction={workspace.canWrite ? <div className="flex flex-wrap items-center gap-2"><ActionMenu items={quickItems} label={labels.quickAdd} /><Button onClick={() => openCreate()} type="button"><Plus aria-hidden="true" />{labels.newEntry}</Button></div> : undefined} search={<TextInput aria-label={labels.search} leadingIcon={<Search aria-hidden="true" />} onChange={(event) => { setSearch(event.target.value); updateUrl('search', event.target.value) }} placeholder={labels.search} value={search} />} sort={<Button onClick={() => { const next = !oldestFirst; setOldestFirst(next); updateUrl('sort', next ? 'oldest' : '') }} size="sm" type="button" variant="secondary"><Clock3 aria-hidden="true" />{oldestFirst ? labels.oldest : labels.newest}</Button>} /><FilterBar actions={<Button onClick={clearFilters} size="sm" type="button" variant="ghost">{labels.clearFilters}</Button>} className="mt-3"><div className="grid min-w-40 flex-1 gap-1.5"><label className="text-xs font-medium text-muted-foreground" htmlFor="appraisal-status-filter">{labels.filterByStatus}</label><DropdownSelect aria-label={labels.filterByStatus} id="appraisal-status-filter" onChange={(event) => { const next = event.target.value as StatusFilter; setStatusFilter(next); updateUrl('status', next) }} value={statusFilter}><option value="ALL">{labels.all}</option><option value="PLANNED">{labels.planned}</option><option value="OPEN">{labels.open}</option><option value="WAITING">{labels.waiting}</option><option value="ACTIVE">{labels.active}</option><option value="DONE">{labels.done}</option><option value="CANCELLED">{labels.cancelled}</option><option value="ARCHIVED">{labels.archived}</option></DropdownSelect></div><div className="grid min-w-40 flex-1 gap-1.5"><label className="text-xs font-medium text-muted-foreground" htmlFor="appraisal-owner-filter">{labels.filterByOwner}</label><DropdownSelect aria-label={labels.filterByOwner} id="appraisal-owner-filter" onChange={(event) => { const next = event.target.value; setOwnerFilter(next); updateUrl('owner', next) }} searchable searchPlaceholder={labels.search} value={ownerFilter}><option value="ALL">{labels.all}</option>{owners.map(([id, owner]) => <option key={id} value={id}>{owner}</option>)}</DropdownSelect></div><FormField className="min-w-36 flex-1" control={<TextInput aria-label={labels.fromDate} onChange={(event) => { setFromDate(event.target.value); updateUrl('from', event.target.value) }} type="date" value={fromDate} />} label={labels.fromDate} /><FormField className="min-w-36 flex-1" control={<TextInput aria-label={labels.toDate} onChange={(event) => { setToDate(event.target.value); updateUrl('to', event.target.value) }} type="date" value={toDate} />} label={labels.toDate} /></FilterBar><ScrollableTabs ariaLabel={labels.filterByType} contentProps={{ role: 'tablist' }} leftLabel={labels.leftTabs} rightLabel={labels.rightTabs} className="mt-4">{tabs.map(([key, label]) => <TabButton active={filter === key} key={key} onClick={() => { setFilter(key); updateUrl('type', key) }}>{label}</TabButton>)}</ScrollableTabs></div>
    {feedback ? <p aria-live="polite" className={`mt-4 flex items-start gap-2 border px-4 py-3 text-sm ${feedback.tone === 'danger' ? 'border-destructive/40 bg-destructive-surface text-destructive' : 'border-success/40 bg-success-surface text-success'}`} role={feedback.tone === 'danger' ? 'alert' : 'status'}><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{feedback.text}</p> : null}
    <DetailColumns aside={<AppraisalAside activeFollowUp={activeFollowUp} labels={labels} noActiveFollowUp={labels.noActiveFollowUp} upcomingItems={upcomingItems} />} className="mt-6" main={<Surface className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-4 py-3 sm:px-5"><p className="text-sm font-medium">{items.length} {labels.itemCount}</p><p className="text-xs text-muted-foreground">{workspace.employee.label}</p></div>{items.length ? <div className="divide-y divide-border-subtle">{items.map((item) => <TimelineRow busy={busy} canComment={workspace.canWrite} commentValue={commentDrafts[item.id] ?? ''} item={item} key={item.id} labels={labels} locale={locale} onAttachment={(file) => { void uploadAttachment(item, file) }} onComment={() => { void addComment(item) }} onCommentChange={(value) => setCommentDrafts((current) => ({ ...current, [item.id]: value }))} onEdit={() => openEdit(item)} onIrrelevant={() => { void addComment(item, labels.irrelevant) }} />)}</div> : <EmptyState actions={workspace.canWrite ? <Button onClick={() => openCreate()} type="button"><Plus aria-hidden="true" />{labels.newEntry}</Button> : undefined} description={search || filter !== 'ALL' || statusFilter !== 'ALL' || ownerFilter !== 'ALL' || fromDate || toDate ? labels.noResultsDescription : labels.noItemsDescription} icon={<FileText />} title={search || filter !== 'ALL' || statusFilter !== 'ALL' || ownerFilter !== 'ALL' || fromDate || toDate ? labels.noResults : labels.noItems} />}</Surface>} />
    <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.close} description={editing ? labels.editDescription : labels.addDescription} dirty={dirty} dirtyProtection={{ description: labels.discardDescription, discardLabel: labels.discardConfirm, keepEditingLabel: labels.discardCancel, title: labels.discardTitle }} onDiscard={closeEditor} onOpenChange={(nextOpen) => { if (!nextOpen) closeEditor(); else setModalOpen(true) }} onSubmit={(event) => { void saveItem(event) }} open={modalOpen} saveLabel={labels.save} saving={busy} title={editing ? labels.edit : labels.newEntry}>{feedback?.tone === 'danger' ? <p className="flex items-start gap-2 border border-destructive/40 bg-destructive-surface px-3 py-2 text-sm text-destructive" role="alert"><CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{feedback.text}</p> : null}<ItemForm draft={draft} editing={editing} employeeOptions={ownerOptions} labels={labels} onChange={(changes) => setDraft((current) => ({ ...current, ...changes }))} /></FormDrawer>
  </PageShell>
}

function AppraisalAside({ activeFollowUp, labels, noActiveFollowUp, upcomingItems }: { activeFollowUp: number; labels: ContinuousAppraisalLabels; noActiveFollowUp: string; upcomingItems: number }) {
  return <Surface className="p-4 sm:p-5" variant="subtle"><SectionHeader description={labels.addDescription} title={labels.activeFollowUp} /><dl className="mt-5 divide-y divide-border-subtle text-sm"><div className="flex items-center justify-between gap-3 py-3 first:pt-0"><dt className="text-muted-foreground">{labels.actions}</dt><dd className="font-semibold tabular-nums">{activeFollowUp}</dd></div><div className="flex items-center justify-between gap-3 py-3"><dt className="text-muted-foreground">{labels.upcomingItems}</dt><dd className="font-semibold tabular-nums">{upcomingItems}</dd></div></dl>{activeFollowUp === 0 ? <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground"><Activity aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />{noActiveFollowUp}</p> : null}</Surface>
}

function TimelineRow({ busy, canComment, commentValue, item, labels, locale, onAttachment, onComment, onCommentChange, onEdit, onIrrelevant }: { busy: boolean; canComment: boolean; commentValue: string; item: ContinuousAppraisalItem; labels: ContinuousAppraisalLabels; locale: Locale; onAttachment: (file: File) => void; onComment: () => void; onCommentChange: (value: string) => void; onEdit: () => void; onIrrelevant: () => void }) {
  const past = item.occurred_on < today()
  const menuItems: ActionMenuItem[] = canComment ? [{ id: 'irrelevant', label: labels.irrelevant, onSelect: onIrrelevant }] : []
  return <article className="grid gap-4 px-4 py-5 sm:px-5 lg:grid-cols-[8rem_minmax(0,1fr)_10rem]"><div className="text-sm text-muted-foreground"><time dateTime={item.occurred_on}>{formatDate(item.occurred_on, locale)}</time><p className="mt-1 text-xs">{past ? labels.pastItem : labels.futureItem}</p></div><div className="min-w-0"><div className="flex flex-wrap items-start gap-2"><h2 className="min-w-0 break-words text-base font-semibold">{item.title}</h2><Badge tone={typeTone(item.item_type)}>{typeLabel(item.item_type, labels)}</Badge><Badge tone={statusTone(item.item_status)}>{statusLabel(item.item_status, labels)}</Badge>{priorityLabel(item.priority, labels) ? <Badge tone="neutral">{priorityLabel(item.priority, labels)}</Badge> : null}</div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{item.body}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{item.due_on ? <span className="inline-flex items-center gap-1.5"><CalendarDays aria-hidden="true" size={13} />{labels.dueDate}: {formatDate(item.due_on, locale)}</span> : null}{item.next_meeting_on ? <span className="inline-flex items-center gap-1.5"><Target aria-hidden="true" size={13} />{labels.nextMeeting}: {formatDate(item.next_meeting_on, locale)}</span> : null}<span className="inline-flex items-center gap-1.5"><UserRound aria-hidden="true" size={13} />{labels.owner}: {item.owner_label ?? '—'}</span></div>{item.attachments.length ? <div className="mt-4 border-t border-border-subtle pt-3"><p className="text-xs font-semibold text-muted-foreground">{labels.attachments}</p><div className="mt-2 flex flex-wrap gap-2">{item.attachments.map((attachment) => <a className="inline-flex max-w-full items-center gap-1.5 break-all rounded-[var(--radius-control)] border border-border px-3 py-2 text-xs font-medium text-primary underline-offset-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={attachment.href} key={attachment.id} rel="noreferrer" target="_blank"><FileText aria-hidden="true" size={13} />{attachment.original_filename}</a>)}</div></div> : null}{item.canEdit ? <div className="mt-3"><label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-primary underline-offset-2 hover:underline"><span>{labels.addAttachment}</span><input accept="image/png,image/jpeg,image/webp,application/pdf" className="sr-only" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) onAttachment(file) }} type="file" /></label><p className="mt-1 text-xs text-muted-foreground">{labels.attachmentTypes}</p></div> : item.item_type !== 'SYSTEM_EVENT' && !item.attachments.length ? <p className="mt-3 text-xs text-muted-foreground">{labels.attachmentUnavailable}</p> : null}<details className="group mt-4 border-t border-border-subtle pt-3"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground"><span className="inline-flex items-center gap-2"><MessageCircle aria-hidden="true" size={15} />{labels.comments} ({item.comments.length})</span><ChevronDown aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-open:rotate-180" /></summary><div className="mt-3">{item.comments.length ? <div className="space-y-2">{item.comments.map((comment) => <p className="break-words border-l-2 border-accent px-3 py-2 text-sm leading-5 text-muted-foreground" key={comment.id}><span className="font-semibold text-foreground">{comment.author_label}</span> {comment.body}</p>)}</div> : <p className="text-sm text-muted-foreground">{labels.noItemsDescription}</p>}{canComment ? <div className="mt-3 flex flex-col gap-2 sm:flex-row"><TextInput aria-label={labels.addComment} maxLength={100} onChange={(event) => onCommentChange(event.target.value)} placeholder={labels.commentPlaceholder} value={commentValue} /><Button disabled={busy || !commentValue.trim()} onClick={onComment} size="sm" type="button" variant="secondary">{labels.addComment}</Button></div> : null}{canComment ? <p className="mt-1 text-right text-xs text-muted-foreground">{commentValue.length}/100 · {labels.commentLimit}</p> : null}</div></details></div><div className="flex min-w-0 items-start justify-between gap-3 border-t border-border-subtle pt-3 text-sm lg:block lg:border-t-0 lg:pt-0"><div><p className="break-words font-medium text-foreground">{item.created_by_label}</p><p className="mt-1 text-xs text-muted-foreground">{labels.createdBy}</p><time className="mt-2 block text-xs text-muted-foreground" dateTime={item.updated_at}>{formatDate(item.updated_at.slice(0, 10), locale)}</time></div><RowActions className="lg:mt-3" menuItems={menuItems} menuLabel={labels.moreActions} primaryAction={item.canEdit ? <Button onClick={onEdit} size="sm" type="button" variant="secondary"><Pencil aria-hidden="true" />{labels.edit}</Button> : undefined} /></div></article>
}

function ItemForm({ draft, editing, employeeOptions, labels, onChange }: { draft: Draft; editing: ContinuousAppraisalItem | null; employeeOptions: ContinuousAppraisalEmployeeOption[]; labels: ContinuousAppraisalLabels; onChange: (changes: Partial<Draft>) => void }) {
  const actionFields = draft.itemType === 'ACTION'
  const goalFields = draft.itemType === 'GOAL'
  const itemTypeOptions: Array<[ItemType, string]> = [['NOTE', labels.note], ['ACTION', labels.action], ['AGREEMENT', labels.agreement], ['FEEDBACK', labels.feedback], ['GOAL', labels.goal], ['MEETING_SUMMARY', labels.meeting]]
  return <div className="grid gap-4"><FormField control={<DropdownSelect disabled={editing !== null} onChange={(event) => onChange({ itemType: event.target.value as ItemType })} value={draft.itemType}>{itemTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</DropdownSelect>} label={labels.entryType} /><div className="grid gap-4 sm:grid-cols-2"><FormField control={<TextInput maxLength={160} onChange={(event) => onChange({ title: event.target.value })} required value={draft.title} />} label={labels.titleLabel} required /><FormField control={<TextInput disabled={editing !== null} onChange={(event) => onChange({ occurredOn: event.target.value })} required type="date" value={draft.occurredOn} />} label={labels.dateLabel} required /></div>{actionFields ? <div className="grid gap-4 sm:grid-cols-2"><FormField control={<TextInput onChange={(event) => onChange({ dueOn: event.target.value })} type="date" value={draft.dueOn} />} label={labels.dueDate} /><FormField control={<DropdownSelect onChange={(event) => onChange({ ownerEmployeeId: event.target.value })} searchable searchPlaceholder={labels.search} value={draft.ownerEmployeeId}><option value="">{labels.owner}</option>{employeeOptions.map((employee) => <option key={employee.id} value={employee.id}>{employee.label}</option>)}</DropdownSelect>} label={labels.owner} /></div> : null}{actionFields ? <div className="grid gap-4 sm:grid-cols-2"><FormField control={<DropdownSelect onChange={(event) => onChange({ itemStatus: event.target.value as Draft['itemStatus'] })} value={draft.itemStatus}><option value="OPEN">{labels.open}</option><option value="PLANNED">{labels.planned}</option><option value="WAITING">{labels.waiting}</option><option value="ACTIVE">{labels.active}</option><option value="DONE">{labels.done}</option><option value="CANCELLED">{labels.cancelled}</option></DropdownSelect>} label={labels.status} /><FormField control={<DropdownSelect onChange={(event) => onChange({ priority: event.target.value as Draft['priority'] })} value={draft.priority}><option value="LOW">{labels.low}</option><option value="MEDIUM">{labels.medium}</option><option value="HIGH">{labels.high}</option></DropdownSelect>} label={labels.priority} /></div> : null}{goalFields ? <div className="grid gap-4 sm:grid-cols-2"><FormField control={<DropdownSelect onChange={(event) => onChange({ goalKind: event.target.value as Draft['goalKind'] })} value={draft.goalKind}><option value="GOAL">{labels.goal}</option><option value="DEVELOPMENT">{labels.development}</option></DropdownSelect>} label={labels.goalKind} /><FormField control={<TextInput onChange={(event) => onChange({ nextMeetingOn: event.target.value })} type="date" value={draft.nextMeetingOn} />} label={labels.nextMeeting} /></div> : null}<FormField control={<Textarea maxLength={10000} onChange={(event) => onChange({ body: event.target.value })} required value={draft.body} />} description={`${draft.body.length}/10000 · ${labels.dateFormatHint}`} label={labels.bodyLabel} required /></div>
}
