'use client'

import type { Database } from '@scope/db'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

type Role = Database['public']['Tables']['management_roles']['Row']
type Permission = Database['public']['Tables']['permissions']['Row']
type RolePermission = Database['public']['Tables']['role_permissions']['Row']
interface Option { id: string; name: string }
interface Labels { roles: string; newRole: string; roleCode: string; roleName: string; roleDescription: string; createRole: string; systemRole: string; tenantRole: string; permissions: string; selectRole: string; savePermissions: string; placements: string; managementAssignments: string; employee: string; department: string; role: string; jobTitle: string; effectiveFrom: string; addPlacement: string; addManagement: string; saved: string; failed: string; empty: string }

export function AuthorizationManager({ roles, permissions, rolePermissions, employees, departments, labels }: { roles: Role[]; permissions: Permission[]; rolePermissions: RolePermission[]; employees: Option[]; departments: Option[]; labels: Labels }) {
  const router = useRouter()
  const tenantRoles = roles.filter((role) => role.tenant_id && !role.is_system)
  const [selectedRoleId, setSelectedRoleId] = useState(tenantRoles[0]?.id ?? '')
  const initial = useMemo(() => new Set(rolePermissions.filter((item) => item.management_role_id === selectedRoleId).map((item) => item.permission_id)), [rolePermissions, selectedRoleId])
  const [permissionIds, setPermissionIds] = useState<Set<string>>(initial)
  const [message, setMessage] = useState<string | null>(null)
  const groups = Map.groupBy(permissions, (permission) => permission.category)

  function selectRole(roleId: string): void { setSelectedRoleId(roleId); setPermissionIds(new Set(rolePermissions.filter((item) => item.management_role_id === roleId).map((item) => item.permission_id))) }
  async function send(url: string, method: string, body: object): Promise<void> { setMessage(null); try { const response = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); if (!response.ok) throw new Error('FAILED'); setMessage(labels.saved); router.refresh() } catch { setMessage(labels.failed) } }
  async function createRoleAction(formData: FormData): Promise<void> { await send('/api/roles', 'POST', { code: String(formData.get('code') ?? '').toUpperCase(), name: formData.get('name'), description: formData.get('description') || null }) }
  async function savePermissions(): Promise<void> { if (selectedRoleId) await send(`/api/roles/${selectedRoleId}/permissions`, 'PUT', { permissionIds: [...permissionIds] }) }
  async function addPlacement(formData: FormData): Promise<void> { await send('/api/organization/placements', 'POST', { employeeId: formData.get('employeeId'), departmentId: formData.get('departmentId'), jobTitle: formData.get('jobTitle') || null, effectiveFrom: formData.get('effectiveFrom') }) }
  async function addManagement(formData: FormData): Promise<void> { await send('/api/organization/management-assignments', 'POST', { employeeId: formData.get('employeeId'), departmentId: formData.get('departmentId'), managementRoleId: formData.get('roleId'), effectiveFrom: formData.get('effectiveFrom') }) }

  return <div className="space-y-6">
    {message ? <p aria-live="polite" className="rounded-xl border bg-surface px-4 py-3 text-sm text-muted-foreground">{message}</p> : null}
    <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <section className="rounded-2xl border bg-surface p-5"><h2 className="font-semibold text-foreground">{labels.roles}</h2><div className="mt-4 space-y-2">{roles.map((role) => <button className={`w-full rounded-xl border px-3 py-3 text-left ${selectedRoleId === role.id ? 'bg-accent text-accent-foreground' : 'bg-background text-foreground'}`} disabled={role.tenant_id === null || role.is_system} key={role.id} onClick={() => selectRole(role.id)} type="button"><span className="block font-medium">{role.name}</span><span className="text-xs text-muted-foreground">{role.code} · {role.is_system ? labels.systemRole : labels.tenantRole}</span></button>)}</div><form action={createRoleAction} className="mt-6 space-y-3 border-t pt-5"><h3 className="text-sm font-semibold text-foreground">{labels.newRole}</h3><label className="block text-sm">{labels.roleCode}<input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" name="code" pattern="[A-Z][A-Z0-9_]+" required /></label><label className="block text-sm">{labels.roleName}<input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" name="name" required /></label><label className="block text-sm">{labels.roleDescription}<textarea className="mt-1 w-full rounded-lg border bg-background px-3 py-2" name="description" /></label><button className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" type="submit">{labels.createRole}</button></form></section>
      <section className="rounded-2xl border bg-surface p-5"><h2 className="font-semibold text-foreground">{labels.permissions}</h2>{selectedRoleId ? <><div className="mt-4 grid gap-5 lg:grid-cols-2">{[...groups.entries()].map(([category, items]) => <fieldset className="rounded-xl border p-4" key={category}><legend className="px-1 text-sm font-semibold">{category}</legend><div className="mt-2 space-y-2">{items.map((permission) => <label className="flex items-start gap-2 text-sm" key={permission.id}><input checked={permissionIds.has(permission.id)} className="mt-1" onChange={(event) => setPermissionIds((current) => { const next = new Set(current); if (event.target.checked) next.add(permission.id); else next.delete(permission.id); return next })} type="checkbox" /><span><span className="block font-medium">{permission.name}</span><code className="text-xs text-muted-foreground">{permission.code}</code></span></label>)}</div></fieldset>)}</div><button className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" onClick={savePermissions} type="button">{labels.savePermissions}</button></> : <p className="mt-4 text-sm text-muted-foreground">{labels.selectRole}</p>}</section>
    </div>
    <div className="grid gap-6 lg:grid-cols-2">
      <OrganizationForm action={addPlacement} button={labels.addPlacement} departments={departments} employees={employees} labels={labels} title={labels.placements} />
      <OrganizationForm action={addManagement} button={labels.addManagement} departments={departments} employees={employees} labels={labels} roles={roles.filter((role) => role.is_active)} title={labels.managementAssignments} />
    </div>
  </div>
}

function OrganizationForm({ action, button, departments, employees, labels, roles, title }: { action: (data: FormData) => Promise<void>; button: string; departments: Option[]; employees: Option[]; labels: Labels; roles?: Role[]; title: string }) {
  const today = new Date().toISOString().slice(0, 10)
  return <form action={action} className="space-y-3 rounded-2xl border bg-surface p-5"><h2 className="font-semibold text-foreground">{title}</h2><label className="block text-sm">{labels.employee}<select className="mt-1 w-full rounded-lg border bg-background px-3 py-2" name="employeeId" required>{employees.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><label className="block text-sm">{labels.department}<select className="mt-1 w-full rounded-lg border bg-background px-3 py-2" name="departmentId" required>{departments.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>{roles ? <label className="block text-sm">{labels.role}<select className="mt-1 w-full rounded-lg border bg-background px-3 py-2" name="roleId" required>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label> : <label className="block text-sm">{labels.jobTitle}<input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" name="jobTitle" /></label>}<label className="block text-sm">{labels.effectiveFrom}<input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" defaultValue={today} name="effectiveFrom" required type="date" /></label><button className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" type="submit">{button}</button></form>
}
