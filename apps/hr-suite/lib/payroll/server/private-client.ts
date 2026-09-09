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

export type PayrollPrivateQuery = PromiseLike<PayrollPrivateQueryResult<unknown>> & {
  select: (columns?: string) => PayrollPrivateQuery
  insert: (values: Record<string, unknown> | readonly Record<string, unknown>[]) => PayrollPrivateQuery
  update: (values: Record<string, unknown>) => PayrollPrivateQuery
  delete: () => PayrollPrivateQuery
  eq: (column: string, value: unknown) => PayrollPrivateQuery
  is: (column: string, value: null) => PayrollPrivateQuery
  gt: (column: string, value: unknown) => PayrollPrivateQuery
  order: (column: string, options?: { readonly ascending?: boolean }) => PayrollPrivateQuery
  limit: (count: number) => PayrollPrivateQuery
  maybeSingle: () => Promise<PayrollPrivateQueryResult<unknown>>
  single: () => Promise<PayrollPrivateQueryResult<unknown>>
}

type PayrollPrivateTable = 'payroll_connection_credentials' | 'payroll_oauth_states'

type PayrollPrivateClient = {
  from: (table: PayrollPrivateTable) => PayrollPrivateQuery
}

type SchemaClient = {
  schema: (schema: string) => unknown
}

export function createPayrollPrivateClient(): PayrollPrivateClient {
  const client = createAdminClient() as unknown as SchemaClient
  return client.schema('payroll_private') as PayrollPrivateClient
}

export function privateRow<T>(value: unknown): T | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as T : null
}

export function privateRows<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}
