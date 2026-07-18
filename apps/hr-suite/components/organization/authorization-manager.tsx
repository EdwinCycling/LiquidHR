'use client'

import type { Database } from '@scope/db'
import { KeyRound, Layers3, Network, Plus, RotateCcw, Save, Search, ShieldCheck, UsersRound } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import {
  buildAuthorizationOverview,
  normalizeAuthorizationTab,
  permissionCoverage,
  permissionSelectionChanged,
  togglePermissionGroup,
  type AuthorizationTab,
} from '@/lib/organization/authorization-view'

type Role = Database['public']['Tables']['management_roles']['Row']
type Permission = Database['public']['Tables']['permissions']['Row']
type RolePermission = Database['public']['Tables']['role_permissions']['Row']
interface Option { id: string; name: string }

export interface AuthorizationLabels {
  roles: string; newRole: string; roleCode: string; roleName: string; roleDescription: string; createRole: string
  systemRole: string; tenantRole: string; permissions: string; selectRole: string; savePermissions: string
  placements: string; managementAssignments: string; employee: string; department: string; role: string
  jobTitle: string; effectiveFrom: string; addPlacement: string; addManagement: string; saved: string; failed: string
  tabPermissions: string; tabOverview: string; tabAssignments: string; roleSearch: string; permissionSearch: string
  totalRoles: string; activeTenantRoles: string; assignedPermissions: string; coveredCategories: string
  selectedCount: string; selectAll: string; clearAll: string; unsavedChanges: string; resetChanges: string
  readOnlyRole: string; inactiveRole: string; activeRole: string; coverage: string; coverageExplanation: string
  overviewTitle: string; overviewSubtitle: string; scopeNoticeTitle: string; scopeNotice: string
  assignmentTitle: string; assignmentSubtitle: string; noSearchResults: string; permissionCode: string
}

interface AuthorizationManagerProps {
  roles: Role[]
  permissions: Permission[]
  rolePermissions: RolePermission[]
  employees: Option[]
  departments: Option[]
  labels: AuthorizationLabels
}

function rolePermissionSet(roleId: string, assignments: RolePermission[]): Set<string> {
  return new Set(assignments.filter((item) => item.management_role_id === roleId).map((item) => item.permission_id))
}

function coverageTone(percentage: number): string {
  if (percentage === 0) return 'bg-muted text-muted-foreground'
  if (percentage < 50) return 'bg-accent text-accent-foreground'
  if (percentage < 100) return 'bg-primary/20 text-foreground'
  return 'bg-primary text-primary-foreground'
}

export function AuthorizationManager({ roles, permissions, rolePermissions, employees, departments, labels }: AuthorizationManagerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTab = normalizeAuthorizationTab(searchParams.get('tab'))
  const firstEditableRole = roles.find((role) => role.tenant_id && !role.is_system)
  const [selectedRoleId, setSelectedRoleId] = useState(firstEditableRole?.id ?? roles[0]?.id ?? '')
  const initialIds = useMemo(() => rolePermissionSet(selectedRoleId, rolePermissions), [rolePermissions, selectedRoleId])
  const [savedPermissionIds, setSavedPermissionIds] = useState<Set<string>>(initialIds)
  const [permissionIds, setPermissionIds] = useState<Set<string>>(initialIds)
  const [roleSearch, setRoleSearch] = useState('')
  const [permissionSearch, setPermissionSearch] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const groups = useMemo(() => Map.groupBy(permissions, (permission) => permission.category), [permissions])
  const overview = useMemo(() => buildAuthorizationOverview({
    roles: roles.map((role) => ({ id: role.id, isActive: role.is_active, isSystem: role.is_system, tenantId: role.tenant_id })),
    permissions: permissions.map((permission) => ({ id: permission.id, category: permission.category })),
    rolePermissions: rolePermissions.map((assignment) => ({ roleId: assignment.management_role_id, permissionId: assignment.permission_id })),
  }), [permissions, rolePermissions, roles])
  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null
  const editable = Boolean(selectedRole?.tenant_id && !selectedRole.is_system)
  const dirty = permissionSelectionChanged(savedPermissionIds, permissionIds)
  const changedCount = new Set([...savedPermissionIds, ...permissionIds].filter((id) => savedPermissionIds.has(id) !== permissionIds.has(id))).size
  const normalizedRoleSearch = roleSearch.trim().toLocaleLowerCase()
  const filteredRoles = roles.filter((role) => !normalizedRoleSearch || `${role.name} ${role.code}`.toLocaleLowerCase().includes(normalizedRoleSearch))
  const normalizedPermissionSearch = permissionSearch.trim().toLocaleLowerCase()

  function setTab(tab: AuthorizationTab): void {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'permissions') params.delete('tab')
    else params.set('tab', tab)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  function selectRole(roleId: string): void {
    const next = rolePermissionSet(roleId, rolePermissions)
    setSelectedRoleId(roleId)
    setSavedPermissionIds(next)
    setPermissionIds(next)
    setMessage(null)
  }

  async function send(url: string, method: string, body: object): Promise<boolean> {
    setMessage(null)
    try {
      const response = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      if (!response.ok) throw new Error('FAILED')
      setMessage(labels.saved)
      router.refresh()
      return true
    } catch {
      setMessage(labels.failed)
      return false
    }
  }

  async function createRoleAction(formData: FormData): Promise<void> {
    await send('/api/roles', 'POST', { code: String(formData.get('code') ?? '').toUpperCase(), name: formData.get('name'), description: formData.get('description') || null })
  }
  async function savePermissions(): Promise<void> {
    if (!selectedRoleId || !editable) return
    if (await send(`/api/roles/${selectedRoleId}/permissions`, 'PUT', { permissionIds: [...permissionIds] })) setSavedPermissionIds(new Set(permissionIds))
  }
  async function addPlacement(formData: FormData): Promise<void> {
    await send('/api/organization/placements', 'POST', { employeeId: formData.get('employeeId'), departmentId: formData.get('departmentId'), jobTitle: formData.get('jobTitle') || null, effectiveFrom: formData.get('effectiveFrom') })
  }
  async function addManagement(formData: FormData): Promise<void> {
    await send('/api/organization/management-assignments', 'POST', { employeeId: formData.get('employeeId'), departmentId: formData.get('departmentId'), managementRoleId: formData.get('roleId'), effectiveFrom: formData.get('effectiveFrom') })
  }

  return <div className="space-y-6">
    <SummaryCards labels={labels} overview={overview} />
    <nav aria-label={labels.permissions} className="flex flex-wrap gap-2 rounded-2xl border bg-surface p-2">
      <TabButton active={activeTab === 'permissions'} icon={<KeyRound className="size-4" />} label={labels.tabPermissions} onClick={() => setTab('permissions')} />
      <TabButton active={activeTab === 'overview'} icon={<Network className="size-4" />} label={labels.tabOverview} onClick={() => setTab('overview')} />
      <TabButton active={activeTab === 'assignments'} icon={<UsersRound className="size-4" />} label={labels.tabAssignments} onClick={() => setTab('assignments')} />
    </nav>
    {message ? <p aria-live="polite" className="rounded-xl border bg-surface px-4 py-3 text-sm text-muted-foreground">{message}</p> : null}

    {activeTab === 'permissions' ? <div className="grid gap-6 xl:grid-cols-[21rem_minmax(0,1fr)]">
      <aside className="self-start rounded-2xl border bg-surface p-4 xl:sticky xl:top-5">
        <div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-foreground">{labels.roles}</h2><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{filteredRoles.length}</span></div>
        <SearchField label={labels.roleSearch} onChange={setRoleSearch} value={roleSearch} />
        <div className="mt-4 max-h-[32rem] space-y-2 overflow-y-auto pr-1">
          {filteredRoles.map((role) => {
            const count = rolePermissionSet(role.id, rolePermissions).size
            return <button aria-pressed={selectedRoleId === role.id} className={`w-full rounded-xl border px-3 py-3 text-left transition ${selectedRoleId === role.id ? 'border-primary bg-accent text-accent-foreground shadow-sm' : 'bg-background text-foreground hover:border-primary/40'}`} key={role.id} onClick={() => selectRole(role.id)} type="button">
              <span className="flex items-start justify-between gap-3"><span><span className="block font-medium">{role.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{role.code} · {role.is_system ? labels.systemRole : labels.tenantRole}</span></span><span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{count}</span></span>
              <span className="mt-2 block text-xs text-muted-foreground">{role.is_active ? labels.activeRole : labels.inactiveRole}</span>
            </button>
          })}
          {filteredRoles.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{labels.noSearchResults}</p> : null}
        </div>
        <details className="mt-5 border-t pt-4"><summary className="cursor-pointer text-sm font-semibold text-foreground">{labels.newRole}</summary><form action={createRoleAction} className="mt-4 space-y-3"><FormInput label={labels.roleCode} name="code" pattern="[A-Z][A-Z0-9_]+" required /><FormInput label={labels.roleName} name="name" required /><label className="block text-sm text-foreground">{labels.roleDescription}<textarea className="mt-1.5 min-h-20 w-full rounded-lg border bg-background px-3 py-2" name="description" /></label><button className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" type="submit"><Plus className="size-4" />{labels.createRole}</button></form></details>
      </aside>

      <section className="min-w-0 rounded-2xl border bg-surface p-4 sm:p-6">
        {selectedRole ? <>
          <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold text-foreground">{selectedRole.name}</h2><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{selectedRole.code}</span></div>{selectedRole.description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{selectedRole.description}</p> : null}{!editable ? <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-accent-foreground"><ShieldCheck className="size-4" />{labels.readOnlyRole}</p> : null}</div><div className="min-w-32 text-left sm:text-right"><p className="text-2xl font-semibold text-foreground">{permissionIds.size}</p><p className="text-xs text-muted-foreground">{labels.selectedCount}</p></div></div>
          <SearchField label={labels.permissionSearch} onChange={setPermissionSearch} value={permissionSearch} />
          <div className="mt-5 grid gap-4 2xl:grid-cols-2">{[...groups.entries()].map(([category, items]) => {
            const visibleItems = items.filter((permission) => !normalizedPermissionSearch || `${permission.name} ${permission.code} ${permission.description ?? ''}`.toLocaleLowerCase().includes(normalizedPermissionSearch))
            if (visibleItems.length === 0) return null
            const groupIds = items.map((permission) => permission.id)
            const coverage = permissionCoverage(permissionIds, groupIds)
            return <fieldset className="min-w-0 rounded-2xl border bg-background p-4" key={category}>
              <legend className="sr-only">{category}</legend>
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold text-foreground">{category}</h3><p className="mt-0.5 text-xs text-muted-foreground">{coverage.assigned} / {coverage.total} · {coverage.percentage}%</p></div>{editable ? <button aria-pressed={coverage.percentage === 100} className="shrink-0 rounded-lg border bg-surface px-2.5 py-1.5 text-xs font-semibold text-foreground hover:border-primary/40" onClick={() => setPermissionIds((current) => togglePermissionGroup(current, groupIds))} type="button">{coverage.percentage === 100 ? labels.clearAll : labels.selectAll}</button> : null}</div>
              <div aria-label={`${labels.coverage} ${coverage.percentage}%`} className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={coverage.percentage}><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${coverage.percentage}%` }} /></div>
              <div className="mt-4 space-y-2">{visibleItems.map((permission) => <label className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${permissionIds.has(permission.id) ? 'border-primary/30 bg-accent' : 'bg-surface'} ${editable ? 'cursor-pointer' : 'cursor-default'}`} key={permission.id}><input checked={permissionIds.has(permission.id)} className="mt-1 size-4 accent-primary" disabled={!editable} onChange={(event) => setPermissionIds((current) => { const next = new Set(current); if (event.target.checked) next.add(permission.id); else next.delete(permission.id); return next })} type="checkbox" /><span className="min-w-0"><span className="block font-medium text-foreground">{permission.name}</span>{permission.description ? <span className="mt-0.5 block leading-5 text-muted-foreground">{permission.description}</span> : null}<span className="mt-1 block truncate font-mono text-[0.7rem] text-muted-foreground"><span className="sr-only">{labels.permissionCode}: </span>{permission.code}</span></span></label>)}</div>
            </fieldset>
          })}</div>
          {editable ? <div className="sticky bottom-4 mt-6 flex flex-col gap-3 rounded-2xl border bg-surface/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between"><p aria-live="polite" className="text-sm font-medium text-foreground">{dirty ? `${changedCount} ${labels.unsavedChanges}` : labels.saved}</p><div className="flex gap-2"><button className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-40 sm:flex-none" disabled={!dirty} onClick={() => setPermissionIds(new Set(savedPermissionIds))} type="button"><RotateCcw className="size-4" />{labels.resetChanges}</button><button className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40 sm:flex-none" disabled={!dirty} onClick={savePermissions} type="button"><Save className="size-4" />{labels.savePermissions}</button></div></div> : null}
        </> : <p className="text-sm text-muted-foreground">{labels.selectRole}</p>}
      </section>
    </div> : null}

    {activeTab === 'overview' ? <AuthorizationHeatmap labels={labels} onSelectRole={(roleId) => { selectRole(roleId); setTab('permissions') }} permissions={permissions} rolePermissions={rolePermissions} roles={roles} /> : null}

    {activeTab === 'assignments' ? <section className="space-y-5"><header className="rounded-2xl border bg-surface p-5"><h2 className="text-xl font-semibold text-foreground">{labels.assignmentTitle}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{labels.assignmentSubtitle}</p></header><div className="grid gap-6 lg:grid-cols-2"><OrganizationForm action={addPlacement} button={labels.addPlacement} departments={departments} employees={employees} labels={labels} title={labels.placements} /><OrganizationForm action={addManagement} button={labels.addManagement} departments={departments} employees={employees} labels={labels} roles={roles.filter((role) => role.is_active)} title={labels.managementAssignments} /></div></section> : null}
  </div>
}

function SummaryCards({ labels, overview }: { labels: AuthorizationLabels; overview: ReturnType<typeof buildAuthorizationOverview> }) {
  const cards = [
    { label: labels.totalRoles, value: overview.roleCount, icon: ShieldCheck },
    { label: labels.activeTenantRoles, value: overview.activeTenantRoleCount, icon: UsersRound },
    { label: labels.assignedPermissions, value: overview.assignedPermissionCount, icon: KeyRound },
    { label: labels.coveredCategories, value: overview.categoryCount, icon: Layers3 },
  ]
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, icon: Icon }) => <article className="relative overflow-hidden rounded-2xl border bg-surface p-4" key={label}><div className="absolute -right-4 -top-4 size-20 rounded-full bg-accent" /><div className="relative flex items-center justify-between gap-4"><div><p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p><p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p></div><span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground"><Icon className="size-5" /></span></div></article>)}</div>
}

function AuthorizationHeatmap({ labels, onSelectRole, permissions, rolePermissions, roles }: { labels: AuthorizationLabels; onSelectRole: (roleId: string) => void; permissions: Permission[]; rolePermissions: RolePermission[]; roles: Role[] }) {
  const groups = [...Map.groupBy(permissions, (permission) => permission.category).entries()]
  return <section className="rounded-2xl border bg-surface p-4 sm:p-6"><header className="border-b pb-5"><h2 className="text-xl font-semibold text-foreground">{labels.overviewTitle}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{labels.overviewSubtitle}</p></header><div className="mt-5 rounded-xl border bg-accent p-4"><p className="font-semibold text-accent-foreground">{labels.scopeNoticeTitle}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.scopeNotice}</p></div>
    <div className="mt-6 hidden overflow-x-auto rounded-xl border lg:block"><table className="w-full min-w-max border-collapse text-sm"><thead><tr className="bg-muted/60"><th className="sticky left-0 z-10 min-w-48 border-b border-r bg-muted px-4 py-3 text-left font-semibold text-foreground">{labels.coverage}</th>{roles.map((role) => <th className="min-w-36 border-b px-3 py-3 text-left font-semibold text-foreground" key={role.id}><span className="block">{role.name}</span><span className="mt-0.5 block text-[0.68rem] font-normal text-muted-foreground">{role.code}</span></th>)}</tr></thead><tbody>{groups.map(([category, items]) => <tr key={category}><th className="sticky left-0 z-10 border-r border-t bg-surface px-4 py-3 text-left font-medium text-foreground">{category}</th>{roles.map((role) => { const coverage = permissionCoverage(rolePermissionSet(role.id, rolePermissions), items.map((item) => item.id)); return <td className="border-t p-2" key={role.id}><button aria-label={`${role.name}, ${category}: ${coverage.assigned} / ${coverage.total}, ${coverage.percentage}%`} className={`w-full rounded-lg px-3 py-3 text-left transition hover:ring-2 hover:ring-primary/30 ${coverageTone(coverage.percentage)}`} onClick={() => onSelectRole(role.id)} type="button"><span className="block font-semibold">{coverage.assigned} / {coverage.total}</span><span className="mt-0.5 block text-xs opacity-80">{coverage.percentage}%</span></button></td>})}</tr>)}</tbody></table></div>
    <div className="mt-6 space-y-4 lg:hidden">{roles.map((role) => <article className="rounded-2xl border bg-background p-4" key={role.id}><button className="w-full text-left" onClick={() => onSelectRole(role.id)} type="button"><span className="font-semibold text-foreground">{role.name}</span><span className="ml-2 text-xs text-muted-foreground">{role.code}</span></button><div className="mt-4 space-y-3">{groups.map(([category, items]) => { const coverage = permissionCoverage(rolePermissionSet(role.id, rolePermissions), items.map((item) => item.id)); return <button className="block w-full text-left" key={category} onClick={() => onSelectRole(role.id)} type="button"><span className="flex items-center justify-between gap-3 text-xs"><span className="font-medium text-foreground">{category}</span><span className="text-muted-foreground">{coverage.assigned}/{coverage.total} · {coverage.percentage}%</span></span><span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${coverage.percentage}%` }} /></span></button> })}</div></article>)}</div>
  </section>
}

function TabButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button aria-pressed={active} className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`} onClick={onClick} type="button">{icon}{label}</button>
}

function SearchField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return <label className="relative mt-4 block"><span className="sr-only">{label}</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input className="w-full rounded-xl border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15" onChange={(event) => onChange(event.target.value)} placeholder={label} type="search" value={value} /></label>
}

function FormInput({ label, name, pattern, required }: { label: string; name: string; pattern?: string; required?: boolean }) {
  return <label className="block text-sm text-foreground">{label}<input className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2" name={name} pattern={pattern} required={required} /></label>
}

function OrganizationForm({ action, button, departments, employees, labels, roles, title }: { action: (data: FormData) => Promise<void>; button: string; departments: Option[]; employees: Option[]; labels: AuthorizationLabels; roles?: Role[]; title: string }) {
  const today = new Date().toISOString().slice(0, 10)
  return <form action={action} className="space-y-4 rounded-2xl border bg-surface p-5"><div><h3 className="font-semibold text-foreground">{title}</h3><div className="mt-2 h-1 w-12 rounded-full bg-primary" /></div><label className="block text-sm text-foreground">{labels.employee}<select className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2" name="employeeId" required>{employees.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><label className="block text-sm text-foreground">{labels.department}<select className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2" name="departmentId" required>{departments.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>{roles ? <label className="block text-sm text-foreground">{labels.role}<select className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2" name="roleId" required>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label> : <FormInput label={labels.jobTitle} name="jobTitle" />}<label className="block text-sm text-foreground">{labels.effectiveFrom}<input className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2" defaultValue={today} name="effectiveFrom" required type="date" /></label><button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground" type="submit"><Plus className="size-4" />{button}</button></form>
}
