import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

export type PayrollCredentialRow = {
  tenant_id: string
  hr_group_id: string
  connection_id: string
  credential_version: number
  encrypted_access_token: string
  encrypted_refresh_token: string | null
  expires_at: string | null
  provider_metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type PayrollOAuthStateRow = {
  state_hash: string
  tenant_id: string
  hr_group_id: string
  provider_id: string
  connection_id: string | null
  initiated_by_user_id: string
  redirect_uri: string
  requested_scopes: string[]
  expires_at: string
  consumed_at: string | null
  created_at: string
}

export type PayrollPrivateQueryResult<T> = {
  readonly data: T | null
  readonly error: { readonly message?: string; readonly code?: string } | null
}

export type PayrollOAuthStateInsert = {
  readonly stateHash: string
  readonly tenantId: string
  readonly hrGroupId: string
  readonly providerId: string
  readonly connectionId: string | null
  readonly initiatedByUserId: string
  readonly redirectUri: string
  readonly requestedScopes: readonly string[]
  readonly expiresAt: string
}

export type PayrollCredentialInsert = {
  readonly tenantId: string
  readonly hrGroupId: string
  readonly connectionId: string
  readonly credentialVersion: number
  readonly encryptedAccessToken: string
  readonly encryptedRefreshToken: string | null
  readonly expiresAt: string | null
  readonly providerMetadata: Record<string, unknown>
}

type PayrollPrivateClient = {
  insertOAuthState: (input: PayrollOAuthStateInsert) => PromiseLike<PayrollPrivateQueryResult<unknown>>
  consumeOAuthState: (stateHash: string, consumedAt: string) => PromiseLike<PayrollPrivateQueryResult<unknown>>
  latestCredential: (tenantId: string, hrGroupId: string, connectionId: string) => PromiseLike<PayrollPrivateQueryResult<unknown>>
  insertCredential: (input: PayrollCredentialInsert) => PromiseLike<PayrollPrivateQueryResult<unknown>>
  deleteCredentials: (tenantId: string, hrGroupId: string, connectionId: string) => PromiseLike<PayrollPrivateQueryResult<unknown>>
}

type PayrollRpcClient = {
  rpc: (functionName: string, args: Record<string, unknown>) => PromiseLike<PayrollPrivateQueryResult<unknown>>
}

export function createPayrollPrivateClient(): PayrollPrivateClient {
  const client = createAdminClient() as unknown as PayrollRpcClient
  return {
    insertOAuthState(input) {
      return client.rpc('payroll_private_insert_oauth_state', {
        requested_state_hash: input.stateHash,
        requested_tenant_id: input.tenantId,
        requested_hr_group_id: input.hrGroupId,
        requested_provider_id: input.providerId,
        requested_connection_id: input.connectionId,
        requested_initiated_by_user_id: input.initiatedByUserId,
        requested_redirect_uri: input.redirectUri,
        requested_requested_scopes: [...input.requestedScopes],
        requested_expires_at: input.expiresAt,
      })
    },
    consumeOAuthState(stateHash, consumedAt) {
      return client.rpc('payroll_private_consume_oauth_state', {
        requested_state_hash: stateHash,
        requested_consumed_at: consumedAt,
      })
    },
    latestCredential(tenantId, hrGroupId, connectionId) {
      return client.rpc('payroll_private_latest_credential', {
        requested_tenant_id: tenantId,
        requested_hr_group_id: hrGroupId,
        requested_connection_id: connectionId,
      })
    },
    insertCredential(input) {
      return client.rpc('payroll_private_insert_credential', {
        requested_tenant_id: input.tenantId,
        requested_hr_group_id: input.hrGroupId,
        requested_connection_id: input.connectionId,
        requested_credential_version: input.credentialVersion,
        requested_encrypted_access_token: input.encryptedAccessToken,
        requested_encrypted_refresh_token: input.encryptedRefreshToken,
        requested_expires_at: input.expiresAt,
        requested_provider_metadata: input.providerMetadata,
      })
    },
    deleteCredentials(tenantId, hrGroupId, connectionId) {
      return client.rpc('payroll_private_delete_credentials', {
        requested_tenant_id: tenantId,
        requested_hr_group_id: hrGroupId,
        requested_connection_id: connectionId,
      })
    },
  }
}

export function privateRow<T>(value: unknown): T | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as T : null
}
