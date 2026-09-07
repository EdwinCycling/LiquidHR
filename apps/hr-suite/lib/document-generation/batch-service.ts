import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { requireHrGroupId, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { createGenerationPreview, DocumentGenerationError, finalizeGeneration, listGenerationOptions } from './service'

const postgresUuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

const batchInputSchema = z.object({
  templateVersionId: z.string().uuid(),
  employeeIds: z.array(postgresUuid).min(1).max(200),
  idempotencyKey: z.string().uuid().optional(),
  freeInputs: z.record(z.string(), z.string()).default({}),
  temporalInputs: z.record(z.string(), z.string()).default({}),
}).strict()

type QueryClient = Awaited<ReturnType<typeof createClient>>

interface LooseResult { readonly data: unknown; readonly error: unknown }

interface LooseQuery extends PromiseLike<LooseResult> {
  select(columns?: string): LooseQuery
  eq(column: string, value: unknown): LooseQuery
  in(column: string, values: readonly string[]): LooseQuery
  order(column: string, options?: { ascending?: boolean }): LooseQuery
  limit(count: number): LooseQuery
  maybeSingle(): Promise<LooseResult>
  update(values: unknown): LooseQuery
}

interface AuthorizedBatchRequest {
  readonly client: QueryClient
  readonly tenantId: string
  readonly hrGroupId: string
  readonly userId: string
}

interface BatchItemRow {
  readonly id: string
  readonly employee_id: string
  readonly snapshot_id: string | null
  readonly status: 'PENDING' | 'FINAL' | 'FAILED'
  readonly error_code: string | null
}

function table(client: QueryClient, name: string): LooseQuery {
  return (client.from as unknown as (relation: string) => LooseQuery)(name)
}

function adminClient(): QueryClient {
  return createAdminClient() as unknown as QueryClient
}

async function authz(permission: 'document-distribution:read' | 'document-distribution:write'): Promise<AuthorizedBatchRequest> {
  const auth: AuthContext = await requirePermission(permission)
  return {
    client: await createClient(),
    tenantId: auth.tenantId,
    hrGroupId: requireHrGroupId(auth),
    userId: auth.userId,
  }
}

function requestHash(input: z.infer<typeof batchInputSchema>): string {
  const stable = (values: Record<string, string>) => Object.fromEntries(Object.keys(values).sort().map((key) => [key, values[key] ?? '']))
  return createHash('sha256').update(JSON.stringify({
    templateVersionId: input.templateVersionId,
    employeeIds: [...new Set(input.employeeIds)].sort(),
    freeInputs: stable(input.freeInputs),
    temporalInputs: stable(input.temporalInputs),
  })).digest('hex')
}

function deterministicUuid(seed: string): string {
  const hex = createHash('sha256').update(seed).digest('hex').slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`
}

function errorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') return error.code
  if (error instanceof Error && /^[A-Z][A-Z0-9_]+$/.test(error.message)) return error.message
  return 'DOCUMENT_DISTRIBUTION_ITEM_FAILED'
}

async function rpc(client: QueryClient, name: string, parameters: Record<string, unknown>): Promise<Record<string, unknown>> {
  const call = client.rpc.bind(client) as unknown as (functionName: string, args: Record<string, unknown>) => Promise<LooseResult>
  const result = await call(name, parameters)
  if (result.error) {
    const message = result.error && typeof result.error === 'object' && 'message' in result.error ? String(result.error.message) : ''
    const match = message.match(/\b(?:DOCUMENT|DISTRIBUTION|HR_GROUP|EMPLOYEE|STORAGE)_[A-Z0-9_]+\b/)
    const code = match?.[0] ?? 'DOCUMENT_DISTRIBUTION_MUTATION_FAILED'
    const status = code.includes('FORBIDDEN') ? 403 : code.includes('INVALID') ? 422 : code.includes('NOT_FOUND') ? 404 : 409
    throw new DocumentGenerationError(code, status)
  }
  if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)) throw new Error('DOCUMENT_DISTRIBUTION_RESPONSE_INVALID')
  return result.data as Record<string, unknown>
}

function input(value: unknown): z.infer<typeof batchInputSchema> {
  const parsed = batchInputSchema.safeParse(value)
  if (!parsed.success || new Set(parsed.data.employeeIds).size !== parsed.data.employeeIds.length) throw new Error('DOCUMENT_DISTRIBUTION_INPUT_INVALID')
  return parsed.data
}

async function updateItem(client: QueryClient, itemId: string, values: Record<string, unknown>): Promise<void> {
  const result = await table(client, 'document_generation_batch_items').update(values).eq('id', itemId)
  if (result.error) throw new Error('DOCUMENT_DISTRIBUTION_ITEM_UPDATE_FAILED')
}

async function runBatch(batchId: string, parsed: z.infer<typeof batchInputSchema>, request: AuthorizedBatchRequest): Promise<'COMPLETED' | 'PARTIAL' | 'FAILED'> {
  const admin = adminClient()
  const itemResult = await table(admin, 'document_generation_batch_items')
    .select('id,employee_id,snapshot_id,status,error_code')
    .eq('tenant_id', request.tenantId)
    .eq('hr_group_id', request.hrGroupId)
    .eq('batch_id', batchId)
    .order('created_at', { ascending: true })
    .limit(200)
  if (itemResult.error || !Array.isArray(itemResult.data)) throw new Error('DOCUMENT_DISTRIBUTION_READ_FAILED')
  const items = itemResult.data as BatchItemRow[]

  for (const item of items) {
    if (item.status === 'FINAL') continue
    try {
      const previewKey = deterministicUuid(`${batchId}:preview:${item.employee_id}`)
      const finalKey = deterministicUuid(`${batchId}:final:${item.employee_id}`)
      let snapshotId = item.snapshot_id
      if (!snapshotId) {
        const preview = await createGenerationPreview({
          templateVersionId: parsed.templateVersionId,
          employeeId: item.employee_id,
          idempotencyKey: previewKey,
          freeInputs: parsed.freeInputs,
          temporalInputs: parsed.temporalInputs,
        })
        snapshotId = preview.id
      }
      await finalizeGeneration(snapshotId, finalKey)
      await updateItem(admin, item.id, { snapshot_id: snapshotId, status: 'FINAL', error_code: null, completed_at: new Date().toISOString() })
    } catch (error) {
      await updateItem(admin, item.id, { status: 'FAILED', error_code: errorCode(error), completed_at: new Date().toISOString() })
    }
  }

  const finalResult = await table(admin, 'document_generation_batch_items')
    .select('status')
    .eq('tenant_id', request.tenantId)
    .eq('hr_group_id', request.hrGroupId)
    .eq('batch_id', batchId)
    .limit(200)
  if (finalResult.error || !Array.isArray(finalResult.data)) throw new Error('DOCUMENT_DISTRIBUTION_READ_FAILED')
  const finalItems = finalResult.data as Array<{ readonly status: BatchItemRow['status'] }>
  const finalCount = finalItems.filter((item) => item.status === 'FINAL').length
  const failedCount = finalItems.filter((item) => item.status === 'FAILED').length
  const status = failedCount === 0 ? 'COMPLETED' : finalCount === 0 ? 'FAILED' : 'PARTIAL'
  const update = await table(admin, 'document_generation_batches').update({ status, final_count: finalCount, failed_count: failedCount, completed_at: new Date().toISOString() })
    .eq('tenant_id', request.tenantId).eq('hr_group_id', request.hrGroupId).eq('id', batchId)
  if (update.error) throw new Error('DOCUMENT_DISTRIBUTION_UPDATE_FAILED')
  const audit = await (admin.from as unknown as (relation: string) => { insert(values: unknown): PromiseLike<LooseResult> })('document_generation_batch_audit').insert({
    tenant_id: request.tenantId,
    hr_group_id: request.hrGroupId,
    batch_id: batchId,
    action: status,
    actor_user_id: request.userId,
    metadata: { finalCount, failedCount },
  })
  if (audit.error) throw new Error('DOCUMENT_DISTRIBUTION_AUDIT_FAILED')
  return status
}

export async function listDistributionOptions() {
  return listGenerationOptions()
}

export async function createDocumentDistribution(value: unknown): Promise<{ readonly id: string; readonly status: string }> {
  const parsed = input(value)
  const request = await authz('document-distribution:write')
  const options = await listGenerationOptions()
  const template = options.templates.find((candidate) => candidate.versionId === parsed.templateVersionId)
  if (!template) throw new Error('DOCUMENT_GENERATION_TEMPLATE_NOT_ACTIVE')
  const idempotencyKey = parsed.idempotencyKey ?? randomUUID()
  const result = await rpc(adminClient(), 'create_document_generation_batch', {
    requested_payload: {
      id: randomUUID(),
      tenant_id: request.tenantId,
      hr_group_id: request.hrGroupId,
      actor_user_id: request.userId,
      template_id: template.id,
      template_version_id: parsed.templateVersionId,
      employee_ids: parsed.employeeIds,
      idempotency_key: idempotencyKey,
      request_hash: requestHash(parsed),
    },
  })
  const batchId = typeof result.id === 'string' ? result.id : null
  if (!batchId) throw new Error('DOCUMENT_DISTRIBUTION_RESPONSE_INVALID')
  const status = await runBatch(batchId, parsed, request)
  return { id: batchId, status }
}

export async function listDistributionHistory(): Promise<readonly Record<string, unknown>[]> {
  const request = await authz('document-distribution:read')
  const batchesResult = await table(request.client, 'document_generation_batches')
    .select('id,template_id,template_version_id,requested_count,final_count,failed_count,status,created_at,completed_at')
    .eq('tenant_id', request.tenantId)
    .eq('hr_group_id', request.hrGroupId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (batchesResult.error || !Array.isArray(batchesResult.data)) throw new Error('DOCUMENT_DISTRIBUTION_READ_FAILED')
  return batchesResult.data as readonly Record<string, unknown>[]
}

export async function listDistributionItems(batchId: string): Promise<readonly Record<string, unknown>[]> {
  const request = await authz('document-distribution:read')
  const items = await table(request.client, 'document_generation_batch_items')
    .select('id,employee_id,snapshot_id,status,error_code,created_at,completed_at')
    .eq('tenant_id', request.tenantId)
    .eq('hr_group_id', request.hrGroupId)
    .eq('batch_id', batchId)
    .order('created_at', { ascending: true })
    .limit(200)
  if (items.error || !Array.isArray(items.data)) throw new Error('DOCUMENT_DISTRIBUTION_READ_FAILED')
  const rows = items.data as Array<Record<string, unknown>>
  const employeeIds = rows.map((item) => typeof item.employee_id === 'string' ? item.employee_id : '').filter(Boolean)
  const employees = employeeIds.length === 0 ? { data: [], error: null } : await table(request.client, 'employees')
    .select('id,first_name,birth_name,employee_number')
    .eq('tenant_id', request.tenantId)
    .eq('hr_group_id', request.hrGroupId)
    .in('id', employeeIds)
    .limit(200)
  if (employees.error || !Array.isArray(employees.data)) throw new Error('DOCUMENT_DISTRIBUTION_READ_FAILED')
  const names = new Map((employees.data as Array<Record<string, unknown>>).map((employee) => [String(employee.id), {
    name: [employee.first_name, employee.birth_name].filter((part): part is string => typeof part === 'string' && part.length > 0).join(' '),
    number: typeof employee.employee_number === 'string' ? employee.employee_number : null,
  }]))
  return rows.map((item) => ({ ...item, employee_name: names.get(String(item.employee_id))?.name ?? item.employee_id, employee_number: names.get(String(item.employee_id))?.number ?? null }))
}
