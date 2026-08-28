'use client'

import { Download, Plus, Search, UsersRound } from 'lucide-react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { MultiSelect } from '@/components/ui/multi-select'
import { TextInput } from '@/components/ui/text-input'
import { CollectionToolbar } from '@/components/patterns/collection-toolbar'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { DataTableShell } from '@/components/patterns/data-table-shell'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { RowActions } from '@/components/patterns/row-actions'

export interface RoleAssignmentManagerLabels {
  title: string; subtitle: string; employee: string; role: string; department: string; effectiveFrom: string; effectiveTo: string
  allRoles: string; searchEmployees: string; searchDepartments: string; addAssignment: string; save: string; delete: string
  export: string; noDepartment: string; scopeRequired: string; tenantWide: string; empty: string; saved: string; failed: string
  assignmentType: string; departmentManager: string; departmentManagerPlus: string; fromEmployee: string; fromDepartment: string; withoutManager: string; currentAssignments: string
  selectDepartments: string; assignManager: string; details: string; cancel: string; job: string; employeeNumber: string
  noCurrentAssignments: string; noMissingDepartments: string; openSection: string; writeRequired: string
}

interface Role { id: string; name: string; code: string; is_organization_scoped: boolean }
interface Assignment { id: string; employee_id: string; management_role_id: string; department_id: string | null; effective_from: string; effective_to: string | null }
interface Employee { id: string; name: string; employeeNumber: string; jobTitle: string | null; departmentName: string | null }
interface Department { id: string; name: string; code: string }
interface PlacementDepartment { employeeId: string; departmentId: string }
type SortKey = 'employee' | 'role' | 'department' | 'effectiveFrom'

const TODAY = new Date().toISOString().slice(0, 10)

export function RoleAssignmentManager({ roles, assignments, employees, departments, placementDepartments, canWrite, labels }: { roles: Role[]; assignments: Assignment[]; employees: Employee[]; departments: Department[]; placementDepartments: PlacementDepartment[]; canWrite: boolean; labels: RoleAssignmentManagerLabels }) {
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [employeeRoleId, setEmployeeRoleId] = useState('')
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('')
  const [searchEmployee, setSearchEmployee] = useState('')
  const [searchDepartment, setSearchDepartment] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('employee')
  const [sortAscending, setSortAscending] = useState(true)
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<Assignment | null>(null)
  const [employeeDrawerOpen, setEmployeeDrawerOpen] = useState(false)
  const [departmentDrawerOpen, setDepartmentDrawerOpen] = useState(false)
  const [missingManagersDrawerOpen, setMissingManagersDrawerOpen] = useState(false)
  const [missingDepartmentIds, setMissingDepartmentIds] = useState<string[]>([])

  const assignableRoles = roles.filter((role) => role.code !== 'TENANT_ADMIN' && role.code !== 'EMPLOYEE')
  const organizationRoles = assignableRoles.filter((role) => role.is_organization_scoped)
  const directManagerRole = roles.find((role) => role.code === 'DIRECT_MANAGER')
  const roleById = useMemo(() => new Map(roles.map((role) => [role.id, role])), [roles])
  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees])
  const departmentById = useMemo(() => new Map(departments.map((department) => [department.id, department])), [departments])
  const currentDepartmentByEmployee = useMemo(() => new Map(placementDepartments.map((placement) => [placement.employeeId, placement.departmentId])), [placementDepartments])

  function isCurrent(assignment: Assignment): boolean { return assignment.effective_from <= TODAY && (!assignment.effective_to || assignment.effective_to >= TODAY) }
  const managedDepartmentIds = new Set(assignments.filter((assignment) => directManagerRole && assignment.management_role_id === directManagerRole.id && assignment.department_id && isCurrent(assignment)).map((assignment) => assignment.department_id as string))
  const departmentsWithoutManager = departments.filter((department) => !managedDepartmentIds.has(department.id))

  function assignmentType(assignment: Assignment): 'sameDepartment' | 'otherDepartment' | null {
    const role = roleById.get(assignment.management_role_id)
    if (role?.code !== 'DIRECT_MANAGER' || !assignment.department_id) return null
    const currentDepartmentId = currentDepartmentByEmployee.get(assignment.employee_id)
    if (!currentDepartmentId) return null
    return currentDepartmentId === assignment.department_id ? 'sameDepartment' : 'otherDepartment'
  }

  const visible = useMemo(() => {
    const employeeQuery = searchEmployee.trim().toLocaleLowerCase('nl-NL')
    const departmentQuery = searchDepartment.trim().toLocaleLowerCase('nl-NL')
    return assignments.filter((assignment) => {
      const employee = employeeById.get(assignment.employee_id)
      const department = assignment.department_id ? departmentById.get(assignment.department_id) : undefined
      return (!roleFilter || assignment.management_role_id === roleFilter)
        && (!employeeQuery || `${employee?.name ?? ''} ${employee?.employeeNumber ?? ''} ${employee?.jobTitle ?? ''}`.toLocaleLowerCase('nl-NL').includes(employeeQuery))
        && (!departmentQuery || `${department?.code ?? ''} ${department?.name ?? ''}`.toLocaleLowerCase('nl-NL').includes(departmentQuery))
    }).sort((left, right) => {
      const values = {
        employee: [employeeById.get(left.employee_id)?.name ?? '', employeeById.get(right.employee_id)?.name ?? ''],
        role: [roleById.get(left.management_role_id)?.name ?? '', roleById.get(right.management_role_id)?.name ?? ''],
        department: [left.department_id ? departmentById.get(left.department_id)?.name ?? '' : '', right.department_id ? departmentById.get(right.department_id)?.name ?? '' : ''],
        effectiveFrom: [left.effective_from, right.effective_from],
      }[sortKey]
      const result = values[0].localeCompare(values[1], 'nl-NL')
      return sortAscending ? result : -result
    })
  }, [assignments, departmentById, employeeById, roleById, roleFilter, searchDepartment, searchEmployee, sortAscending, sortKey])

  async function mutate(url: string, method: 'POST' | 'DELETE', body?: object, refresh = true): Promise<boolean> {
    setSaving(true); setMessage(null)
    try {
      const response = await fetch(url, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
      if (!response.ok) { setMessage(labels.failed); return false }
      setMessage(labels.saved); if (refresh) router.refresh(); return true
    } catch { setMessage(labels.failed); return false } finally { setSaving(false) }
  }

  async function submitAssignment(event: FormEvent<HTMLFormElement>, fixedDepartmentId?: string): Promise<void> {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const managementRoleId = String(form.get('managementRoleId'))
    const role = roleById.get(managementRoleId)
    const departmentId = role?.is_organization_scoped ? fixedDepartmentId ?? String(form.get('departmentId') || '') : null
    if (await mutate('/api/organization/management-assignments', 'POST', { employeeId: form.get('employeeId'), managementRoleId, departmentId: departmentId || null, effectiveFrom: form.get('effectiveFrom'), effectiveTo: form.get('effectiveTo') || null })) {
      setEmployeeDrawerOpen(false); setDepartmentDrawerOpen(false); setEmployeeRoleId('')
    }
  }

  async function submitMissingManagers(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!directManagerRole) { setMessage(labels.failed); return }
    const form = new FormData(event.currentTarget)
    const departmentIds = form.getAll('departmentIds').map(String)
    let success = departmentIds.length > 0
    for (const departmentId of departmentIds) success = await mutate('/api/organization/management-assignments', 'POST', { employeeId: form.get('employeeId'), managementRoleId: directManagerRole.id, departmentId, effectiveFrom: form.get('effectiveFrom'), effectiveTo: null }, false) && success
    if (success) { setMissingManagersDrawerOpen(false); setMissingDepartmentIds([]); router.refresh() }
  }

  function employeeLabel(employee: Employee): string { const context = [employee.jobTitle, employee.departmentName].filter(Boolean).join(' · '); return `${employee.employeeNumber} · ${employee.name}${context ? ` — ${context}` : ''}` }
  function exportCsv(): void {
    const rows = [[labels.employee, labels.role, labels.department, labels.effectiveFrom, labels.effectiveTo], ...visible.map((assignment) => [employeeById.get(assignment.employee_id)?.name ?? '', roleById.get(assignment.management_role_id)?.name ?? '', assignment.department_id ? departmentById.get(assignment.department_id)?.name ?? '' : labels.tenantWide, assignment.effective_from, assignment.effective_to ?? ''])]
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([`\uFEFFsep=;\r\n${csv}`], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'roltoewijzingen.csv'; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  return <section className="space-y-6">
    {message ? <p aria-live="polite" className="border border-border bg-surface px-4 py-3 text-sm font-medium text-foreground">{message}</p> : null}
    {!canWrite ? <p className="border border-border bg-muted px-4 py-3 text-sm font-medium text-muted-foreground">{labels.writeRequired}</p> : null}

    <section className="grid gap-4 xl:grid-cols-3" aria-label={labels.addAssignment}>
      <ActionPanel icon={<UsersRound aria-hidden="true" />} title={labels.fromEmployee} description={labels.addAssignment} action={canWrite ? <Button onClick={() => setEmployeeDrawerOpen(true)} size="sm" type="button"><Plus aria-hidden="true" />{labels.save}</Button> : undefined} />
      <ActionPanel icon={<UsersRound aria-hidden="true" />} title={labels.fromDepartment} description={labels.scopeRequired} action={canWrite ? <Button onClick={() => { setSelectedDepartmentId(''); setDepartmentDrawerOpen(true) }} size="sm" type="button"><Plus aria-hidden="true" />{labels.save}</Button> : undefined} />
      <ActionPanel icon={<UsersRound aria-hidden="true" />} title={labels.withoutManager} description={departmentsWithoutManager.length ? `${departmentsWithoutManager.length}` : labels.noMissingDepartments} action={canWrite && departmentsWithoutManager.length ? <Button onClick={() => { setMissingDepartmentIds([]); setMissingManagersDrawerOpen(true) }} size="sm" type="button"><Plus aria-hidden="true" />{labels.assignManager}</Button> : undefined} />
    </section>

    <CollectionToolbar
      actions={<Button onClick={exportCsv} size="sm" type="button" variant="secondary"><Download aria-hidden="true" />{labels.export}</Button>}
      filters={<DropdownSelect aria-label={labels.allRoles} onChange={(event) => setRoleFilter(event.target.value)} value={roleFilter}><option value="">{labels.allRoles}</option>{assignableRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</DropdownSelect>}
      search={<TextInput aria-label={labels.searchEmployees} leadingIcon={<Search aria-hidden="true" />} onChange={(event) => setSearchEmployee(event.target.value)} placeholder={labels.searchEmployees} type="search" value={searchEmployee} />}
      sort={<TextInput aria-label={labels.searchDepartments} leadingIcon={<Search aria-hidden="true" />} onChange={(event) => setSearchDepartment(event.target.value)} placeholder={labels.searchDepartments} type="search" value={searchDepartment} />}
    />

    <DataTableShell caption={labels.title} state={visible.length ? 'ready' : 'empty'} stateContent={<EmptyState icon={<UsersRound />} title={labels.empty} />}>
      <thead className="border-b border-border-subtle bg-surface-raised text-xs uppercase tracking-[.08em] text-muted-foreground"><tr><SortableHeader active={sortKey === 'employee'} label={labels.employee} onClick={() => changeSort('employee', sortKey, sortAscending, setSortKey, setSortAscending)} /><SortableHeader active={sortKey === 'role'} label={labels.role} onClick={() => changeSort('role', sortKey, sortAscending, setSortKey, setSortAscending)} /><SortableHeader active={sortKey === 'department'} label={labels.department} onClick={() => changeSort('department', sortKey, sortAscending, setSortKey, setSortAscending)} /><SortableHeader active={sortKey === 'effectiveFrom'} label={labels.effectiveFrom} onClick={() => changeSort('effectiveFrom', sortKey, sortAscending, setSortKey, setSortAscending)} /><th className="px-3 py-3">{labels.assignmentType}</th><th className="px-3 py-3 text-right">{labels.details}</th></tr></thead>
      <tbody className="divide-y divide-border-subtle">{visible.map((assignment) => { const type = assignmentType(assignment); return <tr className="hover:bg-muted/40" key={assignment.id}><td className="px-3 py-3 font-medium">{employeeById.get(assignment.employee_id)?.name}<span className="block text-xs font-normal text-muted-foreground">{employeeById.get(assignment.employee_id)?.employeeNumber}</span></td><td className="px-3 py-3">{roleById.get(assignment.management_role_id)?.name}</td><td className="px-3 py-3">{assignment.department_id ? departmentById.get(assignment.department_id)?.name : labels.tenantWide}</td><td className="px-3 py-3">{assignment.effective_from}</td><td className="px-3 py-3">{type === 'sameDepartment' ? <Badge tone="success">{labels.departmentManager}</Badge> : type === 'otherDepartment' ? <Badge tone="warning">{labels.departmentManagerPlus}</Badge> : '—'}</td><td className="px-3 py-3 text-right"><RowActions menuLabel={labels.details} primaryAction={<Button onClick={() => setSelectedAssignment(assignment)} size="sm" type="button" variant="secondary">{labels.details}</Button>} menuItems={canWrite ? [{ destructive: true, id: 'delete', label: labels.delete, onSelect: () => setDeleteCandidate(assignment) }] : []} /></td></tr> })}</tbody>
    </DataTableShell>

    <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.cancel} description={labels.addAssignment} dirty={Boolean(employeeRoleId)} dirtyProtection={{ description: labels.failed, discardLabel: labels.cancel, keepEditingLabel: labels.cancel, title: labels.cancel }} onDiscard={() => setEmployeeRoleId('')} onOpenChange={setEmployeeDrawerOpen} onSubmit={(event) => void submitAssignment(event)} open={employeeDrawerOpen} saveLabel={labels.save} title={labels.fromEmployee}>
      <EmployeeSelect employees={employees} label={labels.employee} labelFor={employeeLabel} /><FormField control={<DropdownSelect aria-label={labels.role} name="managementRoleId" onChange={(event) => setEmployeeRoleId(event.target.value)} required value={employeeRoleId}><option value="">{labels.role}</option>{assignableRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</DropdownSelect>} label={labels.role} required />{roleById.get(employeeRoleId)?.is_organization_scoped ? <DepartmentSelect departments={departments} label={labels.department} /> : <p className="bg-muted px-3 py-2 text-sm text-muted-foreground">{labels.tenantWide}</p>}<DateFields labels={labels} />
    </FormDrawer>
    <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.cancel} description={labels.scopeRequired} dirty={Boolean(selectedDepartmentId)} dirtyProtection={{ description: labels.failed, discardLabel: labels.cancel, keepEditingLabel: labels.cancel, title: labels.cancel }} onDiscard={() => setSelectedDepartmentId('')} onOpenChange={setDepartmentDrawerOpen} onSubmit={(event) => void submitAssignment(event, selectedDepartmentId)} open={departmentDrawerOpen} saveLabel={labels.save} title={labels.fromDepartment}>
      <FormField control={<DropdownSelect aria-label={labels.department} onChange={(event) => setSelectedDepartmentId(event.target.value)} required value={selectedDepartmentId}><option value="">{labels.department}</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.code} · {department.name}</option>)}</DropdownSelect>} label={labels.department} required /><EmployeeSelect employees={employees} label={labels.employee} labelFor={employeeLabel} /><FormField control={<DropdownSelect aria-label={labels.role} name="managementRoleId" required><option value="">{labels.role}</option>{organizationRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</DropdownSelect>} label={labels.role} required /><DateFields labels={labels} />
    </FormDrawer>
    <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.cancel} description={labels.selectDepartments} dirty={missingDepartmentIds.length > 0} dirtyProtection={{ description: labels.failed, discardLabel: labels.cancel, keepEditingLabel: labels.cancel, title: labels.cancel }} onDiscard={() => setMissingDepartmentIds([])} onOpenChange={setMissingManagersDrawerOpen} onSubmit={(event) => void submitMissingManagers(event)} open={missingManagersDrawerOpen} saveLabel={labels.assignManager} title={labels.withoutManager}>
      <FormField control={<MultiSelect aria-label={labels.selectDepartments} emptySelectionLabel={labels.selectDepartments} listLabel={labels.selectDepartments} loadingLabel={labels.selectDepartments} name="departmentIds" noOptionsLabel={labels.empty} onChange={setMissingDepartmentIds} options={departmentsWithoutManager.map((department) => ({ value: department.id, label: `${department.code} · ${department.name}` }))} searchPlaceholder={labels.searchDepartments} selectedCountLabel={labels.selectDepartments} value={missingDepartmentIds} />} label={labels.department} />
      <EmployeeSelect employees={employees} label={labels.employee} labelFor={employeeLabel} /><FormField control={<TextInput defaultValue={TODAY} name="effectiveFrom" required type="date" />} label={labels.effectiveFrom} required />
    </FormDrawer>

    {selectedAssignment ? <Dialog closeLabel={labels.cancel} onOpenChange={(open) => { if (!open) setSelectedAssignment(null) }} open title={labels.details}><dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-3 text-sm"><dt className="text-muted-foreground">{labels.employee}</dt><dd>{employeeById.get(selectedAssignment.employee_id)?.name}</dd><dt className="text-muted-foreground">{labels.employeeNumber}</dt><dd>{employeeById.get(selectedAssignment.employee_id)?.employeeNumber}</dd><dt className="text-muted-foreground">{labels.job}</dt><dd>{employeeById.get(selectedAssignment.employee_id)?.jobTitle ?? '—'}</dd><dt className="text-muted-foreground">{labels.role}</dt><dd>{roleById.get(selectedAssignment.management_role_id)?.name}</dd><dt className="text-muted-foreground">{labels.department}</dt><dd>{selectedAssignment.department_id ? departmentById.get(selectedAssignment.department_id)?.name : labels.tenantWide}</dd><dt className="text-muted-foreground">{labels.effectiveFrom}</dt><dd>{selectedAssignment.effective_from}</dd><dt className="text-muted-foreground">{labels.effectiveTo}</dt><dd>{selectedAssignment.effective_to ?? '—'}</dd></dl></Dialog> : null}
    <ConfirmDialog cancelLabel={labels.cancel} confirmLabel={labels.delete} description={labels.delete} destructive onConfirm={async () => { if (deleteCandidate && await mutate(`/api/organization/management-assignments/${deleteCandidate.id}`, 'DELETE')) setDeleteCandidate(null) }} onOpenChange={(open) => { if (!open && !saving) setDeleteCandidate(null) }} open={Boolean(deleteCandidate)} title={labels.delete} pending={saving} />
  </section>
}

function ActionPanel({ action, description, icon, title }: { action?: ReactNode; description: string; icon: ReactNode; title: string }) { return <article className="flex min-w-0 flex-col justify-between gap-4 border border-border bg-surface p-4"><div className="flex items-start gap-3"><span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-accent text-accent-foreground">{icon}</span><div className="min-w-0"><h2 className="font-semibold text-foreground">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div></div>{action ? <div className="self-start">{action}</div> : null}</article> }
function EmployeeSelect({ employees, label, labelFor }: { employees: Employee[]; label: string; labelFor: (employee: Employee) => string }) { return <FormField control={<DropdownSelect aria-label={label} name="employeeId" required><option value="">{label}</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{labelFor(employee)}</option>)}</DropdownSelect>} label={label} required /> }
function DepartmentSelect({ departments, label }: { departments: Department[]; label: string }) { return <FormField control={<DropdownSelect aria-label={label} name="departmentId" required><option value="">{label}</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.code} · {department.name}</option>)}</DropdownSelect>} label={label} required /> }
function DateFields({ labels }: { labels: RoleAssignmentManagerLabels }) { return <div className="grid gap-4 sm:grid-cols-2"><FormField control={<TextInput defaultValue={TODAY} name="effectiveFrom" required type="date" />} label={labels.effectiveFrom} required /><FormField control={<TextInput name="effectiveTo" type="date" />} label={labels.effectiveTo} /></div> }
function SortableHeader({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) { return <th className="px-3 py-3"><button className={active ? 'font-bold text-foreground' : ''} onClick={onClick} type="button">{label}</button></th> }
function changeSort(next: SortKey, current: SortKey, ascending: boolean, setKey: (key: SortKey) => void, setAscending: (value: boolean) => void): void { if (next === current) setAscending(!ascending); else { setKey(next); setAscending(true) } }
