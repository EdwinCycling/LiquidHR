import { requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { ModuleError, requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import type { Database, Json } from '@scope/db'
import type { PayrollCompanyBinding, PayrollConnection, PayrollConnectionStatus, PayrollProvider, PayrollSyncRun, PayrollSyncRunStatus, PayrollSyncMode, PayrollBindingStatus } from '@/lib/payroll/domain/types'

export class PayrollServiceError extends Error {
  constructor(public readonly code: string, public readonly status = 500) {
    super(code)
    this.name = 'PayrollServiceError'
  }
}

type ProviderRow = Database['public']['Tables']['payroll_providers']['Row']
type ConnectionRow = Database['public']['Tables']['payroll_connections']['Row']
type BindingRow = Database['public']['Tables']['payroll_company_bindings']['Row']
type SyncRunRow = Database['public']['Tables']['payroll_sync_runs']['Row']

export type PayrollWorkspaceData = {
  providers: PayrollProvider[]
  connections: PayrollConnection[]
  bindings: PayrollCompanyBinding[]
  syncRuns: PayrollSyncRun[]
  activeConnection: PayrollConnection | null
}

function providerCapabilities(value: Json): PayrollProvider['capabilities'] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is PayrollProvider['capabilities'][number] => typeof item === 'string')
}

function mapProvider(row: ProviderRow): PayrollProvider {
  return { id: row.id, code: row.code, name: row.name, isActive: row.is_active, capabilities: providerCapabilities(row.capabilities) }
}

function mapConnection(row: ConnectionRow): PayrollConnection {
  return { id: row.id, providerId: row.provider_id, status: row.status as PayrollConnectionStatus, connectedAt: row.connected_at, connectedByUserId: row.connected_by_user_id, lastCheckedAt: row.last_checked_at, lastErrorCode: row.last_error_code, disconnectedAt: row.disconnected_at }
}

function mapBinding(row: BindingRow): PayrollCompanyBinding {
  return { id: row.id, connectionId: row.connection_id, administrationId: row.administration_id, externalCompanyId: row.external_company_id, externalCompanyDisplayName: row.external_company_display_name, status: row.status as PayrollBindingStatus, boundAt: row.bound_at, unboundAt: row.unbound_at }
}

function jsonObject(value: Json): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function mapSyncRun(row: SyncRunRow): PayrollSyncRun {
  return { id: row.id, connectionId: row.connection_id, companyBindingId: row.company_binding_id, mode: row.mode as PayrollSyncMode, status: row.status as PayrollSyncRunStatus, startedAt: row.started_at, completedAt: row.completed_at, summary: jsonObject(row.summary), errorCode: row.error_code }
}

async function payrollAuth(): Promise<{ auth: AuthContext; supabase: Awaited<ReturnType<typeof createClient>> }> {
  const auth = await requirePermission('payroll:read')
  await requireTenantModule('PAYROLL')
  return { auth, supabase: await createClient() }
}

export async function getPayrollWorkspaceData(): Promise<PayrollWorkspaceData> {
  const { auth, supabase } = await payrollAuth()
  const hrGroupId = auth.hrGroupId
  if (!hrGroupId) throw new PayrollServiceError('PAYROLL_HR_GROUP_REQUIRED', 403)
  const [providersResult, connectionsResult, bindingsResult, syncRunsResult] = await Promise.all([
    supabase.from('payroll_providers').select('id, code, name, is_active, capabilities, created_at, updated_at').eq('is_active', true).order('name'),
    supabase.from('payroll_connections').select('id, provider_id, status, connected_at, connected_by_user_id, last_checked_at, last_error_code, last_error_at, disconnected_at, tenant_id, hr_group_id, created_at, updated_at').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).order('created_at', { ascending: false }),
    supabase.from('payroll_company_bindings').select('id, connection_id, administration_id, external_company_id, external_company_display_name, status, bound_at, bound_by_user_id, last_seen_at, unbound_at, tenant_id, hr_group_id, created_at, updated_at').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).order('updated_at', { ascending: false }),
    supabase.from('payroll_sync_runs').select('id, connection_id, company_binding_id, mode, status, started_at, completed_at, started_by_user_id, summary, error_code, tenant_id, hr_group_id, created_at, updated_at').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).order('created_at', { ascending: false }).limit(20),
  ])
  if (providersResult.error || connectionsResult.error || bindingsResult.error || syncRunsResult.error) throw new PayrollServiceError('PAYROLL_READ_FAILED')
  const providers = (providersResult.data ?? []).map(mapProvider)
  const connections = (connectionsResult.data ?? []).map(mapConnection)
  const bindings = (bindingsResult.data ?? []).map(mapBinding)
  const syncRuns = (syncRunsResult.data ?? []).map(mapSyncRun)
  return { providers, connections, bindings, syncRuns, activeConnection: connections.find((connection) => connection.status !== 'DISCONNECTED') ?? null }
}

export function payrollErrorResponse(error: unknown): Response {
  if (error instanceof ModuleError) return Response.json({ error: error.code }, { status: error.status })
  if (error instanceof PayrollServiceError) return Response.json({ error: error.code }, { status: error.status })
  return Response.json({ error: 'PAYROLL_OPERATION_FAILED' }, { status: 500 })
}
