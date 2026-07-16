import { Building2, ChevronRight, FolderTree } from 'lucide-react'
import { DepartmentCreateForm } from '@/components/organization/department-create-form'
import { AuthorizationError } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/permissions'
import { loadActiveContext } from '@/lib/context/server-context'
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
  depth = 0,
}: {
  node: DepartmentNode
  translate: Translator
  depth?: number
}) {
  const hasChildren = node.children.length > 0

  return (
    <li className="relative">
      {hasChildren ? (
        <details className="group" open={depth === 0}>
          <summary
            aria-label={translate('expand', { name: node.name })}
            className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted [&::-webkit-details-marker]:hidden"
          >
            <DepartmentIdentity node={node} translate={translate} />
            <ChevronRight aria-hidden="true" className="shrink-0 text-muted-foreground transition-transform group-open:rotate-90" size={18} />
          </summary>
          <ul className="relative ml-[1.85rem] space-y-1 border-l py-1 pl-5">
            {node.children.map((child) => (
              <DepartmentBranch depth={depth + 1} key={child.id} node={child} translate={translate} />
            ))}
          </ul>
        </details>
      ) : (
        <div className="rounded-xl px-3 py-2.5 transition-colors hover:bg-muted">
          <DepartmentIdentity node={node} translate={translate} />
        </div>
      )}
    </li>
  )
}

export default async function DepartmentsPage() {
  const [{ roots, administrationName, count }, translate, organizationTranslate] = await Promise.all([
    loadDepartmentTree(),
    getTranslator('departments'),
    getTranslator('organization'),
  ])
  let canWrite = true
  try { await requirePermission('department:write') }
  catch (error) { if (error instanceof AuthorizationError) canWrite = false; else throw error }
  const flatDepartments = flattenDepartmentTree(roots)

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
      <header className="flex flex-col justify-between gap-5 border-b pb-7 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-foreground">
            {translate('eyebrow')}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
            {translate('title')}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{translate('subtitle')}</p>
        </div>
        {administrationName ? (
          <div className="min-w-0 rounded-xl border bg-surface px-4 py-3 sm:max-w-xs">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {translate('administration')}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-foreground">{administrationName}</p>
          </div>
        ) : null}
      </header>

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
              <DepartmentBranch key={node.id} node={node} translate={translate} />
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
  administrationName: string | null
  count: number
}> {
  const context = await requirePermission('department:read')
  const activeContext = await loadActiveContext(context.userId)
  const supabase = await createClient()
  let query = supabase
    .from('departments')
    .select('id, code, name, parent_id')
    .eq('tenant_id', context.tenantId)
    .eq('is_active', true)

  if (context.administrationId) {
    query = query.eq('administration_id', context.administrationId)
  }

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
    administrationName: activeContext.administration?.name ?? null,
    count: departments.length,
  }
}
