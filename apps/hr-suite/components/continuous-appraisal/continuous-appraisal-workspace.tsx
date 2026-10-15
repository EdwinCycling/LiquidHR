'use client'

import { Activity, CalendarDays, Check, ChevronDown, CircleAlert, Clock3, FileText, MessageCircle, Pencil, Plus, Search, SlidersHorizontal, Target, Trash2, UserRound, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import type { ActionMenuItem } from '@/components/ui/action-menu'
import { CollectionToolbar } from '@/components/patterns/collection-toolbar'
import { FilterBar } from '@/components/patterns/filter-bar'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { PageHeader } from '@/components/patterns/page-header'
import { RowActions } from '@/components/patterns/row-actions'
import { ScrollableTabs, TabButton } from '@/components/patterns/scrollable-tabs'
import { SectionHeader } from '@/components/patterns/section-header'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { DetailColumns } from '@/components/layout/detail-columns'
import { PageShell } from '@/components/layout/page-shell'
import type { Locale } from '@/lib/i18n/config'
import type { ContinuousAppraisalEmployeeOption, ContinuousAppraisalItem, ContinuousAppraisalWorkspace } from '@/lib/continuous-appraisal/service'

export type ContinuousAppraisalLabels = {
  title: string; subtitle: string; employee: string; search: string; all: string; notes: string; actions: string; agreements: string; feedback: string; goals: string; meetings: string; newest: string; oldest: string; newEntry: string; addNote: string; addAction: string; addAgreement: string; addFeedback: string; addGoal: string; addMeeting: string; note: string; action: string; agreement: string; goal: string; development: string; meeting: string; entryType: string; titleLabel: string; bodyLabel: string; dateLabel: string; dueDate: string; nextMeeting: string; owner: string; status: string; priority: string; goalKind: string; open: string; waiting: string; active: string; done: string; cancelled: string; planned: string; archived: string; notRelevant: string; markDone: string; deleteAction: string; deleteTitle: string; deleteDescription: string; deleteConfirm: string; deleted: string; deleteFailed: string; statusMarkedDone: string; statusMarkedNotRelevant: string; statusActionFailed: string; versionConflict: string; low: string; medium: string; high: string; save: string; cancel: string; close: string; edit: string; comments: string; addComment: string; commentPlaceholder: string; commentLimit: string; noItems: string; noItemsDescription: string; noResults: string; noResultsDescription: string; pastItem: string; futureItem: string; createdBy: string; irrelevant: string; saveFailed: string; saved: string; selectEmployee: string; managerSubtitle: string; workforceLink: string; systemEvent: string; itemCount: string; addDescription: string; editDescription: string; noEmployee: string; showComments: string; hideComments: string; attachments: string; addAttachment: string; attachmentTypes: string; attachmentUploadFailed: string; attachmentPartialFailure: string; attachmentInvalidType: string; attachmentInvalidSize: string; removeFile: string; retryUpload: string; itemSavedPendingAttachments: string; selectedAttachments: string; filters: string; filtersActive: string; filterByType: string; filterByStatus: string; filterByOwner: string; fromDate: string; toDate: string; clearFilters: string; moreActions: string; quickAdd: string; canWrite: string; readOnly: string; readOnlyDescription: string; activeFollowUp: string; upcomingItems: string; followUpDescription: string; noActiveFollowUp: string; viewDetails: string; viewItem: string; deadlineOverdue: string; deadlineToday: string; deadlineSoon: string; deadlineLater: string; noDate: string; employeeNumber: string; jobTitle: string; discardTitle: string; discardDescription: string; discardConfirm: string; discardCancel: string; attachmentUnavailable: string; leftTabs: string; rightTabs: string
}

type WorkspaceMode = 'self' | 'manager' | 'hr'
export type ContinuousAppraisalFilter = 'ALL' | 'NOTE' | 'ACTION' | 'AGREEMENT' | 'FEEDBACK' | 'GOAL' | 'MEETING_SUMMARY'
type StatusFilter = 'ALL' | 'PLANNED' | 'OPEN' | 'WAITING' | 'ACTIVE' | 'DONE' | 'NOT_RELEVANT' | 'CANCELLED' | 'ARCHIVED'
type QuickView = 'OPEN_ACTIONS' | 'UPCOMING' | null
type ItemType = Exclude<ContinuousAppraisalFilter, 'ALL'>
type Draft = { itemType: ItemType; goalKind: 'GOAL' | 'DEVELOPMENT'; title: string; body: string; occurredOn: string; dueOn: string; nextMeetingOn: string; itemStatus: Exclude<StatusFilter, 'ALL' | 'ARCHIVED'>; priority: 'LOW' | 'MEDIUM' | 'HIGH'; ownerEmployeeId: string }

export type ContinuousAppraisalInitialFilters = { search?: string; itemType?: ContinuousAppraisalFilter; itemStatus?: StatusFilter; owner?: string; fromDate?: string; toDate?: string; oldestFirst?: boolean; quickView?: QuickView }
type Props = { mode: WorkspaceMode; initial: ContinuousAppraisalWorkspace; employeeOptions?: ContinuousAppraisalEmployeeOption[]; labels: ContinuousAppraisalLabels; locale: Locale; initialFilters?: ContinuousAppraisalInitialFilters }

const today = () => { const value = new Date(); return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-') }
const allowedAttachmentTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
const maxAttachmentBytes = 10 * 1024 * 1024
const emptyDraft = (itemType: ItemType = 'NOTE', defaultOwnerId = ''): Draft => ({ itemType, goalKind: 'GOAL', title: '', body: '', occurredOn: today(), dueOn: '', nextMeetingOn: '', itemStatus: itemType === 'GOAL' ? 'ACTIVE' : 'OPEN', priority: 'MEDIUM', ownerEmployeeId: itemType === 'ACTION' ? defaultOwnerId : '' })

function fileSizeLabel(size: number): string {
  return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`
}

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
  return ({ PLANNED: labels.planned, OPEN: labels.open, WAITING: labels.waiting, ACTIVE: labels.active, DONE: labels.done, NOT_RELEVANT: labels.notRelevant, CANCELLED: labels.cancelled, ARCHIVED: labels.archived } as Record<string, string>)[value] ?? value
}

function statusTone(value: string): BadgeTone {
  return ({ ACTIVE: 'info', CANCELLED: 'danger', DONE: 'success', NOT_RELEVANT: 'warning', OPEN: 'neutral', PLANNED: 'neutral', WAITING: 'warning', ARCHIVED: 'neutral' } as Record<string, BadgeTone>)[value] ?? 'neutral'
}

function priorityLabel(value: string | null, labels: ContinuousAppraisalLabels): string | null {
  return value ? ({ LOW: labels.low, MEDIUM: labels.medium, HIGH: labels.high } as Record<string, string>)[value] ?? value : null
}

function isOpenAction(item: ContinuousAppraisalItem): boolean { return item.item_type === 'ACTION' && ['PLANNED', 'OPEN', 'WAITING', 'ACTIVE'].includes(item.item_status) }
function upcomingDate(item: ContinuousAppraisalItem, asOf: string): string | null {
  if (['DONE', 'NOT_RELEVANT', 'CANCELLED', 'ARCHIVED'].includes(item.item_status)) return null
  if ((item.item_type === 'ACTION' || item.item_type === 'GOAL') && item.due_on && item.due_on >= asOf) return item.due_on
  if (item.item_type === 'AGREEMENT' && item.occurred_on >= asOf) return item.occurred_on
  if (item.item_type === 'MEETING_SUMMARY' && item.next_meeting_on && item.next_meeting_on >= asOf) return item.next_meeting_on
  return null
}

function followUpDate(item: ContinuousAppraisalItem, asOf: string): string | null {
  return upcomingDate(item, asOf) ?? (item.item_type === 'ACTION' && isOpenAction(item) ? item.due_on : null)
}

function followUpTiming(item: ContinuousAppraisalItem, asOf: string, labels: ContinuousAppraisalLabels): string {
  const date = followUpDate(item, asOf)
  if (!date) return labels.noDate
  if (date < asOf) return labels.deadlineOverdue
  if (date === asOf) return labels.deadlineToday
  const days = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`)) / 86_400_000
  return days <= 7 ? labels.deadlineSoon : labels.deadlineLater
}

export function filterContinuousAppraisalItems(items: readonly ContinuousAppraisalItem[], filters: { type: ContinuousAppraisalFilter; status: StatusFilter; owner: string; fromDate: string; toDate: string; search: string; oldestFirst: boolean; quickView?: QuickView; asOf?: string }): ContinuousAppraisalItem[] {
  const needle = filters.search.trim().toLocaleLowerCase('nl-NL')
  const asOf = filters.asOf ?? today()
  return [...items].filter((item) => {
    const text = `${item.title}\n${item.body}\n${item.created_by_label}\n${item.owner_label ?? ''}`.toLocaleLowerCase('nl-NL')
    const quickMatch = filters.quickView === 'OPEN_ACTIONS' ? isOpenAction(item) : filters.quickView === 'UPCOMING' ? upcomingDate(item, asOf) !== null : true
    return quickMatch && (filters.type === 'ALL' || item.item_type === filters.type) && (filters.status === 'ALL' || item.item_status === filters.status) && (filters.owner === 'ALL' || item.owner_employee_id === filters.owner) && (!filters.fromDate || item.occurred_on >= filters.fromDate) && (!filters.toDate || item.occurred_on <= filters.toDate) && (!needle || text.includes(needle))
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
  const [quickView, setQuickView] = useState<QuickView>(initialFilters?.quickView ?? null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [editing, setEditing] = useState<ContinuousAppraisalItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ContinuousAppraisalItem | null>(null)
  const [selectedAttachments, setSelectedAttachments] = useState<File[]>([])
  const [attachmentTargetId, setAttachmentTargetId] = useState<string | null>(null)
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

  const items = useMemo(() => filterContinuousAppraisalItems(workspace.items, { type: filter, status: statusFilter, owner: ownerFilter, fromDate, toDate, search, oldestFirst, quickView }), [filter, fromDate, oldestFirst, ownerFilter, quickView, search, statusFilter, toDate, workspace.items])
  const ownerOptions = useMemo(() => [...new Map([...employeeOptions, workspace.employee].map((option) => [option.id, option])).values()], [employeeOptions, workspace.employee])
  const owners = useMemo(() => [...new Map(workspace.items.filter((item) => item.owner_employee_id && item.owner_label).map((item) => [item.owner_employee_id as string, item.owner_label as string])).entries()], [workspace.items])
  const activeFollowUp = workspace.items.filter(isOpenAction).length
  const upcomingItems = workspace.items.filter((item) => upcomingDate(item, today()) !== null).length
  const followUpItems = workspace.items.filter((item) => isOpenAction(item) || upcomingDate(item, today()) !== null).sort((a, b) => (followUpDate(a, today()) ?? '9999-12-31').localeCompare(followUpDate(b, today()) ?? '9999-12-31'))
  const dirty = modalOpen && (JSON.stringify(draft) !== JSON.stringify(savedDraft) || (selectedAttachments.length > 0 && attachmentTargetId === null))

  const reload = async (employeeId = workspace.employeeId) => {
    const response = await fetch(`/api/continuous-appraisal?employeeId=${encodeURIComponent(employeeId)}`, { cache: 'no-store' })
    if (!response.ok) throw new Error('reload')
    setWorkspace(await response.json() as ContinuousAppraisalWorkspace)
  }

  const openCreate = (itemType: ItemType = 'NOTE') => {
    const nextDraft = emptyDraft(itemType, mode === 'self' ? workspace.employeeId : '')
    setEditing(null); setDraft(nextDraft); setSavedDraft(nextDraft); setSelectedAttachments([]); setAttachmentTargetId(null); setFeedback(null); setModalOpen(true)
  }

  const openTabCreate = () => {
    if (filter !== 'ALL' && (filter !== 'FEEDBACK' || workspace.canCreateFeedback)) openCreate(filter)
    else openCreate('NOTE')
  }

  const createLabel = filter === 'NOTE' ? labels.addNote : filter === 'ACTION' ? labels.addAction : filter === 'AGREEMENT' ? labels.addAgreement : filter === 'FEEDBACK' ? labels.addFeedback : filter === 'GOAL' ? labels.addGoal : filter === 'MEETING_SUMMARY' ? labels.addMeeting : labels.newEntry

  const setView = (next: QuickView) => {
    const value = quickView === next ? null : next
    setQuickView(value); updateUrl('view', value ?? '')
    setFilter('ALL'); setStatusFilter('ALL'); setOwnerFilter('ALL'); setFromDate(''); setToDate(''); setSearch('')
    for (const key of ['type', 'status', 'owner', 'from', 'to', 'search']) updateUrl(key, '')
  }

  const viewItem = (itemId: string) => {
    clearFilters()
    setFiltersOpen(false)
    window.requestAnimationFrame(() => {
      const element = document.getElementById(`appraisal-item-${itemId}`)
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      element?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' })
    })
  }

  const openEdit = (item: ContinuousAppraisalItem) => {
    const nextDraft: Draft = { itemType: item.item_type as ItemType, goalKind: item.goal_kind === 'DEVELOPMENT' ? 'DEVELOPMENT' : 'GOAL', title: item.title, body: item.body, occurredOn: item.occurred_on, dueOn: item.due_on ?? '', nextMeetingOn: item.next_meeting_on ?? '', itemStatus: item.item_status as Draft['itemStatus'], priority: (item.priority as Draft['priority']) ?? 'MEDIUM', ownerEmployeeId: item.owner_employee_id ?? '' }
    setEditing(item); setDraft(nextDraft); setSavedDraft(nextDraft); setSelectedAttachments([]); setAttachmentTargetId(null); setFeedback(null); setModalOpen(true)
  }

  const closeEditor = () => { setModalOpen(false); setEditing(null); setSelectedAttachments([]); setAttachmentTargetId(null); setFeedback(null) }

  const chooseAttachments = (files: File[]) => {
    const invalidType = files.find((file) => !allowedAttachmentTypes.has(file.type))
    if (invalidType) { setFeedback({ tone: 'danger', text: labels.attachmentInvalidType }); return }
    if (files.some((file) => file.size < 1 || file.size > maxAttachmentBytes)) { setFeedback({ tone: 'danger', text: labels.attachmentInvalidSize }); return }
    setFeedback(null); setSelectedAttachments((current) => [...current, ...files])
  }

  const uploadPendingAttachments = async (itemId: string, files: File[]): Promise<boolean> => {
    for (let index = 0; index < files.length; index += 1) {
      const formData = new FormData()
      formData.append('file', files[index])
      const response = await fetch(`/api/continuous-appraisal/items/${itemId}/attachments`, { method: 'POST', body: formData })
      if (!response.ok) {
        setSelectedAttachments(files.slice(index)); setAttachmentTargetId(itemId)
        await reload().catch(() => undefined)
        setFeedback({ tone: 'danger', text: labels.attachmentPartialFailure })
        return false
      }
      setSelectedAttachments(files.slice(index + 1))
    }
    setSelectedAttachments([]); setAttachmentTargetId(null)
    await reload().catch(() => setFeedback({ tone: 'danger', text: labels.saveFailed }))
    return true
  }

  const saveItem = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    if (busy || !draft.title.trim() || !draft.body.trim()) return
    setBusy(true); setFeedback(null)
    try {
      if (attachmentTargetId) {
        if (await uploadPendingAttachments(attachmentTargetId, selectedAttachments)) { closeEditor(); setFeedback({ tone: 'success', text: labels.saved }) }
        return
      }
      const payload = editing
        ? { version: editing.version, title: draft.title, body: draft.body, dueOn: draft.dueOn || null, nextMeetingOn: draft.nextMeetingOn || null, priority: draft.priority, ownerEmployeeId: draft.ownerEmployeeId || null }
        : { employeeId: workspace.employeeId, itemType: draft.itemType, goalKind: draft.itemType === 'GOAL' ? draft.goalKind : null, title: draft.title, body: draft.body, occurredOn: draft.occurredOn, dueOn: draft.dueOn || null, nextMeetingOn: draft.nextMeetingOn || null, itemStatus: draft.itemStatus, priority: draft.priority, ownerEmployeeId: draft.ownerEmployeeId || null }
      const response = await fetch(editing ? `/api/continuous-appraisal/items/${editing.id}` : '/api/continuous-appraisal', { method: editing ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      if (!response.ok) throw new Error('save')
      const result = await response.json() as { id?: unknown }
      const itemId = editing?.id ?? result.id
      if (typeof itemId !== 'string') throw new Error('save')
      setSavedDraft(draft)
      await reload().catch(() => setFeedback({ tone: 'danger', text: labels.saveFailed }))
      if (selectedAttachments.length > 0) {
        setAttachmentTargetId(itemId)
        if (!await uploadPendingAttachments(itemId, selectedAttachments)) return
      }
      closeEditor(); setFeedback({ tone: 'success', text: labels.saved })
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

  const changeStatus = async (item: ContinuousAppraisalItem, nextStatus: 'DONE' | 'NOT_RELEVANT') => {
    if (busy) return
    setBusy(true); setFeedback(null)
    try {
      const response = await fetch(`/api/continuous-appraisal/items/${item.id}/status`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: item.version, itemStatus: nextStatus }) })
      if (!response.ok) throw new Error(response.status === 409 ? 'conflict' : 'status')
      await reload(); setFeedback({ tone: 'success', text: nextStatus === 'DONE' ? labels.statusMarkedDone : labels.statusMarkedNotRelevant })
    } catch (error) { setFeedback({ tone: 'danger', text: error instanceof Error && error.message === 'conflict' ? labels.versionConflict : labels.statusActionFailed }) } finally { setBusy(false) }
  }

  const deleteItem = async () => {
    if (!deleteTarget || busy) return
    setBusy(true); setFeedback(null)
    try {
      const response = await fetch(`/api/continuous-appraisal/items/${deleteTarget.id}`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: deleteTarget.version }) })
      if (!response.ok) throw new Error(response.status === 409 ? 'conflict' : 'delete')
      await reload(); setDeleteTarget(null); setFeedback({ tone: 'success', text: labels.deleted })
    } catch (error) { setFeedback({ tone: 'danger', text: error instanceof Error && error.message === 'conflict' ? labels.versionConflict : labels.deleteFailed }) } finally { setBusy(false) }
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
    setQuickView(null)
    for (const key of ['type', 'status', 'owner', 'from', 'to', 'search', 'sort', 'view']) updateUrl(key, '')
  }

  const tabs: Array<[ContinuousAppraisalFilter, string]> = [['ALL', labels.all], ['NOTE', labels.notes], ['ACTION', labels.actions], ['AGREEMENT', labels.agreements], ['FEEDBACK', labels.feedback], ['GOAL', labels.goals], ['MEETING_SUMMARY', labels.meetings]]
  const hasActiveFilters = filter !== 'ALL' || statusFilter !== 'ALL' || ownerFilter !== 'ALL' || Boolean(fromDate || toDate || search || quickView)
  const addButton = workspace.canWrite && (filter !== 'FEEDBACK' || workspace.canCreateFeedback) ? <Button onClick={openTabCreate} type="button"><Plus aria-hidden="true" />{createLabel}</Button> : undefined

  return <PageShell className="py-6 sm:py-8" width="wide">
    <PageHeader actions={mode !== 'self' ? <div className="grid w-full gap-1.5 sm:w-72"><label className="text-xs font-medium text-muted-foreground" htmlFor="appraisal-employee">{labels.selectEmployee}</label><DropdownSelect aria-label={labels.selectEmployee} disabled={busy} id="appraisal-employee" onChange={(event) => { void selectEmployee(event.target.value) }} searchable searchPlaceholder={labels.search} value={workspace.employeeId}>{employeeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</DropdownSelect></div> : undefined} description={mode === 'self' ? labels.subtitle : labels.managerSubtitle} title={labels.title} />
    <Surface className="mt-6 p-4 sm:p-5" variant="subtle"><div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex min-w-0 items-start gap-3"><span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] bg-accent text-primary"><UserRound size={18} /></span><div className="min-w-0"><p className="break-words text-base font-semibold">{workspace.employee.label}</p><p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{labels.employeeNumber}: {workspace.employee.employeeNumber}</span>{workspace.employee.jobTitle ? <span>{labels.jobTitle}: {workspace.employee.jobTitle}</span> : null}</p></div></div><div className="grid grid-cols-2 gap-2 text-sm sm:flex sm:flex-wrap sm:items-center sm:justify-end">
      <button className="rounded-[var(--radius-control)] px-3 py-2 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" onClick={() => setView('OPEN_ACTIONS')} type="button"><span className="block text-xs text-muted-foreground">{labels.activeFollowUp}</span><span className="font-semibold tabular-nums">{activeFollowUp}</span></button>
      <button className="rounded-[var(--radius-control)] px-3 py-2 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" onClick={() => setView('UPCOMING')} type="button"><span className="block text-xs text-muted-foreground">{labels.upcomingItems}</span><span className="font-semibold tabular-nums">{upcomingItems}</span></button>
      <button className="rounded-[var(--radius-control)] px-3 py-2 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" onClick={clearFilters} type="button"><span className="block text-xs text-muted-foreground">{labels.itemCount}</span><span className="font-semibold tabular-nums">{workspace.items.length}</span></button>
    </div></div></Surface>
    <div className="mt-7"><CollectionToolbar search={<TextInput aria-label={labels.search} leadingIcon={<Search aria-hidden="true" />} onChange={(event) => { setSearch(event.target.value); updateUrl('search', event.target.value) }} placeholder={labels.search} value={search} />} sort={<Button onClick={() => { const next=!oldestFirst; setOldestFirst(next); updateUrl('sort',next?'oldest':'') }} size="sm" type="button" variant="secondary"><Clock3 aria-hidden="true" />{oldestFirst?labels.oldest:labels.newest}</Button>} />
      <Button aria-controls={filtersOpen ? 'appraisal-filter-panel' : undefined} aria-expanded={filtersOpen} className="mt-3" onClick={() => setFiltersOpen((open)=>!open)} size="sm" type="button" variant="secondary"><SlidersHorizontal aria-hidden="true" />{labels.filters}{hasActiveFilters?` · ${labels.filtersActive}`:''}</Button>
      {filtersOpen?<FilterBar id="appraisal-filter-panel" actions={<Button onClick={clearFilters} size="sm" type="button" variant="ghost">{labels.clearFilters}</Button>} className="mt-3"><div className="grid min-w-40 flex-1 gap-1.5"><label className="text-xs font-medium text-muted-foreground" htmlFor="appraisal-status-filter">{labels.filterByStatus}</label><DropdownSelect aria-label={labels.filterByStatus} id="appraisal-status-filter" onChange={(event)=>{const next=event.target.value as StatusFilter;setStatusFilter(next);updateUrl('status',next)}} value={statusFilter}><option value="ALL">{labels.all}</option><option value="PLANNED">{labels.planned}</option><option value="OPEN">{labels.open}</option><option value="WAITING">{labels.waiting}</option><option value="ACTIVE">{labels.active}</option><option value="DONE">{labels.done}</option><option value="NOT_RELEVANT">{labels.notRelevant}</option><option value="CANCELLED">{labels.cancelled}</option><option value="ARCHIVED">{labels.archived}</option></DropdownSelect></div><div className="grid min-w-40 flex-1 gap-1.5"><label className="text-xs font-medium text-muted-foreground" htmlFor="appraisal-owner-filter">{labels.filterByOwner}</label><DropdownSelect aria-label={labels.filterByOwner} id="appraisal-owner-filter" onChange={(event)=>{const next=event.target.value;setOwnerFilter(next);updateUrl('owner',next)}} searchable searchPlaceholder={labels.search} value={ownerFilter}><option value="ALL">{labels.all}</option>{owners.map(([id,owner])=><option key={id} value={id}>{owner}</option>)}</DropdownSelect></div><FormField className="min-w-36 flex-1" control={<TextInput aria-label={labels.fromDate} onChange={(event)=>{setFromDate(event.target.value);updateUrl('from',event.target.value)}} type="date" value={fromDate}/>} label={labels.fromDate}/><FormField className="min-w-36 flex-1" control={<TextInput aria-label={labels.toDate} onChange={(event)=>{setToDate(event.target.value);updateUrl('to',event.target.value)}} type="date" value={toDate}/>} label={labels.toDate}/></FilterBar>:null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><ScrollableTabs ariaLabel={labels.filterByType} contentProps={{role:'tablist'}} leftLabel={labels.leftTabs} rightLabel={labels.rightTabs}>{tabs.map(([key,label])=><TabButton active={filter===key} key={key} onClick={()=>{setFilter(key);updateUrl('type',key)}}>{label}</TabButton>)}</ScrollableTabs>{addButton?<div data-testid="appraisal-create">{addButton}</div>:null}</div>
    </div>
    {feedback?<p aria-live="polite" className={`mt-4 flex items-start gap-2 border px-4 py-3 text-sm ${feedback.tone==='danger'?'border-destructive/40 bg-destructive-surface text-destructive':'border-success/40 bg-success-surface text-success'}`} role={feedback.tone==='danger'?'alert':'status'}><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0"/>{feedback.text}</p>:null}
    <DetailColumns aside={<AppraisalAside followUpItems={followUpItems} labels={labels} locale={locale} onViewItem={viewItem}/>} className="mt-6" main={<Surface className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-4 py-3 sm:px-5"><p className="text-sm font-medium">{items.length} {labels.itemCount}</p><p className="text-xs text-muted-foreground">{workspace.employee.label}</p></div>{items.length?<div className="divide-y divide-border-subtle">{items.map((item)=><TimelineRow busy={busy} canComment={workspace.canWrite} commentValue={commentDrafts[item.id]??''} item={item} key={item.id} labels={labels} locale={locale} onAttachment={(file)=>{void uploadAttachment(item,file)}} onComment={()=>{void addComment(item)}} onCommentChange={(value)=>setCommentDrafts((current)=>({...current,[item.id]:value}))} onDelete={()=>setDeleteTarget(item)} onDone={()=>{void changeStatus(item,'DONE')}} onEdit={()=>openEdit(item)} onNotRelevant={()=>{void changeStatus(item,'NOT_RELEVANT')}}/>)}</div>:<EmptyState actions={addButton?<div data-testid="appraisal-create-empty">{addButton}</div>:undefined} description={hasActiveFilters?labels.noResultsDescription:labels.noItemsDescription} icon={<FileText/>} title={hasActiveFilters?labels.noResults:labels.noItems}/>}</Surface>}/>
    <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.close} description={editing?labels.editDescription:labels.addDescription} dirty={dirty} dirtyProtection={{description:labels.discardDescription,discardLabel:labels.discardConfirm,keepEditingLabel:labels.discardCancel,title:labels.discardTitle}} onDiscard={closeEditor} onOpenChange={(nextOpen)=>{if(!nextOpen){if(attachmentTargetId&&selectedAttachments.length){setFeedback({tone:'danger',text:labels.itemSavedPendingAttachments});return}closeEditor()}else setModalOpen(true)}} onSubmit={(event)=>{void saveItem(event)}} open={modalOpen} saveLabel={attachmentTargetId?labels.retryUpload:labels.save} saving={busy} title={editing?labels.edit:labels.newEntry}>{feedback?.tone==='danger'?<p className="flex items-start gap-2 border border-destructive/40 bg-destructive-surface px-3 py-2 text-sm text-destructive" role="alert"><CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0"/>{feedback.text}</p>:null}<ItemForm canCreateFeedback={workspace.canCreateFeedback} draft={draft} editing={editing} employeeOptions={ownerOptions} labels={labels} onChange={(changes)=>setDraft((current)=>({...current,...changes}))} onFilesSelected={chooseAttachments} onRemoveFile={(index)=>setSelectedAttachments((files)=>files.filter((_file,fileIndex)=>fileIndex!==index))} selectedAttachments={selectedAttachments}/></FormDrawer>
    <ConfirmDialog cancelLabel={labels.cancel} confirmLabel={labels.deleteConfirm} destructive description={`${labels.deleteDescription} “${deleteTarget?.title??''}”`} onConfirm={deleteItem} onOpenChange={(open)=>{if(!open&&!busy)setDeleteTarget(null)}} open={deleteTarget!==null} pending={busy} title={labels.deleteTitle}/>
  </PageShell>
}

function AppraisalAside({ followUpItems, labels, locale, onViewItem }: { followUpItems: ContinuousAppraisalItem[]; labels: ContinuousAppraisalLabels; locale: Locale; onViewItem: (itemId: string) => void }) {
  const asOf=today()
  const actionCount=followUpItems.filter(isOpenAction).length
  const upcomingCount=followUpItems.filter((item)=>upcomingDate(item,asOf)!==null).length
  return <Surface className="p-4 sm:p-5" variant="subtle"><SectionHeader description={labels.followUpDescription} title={labels.activeFollowUp}/><dl className="mt-5 divide-y divide-border-subtle text-sm"><div className="flex items-center justify-between gap-3 py-3 first:pt-0"><dt className="text-muted-foreground">{labels.actions}</dt><dd className="font-semibold tabular-nums">{actionCount}</dd></div><div className="flex items-center justify-between gap-3 py-3"><dt className="text-muted-foreground">{labels.upcomingItems}</dt><dd className="font-semibold tabular-nums">{upcomingCount}</dd></div></dl>{followUpItems.length?<ul className="mt-2 divide-y divide-border-subtle border-t border-border-subtle">{followUpItems.slice(0,8).map((item)=>{const date=followUpDate(item,asOf);return <li key={item.id}><button aria-label={`${labels.viewItem}: ${item.title}`} className="w-full rounded-[var(--radius-control)] py-3 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" onClick={()=>onViewItem(item.id)} type="button"><span className="block break-words text-sm font-medium text-foreground">{item.title}</span><span className="mt-1 block text-xs text-muted-foreground">{item.owner_label??labels.noDate} · {date?formatDate(date,locale):labels.noDate} · {followUpTiming(item,asOf,labels)}</span><span className="mt-2 flex flex-wrap gap-1.5"><Badge tone={statusTone(item.item_status)}>{statusLabel(item.item_status,labels)}</Badge>{priorityLabel(item.priority,labels)?<Badge tone="neutral">{priorityLabel(item.priority,labels)}</Badge>:null}</span></button></li>})}</ul>:<p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground"><Activity aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success"/>{labels.noActiveFollowUp}</p>}</Surface>
}
function TimelineRow({ busy, canComment, commentValue, item, labels, locale, onAttachment, onComment, onCommentChange, onDelete, onDone, onEdit, onNotRelevant }: { busy: boolean; canComment: boolean; commentValue: string; item: ContinuousAppraisalItem; labels: ContinuousAppraisalLabels; locale: Locale; onAttachment: (file: File) => void; onComment: () => void; onCommentChange: (value: string) => void; onDelete: () => void; onDone: () => void; onEdit: () => void; onNotRelevant: () => void }) {
  const past=item.occurred_on<today()
  const menuItems: ActionMenuItem[]=[
    ...(item.canMarkDone?[{id:'done',label:labels.markDone,icon:<Check aria-hidden="true"/>,tone:'success' as const,onSelect:onDone}]:[]),
    ...(item.canMarkNotRelevant?[{id:'not-relevant',label:labels.notRelevant,icon:<CircleAlert aria-hidden="true"/>,tone:'warning' as const,onSelect:onNotRelevant}]:[]),
    ...(item.canDelete?[{id:'delete',label:labels.deleteAction,icon:<Trash2 aria-hidden="true"/>,destructive:true,onSelect:onDelete}]:[]),
  ]
  return <article id={`appraisal-item-${item.id}`} className="scroll-mt-24 grid gap-4 px-4 py-5 sm:px-5 lg:grid-cols-[8rem_minmax(0,1fr)_10rem]">
    <div className="text-sm text-muted-foreground"><time dateTime={item.occurred_on}>{formatDate(item.occurred_on,locale)}</time><p className="mt-1 text-xs">{past?labels.pastItem:labels.futureItem}</p></div>
    <div className="min-w-0"><details className="group"><summary className="flex cursor-pointer list-none flex-wrap items-start gap-2 rounded-[var(--radius-control)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"><h2 className="min-w-0 break-words text-base font-semibold">{item.title}</h2><Badge tone={typeTone(item.item_type)}>{typeLabel(item.item_type,labels)}</Badge><Badge tone={statusTone(item.item_status)}>{statusLabel(item.item_status,labels)}</Badge>{priorityLabel(item.priority,labels)?<Badge tone="neutral">{priorityLabel(item.priority,labels)}</Badge>:null}<ChevronDown aria-hidden="true" className="ml-auto mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"/></summary>
      <div className="pt-2"><p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{item.body}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{item.due_on?<span className="inline-flex items-center gap-1.5"><CalendarDays aria-hidden="true" size={13}/>{labels.dueDate}: {formatDate(item.due_on,locale)}</span>:null}{item.next_meeting_on?<span className="inline-flex items-center gap-1.5"><Target aria-hidden="true" size={13}/>{labels.nextMeeting}: {formatDate(item.next_meeting_on,locale)}</span>:null}<span className="inline-flex items-center gap-1.5"><UserRound aria-hidden="true" size={13}/>{labels.owner}: {item.owner_label??'—'}</span></div>
      {item.attachments.length?<div className="mt-4 border-t border-border-subtle pt-3"><p className="text-xs font-semibold text-muted-foreground">{labels.attachments}</p><div className="mt-2 flex flex-wrap gap-2">{item.attachments.map((attachment)=><a className="inline-flex max-w-full items-center gap-1.5 break-all rounded-[var(--radius-control)] border border-border px-3 py-2 text-xs font-medium text-primary underline-offset-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={attachment.href} key={attachment.id} rel="noreferrer" target="_blank"><FileText aria-hidden="true" size={13}/>{attachment.original_filename}</a>)}</div></div>:null}
      {item.canEdit?<div className="mt-3"><label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-primary underline-offset-2 hover:underline"><span>{labels.addAttachment}</span><input accept="image/png,image/jpeg,image/webp,application/pdf" className="sr-only" disabled={busy} onChange={(event)=>{const file=event.target.files?.[0];event.target.value='';if(file)onAttachment(file)}} type="file"/></label><p className="mt-1 text-xs text-muted-foreground">{labels.attachmentTypes}</p></div>:null}
      <div className="mt-4 border-t border-border-subtle pt-3"><div className="flex items-center gap-2 text-sm font-medium"><MessageCircle aria-hidden="true" size={15}/>{labels.comments} ({item.comments.length})</div><div className="mt-3">{item.comments.length?<div className="space-y-2">{item.comments.map((comment)=><p className="break-words border-l-2 border-accent px-3 py-2 text-sm leading-5 text-muted-foreground" key={comment.id}><span className="font-semibold text-foreground">{comment.author_label}</span> {comment.body}</p>)}</div>:<p className="text-sm text-muted-foreground">{labels.noItemsDescription}</p>}{canComment?<div className="mt-3 flex flex-col gap-2 sm:flex-row"><TextInput aria-label={labels.addComment} maxLength={100} onChange={(event)=>onCommentChange(event.target.value)} placeholder={labels.commentPlaceholder} value={commentValue}/><Button disabled={busy||!commentValue.trim()} onClick={onComment} size="sm" type="button" variant="secondary">{labels.addComment}</Button></div>:null}{canComment?<p className="mt-1 text-right text-xs text-muted-foreground">{commentValue.length}/100 · {labels.commentLimit}</p>:null}</div></div>
      </div></details></div>
    <div className="flex min-w-0 items-start justify-between gap-3 border-t border-border-subtle pt-3 text-sm lg:block lg:border-t-0 lg:pt-0"><div><p className="break-words font-medium text-foreground">{item.created_by_label}</p><p className="mt-1 text-xs text-muted-foreground">{labels.createdBy}</p><time className="mt-2 block text-xs text-muted-foreground" dateTime={item.updated_at}>{formatDate(item.updated_at.slice(0,10),locale)}</time></div><RowActions className="lg:mt-3" menuItems={menuItems} menuLabel={labels.moreActions} primaryAction={item.canEdit?<Button onClick={onEdit} size="sm" type="button" variant="secondary"><Pencil aria-hidden="true"/>{labels.edit}</Button>:undefined}/></div>
  </article>
}
function ItemForm({ canCreateFeedback, draft, editing, employeeOptions, labels, onChange, onFilesSelected, onRemoveFile, selectedAttachments }: { canCreateFeedback: boolean; draft: Draft; editing: ContinuousAppraisalItem | null; employeeOptions: ContinuousAppraisalEmployeeOption[]; labels: ContinuousAppraisalLabels; onChange: (changes: Partial<Draft>) => void; onFilesSelected: (files: File[]) => void; onRemoveFile: (index: number) => void; selectedAttachments: File[] }) {
  const actionFields=draft.itemType==='ACTION'
  const goalFields=draft.itemType==='GOAL'
  const meetingFields=draft.itemType==='MEETING_SUMMARY'
  const itemTypeOptions: Array<[ItemType,string]>=[['NOTE',labels.note],['ACTION',labels.action],['AGREEMENT',labels.agreement],...(canCreateFeedback?[['FEEDBACK',labels.feedback] as [ItemType,string]]:[]),['GOAL',labels.goal],['MEETING_SUMMARY',labels.meeting]]
  return <div className="grid gap-4">
    <FormField control={<DropdownSelect disabled={editing!==null} onChange={(event)=>onChange({itemType:event.target.value as ItemType})} value={draft.itemType}>{itemTypeOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</DropdownSelect>} label={labels.entryType}/>
    <div className="grid gap-4 sm:grid-cols-2"><FormField control={<TextInput maxLength={160} onChange={(event)=>onChange({title:event.target.value})} required value={draft.title}/>} label={labels.titleLabel} required/><FormField control={<TextInput disabled={editing!==null} onChange={(event)=>onChange({occurredOn:event.target.value})} required type="date" value={draft.occurredOn}/>} label={labels.dateLabel} required/></div>
    {actionFields?<div className="grid gap-4 sm:grid-cols-2"><FormField control={<TextInput onChange={(event)=>onChange({dueOn:event.target.value})} type="date" value={draft.dueOn}/>} label={labels.dueDate}/><FormField control={<DropdownSelect onChange={(event)=>onChange({ownerEmployeeId:event.target.value})} searchable searchPlaceholder={labels.search} value={draft.ownerEmployeeId}><option value="">{labels.owner}</option>{employeeOptions.map((employee)=><option key={employee.id} value={employee.id}>{employee.label}</option>)}</DropdownSelect>} label={labels.owner}/></div>:null}
    {actionFields&&!editing?<div className="grid gap-4 sm:grid-cols-2"><FormField control={<DropdownSelect onChange={(event)=>onChange({itemStatus:event.target.value as Draft['itemStatus']})} value={draft.itemStatus}><option value="OPEN">{labels.open}</option><option value="PLANNED">{labels.planned}</option><option value="WAITING">{labels.waiting}</option><option value="ACTIVE">{labels.active}</option><option value="CANCELLED">{labels.cancelled}</option></DropdownSelect>} label={labels.status}/><FormField control={<DropdownSelect onChange={(event)=>onChange({priority:event.target.value as Draft['priority']})} value={draft.priority}><option value="LOW">{labels.low}</option><option value="MEDIUM">{labels.medium}</option><option value="HIGH">{labels.high}</option></DropdownSelect>} label={labels.priority}/></div>:actionFields?<FormField control={<DropdownSelect onChange={(event)=>onChange({priority:event.target.value as Draft['priority']})} value={draft.priority}><option value="LOW">{labels.low}</option><option value="MEDIUM">{labels.medium}</option><option value="HIGH">{labels.high}</option></DropdownSelect>} label={labels.priority}/>:null}
    {goalFields?<div className="grid gap-4 sm:grid-cols-2"><FormField control={<DropdownSelect onChange={(event)=>onChange({goalKind:event.target.value as Draft['goalKind']})} value={draft.goalKind}><option value="GOAL">{labels.goal}</option><option value="DEVELOPMENT">{labels.development}</option></DropdownSelect>} label={labels.goalKind}/><FormField control={<TextInput onChange={(event)=>onChange({nextMeetingOn:event.target.value})} type="date" value={draft.nextMeetingOn}/>} label={labels.nextMeeting}/></div>:null}
    {meetingFields?<FormField control={<TextInput onChange={(event)=>onChange({nextMeetingOn:event.target.value})} type="date" value={draft.nextMeetingOn}/>} label={labels.nextMeeting}/>:null}
    <FormField control={<Textarea maxLength={10000} onChange={(event)=>onChange({body:event.target.value})} required value={draft.body}/>} description={`${draft.body.length}/10000`} label={labels.bodyLabel} required/>
    <FormField control={<div className="grid gap-2"><input accept="image/png,image/jpeg,image/webp,application/pdf" aria-label={labels.addAttachment} className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-[var(--radius-control)] file:border file:border-border file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" multiple onChange={(event)=>{const files=Array.from(event.target.files??[]);event.target.value='';if(files.length)onFilesSelected(files)}} type="file"/><p className="text-xs text-muted-foreground">{labels.attachmentTypes}</p>{selectedAttachments.length?<div><p className="text-xs font-medium text-foreground">{labels.selectedAttachments}</p><ul className="mt-1 divide-y divide-border-subtle border-y border-border-subtle">{selectedAttachments.map((file,index)=><li className="flex min-w-0 items-center justify-between gap-3 py-2" key={`${file.name}-${file.lastModified}-${index}`}><span className="min-w-0 break-all text-xs text-muted-foreground">{file.name} · {file.type} · {fileSizeLabel(file.size)}</span><Button aria-label={`${labels.removeFile}: ${file.name}`} onClick={()=>onRemoveFile(index)} size="sm" type="button" variant="ghost"><X aria-hidden="true"/></Button></li>)}</ul></div>:null}</div>} label={labels.addAttachment}/>
  </div>
}
