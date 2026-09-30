import 'server-only'

import type { PayrollAdministrationRow } from './database'
import { applyPayrollScopeFilter, assertPayrollScope, type PayrollScope } from './scope'
import { createPayrollSupabaseClient } from './supabase-client'
import type { PayrollSupabaseClient } from './supabase-types'

export type { PayrollSupabaseClient } from './supabase-types'

const ADMINISTRATION_COLUMNS = 'id,source_tenant_id,source_hr_group_id,source_administration_id,display_name,capability_enabled,status,created_at,created_by_user_id,updated_at,updated_by_user_id'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface PayrollAdministrationCapability {
  id: string
  displayName: string
  capabilityEnabled: boolean
  status: PayrollAdministrationRow['status']
}

export interface PayrollRepository {
  getPayrollAdministration(scope: PayrollScope): Promise<PayrollAdministrationCapability | null>
  setPayrollAdministrationCapability(
    scope: PayrollScope,
    payrollAdministrationId: string,
    capabilityEnabled: boolean,
    actorUserId: string,
  ): Promise<PayrollAdministrationCapability | null>
}

export class PayrollRepositoryError extends Error {
  constructor() {
    super('Payroll Lab data could not be read or written.')
    this.name = 'PayrollRepositoryError'
  }
}

function toCapability(row: PayrollAdministrationRow | null): PayrollAdministrationCapability | null {
  if (!row) return null
  return {
    id: row.id,
    displayName: row.display_name,
    capabilityEnabled: row.capability_enabled,
    status: row.status,
  }
}

function assertUuid(value: string): void {
  if (!UUID_PATTERN.test(value)) throw new PayrollRepositoryError()
}

class SupabasePayrollRepository implements PayrollRepository {
  constructor(private readonly client: PayrollSupabaseClient) {}

  async getPayrollAdministration(scope: PayrollScope): Promise<PayrollAdministrationCapability | null> {
    const validatedScope = assertPayrollScope(scope)
    const { data, error } = await applyPayrollScopeFilter(
      this.client.from('payroll_administrations').select(ADMINISTRATION_COLUMNS),
      validatedScope,
    ).maybeSingle()

    if (error) throw new PayrollRepositoryError()
    return toCapability(data)
  }

  async setPayrollAdministrationCapability(
    scope: PayrollScope,
    payrollAdministrationId: string,
    capabilityEnabled: boolean,
    actorUserId: string,
  ): Promise<PayrollAdministrationCapability | null> {
    const validatedScope = assertPayrollScope(scope)
    assertUuid(payrollAdministrationId)
    assertUuid(actorUserId)

    const { data, error } = await applyPayrollScopeFilter(
      this.client
        .from('payroll_administrations')
        .update({
          capability_enabled: capabilityEnabled,
          updated_at: new Date().toISOString(),
          updated_by_user_id: actorUserId,
        })
        .eq('id', payrollAdministrationId),
      validatedScope,
    ).select(ADMINISTRATION_COLUMNS).maybeSingle()

    if (error) throw new PayrollRepositoryError()
    return toCapability(data)
  }
}

export function createPayrollRepository(client: PayrollSupabaseClient = createPayrollSupabaseClient()): PayrollRepository {
  return new SupabasePayrollRepository(client)
}
