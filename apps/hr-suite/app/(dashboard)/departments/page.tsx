import Link from 'next/link'
import { Building2, ChevronRight, FolderTree } from 'lucide-react'
import { redirect } from 'next/navigation'
import { DepartmentCreateForm } from '@/components/organization/department-create-form'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { AuthorizationError, getRequestAuthorizationContext, requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import type { Translator } from '@/lib/i18n/translator'
import { createClient } from '@/lib/supabase/server'

interface DepartmentNode {
  id: string
  name: string
  code: string
  children: DepartmentNode[]
}

function DepartmentIdentity({ node, translate }: { node: DepartmentNode; translate: Translator }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg border bg-surface-raised text-accent-foreground">
        <Building2 size={17} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-foreground">{node.name}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{translate('code', { code: node.code })}</span>
      </span>
    </span>
  )
}

function DepartmentBranch({
  node,
  translate,
  canStartProcess,
  startProcessLabel,
  depth = 0,
}: {
  node: DepartmentNode
  translate: Translator
  canStartProcess: boolean
  startProcessLabel: string
  depth?: number
}) {
  const hasChildren = node.children.length > 0

  return (
    <li className="relative">
      {hasChildren ? (
        <details className="group" open>
          <summary
            aria-label={translate('expand', { name: node.name })}
            className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted [&::-webkit-details-marker]:hidden"
          >
            <DepartmentIdentity node={node} translate={translate} />
            <ChevronRight aria-hidden="true" className="shrink-0 text-muted-foreground transition-transform group-open:rotate-90" size={18} />
          </summary>
          <ul className="relative ml-[1.85rem] space-y-1 border-l py-1 pl-5">
              {node.children.map((child) => (
              <DepartmentBranch canStartProcess={canStartProcess} depth={depth + 1} key={child.id} node={child} startProcessLabel={startProcessLabel} translate={translate} />
              ))}
            </ul>
          {canStartProcess ? <Link className="ml-3 inline-flex items-center rounded-lg px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10" href={`/work/new/internal-transfer?departmentId=${node.id}`}>{startProcessLabel}</Link> : null}
          </details>
        ) : (
        <div className="rounded-xl px-3 py-2.5 transition-colors hover:bg-muted">
          <DepartmentIdentity node={node} translate={translate} />
          {canStartProcess ? <Link className="mt-2 ml-12 inline-flex items-center rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10" href={`/work/new/internal-transfer?departmentId=${node.id}`}>{startProcessLabel}</Link> : null}
        </div>
      )}
    </li>
  )
}

export default async function DepartmentsPage() {
  let departmentData: Awaited<ReturnType<typeof loadDepartmentTree>>
  try {
    departmentData = await loadDepartmentTree()
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }
  const [{ roots, count }, translate, organizationTranslate, settingsTranslate] = await Promise.all([
    departmentData,
    getTranslator('departments'),
    getTranslator('organization'),
    getTranslator('settings'),
  ])
  let canWrite = true
  try { await requirePermission('department:write') }
  catch (error) { if (error instanceof AuthorizationError) canWrite = false; else throw error }
  const canStartProcess = (await getRequestAuthorizationContext()).context.permissions.includes('process-instance:start')
  const flatDepartments = flattenDepartmentTree(roots)

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
      <AdminSettingsPageHeader
        backLabel={settingsTranslate('admin.backToOverview')}
        eyebrow={translate('eyebrow')}
        subtitle={translate('subtitle')}
        title={translate('title')}
      />

      {canWrite ? <DepartmentCreateForm departments={flatDepartments.map((department) => ({ id: department.id, name: `${department.code} · ${department.name}` }))} labels={{ title: organizationTranslate('departmentCreate'), code: organizationTranslate('departmentCode'), name: organizationTranslate('departmentName'), parent: organizationTranslate('parentDepartment'), noParent: organizationTranslate('noParent'), create: organizationTranslate('create'), saved: organizationTranslate('saved'), failed: organizationTranslate('failed') }} /> : null}

      <div className="mt-7 overflow-hidden rounded-2xl border bg-surface">
        <div className="flex items-center justify-between gap-4 border-b bg-surface-raised px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-accent text-accent-foreground">
              <FolderTree aria-hidden="true" size={18} />
            </span>
            <h2 className="text-sm font-semibold text-foreground">{translate('structure')}</h2>
          </div>
          <span className="text-xs font-medium text-muted-foreground">{translate('count', { count })}</span>
        </div>

        {roots.length > 0 ? (
          <ul className="space-y-1 p-3 sm:p-5">
            {roots.map((node) => (
              <DepartmentBranch canStartProcess={canStartProcess} key={node.id} node={node} startProcessLabel={translate('processStart')} translate={translate} />
            ))}
          </ul>
        ) : (
          <div className="grid min-h-56 place-items-center p-8 text-center">
            <div>
              <span className="mx-auto grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
                <FolderTree aria-hidden="true" size={22} />
              </span>
              <p className="mt-4 text-sm text-muted-foreground">{translate('empty')}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function flattenDepartmentTree(nodes: DepartmentNode[]): DepartmentNode[] {
  return nodes.flatMap((node) => [node, ...flattenDepartmentTree(node.children)])
}

async function loadDepartmentTree(): Promise<{
  roots: DepartmentNode[]
  count: number
}> {
  const context = await requirePermission('department:read')
  const groupId = requireHrGroupId(context)
  const supabase = await createClient()
  const query = supabase
    .from('departments')
    .select('id, code, name, parent_id')
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', groupId)
    .eq('is_active', true)

  const { data: departments, error } = await query
    .order('name')
    .limit(200)

  if (error) throw error

  const nodes = new Map<string, DepartmentNode>()
  const roots: DepartmentNode[] = []
  departments.forEach((department) => nodes.set(department.id, { ...department, children: [] }))
  departments.forEach((department) => {
    const node = nodes.get(department.id)
    if (!node) return
    const parent = department.parent_id ? nodes.get(department.parent_id) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  })

  return {
    roots,
    count: departments.length,
  }
}
