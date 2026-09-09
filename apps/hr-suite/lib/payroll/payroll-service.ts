import 'server-only'

import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { requireHrGroupId, requirePermission, permissionErrorResponse, type AuthContext } from '@/lib/auth/permissions'
import { ModuleError, requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database, Json } from '@scope/db'
import type {
  PayrollAdministration,
  PayrollBindingStatus,
  PayrollCompanyBinding,
  PayrollConnection,
  PayrollConnectionStatus,
  PayrollProvider as PayrollProviderView,
  PayrollProviderCompany,
  PayrollSyncMode,
  PayrollSyncRun,
  PayrollSyncRunStatus,
} from '@/lib/payroll/domain/types'
import { PAYROLL_PROVIDER_CAPABILITIES, PAYROLL_PROVIDER_CODE } from '@/lib/payroll/domain/types'
import { getPayrollProvider } from '@/lib/payroll/providers/nmbrs/provider'
import { createNmbrsClient, isNmbrsUnauthorized, NMBRS_P1_SCOPES } from '@/lib/payroll/providers/nmbrs/client'
import { PayrollProviderError, type PayrollProvider as PayrollProviderAdapter } from '@/lib/payroll/providers/payroll-provider'
import {
  assertPayrollCredentialEncryptionConfigured,
  decryptPayrollCredential,
  encryptPayrollCredential,
  PayrollCredentialError,
} from '@/lib/payroll/server/credential-encryption'
import { createPayrollPrivateClient, privateRow, type PayrollCredentialRow, type PayrollOAuthStateRow } from '@/lib/payroll/server/private-client'

export const PAYROLL_OAUTH_STATE_COOKIE = 'liquid-hr-payroll-oauth-state'
export const PAYROLL_OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60

const UUID_SCHEMA = z.string().uuid()
const CONNECTION_SELECT = 'id, provider_id, status, connected_at, connected_by_user_id, last_checked_at, last_error_code, last_error_at, disconnected_at, tenant_id, hr_group_id, created_at, updated_at'
const BINDING_SELECT = 'id, connection_id, administration_id, external_company_id, external_company_display_name, status, bound_at, bound_by_user_id, last_seen_at, unbound_at, tenant_id, hr_group_id, created_at, updated_at'
const COMPANY_SELECT = 'id, connection_id, external_company_id, external_company_number, external_company_display_name, external_debtor_id, status, first_seen_at, last_seen_at, provider_metadata, tenant_id, hr_group_id, created_at, updated_at'

type ProviderRow = Database['public']['Tables']['payroll_providers']['Row']
type ConnectionRow = Database['public']['Tables']['payroll_connections']['Row']
type BindingRow = Database['public']['Tables']['payroll_company_bindings']['Row']
type CompanyRow = Database['public']['Tables']['payroll_provider_companies']['Row']
type SyncRunRow = Database['public']['Tables']['payroll_sync_runs']['Row']

export class PayrollServiceError extends Error {
  constructor(public readonly code: string, public readonly status = 500) {
    super(code)
    this.name = 'PayrollServiceError'
  }
}

export type PayrollWorkspaceData = {
  providers: PayrollProviderView[]
  connections: PayrollConnection[]
  providerCompanies: PayrollProviderCompany[]
  bindings: PayrollCompanyBinding[]
  administrations: PayrollAdministration[]
  syncRuns: PayrollSyncRun[]
  activeConnection: PayrollConnection | null
}

export type PayrollAuthorizationResult = {
  authorizationUrl: string
  connectionId: string
  state: string
  expiresAt: string
}

export type PayrollDisconnectResult = {
  connection: PayrollConnection
  remoteRevocation: 'SUCCEEDED' | 'FAILED' | 'NO_CREDENTIALS'
}

function isProviderCapability(value: string): value is (typeof PAYROLL_PROVIDER_CAPABILITIES)[number] {
  return (PAYROLL_PROVIDER_CAPABILITIES as readonly string[]).includes(value)
}

function providerCapabilities(value: Json): PayrollProviderView['capabilities'] {
  if (Array.isArray(value)) return value.filter((item): item is PayrollProviderView['capabilities'][number] => typeof item === 'string' && isProviderCapability(item))
  if (typeof value !== 'object' || value === null) return []
  const capabilities: Array<PayrollProviderView['capabilities'][number]> = []
  for (const [key, enabled] of Object.entries(value)) {
    if (enabled === true && isProviderCapability(key)) capabilities.push(key)
  }
  return capabilities
}

function mapProvider(row: ProviderRow): PayrollProviderView {
  return { id: row.id, code: row.code, name: row.name, isActive: row.is_active, capabilities: providerCapabilities(row.capabilities) }
}

function mapConnection(row: ConnectionRow): PayrollConnection {
  return {
    id: row.id,
    providerId: row.provider_id,
    status: row.status as PayrollConnectionStatus,
    connectedAt: row.connected_at,
    connectedByUserId: row.connected_by_user_id,
    lastCheckedAt: row.last_checked_at,
    lastErrorCode: row.last_error_code,
    disconnectedAt: row.disconnected_at,
  }
}

function mapCompany(row: CompanyRow): PayrollProviderCompany {
  return {
    id: row.id,
    connectionId: row.connection_id,
    externalCompanyId: row.external_company_id,
    externalCompanyNumber: row.external_company_number,
    externalCompanyDisplayName: row.external_company_display_name,
    externalDebtorId: row.external_debtor_id,
    status: row.status,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  }
}

function mapBinding(row: BindingRow): PayrollCompanyBinding {
  return {
    id: row.id,
    connectionId: row.connection_id,
    administrationId: row.administration_id,
    externalCompanyId: row.external_company_id,
    externalCompanyDisplayName: row.external_company_display_name,
    status: row.status as PayrollBindingStatus,
    boundAt: row.bound_at,
    unboundAt: row.unbound_at,
  }
}

function jsonObject(value: Json): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function mapSyncRun(row: SyncRunRow): PayrollSyncRun {
  return {
    id: row.id,
    connectionId: row.connection_id,
    companyBindingId: row.company_binding_id,
    mode: row.mode as PayrollSyncMode,
    status: row.status as PayrollSyncRunStatus,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    summary: jsonObject(row.summary),
    errorCode: row.error_code,
  }
}

async function payrollAuth(permission: 'payroll:read' | 'payroll:manage'): Promise<{ auth: AuthContext; hrGroupId: string; supabase: Awaited<ReturnType<typeof createClient>> }> {
  const auth = await requirePermission(permission)
  await requireTenantModule('PAYROLL')
  return { auth, hrGroupId: requireHrGroupId(auth), supabase: await createClient() }
}

export async function getPayrollWorkspaceData(): Promise<PayrollWorkspaceData> {
  const { auth, hrGroupId, supabase } = await payrollAuth('payroll:read')
  const [providersResult, connectionsResult, companiesResult, bindingsResult, administrationsResult, syncRunsResult] = await Promise.all([
    supabase.from('payroll_providers').select('id, code, name, is_active, capabilities, created_at, updated_at').eq('is_active', true).order('name'),
    supabase.from('payroll_connections').select(CONNECTION_SELECT).eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).order('created_at', { ascending: false }),
    supabase.from('payroll_provider_companies').select(COMPANY_SELECT).eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).order('last_seen_at', { ascending: false }),
    supabase.from('payroll_company_bindings').select(BINDING_SELECT).eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).order('updated_at', { ascending: false }),
    supabase.from('administrations').select('id, code, name').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).order('name').limit(500),
    supabase.from('payroll_sync_runs').select('id, connection_id, company_binding_id, mode, status, started_at, completed_at, started_by_user_id, summary, error_code, tenant_id, hr_group_id, created_at, updated_at').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).order('created_at', { ascending: false }).limit(20),
  ])
  if (providersResult.error || connectionsResult.error || companiesResult.error || bindingsResult.error || administrationsResult.error || syncRunsResult.error) throw new PayrollServiceError('PAYROLL_READ_FAILED')
  const providers = (providersResult.data ?? []).map(mapProvider)
  const connections = (connectionsResult.data ?? []).map(mapConnection)
  const providerCompanies = (companiesResult.data ?? []).map(mapCompany)
  const bindings = (bindingsResult.data ?? []).map(mapBinding)
  const administrations = (administrationsResult.data ?? []).map((administration) => ({ id: administration.id, code: administration.code, name: administration.name }))
  const syncRuns = (syncRunsResult.data ?? []).map(mapSyncRun)
  return { providers, connections, providerCompanies, bindings, administrations, syncRuns, activeConnection: connections.find((connection) => connection.status !== 'DISCONNECTED') ?? null }
}

function parseUuid(value: unknown, code: string): string {
  const parsed = UUID_SCHEMA.safeParse(value)
  if (!parsed.success) throw new PayrollServiceError(code, 400)
  return parsed.data
}

function parseText(value: unknown, code: string, maxLength: number): string {
  if (typeof value !== 'string') throw new PayrollServiceError(code, 400)
  const parsed = value.trim()
  if (parsed.length === 0 || parsed.length > maxLength) throw new PayrollServiceError(code, 400)
  return parsed
}

function safeErrorCode(error: unknown, fallback = 'PAYROLL_OPERATION_FAILED'): string {
  if (error instanceof PayrollServiceError || error instanceof PayrollProviderError || error instanceof PayrollCredentialError) return error.code.slice(0, 120)
  return fallback
}

function normalizeOperationError(error: unknown, fallback: string, status = 502): PayrollServiceError | PayrollProviderError | PayrollCredentialError {
  if (error instanceof PayrollServiceError || error instanceof PayrollProviderError || error instanceof PayrollCredentialError) return error
  return new PayrollServiceError(fallback, status)
}

async function activeNmbrsProvider(admin: ReturnType<typeof createAdminClient>): Promise<{ row: ProviderRow; provider: PayrollProviderAdapter }> {
  const { data, error } = await admin.from('payroll_providers').select('id, code, name, is_active, capabilities, created_at, updated_at').eq('code', PAYROLL_PROVIDER_CODE).eq('is_active', true).maybeSingle()
  if (error || !data) throw new PayrollServiceError('PAYROLL_PROVIDER_NOT_CONFIGURED', 503)
  return { row: data, provider: getPayrollProvider(data.code) }
}

async function scopedConnection(admin: ReturnType<typeof createAdminClient>, tenantId: string, hrGroupId: string, connectionId: string): Promise<ConnectionRow> {
  const { data, error } = await admin.from('payroll_connections').select(CONNECTION_SELECT).eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('id', connectionId).maybeSingle()
  if (error) throw new PayrollServiceError('PAYROLL_CONNECTION_READ_FAILED')
  if (!data) throw new PayrollServiceError('PAYROLL_CONNECTION_NOT_FOUND', 404)
  return data
}

async function scopedCompany(admin: ReturnType<typeof createAdminClient>, tenantId: string, hrGroupId: string, companyId: string): Promise<CompanyRow> {
  const { data, error } = await admin.from('payroll_provider_companies').select(COMPANY_SELECT).eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('id', companyId).maybeSingle()
  if (error) throw new PayrollServiceError('PAYROLL_COMPANY_READ_FAILED')
  if (!data) throw new PayrollServiceError('PAYROLL_PROVIDER_COMPANY_NOT_FOUND', 404)
  return data
}

async function writeAudit(input: {
  tenantId: string
  hrGroupId: string
  providerId?: string | null
  connectionId?: string | null
  companyBindingId?: string | null
  administrationId?: string | null
  actorUserId?: string | null
  eventType: string
  resultCode: string
  referenceData?: Json
}): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.from('payroll_audit_events').insert({
    tenant_id: input.tenantId,
    hr_group_id: input.hrGroupId,
    provider_id: input.providerId ?? null,
    connection_id: input.connectionId ?? null,
    company_binding_id: input.companyBindingId ?? null,
    administration_id: input.administrationId ?? null,
    actor_user_id: input.actorUserId ?? null,
    event_type: input.eventType,
    result_code: input.resultCode.slice(0, 120),
    reference_data: input.referenceData ?? {},
  })
  if (error) throw new PayrollServiceError('PAYROLL_AUDIT_WRITE_FAILED')
}

async function writeAuditBestEffort(input: Parameters<typeof writeAudit>[0]): Promise<void> {
  try {
    await writeAudit(input)
  } catch {
    // The operation's primary error remains the response; audit failures are not
    // allowed to turn a safe provider error into a secret-bearing exception.
  }
}

export function createPayrollOAuthState(): string {
  return randomBytes(32).toString('base64url')
}

export function hashPayrollOAuthState(state: string): string {
  return createHash('sha256').update(state, 'utf8').digest('hex')
}

export function payrollOAuthStateCookieOptions(): {
  httpOnly: true
  sameSite: 'lax'
  secure: boolean
  path: string
  maxAge: number
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/payroll/providers/nmbrs',
    maxAge: PAYROLL_OAUTH_STATE_MAX_AGE_SECONDS,
  }
}

async function latestCredential(tenantId: string, hrGroupId: string, connectionId: string): Promise<PayrollCredentialRow | null> {
  const result = await createPayrollPrivateClient().latestCredential(tenantId, hrGroupId, connectionId)
  if (result.error) throw new PayrollServiceError('PAYROLL_CREDENTIAL_READ_FAILED')
  return privateRow<PayrollCredentialRow>(result.data)
}

async function consumeOAuthState(state: string): Promise<PayrollOAuthStateRow> {
  const hash = hashPayrollOAuthState(state)
  const consumedAt = new Date().toISOString()
  const consumed = await createPayrollPrivateClient().consumeOAuthState(hash, consumedAt)
  if (consumed.error) throw new PayrollServiceError('PAYROLL_OAUTH_STATE_CONSUME_FAILED', 400)
  const consumedRow = privateRow<PayrollOAuthStateRow>(consumed.data)
  if (!consumedRow) throw new PayrollServiceError('PAYROLL_OAUTH_STATE_REPLAYED', 400)
  return consumedRow
}

async function setConnectionError(connection: ConnectionRow, error: unknown): Promise<void> {
  const admin = createAdminClient()
  const code = safeErrorCode(error)
  await admin.from('payroll_connections').update({
    status: code === 'NMBRS_UNAUTHORIZED' ? 'ACTION_REQUIRED' : 'ERROR',
    last_error_code: code,
    last_error_at: new Date().toISOString(),
    disconnected_at: null,
  }).eq('tenant_id', connection.tenant_id).eq('hr_group_id', connection.hr_group_id).eq('id', connection.id)
}

export async function startNmbrsAuthorization(connectionIdInput?: unknown): Promise<PayrollAuthorizationResult> {
  const { auth, hrGroupId } = await payrollAuth('payroll:manage')
  assertPayrollCredentialEncryptionConfigured()
  const admin = createAdminClient()
  const { row: providerRow } = await activeNmbrsProvider(admin)
  const nmbrsClient = getPayrollProvider(PAYROLL_PROVIDER_CODE).createAuthorizationRequest
  if (!nmbrsClient) throw new PayrollServiceError('PAYROLL_OAUTH_NOT_AVAILABLE', 503)
  const redirectValue = createNmbrsClient().redirectUri
  const parsedConnectionId = connectionIdInput === undefined ? null : parseUuid(connectionIdInput, 'PAYROLL_CONNECTION_ID_INVALID')
  let connection: ConnectionRow | null = null
  if (parsedConnectionId) connection = await scopedConnection(admin, auth.tenantId, hrGroupId, parsedConnectionId)
  if (connection && connection.provider_id !== providerRow.id) throw new PayrollServiceError('PAYROLL_PROVIDER_MISMATCH', 409)
  if (!connection) {
    const reserved = await admin.from('payroll_connections').select(CONNECTION_SELECT).eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).neq('status', 'DISCONNECTED').maybeSingle()
    if (reserved.error) throw new PayrollServiceError('PAYROLL_CONNECTION_READ_FAILED')
    connection = reserved.data
  }
  if (!connection) {
    const disconnected = await admin.from('payroll_connections').select(CONNECTION_SELECT).eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('provider_id', providerRow.id).eq('status', 'DISCONNECTED').order('updated_at', { ascending: false }).limit(1).maybeSingle()
    if (disconnected.error) throw new PayrollServiceError('PAYROLL_CONNECTION_READ_FAILED')
    connection = disconnected.data
  }
  if (connection && connection.provider_id !== providerRow.id) throw new PayrollServiceError('PAYROLL_PROVIDER_MISMATCH', 409)
  if (connection) {
    const updated = await admin.from('payroll_connections').update({ status: 'CONNECTING', last_error_code: null, last_error_at: null, disconnected_at: null }).eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('id', connection.id).select(CONNECTION_SELECT).single()
    if (updated.error || !updated.data) throw new PayrollServiceError('PAYROLL_CONNECTION_START_FAILED')
    connection = updated.data
  } else {
    const inserted = await admin.from('payroll_connections').insert({ tenant_id: auth.tenantId, hr_group_id: hrGroupId, provider_id: providerRow.id, status: 'CONNECTING' }).select(CONNECTION_SELECT).single()
    if (inserted.error || !inserted.data) throw new PayrollServiceError('PAYROLL_CONNECTION_START_FAILED')
    connection = inserted.data
  }
  const state = createPayrollOAuthState()
  const expiresAt = new Date(Date.now() + PAYROLL_OAUTH_STATE_MAX_AGE_SECONDS * 1000)
  const stateInsert = await createPayrollPrivateClient().insertOAuthState({
    stateHash: hashPayrollOAuthState(state),
    tenantId: auth.tenantId,
    hrGroupId: hrGroupId,
    providerId: providerRow.id,
    connectionId: connection.id,
    initiatedByUserId: auth.userId,
    redirectUri: redirectValue,
    requestedScopes: [...NMBRS_P1_SCOPES],
    expiresAt: expiresAt.toISOString(),
  })
  if (stateInsert.error) throw new PayrollServiceError('PAYROLL_OAUTH_STATE_WRITE_FAILED')
  const authorization = await nmbrsClient({ redirectUri: redirectValue, state })
  return { authorizationUrl: authorization.authorizationUrl, connectionId: connection.id, state, expiresAt: expiresAt.toISOString() }
}

export async function completeNmbrsAuthorization(input: { state: unknown; code: unknown }): Promise<PayrollConnection> {
  const state = parseText(input.state, 'PAYROLL_OAUTH_STATE_INVALID', 500)
  const code = parseText(input.code, 'PAYROLL_OAUTH_CODE_INVALID', 2_000)
  const stateRow = await consumeOAuthState(state)
  const admin = createAdminClient()
  const connection = stateRow.connection_id
    ? await scopedConnection(admin, stateRow.tenant_id, stateRow.hr_group_id, stateRow.connection_id)
    : null
  if (!connection) throw new PayrollServiceError('PAYROLL_CONNECTION_NOT_FOUND', 404)
  try {
    const providerResult = await admin.from('payroll_providers').select('id, code, name, is_active, capabilities, created_at, updated_at').eq('id', stateRow.provider_id).eq('is_active', true).maybeSingle()
    if (providerResult.error || !providerResult.data) throw new PayrollServiceError('PAYROLL_PROVIDER_NOT_CONFIGURED', 503)
    const provider = getPayrollProvider(providerResult.data.code)
    if (!provider.exchangeAuthorizationCode) throw new PayrollServiceError('PAYROLL_OAUTH_NOT_AVAILABLE', 503)
    const tokenSet = await provider.exchangeAuthorizationCode({ code, redirectUri: stateRow.redirect_uri })
    if (!tokenSet.refreshToken) throw new PayrollServiceError('PAYROLL_REFRESH_TOKEN_MISSING', 502)
    const current = await latestCredential(connection.tenant_id, connection.hr_group_id, connection.id)
    const credentialVersion = (current?.credential_version ?? 0) + 1
    const credentialInsert = await createPayrollPrivateClient().insertCredential({
      tenantId: connection.tenant_id,
      hrGroupId: connection.hr_group_id,
      connectionId: connection.id,
      credentialVersion,
      encryptedAccessToken: encryptPayrollCredential(tokenSet.accessToken),
      encryptedRefreshToken: encryptPayrollCredential(tokenSet.refreshToken),
      expiresAt: tokenSet.expiresAt,
      providerMetadata: { scope: tokenSet.scope, provider: 'NMBRS' },
    })
    if (credentialInsert.error) throw new PayrollServiceError('PAYROLL_CREDENTIAL_WRITE_FAILED')
    const reconnected = connection.connected_at !== null || connection.status === 'DISCONNECTED'
    const updated = await admin.from('payroll_connections').update({
      status: 'CONNECTED',
      connected_at: new Date().toISOString(),
      connected_by_user_id: stateRow.initiated_by_user_id,
      last_checked_at: null,
      last_error_code: null,
      last_error_at: null,
      disconnected_at: null,
    }).eq('tenant_id', connection.tenant_id).eq('hr_group_id', connection.hr_group_id).eq('id', connection.id).select(CONNECTION_SELECT).single()
    if (updated.error || !updated.data) throw new PayrollServiceError('PAYROLL_CONNECTION_UPDATE_FAILED')
    await writeAudit({
      tenantId: connection.tenant_id,
      hrGroupId: connection.hr_group_id,
      providerId: providerResult.data.id,
      connectionId: connection.id,
      actorUserId: stateRow.initiated_by_user_id,
      eventType: reconnected ? 'PAYROLL_CONNECTION_RECONNECTED' : 'PAYROLL_CONNECTION_CREATED',
      resultCode: reconnected ? 'NMBRS_OAUTH_RECONNECTED' : 'NMBRS_OAUTH_CONNECTED',
      referenceData: { flow: 'AUTHORIZATION_CODE', scopes: [...stateRow.requested_scopes] },
    })
    return mapConnection(updated.data)
  } catch (error) {
    await setConnectionError(connection, error)
    const normalized = normalizeOperationError(error, 'PAYROLL_OAUTH_FAILED')
    throw normalized
  }
}

export async function failNmbrsAuthorization(input: { state: unknown }): Promise<void> {
  const state = parseText(input.state, 'PAYROLL_OAUTH_STATE_INVALID', 500)
  const stateRow = await consumeOAuthState(state)
  if (!stateRow.connection_id) return
  const admin = createAdminClient()
  const connection = await scopedConnection(admin, stateRow.tenant_id, stateRow.hr_group_id, stateRow.connection_id)
  await setConnectionError(connection, new PayrollProviderError('NMBRS_AUTHORIZATION_DENIED', 400))
}

async function accessTokenForConnection(connection: ConnectionRow, forceRefresh = false): Promise<{ accessToken: string }> {
  const current = await latestCredential(connection.tenant_id, connection.hr_group_id, connection.id)
  if (!current) throw new PayrollServiceError('PAYROLL_CREDENTIALS_MISSING', 409)
  const accessToken = decryptPayrollCredential(current.encrypted_access_token)
  const refreshToken = current.encrypted_refresh_token ? decryptPayrollCredential(current.encrypted_refresh_token) : null
  const expiresAt = current.expires_at ? Date.parse(current.expires_at) : 0
  if (!forceRefresh && expiresAt > Date.now() + 60_000) return { accessToken }
  if (!refreshToken) throw new PayrollServiceError('PAYROLL_REFRESH_TOKEN_MISSING', 409)
  const providerResult = await createAdminClient().from('payroll_providers').select('id, code, name, is_active, capabilities, created_at, updated_at').eq('id', connection.provider_id).eq('is_active', true).maybeSingle()
  if (providerResult.error || !providerResult.data) throw new PayrollServiceError('PAYROLL_PROVIDER_NOT_CONFIGURED', 503)
  const provider = getPayrollProvider(providerResult.data.code)
  if (!provider.refreshCredentials) throw new PayrollServiceError('PAYROLL_REFRESH_NOT_AVAILABLE', 503)
  let refreshed
  try {
    refreshed = await provider.refreshCredentials({ refreshToken })
  } catch (error) {
    const newest = await latestCredential(connection.tenant_id, connection.hr_group_id, connection.id)
    if (newest && newest.credential_version > current.credential_version) return { accessToken: decryptPayrollCredential(newest.encrypted_access_token) }
    throw error
  }
  const refreshedAccess = encryptPayrollCredential(refreshed.accessToken)
  const refreshedRefresh = encryptPayrollCredential(refreshed.refreshToken ?? refreshToken)
  const inserted = await createPayrollPrivateClient().insertCredential({
    tenantId: current.tenant_id,
    hrGroupId: current.hr_group_id,
    connectionId: current.connection_id,
    credentialVersion: current.credential_version + 1,
    encryptedAccessToken: refreshedAccess,
    encryptedRefreshToken: refreshedRefresh,
    expiresAt: refreshed.expiresAt,
    providerMetadata: { scope: refreshed.scope, provider: 'NMBRS' },
  })
  if (inserted.error) {
    const newest = await latestCredential(connection.tenant_id, connection.hr_group_id, connection.id)
    if (newest && newest.credential_version > current.credential_version) return { accessToken: decryptPayrollCredential(newest.encrypted_access_token) }
    throw new PayrollServiceError('PAYROLL_CREDENTIAL_REFRESH_WRITE_FAILED')
  }
  return { accessToken: refreshed.accessToken }
}

async function withNmbrsAccessToken<T>(connection: ConnectionRow, operation: (accessToken: string) => Promise<T>): Promise<T> {
  const initial = await accessTokenForConnection(connection)
  try {
    return await operation(initial.accessToken)
  } catch (error) {
    if (!isNmbrsUnauthorized(error)) throw error
    const refreshed = await accessTokenForConnection(connection, true)
    return operation(refreshed.accessToken)
  }
}

export async function checkNmbrsConnection(connectionIdInput: unknown): Promise<PayrollConnection> {
  const { auth, hrGroupId } = await payrollAuth('payroll:manage')
  const connectionId = parseUuid(connectionIdInput, 'PAYROLL_CONNECTION_ID_INVALID')
  const admin = createAdminClient()
  const connection = await scopedConnection(admin, auth.tenantId, hrGroupId, connectionId)
  const provider = await activeNmbrsProvider(admin)
  if (connection.provider_id !== provider.row.id) throw new PayrollServiceError('PAYROLL_PROVIDER_MISMATCH', 409)
  if (connection.status !== 'CONNECTED') throw new PayrollServiceError('PAYROLL_CONNECTION_NOT_CONNECTED', 409)
  try {
    if (!provider.provider.getConnectionHealth) throw new PayrollServiceError('PAYROLL_HEALTH_NOT_AVAILABLE', 503)
    const health = await withNmbrsAccessToken(connection, (accessToken) => provider.provider.getConnectionHealth!({ accessToken }))
    const updated = await admin.from('payroll_connections').update({ status: health.status, last_checked_at: health.checkedAt, last_error_code: null, last_error_at: null }).eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('id', connection.id).select(CONNECTION_SELECT).single()
    if (updated.error || !updated.data) throw new PayrollServiceError('PAYROLL_CONNECTION_UPDATE_FAILED')
    await writeAudit({ tenantId: auth.tenantId, hrGroupId, providerId: provider.row.id, connectionId: connection.id, actorUserId: auth.userId, eventType: 'PAYROLL_CONNECTION_CHECKED', resultCode: health.resultCode, referenceData: { operation: 'USER_INFO' } })
    return mapConnection(updated.data)
  } catch (error) {
    await setConnectionError(connection, error)
    await writeAuditBestEffort({ tenantId: auth.tenantId, hrGroupId, providerId: provider.row.id, connectionId: connection.id, actorUserId: auth.userId, eventType: 'PAYROLL_CONNECTION_CHECKED', resultCode: safeErrorCode(error, 'NMBRS_HEALTH_FAILED'), referenceData: { operation: 'USER_INFO' } })
    throw normalizeOperationError(error, 'PAYROLL_CONNECTION_CHECK_FAILED')
  }
}

async function restoreInactiveBindings(admin: ReturnType<typeof createAdminClient>, connection: ConnectionRow, companies: readonly PayrollProviderCompany[]): Promise<void> {
  const inactive = await admin.from('payroll_company_bindings').select(BINDING_SELECT).eq('tenant_id', connection.tenant_id).eq('hr_group_id', connection.hr_group_id).eq('connection_id', connection.id).eq('status', 'INACTIVE').order('updated_at', { ascending: false }).limit(500)
  if (inactive.error) throw new PayrollServiceError('PAYROLL_BINDING_READ_FAILED')
  if (!inactive.data || inactive.data.length === 0) return
  const administrations = await admin.from('administrations').select('id').eq('tenant_id', connection.tenant_id).eq('hr_group_id', connection.hr_group_id).eq('is_active', true).limit(500)
  if (administrations.error) throw new PayrollServiceError('PAYROLL_ADMINISTRATION_READ_FAILED')
  const availableAdministrationIds = new Set((administrations.data ?? []).map((row) => row.id))
  const activeBindings = await admin.from('payroll_company_bindings').select('administration_id, external_company_id').eq('tenant_id', connection.tenant_id).eq('hr_group_id', connection.hr_group_id).eq('status', 'ACTIVE').limit(500)
  if (activeBindings.error) throw new PayrollServiceError('PAYROLL_BINDING_READ_FAILED')
  const occupiedAdministrationIds = new Set((activeBindings.data ?? []).map((row) => row.administration_id))
  const occupiedExternalIds = new Set((activeBindings.data ?? []).map((row) => row.external_company_id))
  for (const binding of inactive.data) {
    const company = companies.find((item) => item.externalCompanyId === binding.external_company_id && item.status === 'ACTIVE')
    if (!company || !availableAdministrationIds.has(binding.administration_id)) continue
    if (occupiedAdministrationIds.has(binding.administration_id) || occupiedExternalIds.has(binding.external_company_id)) continue
    const result = await admin.from('payroll_company_bindings').update({ status: 'ACTIVE', bound_at: new Date().toISOString(), unbound_at: null, last_seen_at: company.lastSeenAt }).eq('id', binding.id).eq('tenant_id', connection.tenant_id).eq('hr_group_id', connection.hr_group_id).select('id').maybeSingle()
    if (result.error) throw new PayrollServiceError('PAYROLL_BINDING_RESTORE_FAILED')
    occupiedAdministrationIds.add(binding.administration_id)
    occupiedExternalIds.add(binding.external_company_id)
  }
}

export async function discoverNmbrsCompanies(connectionIdInput: unknown): Promise<PayrollProviderCompany[]> {
  const { auth, hrGroupId } = await payrollAuth('payroll:manage')
  const connectionId = parseUuid(connectionIdInput, 'PAYROLL_CONNECTION_ID_INVALID')
  const admin = createAdminClient()
  const connection = await scopedConnection(admin, auth.tenantId, hrGroupId, connectionId)
  const provider = await activeNmbrsProvider(admin)
  if (connection.provider_id !== provider.row.id) throw new PayrollServiceError('PAYROLL_PROVIDER_MISMATCH', 409)
  if (connection.status !== 'CONNECTED') throw new PayrollServiceError('PAYROLL_CONNECTION_NOT_CONNECTED', 409)
  try {
    if (!provider.provider.listCompanies) throw new PayrollServiceError('PAYROLL_COMPANY_DISCOVERY_NOT_AVAILABLE', 503)
    const companies = await withNmbrsAccessToken(connection, (accessToken) => provider.provider.listCompanies!({ accessToken }))
    const uniqueCompanies = [...new Map(companies.map((company) => [company.externalCompanyId, company])).values()]
    const existing = await admin.from('payroll_provider_companies').select(COMPANY_SELECT).eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('connection_id', connection.id).limit(5000)
    if (existing.error) throw new PayrollServiceError('PAYROLL_COMPANY_READ_FAILED')
    const seenIds = new Set(uniqueCompanies.map((company) => company.externalCompanyId))
    for (const row of existing.data ?? []) {
      if (!seenIds.has(row.external_company_id)) {
        const stale = await admin.from('payroll_provider_companies').update({ status: 'INACTIVE' }).eq('id', row.id).eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId)
        if (stale.error) throw new PayrollServiceError('PAYROLL_COMPANY_UPDATE_FAILED')
      }
    }
    for (const company of uniqueCompanies) {
      const upsert = await admin.from('payroll_provider_companies').upsert({
        tenant_id: auth.tenantId,
        hr_group_id: hrGroupId,
        connection_id: connection.id,
        external_company_id: company.externalCompanyId,
        external_company_number: company.externalCompanyNumber,
        external_company_display_name: company.externalCompanyDisplayName,
        external_debtor_id: company.externalDebtorId,
        status: 'ACTIVE',
        provider_metadata: { provider: 'NMBRS', source: 'COMPANIES' },
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,hr_group_id,connection_id,external_company_id' })
      if (upsert.error) throw new PayrollServiceError('PAYROLL_COMPANY_WRITE_FAILED')
    }
    const updatedConnection = await admin.from('payroll_connections').update({ status: 'CONNECTED', last_checked_at: new Date().toISOString(), last_error_code: null, last_error_at: null }).eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('id', connection.id).select(CONNECTION_SELECT).single()
    if (updatedConnection.error || !updatedConnection.data) throw new PayrollServiceError('PAYROLL_CONNECTION_UPDATE_FAILED')
    const currentCompanies = await admin.from('payroll_provider_companies').select(COMPANY_SELECT).eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('connection_id', connection.id).order('last_seen_at', { ascending: false }).limit(5000)
    if (currentCompanies.error) throw new PayrollServiceError('PAYROLL_COMPANY_READ_FAILED')
    const mappedCompanies = (currentCompanies.data ?? []).map(mapCompany)
    await restoreInactiveBindings(admin, updatedConnection.data, mappedCompanies)
    await writeAudit({ tenantId: auth.tenantId, hrGroupId, providerId: provider.row.id, connectionId: connection.id, actorUserId: auth.userId, eventType: 'PAYROLL_COMPANIES_DISCOVERED', resultCode: 'NMBRS_COMPANIES_DISCOVERED', referenceData: { companyCount: uniqueCompanies.length, endpoint: '/api/companies' } })
    return mappedCompanies
  } catch (error) {
    await setConnectionError(connection, error)
    await writeAuditBestEffort({ tenantId: auth.tenantId, hrGroupId, providerId: provider.row.id, connectionId: connection.id, actorUserId: auth.userId, eventType: 'PAYROLL_COMPANIES_DISCOVERED', resultCode: safeErrorCode(error, 'NMBRS_COMPANY_DISCOVERY_FAILED'), referenceData: { endpoint: '/api/companies' } })
    throw normalizeOperationError(error, 'PAYROLL_COMPANY_DISCOVERY_FAILED')
  }
}

export async function bindPayrollCompany(input: { providerCompanyId: unknown; administrationId: unknown }): Promise<PayrollCompanyBinding> {
  const { auth, hrGroupId } = await payrollAuth('payroll:manage')
  const providerCompanyId = parseUuid(input.providerCompanyId, 'PAYROLL_PROVIDER_COMPANY_ID_INVALID')
  const administrationId = parseUuid(input.administrationId, 'PAYROLL_ADMINISTRATION_ID_INVALID')
  const admin = createAdminClient()
  const company = await scopedCompany(admin, auth.tenantId, hrGroupId, providerCompanyId)
  if (company.status !== 'ACTIVE') throw new PayrollServiceError('PAYROLL_PROVIDER_COMPANY_INACTIVE', 409)
  const connection = await scopedConnection(admin, auth.tenantId, hrGroupId, company.connection_id)
  if (connection.status !== 'CONNECTED') throw new PayrollServiceError('PAYROLL_CONNECTION_NOT_CONNECTED', 409)
  const provider = await activeNmbrsProvider(admin)
  if (connection.provider_id !== provider.row.id) throw new PayrollServiceError('PAYROLL_PROVIDER_MISMATCH', 409)
  const administration = await admin.from('administrations').select('id').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('id', administrationId).eq('is_active', true).maybeSingle()
  if (administration.error) throw new PayrollServiceError('PAYROLL_ADMINISTRATION_READ_FAILED')
  if (!administration.data) throw new PayrollServiceError('PAYROLL_ADMINISTRATION_NOT_FOUND', 404)
  const [sameCompany, sameAdministration, inactive] = await Promise.all([
    admin.from('payroll_company_bindings').select(BINDING_SELECT).eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('connection_id', connection.id).eq('external_company_id', company.external_company_id).eq('status', 'ACTIVE').maybeSingle(),
    admin.from('payroll_company_bindings').select(BINDING_SELECT).eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('administration_id', administrationId).eq('status', 'ACTIVE').maybeSingle(),
    admin.from('payroll_company_bindings').select(BINDING_SELECT).eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('connection_id', connection.id).eq('external_company_id', company.external_company_id).eq('status', 'INACTIVE').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (sameCompany.error || sameAdministration.error || inactive.error) throw new PayrollServiceError('PAYROLL_BINDING_READ_FAILED')
  if (sameCompany.data && sameCompany.data.administration_id !== administrationId || sameAdministration.data && sameAdministration.data.external_company_id !== company.external_company_id) throw new PayrollServiceError('PAYROLL_BINDING_CONFLICT', 409)
  if (sameCompany.data) return mapBinding(sameCompany.data)
  let result: { data: BindingRow | null; error: { code?: string; message?: string } | null }
  if (inactive.data) {
    result = await admin.from('payroll_company_bindings').update({ administration_id: administrationId, external_company_display_name: company.external_company_display_name, status: 'ACTIVE', bound_at: new Date().toISOString(), bound_by_user_id: auth.userId, last_seen_at: company.last_seen_at, unbound_at: null }).eq('id', inactive.data.id).eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).select(BINDING_SELECT).single()
  } else {
    result = await admin.from('payroll_company_bindings').insert({ tenant_id: auth.tenantId, hr_group_id: hrGroupId, connection_id: connection.id, administration_id: administrationId, external_company_id: company.external_company_id, external_company_display_name: company.external_company_display_name, status: 'ACTIVE', bound_at: new Date().toISOString(), bound_by_user_id: auth.userId, last_seen_at: company.last_seen_at }).select(BINDING_SELECT).single()
  }
  if (result.error || !result.data) {
    if (result.error?.code === '23505') throw new PayrollServiceError('PAYROLL_BINDING_CONFLICT', 409)
    throw new PayrollServiceError('PAYROLL_BINDING_WRITE_FAILED')
  }
  await writeAudit({ tenantId: auth.tenantId, hrGroupId, providerId: provider.row.id, connectionId: connection.id, companyBindingId: result.data.id, administrationId, actorUserId: auth.userId, eventType: 'PAYROLL_COMPANY_BOUND', resultCode: 'NMBRS_COMPANY_BOUND', referenceData: { externalCompanyId: company.external_company_id } })
  return mapBinding(result.data)
}

export async function unbindPayrollCompany(bindingIdInput: unknown): Promise<PayrollCompanyBinding> {
  const { auth, hrGroupId } = await payrollAuth('payroll:manage')
  const bindingId = parseUuid(bindingIdInput, 'PAYROLL_BINDING_ID_INVALID')
  const admin = createAdminClient()
  const { data, error } = await admin.from('payroll_company_bindings').select(BINDING_SELECT).eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('id', bindingId).maybeSingle()
  if (error) throw new PayrollServiceError('PAYROLL_BINDING_READ_FAILED')
  if (!data) throw new PayrollServiceError('PAYROLL_BINDING_NOT_FOUND', 404)
  if (data.status === 'INACTIVE') return mapBinding(data)
  const updated = await admin.from('payroll_company_bindings').update({ status: 'INACTIVE', unbound_at: new Date().toISOString() }).eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('id', bindingId).select(BINDING_SELECT).single()
  if (updated.error || !updated.data) throw new PayrollServiceError('PAYROLL_BINDING_UPDATE_FAILED')
  await writeAudit({ tenantId: auth.tenantId, hrGroupId, connectionId: updated.data.connection_id, companyBindingId: bindingId, administrationId: updated.data.administration_id, actorUserId: auth.userId, eventType: 'PAYROLL_COMPANY_UNBOUND', resultCode: 'NMBRS_COMPANY_UNBOUND', referenceData: { externalCompanyId: updated.data.external_company_id } })
  return mapBinding(updated.data)
}

export async function disconnectNmbrsConnection(connectionIdInput: unknown): Promise<PayrollDisconnectResult> {
  const { auth, hrGroupId } = await payrollAuth('payroll:manage')
  const connectionId = parseUuid(connectionIdInput, 'PAYROLL_CONNECTION_ID_INVALID')
  const admin = createAdminClient()
  const connection = await scopedConnection(admin, auth.tenantId, hrGroupId, connectionId)
  const provider = await activeNmbrsProvider(admin)
  if (connection.provider_id !== provider.row.id) throw new PayrollServiceError('PAYROLL_PROVIDER_MISMATCH', 409)
  const current = await latestCredential(auth.tenantId, hrGroupId, connection.id)
  let remoteRevocation: PayrollDisconnectResult['remoteRevocation'] = 'NO_CREDENTIALS'
  let revocationError: unknown = null
  if (current) {
    try {
      const accessToken = decryptPayrollCredential(current.encrypted_access_token)
      const refreshToken = current.encrypted_refresh_token ? decryptPayrollCredential(current.encrypted_refresh_token) : null
      if (!provider.provider.revokeCredentials) throw new PayrollServiceError('PAYROLL_REVOCATION_NOT_AVAILABLE', 503)
      await provider.provider.revokeCredentials({ accessToken, refreshToken })
      remoteRevocation = 'SUCCEEDED'
    } catch (error) {
      remoteRevocation = 'FAILED'
      revocationError = error
    }
  }
  const deleted = await createPayrollPrivateClient().deleteCredentials(auth.tenantId, hrGroupId, connection.id)
  if (deleted.error) throw new PayrollServiceError('PAYROLL_CREDENTIAL_DELETE_FAILED')
  const now = new Date().toISOString()
  const bindings = await admin.from('payroll_company_bindings').update({ status: 'INACTIVE', unbound_at: now }).eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('connection_id', connection.id).eq('status', 'ACTIVE')
  if (bindings.error) throw new PayrollServiceError('PAYROLL_BINDING_DISCONNECT_FAILED')
  const companies = await admin.from('payroll_provider_companies').update({ status: 'INACTIVE' }).eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('connection_id', connection.id).eq('status', 'ACTIVE')
  if (companies.error) throw new PayrollServiceError('PAYROLL_COMPANY_DISCONNECT_FAILED')
  const updated = await admin.from('payroll_connections').update({ status: 'DISCONNECTED', disconnected_at: now, last_error_code: remoteRevocation === 'FAILED' ? safeErrorCode(revocationError, 'NMBRS_REVOCATION_FAILED') : null, last_error_at: remoteRevocation === 'FAILED' ? now : null }).eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('id', connection.id).select(CONNECTION_SELECT).single()
  if (updated.error || !updated.data) throw new PayrollServiceError('PAYROLL_CONNECTION_DISCONNECT_FAILED')
  await writeAudit({ tenantId: auth.tenantId, hrGroupId, providerId: provider.row.id, connectionId: connection.id, actorUserId: auth.userId, eventType: 'PAYROLL_CONNECTION_DISCONNECTED', resultCode: remoteRevocation === 'FAILED' ? 'NMBRS_DISCONNECTED_REVOCATION_FAILED' : 'NMBRS_DISCONNECTED', referenceData: { remoteRevocation } })
  return { connection: mapConnection(updated.data), remoteRevocation }
}

export function payrollErrorResponse(error: unknown): Response {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof ModuleError) return Response.json({ error: error.code }, { status: error.status })
  if (error instanceof PayrollServiceError || error instanceof PayrollProviderError || error instanceof PayrollCredentialError) return Response.json({ error: error.code }, { status: error.status ?? 500 })
  return Response.json({ error: 'PAYROLL_OPERATION_FAILED' }, { status: 500 })
}
