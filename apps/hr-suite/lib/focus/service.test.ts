import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, getEmployeeJourneyProjections, getRequestAuthorizationContext, readEmployeeEssAccess } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getEmployeeJourneyProjections: vi.fn(),
  getRequestAuthorizationContext: vi.fn(),
  readEmployeeEssAccess: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/journeys/projection-service', () => ({ getEmployeeJourneyProjections }))
vi.mock('@/lib/auth/permissions', () => ({ getRequestAuthorizationContext }))
vi.mock('@/lib/auth/employee-ess-access', () => ({ readEmployeeEssAccess }))

import type { createClient as createServerClient } from '@/lib/supabase/server'
import { focusActions, getFocusHomeData } from './service'

type SupabaseServerClient = Awaited<ReturnType<typeof createServerClient>>
let supabaseClient: SupabaseServerClient

function query<T>(data: T) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
  }
  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  builder.is.mockReturnValue(builder)
  builder.order.mockReturnValue(builder)
  builder.limit.mockResolvedValue({ data, error: null })
  builder.maybeSingle.mockResolvedValue({ data, error: null })
  return builder
}

describe('Focus service lifecycle boundary', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    supabaseClient = {} as SupabaseServerClient
    getRequestAuthorizationContext.mockImplementation(async () => ({
      context: {
        tenantId: 'tenant-a',
        hrGroupId: 'group-a',
        employeeId: 'employee-a',
        activeRoles: ['EMPLOYEE'],
        permissions: [
          'self:journey:read',
          'self:employee:read',
          'self:document:read',
          'self:leave:read',
          'self:process-task:read',
          'process-task:read',
          'organization-chart:read',
        ],
      },
      supabase: supabaseClient,
    }))
    getEmployeeJourneyProjections.mockResolvedValue([])
    readEmployeeEssAccess.mockResolvedValue({ status: 'ACTIVE', blockedAt: null, blockedByUserId: null })
  })

  it('returns no ESS actions or Full presentation for an employee without current or future employment', async () => {
    const employeeQuery = query({ id: 'employee-a', first_name: 'No', birth_name: 'Employment', avatar_url: null })
    const employmentQuery = query([{ starts_on: '2026-09-01', ends_on: '2026-09-16', record_status: 'CONFIRMED', deleted_at: null }])
    supabaseClient = {
      from: vi.fn((table: string) => table === 'employees' ? employeeQuery : employmentQuery),
    } as unknown as SupabaseServerClient

    const data = await getFocusHomeData({ today: '2026-09-17', device: 'DESKTOP', explicitPresentation: 'FULL' })

    expect(data).toMatchObject({
      experience: 'NO_EMPLOYMENT',
      presentation: 'FOCUS',
      actions: [],
      journey: null,
      canOpenFull: false,
    })
    expect(getEmployeeJourneyProjections).not.toHaveBeenCalled()
  })

  it('keeps manager work and team actions while suppressing blocked Employee selfservice', () => {
    const permissions = ['self:employee:read', 'self:leave:read', 'self:process-task:read', 'process-task:read', 'organization-chart:read']
    const blockedManagerActions = focusActions({ employeeId: 'employee-a', experience: 'MANAGER', permissions, journey: null, blocked: true })
    const blockedEmployeeActions = focusActions({
      employeeId: 'employee-a',
      experience: 'EMPLOYEE',
      permissions: ['self:employee:read', 'self:leave:read', 'self:process-task:read'],
      journey: null,
      blocked: true,
    })

    expect(blockedManagerActions.map((action) => action.key)).toEqual(['requests', 'work', 'team'])
    expect(blockedEmployeeActions).toEqual([])
  })

  it('shows the Employee sickness action only when the permission and HR-group setting are both enabled', () => {
    const permissions = ['self:absence:write']
    const disabled = focusActions({ employeeId: 'employee-a', experience: 'EMPLOYEE', permissions, journey: null, employeeSelfReportEnabled: false })
    const enabled = focusActions({ employeeId: 'employee-a', experience: 'EMPLOYEE', permissions, journey: null, employeeSelfReportEnabled: true })

    expect(disabled.map((action) => action.key)).not.toContain('absence')
    expect(enabled.map((action) => action.key)).toContain('absence')
  })

  it('reads the self-report setting through the scoped RPC for an employee', async () => {
    getRequestAuthorizationContext.mockImplementation(async () => ({
      context: {
        tenantId: 'tenant-a',
        hrGroupId: 'group-a',
        employeeId: 'employee-a',
        activeRoles: ['EMPLOYEE'],
        permissions: ['self:absence:write', 'self:employee:read'],
      },
      supabase: supabaseClient,
    }))
    const employeeQuery = query({ id: 'employee-a', first_name: 'Noah', birth_name: 'Hendriks', avatar_url: null })
    const employmentQuery = query([{ starts_on: '2026-01-01', ends_on: null, record_status: 'CONFIRMED', deleted_at: null }])
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    supabaseClient = {
      from: vi.fn((table: string) => table === 'employees' ? employeeQuery : employmentQuery),
      rpc,
    } as unknown as SupabaseServerClient

    const data = await getFocusHomeData({ today: '2026-09-20', device: 'DESKTOP' })

    expect(rpc).toHaveBeenCalledWith('get_employee_self_report_enabled', {
      requested_tenant_id: 'tenant-a',
      requested_hr_group_id: 'group-a',
    })
    expect(data.actions.map((action) => action.key)).toContain('absence')
    expect(data.canReportAbsence).toBe(true)
  })

  it('keeps manager work available for an absence permission without process-task permissions', () => {
    const actions = focusActions({ employeeId: 'employee-a', experience: 'MANAGER', permissions: ['absence:read'], journey: null })

    expect(actions.map((action) => action.key)).toContain('work')
    expect(actions.map((action) => action.key)).toContain('team')
  })
})
