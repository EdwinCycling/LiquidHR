import 'server-only'

import { requireHrGroupId, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { DocumentGenerationError } from './errors'

type QueryClient = Awaited<ReturnType<typeof createClient>>

interface LooseResult {
  readonly data: unknown
  readonly error: unknown
}

interface LooseQuery extends PromiseLike<LooseResult> {
  select(columns?: string): LooseQuery
  eq(column: string, value: unknown): LooseQuery
  is(column: string, value: unknown): LooseQuery
  in(column: string, values: readonly string[]): LooseQuery
  order(column: string, options?: { ascending?: boolean }): LooseQuery
  limit(count: number): LooseQuery
  maybeSingle(): Promise<LooseResult>
}

function table(client: QueryClient, name: string): LooseQuery {
  return (client.from as unknown as (relation: string) => LooseQuery)(name)
}

async function row<T>(query: PromiseLike<LooseResult>): Promise<T> {
  const result = await query
  if (result.error || result.data === null) throw new DocumentGenerationError('DOCUMENT_GENERATION_READ_FAILED', 500)
  return result.data as T
}

async function optionalRow<T>(query: PromiseLike<LooseResult>): Promise<T | null> {
  const result = await query
  if (result.error) throw new DocumentGenerationError('DOCUMENT_GENERATION_READ_FAILED', 500)
  return result.data as T | null
}

export async function listDistributionOptions(): Promise<{ templates: readonly { id: string; name: string; versionId: string; version: number }[]; employees: readonly { id: string; name: string; employeeNumber: string | null }[] }> {
  const auth: AuthContext = await requirePermission('document-generation:write')
  const tenantId = auth.tenantId
  const hrGroupId = requireHrGroupId(auth)
  const client = await createClient()
  const templates = await row<Record<string, unknown>[]>(table(client, 'document_studio_templates')
    .select('id,name,current_active_version_id')
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('kind', 'DOCUMENT')
    .eq('lifecycle', 'ACTIVE')
    .order('name')
    .limit(200))
  const active = (await Promise.all(templates.flatMap(async (template) => {
    if (typeof template.current_active_version_id !== 'string') return []
    const version = await optionalRow<Record<string, unknown>>(table(client, 'document_studio_template_versions')
      .select('id,version_number,status')
      .eq('tenant_id', tenantId)
      .eq('hr_group_id', hrGroupId)
      .eq('id', template.current_active_version_id)
      .eq('status', 'ACTIVE')
      .maybeSingle())
    if (!version || typeof version.version_number !== 'number') return []
    return [{ id: String(template.id), name: String(template.name), versionId: String(version.id), version: version.version_number }]
  }))).flat()
  const employees = await row<Record<string, unknown>[]>(table(client, 'employees')
    .select('id,first_name,birth_name,employee_number')
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .is('deleted_at', null)
    .eq('is_archived', false)
    .order('birth_name')
    .limit(2000))
  return {
    templates: active,
    employees: employees.map((employee) => ({
      id: String(employee.id),
      name: [employee.first_name, employee.birth_name].filter((part): part is string => typeof part === 'string' && part.length > 0).join(' '),
      employeeNumber: typeof employee.employee_number === 'string' ? employee.employee_number : null,
    })),
  }
}

export async function listDistributionHistory(): Promise<readonly Record<string, unknown>[]> {
  const auth: AuthContext = await requirePermission('document-distribution:read')
  const tenantId = auth.tenantId
  const hrGroupId = requireHrGroupId(auth)
  const client = await createClient()
  const batches = await table(client, 'document_generation_batches')
    .select('id,template_id,template_version_id,requested_count,final_count,failed_count,status,created_at,completed_at')
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (batches.error || !Array.isArray(batches.data)) throw new Error('DOCUMENT_DISTRIBUTION_READ_FAILED')
  return batches.data as readonly Record<string, unknown>[]
}

export async function listDistributionItems(batchId: string): Promise<readonly Record<string, unknown>[]> {
  const auth: AuthContext = await requirePermission('document-distribution:read')
  const tenantId = auth.tenantId
  const hrGroupId = requireHrGroupId(auth)
  const client = await createClient()
  const items = await table(client, 'document_generation_batch_items')
    .select('id,employee_id,snapshot_id,status,error_code,created_at,completed_at')
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('batch_id', batchId)
    .order('created_at', { ascending: true })
    .limit(200)
  if (items.error || !Array.isArray(items.data)) throw new Error('DOCUMENT_DISTRIBUTION_READ_FAILED')
  const rows = items.data as Array<Record<string, unknown>>
  const employeeIds = rows.map((item) => typeof item.employee_id === 'string' ? item.employee_id : '').filter(Boolean)
  const employees = employeeIds.length === 0 ? { data: [], error: null } : await table(client, 'employees')
    .select('id,first_name,birth_name,employee_number')
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .in('id', employeeIds)
    .limit(200)
  if (employees.error || !Array.isArray(employees.data)) throw new Error('DOCUMENT_DISTRIBUTION_READ_FAILED')
  const names = new Map((employees.data as Array<Record<string, unknown>>).map((employee) => [String(employee.id), {
    name: [employee.first_name, employee.birth_name].filter((part): part is string => typeof part === 'string' && part.length > 0).join(' '),
    number: typeof employee.employee_number === 'string' ? employee.employee_number : null,
  }]))
  return rows.map((item) => ({
    ...item,
    employee_name: names.get(String(item.employee_id))?.name ?? item.employee_id,
    employee_number: names.get(String(item.employee_id))?.number ?? null,
  }))
}
