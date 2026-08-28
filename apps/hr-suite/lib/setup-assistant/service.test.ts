import { describe, expect, it, vi } from 'vitest'
import { AuthorizationError, type AuthContext } from '@/lib/auth/permissions'

type SupabaseServerClient = Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
type FakeResult = { data: unknown; error: null }
type FakeQuery = {
  select: (...args: unknown[]) => FakeQuery
  eq: (...args: unknown[]) => FakeQuery
  limit: (...args: unknown[]) => Promise<FakeResult>
  maybeSingle: () => Promise<FakeResult>
  upsert: (...args: unknown[]) => Promise<{ error: null }>
}

vi.mock('server-only', () => ({}))

import {
  canUseSetupAssistant,
  getSetupAssistantState,
  setSetupAssistantEnabled,
  setSetupStepCompletion,
} from './service'

function auth(permissions: string[], activeRoles: string[] = []): AuthContext {
  return {
    tenantId: 'tenant-1',
    hrGroupId: 'hr-group-1',
    administrationId: null,
    userId: 'user-1',
    employeeId: null,
    activeRoles,
    permissions,
  }
}

function setupClient(options: {
  setting?: { is_enabled: boolean } | null
  completions?: Array<{ step_key: string; is_completed: boolean }>
} = {}) {
  const settingsUpsert = vi.fn(async (...args: unknown[]) => {
    void args
    return { error: null }
  })
  const completionUpsert = vi.fn(async (...args: unknown[]) => {
    void args
    return { error: null }
  })
  const settingsQuery: FakeQuery = {
    select: () => settingsQuery,
    eq: () => settingsQuery,
    limit: async () => ({ data: [], error: null }),
    maybeSingle: async () => ({ data: options.setting ?? null, error: null }),
    upsert: (...args) => settingsUpsert(...args),
  }
  const completionQuery: FakeQuery = {
    select: () => completionQuery,
    eq: () => completionQuery,
    limit: async () => ({ data: options.completions ?? [], error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
    upsert: (...args) => completionUpsert(...args),
  }
  const client = {
    from(table: string): FakeQuery {
      if (table === 'setup_guide_settings') return settingsQuery
      if (table === 'setup_step_completion') return completionQuery
      throw new Error(`Unexpected table in Setup Assistant test: ${table}`)
    },
  } as unknown as SupabaseServerClient
  return { client, settingsUpsert, completionUpsert }
}

describe('Setup Assistent access contract', () => {
  it('allows a functional HR Admin with settings read access without TENANT_ADMIN', () => {
    expect(canUseSetupAssistant(auth(['settings:read'], ['HR_ADMIN']))).toBe(true)
  })

  it('requires settings:read regardless of the active role', () => {
    expect(canUseSetupAssistant(auth([], ['TENANT_ADMIN']))).toBe(false)
    expect(canUseSetupAssistant(auth([], ['HR_ADMIN']))).toBe(false)
  })

  it('allows an HR Admin without TENANT_ADMIN to read the shared state and filters steps by permission', async () => {
    const { client } = setupClient()

    await expect(getSetupAssistantState({ auth: auth(['settings:read'], ['HR_ADMIN']), supabase: client })).resolves.toMatchObject({
      isEnabled: false,
      canWrite: false,
      visibleStepKeys: ['BAS-003', 'SET-002'],
    })
  })

  it('allows an HR Admin with settings:write to enable, disable and complete a step', async () => {
    const { client, settingsUpsert, completionUpsert } = setupClient()
    const dependencies = { auth: auth(['settings:read', 'settings:write'], ['HR_ADMIN']), supabase: client }

    await expect(setSetupAssistantEnabled(true, dependencies)).resolves.toBeUndefined()
    await expect(setSetupAssistantEnabled(false, dependencies)).resolves.toBeUndefined()
    await expect(setSetupStepCompletion('BAS-003', true, dependencies)).resolves.toBeUndefined()
    await expect(setSetupStepCompletion('BAS-003', false, dependencies)).resolves.toBeUndefined()

    expect(settingsUpsert).toHaveBeenCalledTimes(2)
    expect(settingsUpsert).toHaveBeenNthCalledWith(1, expect.objectContaining({ is_enabled: true }), { onConflict: 'tenant_id,hr_group_id,guide_code' })
    expect(settingsUpsert).toHaveBeenNthCalledWith(2, expect.objectContaining({ is_enabled: false }), { onConflict: 'tenant_id,hr_group_id,guide_code' })
    expect(completionUpsert).toHaveBeenCalledTimes(2)
    expect(completionUpsert).toHaveBeenNthCalledWith(1, expect.objectContaining({ step_key: 'BAS-003', is_completed: true }), { onConflict: 'tenant_id,hr_group_id,guide_code,step_key' })
    expect(completionUpsert).toHaveBeenNthCalledWith(2, expect.objectContaining({ step_key: 'BAS-003', is_completed: false }), { onConflict: 'tenant_id,hr_group_id,guide_code,step_key' })
  })

  it('allows a read-only settings user to read but rejects every Setup write', async () => {
    const { client, settingsUpsert, completionUpsert } = setupClient()
    const dependencies = { auth: auth(['settings:read'], ['HR_ADMIN']), supabase: client }

    await expect(getSetupAssistantState(dependencies)).resolves.toMatchObject({ canWrite: false })
    await expect(setSetupAssistantEnabled(true, dependencies)).rejects.toBeInstanceOf(AuthorizationError)
    await expect(setSetupStepCompletion('BAS-003', true, dependencies)).rejects.toBeInstanceOf(AuthorizationError)
    expect(settingsUpsert).not.toHaveBeenCalled()
    expect(completionUpsert).not.toHaveBeenCalled()
  })

  it('rejects a user without settings:read before any read or write reaches the data client', async () => {
    const { client, settingsUpsert, completionUpsert } = setupClient()
    const dependencies = { auth: auth([], ['EMPLOYEE']), supabase: client }

    await expect(getSetupAssistantState(dependencies)).rejects.toBeInstanceOf(AuthorizationError)
    await expect(setSetupAssistantEnabled(true, dependencies)).rejects.toBeInstanceOf(AuthorizationError)
    await expect(setSetupStepCompletion('BAS-003', true, dependencies)).rejects.toBeInstanceOf(AuthorizationError)
    expect(settingsUpsert).not.toHaveBeenCalled()
    expect(completionUpsert).not.toHaveBeenCalled()
  })
})
