'use client'

import Link from 'next/link'
import { Building2, ChevronRight, FolderTree, Pencil, Plus, Search, ShieldCheck } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import { CollectionToolbar } from '@/components/patterns/collection-toolbar'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { RowActions } from '@/components/patterns/row-actions'
import { Surface } from '@/components/ui/surface'
import {
  descendantDepartmentIds,
  filterDepartmentTree,
  type DepartmentRecord,
  type DepartmentStatusFilter,
  type DepartmentSort,
  type DepartmentTreeNode,
} from '@/lib/organization/department-tree'

export type DepartmentManagerLabels = {
  add: string
  edit: string
  create: string
  save: string
  cancel: string
  close: string
  code: string
  codeReadOnly: string
  name: string
  description: string
  descriptionHelp: string
  parent: string
  parentHelp: string
  noParent: string
  structure: string
  search: string
  filter: string
  allStatuses: string
  activeOnly: string
  inactiveOnly: string
  sort: string
  sortName: string
  sortCode: string
  results: string
  resetFilters: string
  actions: string
  active: string
  inactive: string
  noResults: string
  empty: string
  readOnly: string
  failed: string
  conflict: string
  saved: string
  processStart: string
  discardTitle: string
  discardDescription: string
  discardConfirm: string
  discardCancel: string
  deactivate: string
  activate: string
  deactivateTitle: string
  activateTitle: string
  deactivateDescription: string
  activateDescription: string
  confirmDeactivate: string
  confirmActivate: string
}

type FormValues = {
  code: string
  name: string
  description: string
  parentId: string
}

const emptyFormValues: FormValues = { code: '', name: '', description: '', parentId: '' }

export function DepartmentManagement({ canStartProcess, canWrite, departments, labels }: {
  canStartProcess: boolean
  canWrite: boolean
  departments: readonly DepartmentRecord[]
  labels: DepartmentManagerLabels
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<DepartmentStatusFilter>('ALL')
  const [sort, setSort] = useState<DepartmentSort>('NAME')
  const [formOpen, setFormOpen] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<DepartmentRecord | null>(null)
  const [formValues, setFormValues] = useState<FormValues>(emptyFormValues)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [statusCandidate, setStatusCandidate] = useState<DepartmentRecord | null>(null)
  const [statusSaving, setStatusSaving] = useState(false)

  const filtered = useMemo(() => filterDepartmentTree(departments, search, status, sort), [departments, search, sort, status])
  const parentOptions = useMemo(() => {
    const excludedIds = editingDepartment ? new Set([editingDepartment.id, ...descendantDepartmentIds(departments, editingDepartment.id)]) : new Set<string>()
    return [...departments]
      .filter((department) => !excludedIds.has(department.id))
      .sort((left, right) => left.name.localeCompare(right.name, 'nl-NL'))
  }, [departments, editingDepartment])
  const formDirty = JSON.stringify(formValues) !== JSON.stringify(editingDepartment ? toFormValues(editingDepartment) : emptyFormValues)

  function startCreate(): void {
    setEditingDepartment(null)
    setFormValues(emptyFormValues)
    setFormError(null)
    setFormOpen(true)
  }

  function startEdit(department: DepartmentRecord): void {
    setEditingDepartment(department)
    setFormValues(toFormValues(department))
    setFormError(null)
    setFormOpen(true)
  }

  function resetForm(): void {
    setEditingDepartment(null)
    setFormValues(emptyFormValues)
    setFormError(null)
  }

  function handleFormOpenChange(open: boolean): void {
    setFormOpen(open)
    if (!open) resetForm()
  }

  function updateFormValue<K extends keyof FormValues>(key: K, value: FormValues[K]): void {
    setFormValues((current) => ({ ...current, [key]: value }))
    setFormError(null)
  }

  async function submitForm(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setFormError(null)

    const body = editingDepartment
      ? { name: formValues.name, description: formValues.description || null, parentId: formValues.parentId || null }
      : { code: formValues.code, name: formValues.name, description: formValues.description || null, parentId: formValues.parentId || null }

    try {
      const response = await fetch(editingDepartment ? `/api/departments/${editingDepartment.id}` : '/api/departments', {
        method: editingDepartment ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const errorCode = await getErrorCode(response)
      if (!response.ok) {
        setFormError(errorCode === 'DEPARTMENT_CONFLICT' ? labels.conflict : labels.failed)
        return
      }
      setFormOpen(false)
      resetForm()
      router.refresh()
    } catch {
      setFormError(labels.failed)
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(): Promise<void> {
    if (!statusCandidate || statusSaving) return
    setStatusSaving(true)
    try {
      const response = await fetch(`/api/departments/${statusCandidate.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isActive: !statusCandidate.isActive }),
      })
      if (!response.ok) return
      setStatusCandidate(null)
      router.refresh()
    } finally {
      setStatusSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {!canWrite ? (
        <Surface className="flex items-start gap-3 p-4" variant="subtle">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{labels.readOnly}</p>
        </Surface>
      ) : null}

      <CollectionToolbar
        createAction={canWrite ? <Button onClick={startCreate} type="button"><Plus aria-hidden="true" />{labels.add}</Button> : undefined}
        filters={<DropdownSelect aria-label={labels.filter} onChange={(event) => setStatus(event.target.value as DepartmentStatusFilter)} value={status}><option value="ALL">{labels.allStatuses}</option><option value="ACTIVE">{labels.activeOnly}</option><option value="INACTIVE">{labels.inactiveOnly}</option></DropdownSelect>}
        search={<TextInput aria-label={labels.search} className="sm:min-w-80" leadingIcon={<Search aria-hidden="true" />} onChange={(event) => setSearch(event.target.value)} placeholder={labels.search} type="search" value={search} />}
        sort={<DropdownSelect aria-label={labels.sort} onChange={(event) => setSort(event.target.value as DepartmentSort)} value={sort}><option value="NAME">{labels.sortName}</option><option value="CODE">{labels.sortCode}</option></DropdownSelect>}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{labels.results.replace('{visible}', String(filtered.matchingCount)).replace('{total}', String(departments.length))}</span>
        {status !== 'ALL' || search.trim() ? <Button onClick={() => { setSearch(''); setStatus('ALL') }} size="sm" type="button" variant="ghost">{labels.resetFilters}</Button> : null}
      </div>

      <Surface className="overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-border-subtle bg-surface-raised px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-accent text-accent-foreground"><FolderTree size={18} /></span>
            <h2 className="truncate text-sm font-semibold text-foreground">{labels.structure}</h2>
          </div>
          <span className="text-xs font-medium text-muted-foreground">{filtered.visibleCount}</span>
        </div>
        {departments.length === 0 ? <EmptyState className="m-4" icon={<FolderTree />} title={labels.empty} /> : filtered.roots.length === 0 ? <EmptyState className="m-4" icon={<Search />} title={labels.noResults} /> : <ul className="space-y-1 p-3 sm:p-5">{filtered.roots.map((node) => <DepartmentBranch canStartProcess={canStartProcess} canWrite={canWrite} key={node.id} labels={labels} node={node} onEdit={startEdit} onStatusChange={setStatusCandidate} />)}</ul>}
      </Surface>

      <FormDrawer
        cancelLabel={labels.cancel}
        closeLabel={labels.close}
        description={editingDepartment ? labels.edit : labels.add}
        dirty={formDirty}
        dirtyProtection={{ description: labels.discardDescription, discardLabel: labels.discardConfirm, keepEditingLabel: labels.discardCancel, title: labels.discardTitle }}
        onDiscard={resetForm}
        onOpenChange={handleFormOpenChange}
        onSubmit={(event) => void submitForm(event)}
        open={formOpen}
        saveLabel={editingDepartment ? labels.save : labels.create}
        saving={saving}
        title={editingDepartment ? labels.edit : labels.add}
      >
        {formError ? <p className="border border-destructive/40 bg-destructive-surface px-3 py-2 text-sm text-destructive" role="alert">{formError}</p> : null}
        <FormField control={<TextInput maxLength={40} onChange={(event) => updateFormValue('code', event.target.value)} readOnly={Boolean(editingDepartment)} required value={formValues.code} />} description={editingDepartment ? labels.codeReadOnly : undefined} label={labels.code} required />
        <FormField control={<TextInput maxLength={160} onChange={(event) => updateFormValue('name', event.target.value)} required value={formValues.name} />} label={labels.name} required />
        <FormField control={<Textarea maxLength={500} onChange={(event) => updateFormValue('description', event.target.value)} value={formValues.description} />} description={labels.descriptionHelp} label={labels.description} />
        <FormField control={<DropdownSelect aria-label={labels.parent} onChange={(event) => updateFormValue('parentId', event.target.value)} searchable searchPlaceholder={labels.parent} value={formValues.parentId}><option value="">{labels.noParent}</option>{parentOptions.map((department) => <option key={department.id} value={department.id}>{department.code} · {department.name}{department.isActive ? '' : ` · ${labels.inactive}`}</option>)}</DropdownSelect>} description={labels.parentHelp} label={labels.parent} />
      </FormDrawer>

      <ConfirmDialog
        cancelLabel={labels.cancel}
        confirmLabel={statusCandidate?.isActive ? labels.confirmDeactivate : labels.confirmActivate}
        description={statusCandidate?.isActive ? labels.deactivateDescription : labels.activateDescription}
        destructive={Boolean(statusCandidate?.isActive)}
        onConfirm={() => void changeStatus()}
        onOpenChange={(open) => { if (!open && !statusSaving) setStatusCandidate(null) }}
        open={Boolean(statusCandidate)}
        pending={statusSaving}
        title={statusCandidate?.isActive ? labels.deactivateTitle : labels.activateTitle}
      />
    </div>
  )
}

function DepartmentBranch({ canStartProcess, canWrite, labels, node, onEdit, onStatusChange }: {
  canStartProcess: boolean
  canWrite: boolean
  labels: DepartmentManagerLabels
  node: DepartmentTreeNode
  onEdit: (department: DepartmentRecord) => void
  onStatusChange: (department: DepartmentRecord) => void
}) {
  const actions = canWrite ? <RowActions menuLabel={labels.actions} menuItems={[{ destructive: node.isActive, id: node.isActive ? 'deactivate' : 'activate', label: node.isActive ? labels.deactivate : labels.activate, onSelect: () => onStatusChange(node) }]} primaryAction={<Button aria-label={`${labels.edit}: ${node.name}`} onClick={() => onEdit(node)} size="sm" type="button" variant="secondary"><Pencil aria-hidden="true" />{labels.edit}</Button>} /> : null
  const processLink = canStartProcess && node.isActive ? <Link className={buttonClasses({ size: 'sm', variant: 'ghost' })} href={`/work/new/internal-transfer?departmentId=${node.id}`}>{labels.processStart}</Link> : null
  const identity = <DepartmentIdentity labels={labels} node={node} />

  if (node.children.length > 0) {
    return <li className="relative"><div className="flex min-w-0 items-start gap-2"><details className="min-w-0 flex-1" open><summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[var(--radius-control)] px-2 py-2.5 hover:bg-surface-raised [&::-webkit-details-marker]:hidden"><span className="flex min-w-0 items-center gap-2"><ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform [details[open]_&]:rotate-90" />{identity}</span></summary><ul className="relative ml-3 space-y-1 border-l border-border-subtle py-1 pl-4 sm:ml-5 sm:pl-5">{node.children.map((child) => <DepartmentBranch canStartProcess={canStartProcess} canWrite={canWrite} key={child.id} labels={labels} node={child} onEdit={onEdit} onStatusChange={onStatusChange} />)}</ul></details><div className="flex shrink-0 flex-wrap items-center justify-end gap-1 pt-1">{processLink}{actions}</div></div></li>
  }

  return <li className="relative"><div className="flex min-w-0 items-start gap-2 rounded-[var(--radius-control)] px-2 py-2.5 hover:bg-surface-raised"><button className="min-w-0 flex-1 text-left" onClick={() => canWrite && onEdit(node)} type="button">{identity}</button><div className="flex shrink-0 flex-wrap items-center justify-end gap-1">{processLink}{actions}</div></div></li>
}

function DepartmentIdentity({ labels, node }: { labels: DepartmentManagerLabels; node: DepartmentTreeNode }) {
  return <span className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] border border-border-subtle bg-surface-subtle text-accent-foreground"><Building2 size={17} /></span><span className="min-w-0"><span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground"><span className="break-words">{node.name}</span><Badge tone={node.isActive ? 'success' : 'neutral'}>{node.isActive ? labels.active : labels.inactive}</Badge></span><span className="mt-0.5 block break-words text-xs text-muted-foreground">{node.code}</span></span></span>
}

function toFormValues(department: DepartmentRecord): FormValues {
  return { code: department.code, name: department.name, description: department.description ?? '', parentId: department.parentId ?? '' }
}

async function getErrorCode(response: Response): Promise<string | null> {
  const payload: unknown = await response.json().catch(() => null)
  if (!payload || typeof payload !== 'object' || !('error' in payload)) return null
  const error = payload.error
  return typeof error === 'string' ? error : null
}
