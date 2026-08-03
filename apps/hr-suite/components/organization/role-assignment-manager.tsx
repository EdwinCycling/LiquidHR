'use client'

import { ChevronDown, Download, Plus, Search, Trash2, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { DropdownSelect } from '@/components/ui/dropdown-select'

export interface RoleAssignmentManagerLabels {
  title: string; subtitle: string; employee: string; role: string; department: string; effectiveFrom: string; effectiveTo: string
  allRoles: string; searchEmployees: string; searchDepartments: string; addAssignment: string; save: string; delete: string
  export: string; noDepartment: string; scopeRequired: string; tenantWide: string; empty: string; saved: string; failed: string
  needsReview: string; fromEmployee: string; fromDepartment: string; withoutManager: string; currentAssignments: string
  selectDepartments: string; assignManager: string; details: string; cancel: string; job: string; employeeNumber: string
  noCurrentAssignments: string; noMissingDepartments: string; openSection: string
}

interface Role { id: string; name: string; code: string; is_organization_scoped: boolean }
interface Assignment { id: string; employee_id: string; management_role_id: string; department_id: string | null; effective_from: string; effective_to: string | null }
interface Employee { id: string; name: string; employeeNumber: string; jobTitle: string | null; departmentName: string | null }
interface Department { id: string; name: string; code: string }
interface PlacementDepartment { employeeId: string; departmentId: string }
type SortKey = 'employee' | 'role' | 'department' | 'effectiveFrom'

const TODAY = new Date().toISOString().slice(0, 10)

export function RoleAssignmentManager({ roles, assignments, employees, departments, placementDepartments, labels }: { roles: Role[]; assignments: Assignment[]; employees: Employee[]; departments: Department[]; placementDepartments: PlacementDepartment[]; labels: RoleAssignmentManagerLabels }) {
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

  const assignableRoles = roles.filter((role) => role.code !== 'TENANT_ADMIN' && role.code !== 'EMPLOYEE')
  const organizationRoles = assignableRoles.filter((role) => role.is_organization_scoped)
  const directManagerRole = roles.find((role) => role.code === 'DIRECT_MANAGER')
  const roleById = useMemo(() => new Map(roles.map((role) => [role.id, role])), [roles])
  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees])
  const departmentById = useMemo(() => new Map(departments.map((department) => [department.id, department])), [departments])
  const currentDepartmentByEmployee = useMemo(() => new Map(placementDepartments.map((placement) => [placement.employeeId, placement.departmentId])), [placementDepartments])

  function isCurrent(assignment: Assignment): boolean {
    return assignment.effective_from <= TODAY && (!assignment.effective_to || assignment.effective_to >= TODAY)
  }

  const currentDepartmentAssignments = assignments.filter((assignment) => assignment.department_id === selectedDepartmentId && isCurrent(assignment))
  const managedDepartmentIds = new Set(assignments.filter((assignment) => directManagerRole && assignment.management_role_id === directManagerRole.id && assignment.department_id && isCurrent(assignment)).map((assignment) => assignment.department_id as string))
  const departmentsWithoutManager = departments.filter((department) => !managedDepartmentIds.has(department.id))
  const needsReview = (assignment: Assignment): boolean => Boolean(assignment.department_id && currentDepartmentByEmployee.get(assignment.employee_id) && currentDepartmentByEmployee.get(assignment.employee_id) !== assignment.department_id)

  const visible = useMemo(() => {
    const employeeQuery = searchEmployee.trim().toLocaleLowerCase('nl-NL')
    const departmentQuery = searchDepartment.trim().toLocaleLowerCase('nl-NL')
    const rows = assignments.filter((assignment) => {
      const employee = employeeById.get(assignment.employee_id)
      const department = assignment.department_id ? departmentById.get(assignment.department_id) : undefined
      return (!roleFilter || assignment.management_role_id === roleFilter)
        && (!employeeQuery || `${employee?.name ?? ''} ${employee?.employeeNumber ?? ''} ${employee?.jobTitle ?? ''}`.toLocaleLowerCase('nl-NL').includes(employeeQuery))
        && (!departmentQuery || `${department?.code ?? ''} ${department?.name ?? ''}`.toLocaleLowerCase('nl-NL').includes(departmentQuery))
    })
    return rows.sort((left, right) => {
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
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch(url, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
      if (!response.ok) { setMessage(labels.failed); return false }
      setMessage(labels.saved)
      if (refresh) router.refresh()
      return true
    } catch {
      setMessage(labels.failed)
      return false
    } finally {
      setSaving(false)
    }
  }

  async function submitAssignment(event: FormEvent<HTMLFormElement>, fixedDepartmentId?: string): Promise<void> {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const managementRoleId = String(form.get('managementRoleId'))
    const role = roleById.get(managementRoleId)
    const departmentId = role?.is_organization_scoped ? fixedDepartmentId ?? String(form.get('departmentId') || '') : null
    if (await mutate('/api/organization/management-assignments', 'POST', {
      employeeId: form.get('employeeId'), managementRoleId, departmentId: departmentId || null,
      effectiveFrom: form.get('effectiveFrom'), effectiveTo: form.get('effectiveTo') || null,
    })) formElement.reset()
  }

  async function submitMissingManagers(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!directManagerRole) { setMessage(labels.failed); return }
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const departmentIds = form.getAll('departmentIds').map(String)
    let success = departmentIds.length > 0
    for (const departmentId of departmentIds) {
      success = await mutate('/api/organization/management-assignments', 'POST', {
        employeeId: form.get('employeeId'), managementRoleId: directManagerRole.id, departmentId,
        effectiveFrom: form.get('effectiveFrom'), effectiveTo: null,
      }, false) && success
    }
    if (success) { formElement.reset(); router.refresh() }
  }

  function employeeLabel(employee: Employee): string {
    const context = [employee.jobTitle, employee.departmentName].filter(Boolean).join(' · ')
    return `${employee.employeeNumber} · ${employee.name}${context ? ` — ${context}` : ''}`
  }

  function exportCsv(): void {
    const rows = [[labels.employee, labels.role, labels.department, labels.effectiveFrom, labels.effectiveTo], ...visible.map((assignment) => [employeeById.get(assignment.employee_id)?.name ?? '', roleById.get(assignment.management_role_id)?.name ?? '', assignment.department_id ? departmentById.get(assignment.department_id)?.name ?? '' : labels.tenantWide, assignment.effective_from, assignment.effective_to ?? ''])]
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([`\uFEFFsep=;\r\n${csv}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'roltoewijzingen.csv'; link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  return <section className="mx-auto w-full max-w-[96rem] px-5 py-8 sm:px-8 sm:py-10">
    <p className="eyebrow">{labels.role}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{labels.title}</h1><p className="mt-2 max-w-3xl text-muted-foreground">{labels.subtitle}</p>
    {message ? <p aria-live="polite" className="mt-4 rounded-lg border bg-surface px-4 py-3 text-sm font-medium">{message}</p> : null}

    <div className="mt-7 grid gap-4 xl:grid-cols-3">
      <AssignmentCard title={labels.fromEmployee} openLabel={labels.openSection}>
        <form className="grid gap-3" onSubmit={(event) => void submitAssignment(event)}>
          <EmployeeSelect employees={employees} label={labels.employee} labelFor={employeeLabel} />
          <label className="grid gap-1.5 text-sm font-medium">{labels.role}<select className="form-field" name="managementRoleId" onChange={(event) => setEmployeeRoleId(event.target.value)} required value={employeeRoleId}><option value="" />{assignableRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
          {roleById.get(employeeRoleId)?.is_organization_scoped ? <DepartmentSelect departments={departments} label={labels.department} /> : <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{labels.tenantWide}</p>}
          <DateFields labels={labels} />
          <button className="button-primary inline-flex items-center justify-center gap-2" disabled={saving} type="submit"><Plus size={16} />{labels.save}</button>
        </form>
      </AssignmentCard>

      <AssignmentCard title={labels.fromDepartment} openLabel={labels.openSection}>
        <label className="grid gap-1.5 text-sm font-medium">{labels.department}<select className="form-field" onChange={(event) => setSelectedDepartmentId(event.target.value)} value={selectedDepartmentId}><option value="" />{departments.map((department) => <option key={department.id} value={department.id}>{department.code} · {department.name}</option>)}</select></label>
        {selectedDepartmentId ? <><section className="mt-4 rounded-xl border p-3"><h3 className="text-sm font-semibold">{labels.currentAssignments}</h3>{currentDepartmentAssignments.length ? <ul className="mt-2 space-y-2">{currentDepartmentAssignments.map((assignment) => <li className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2 text-sm" key={assignment.id}><span>{employeeById.get(assignment.employee_id)?.name} · {roleById.get(assignment.management_role_id)?.name}</span><button aria-label={labels.delete} className="text-destructive" disabled={saving} onClick={() => void mutate(`/api/organization/management-assignments/${assignment.id}`, 'DELETE')} type="button"><Trash2 size={15} /></button></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">{labels.noCurrentAssignments}</p>}</section><form className="mt-4 grid gap-3" onSubmit={(event) => void submitAssignment(event, selectedDepartmentId)}><EmployeeSelect employees={employees} label={labels.employee} labelFor={employeeLabel} /><label className="grid gap-1.5 text-sm font-medium">{labels.role}<select className="form-field" name="managementRoleId" required><option value="" />{organizationRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label><DateFields labels={labels} /><button className="button-primary inline-flex items-center justify-center gap-2" disabled={saving} type="submit"><Plus size={16} />{labels.save}</button></form></> : null}
      </AssignmentCard>

      <AssignmentCard title={labels.withoutManager} openLabel={labels.openSection}>
        {departmentsWithoutManager.length ? <form className="grid gap-3" onSubmit={(event) => void submitMissingManagers(event)}><fieldset className="rounded-xl border p-3"><legend className="px-1 text-sm font-semibold">{labels.selectDepartments}</legend><div className="mt-2 max-h-48 space-y-2 overflow-y-auto">{departmentsWithoutManager.map((department) => <label className="flex items-center gap-2 text-sm" key={department.id}><input name="departmentIds" type="checkbox" value={department.id} />{department.code} · {department.name}</label>)}</div></fieldset><EmployeeSelect employees={employees} label={labels.employee} labelFor={employeeLabel} /><label className="grid gap-1.5 text-sm font-medium">{labels.effectiveFrom}<input className="form-field" defaultValue={TODAY} name="effectiveFrom" required type="date" /></label><button className="button-primary inline-flex items-center justify-center gap-2" disabled={saving} type="submit"><Plus size={16} />{labels.assignManager}</button></form> : <p className="text-sm text-muted-foreground">{labels.noMissingDepartments}</p>}
      </AssignmentCard>
    </div>

    <section className="mt-6 rounded-2xl border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="grid flex-1 gap-3 md:grid-cols-3"><SearchInput label={labels.searchEmployees} value={searchEmployee} onChange={setSearchEmployee} /><SearchInput label={labels.searchDepartments} value={searchDepartment} onChange={setSearchDepartment} /><select className="form-field" onChange={(event) => setRoleFilter(event.target.value)} value={roleFilter}><option value="">{labels.allRoles}</option>{assignableRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></div><button className="button-secondary inline-flex items-center gap-2" onClick={exportCsv} type="button"><Download size={16} />{labels.export}</button></div>
      {visible.length ? <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="border-b text-left text-xs uppercase tracking-[.08em] text-muted-foreground"><tr><SortableHeader active={sortKey === 'employee'} label={labels.employee} onClick={() => changeSort('employee', sortKey, sortAscending, setSortKey, setSortAscending)} /><SortableHeader active={sortKey === 'role'} label={labels.role} onClick={() => changeSort('role', sortKey, sortAscending, setSortKey, setSortAscending)} /><SortableHeader active={sortKey === 'department'} label={labels.department} onClick={() => changeSort('department', sortKey, sortAscending, setSortKey, setSortAscending)} /><SortableHeader active={sortKey === 'effectiveFrom'} label={labels.effectiveFrom} onClick={() => changeSort('effectiveFrom', sortKey, sortAscending, setSortKey, setSortAscending)} /><th className="px-3 py-3">{labels.needsReview}</th></tr></thead><tbody className="divide-y">{visible.map((assignment) => <tr className="cursor-pointer hover:bg-muted/50" key={assignment.id} onClick={() => setSelectedAssignment(assignment)}><td className="px-3 py-3 font-medium">{employeeById.get(assignment.employee_id)?.name}<span className="block text-xs font-normal text-muted-foreground">{employeeById.get(assignment.employee_id)?.employeeNumber}</span></td><td className="px-3 py-3">{roleById.get(assignment.management_role_id)?.name}</td><td className="px-3 py-3">{assignment.department_id ? departmentById.get(assignment.department_id)?.name : labels.tenantWide}</td><td className="px-3 py-3">{assignment.effective_from}</td><td className="px-3 py-3">{needsReview(assignment) ? <span className="status-chip bg-warning-surface text-warning">{labels.needsReview}</span> : '—'}</td></tr>)}</tbody></table></div> : <p className="mt-6 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{labels.empty}</p>}
    </section>

    {selectedAssignment ? <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/60 p-4 backdrop-blur-sm" onMouseDown={() => setSelectedAssignment(null)} role="presentation"><section aria-modal="true" className="w-full max-w-lg rounded-2xl border bg-surface p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()} role="dialog"><header className="flex items-center justify-between"><h2 className="text-xl font-semibold">{labels.details}</h2><button aria-label={labels.cancel} className="button-secondary" onClick={() => setSelectedAssignment(null)} type="button"><X size={16} /></button></header><dl className="mt-5 grid grid-cols-[9rem_1fr] gap-3 text-sm"><dt className="text-muted-foreground">{labels.employee}</dt><dd>{employeeById.get(selectedAssignment.employee_id)?.name}</dd><dt className="text-muted-foreground">{labels.employeeNumber}</dt><dd>{employeeById.get(selectedAssignment.employee_id)?.employeeNumber}</dd><dt className="text-muted-foreground">{labels.job}</dt><dd>{employeeById.get(selectedAssignment.employee_id)?.jobTitle ?? '—'}</dd><dt className="text-muted-foreground">{labels.role}</dt><dd>{roleById.get(selectedAssignment.management_role_id)?.name}</dd><dt className="text-muted-foreground">{labels.department}</dt><dd>{selectedAssignment.department_id ? departmentById.get(selectedAssignment.department_id)?.name : labels.tenantWide}</dd><dt className="text-muted-foreground">{labels.effectiveFrom}</dt><dd>{selectedAssignment.effective_from}</dd><dt className="text-muted-foreground">{labels.effectiveTo}</dt><dd>{selectedAssignment.effective_to ?? '—'}</dd></dl><div className="mt-6 flex justify-end gap-2"><button className="button-secondary" onClick={() => setSelectedAssignment(null)} type="button">{labels.cancel}</button><button className="inline-flex items-center gap-2 rounded-xl bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground" disabled={saving} onClick={async () => { if (await mutate(`/api/organization/management-assignments/${selectedAssignment.id}`, 'DELETE')) setSelectedAssignment(null) }} type="button"><Trash2 size={16} />{labels.delete}</button></div></section></div> : null}
  </section>
}

function AssignmentCard({ title, openLabel, children }: { title: string; openLabel: string; children: React.ReactNode }) {
  return <details className="group self-start rounded-2xl border bg-surface shadow-sm"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 font-semibold"><span>{title}</span><span className="inline-flex items-center gap-2 text-xs text-muted-foreground">{openLabel}<ChevronDown className="transition group-open:rotate-180" size={17} /></span></summary><div className="border-t p-5">{children}</div></details>
}

function EmployeeSelect({ employees, label, labelFor }: { employees: Employee[]; label: string; labelFor: (employee: Employee) => string }) {
  return <label className="grid gap-1.5 text-sm font-medium">{label}<DropdownSelect aria-label={label} name="employeeId" required><option value="">{label}</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{labelFor(employee)}</option>)}</DropdownSelect></label>
}

function DepartmentSelect({ departments, label }: { departments: Department[]; label: string }) {
  return <label className="grid gap-1.5 text-sm font-medium">{label}<DropdownSelect aria-label={label} name="departmentId" required><option value="">{label}</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.code} · {department.name}</option>)}</DropdownSelect></label>
}

function DateFields({ labels }: { labels: RoleAssignmentManagerLabels }) {
  return <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium">{labels.effectiveFrom}<input className="form-field" defaultValue={TODAY} name="effectiveFrom" required type="date" /></label><label className="grid gap-1.5 text-sm font-medium">{labels.effectiveTo}<input className="form-field" name="effectiveTo" type="date" /></label></div>
}

function SearchInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><input className="form-field pl-9" onChange={(event) => onChange(event.target.value)} placeholder={label} value={value} /></label>
}

function SortableHeader({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <th className="px-3 py-3"><button className={active ? 'font-bold text-foreground' : ''} onClick={onClick} type="button">{label}</button></th>
}

function changeSort(next: SortKey, current: SortKey, ascending: boolean, setKey: (key: SortKey) => void, setAscending: (value: boolean) => void): void {
  if (next === current) setAscending(!ascending)
  else { setKey(next); setAscending(true) }
}
