import type { Database } from '@scope/db'
import type { AuthContext } from '@/lib/auth/permissions'
import { requireAuthContext, requirePermissionInContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { LeaveServiceError } from './leave-service'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>
type LeaveRequestStatus = Database['public']['Enums']['leave_request_status']

export interface EmployeeLeaveReadDependencies {
  context: AuthContext
  supabase: SupabaseClient
}

export interface EmployeeLeaveTypeAllocation {
  name: string
  hours: number
}

export interface EmployeeLeaveRequest {
  requestId: string
  startDate: string
  endDate: string
  requestedHours: number
  status: LeaveRequestStatus
  timeMode: Database['public']['Enums']['leave_request_time_mode']
  leaveTypes: EmployeeLeaveTypeAllocation[]
}

export interface EmployeeLeaveRequestList {
  asOfDate: string
  requests: EmployeeLeaveRequest[]
  sourceTruncated: boolean
}

const SELF_SERVICE_REQUEST_STATUSES = ['PENDING', 'CHANGES_REQUESTED', 'APPROVED'] as const satisfies readonly LeaveRequestStatus[]

function currentDateInAmsterdam(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value
  const year = value('year')
  const month = value('month')
  const day = value('day')
  if (!year || !month || !day) throw new LeaveServiceError('LEAVE_OPERATION_FAILED', 500)
  return `${year}-${month}-${day}`
}

async function employeeContext(dependencies?: EmployeeLeaveReadDependencies) {
  const supabase = dependencies?.supabase ?? await createClient()
  const context = dependencies?.context ?? await requireAuthContext(supabase)
  if (!context.employeeId || !context.hrGroupId) throw new LeaveServiceError('LEAVE_EMPLOYMENT_REQUIRED', 409)
  await requirePermissionInContext(supabase, context, 'self:leave:read', context.employeeId)
  return { context, supabase }
}

async function queryEmployeeLeaveRequests(input: {
  readonly statuses: readonly LeaveRequestStatus[]
  readonly startAfter?: string
  readonly requestId?: string
  readonly limit: number
  readonly now: Date
}, dependencies?: EmployeeLeaveReadDependencies): Promise<EmployeeLeaveRequestList> {
  const { context, supabase } = await employeeContext(dependencies)
  const limit = Math.min(Math.max(input.limit, 1), 100)
  let query = supabase
    .from('leave_requests')
    .select('id,leave_type_id,start_date,end_date,requested_minutes,status,time_mode')
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', context.hrGroupId!)
    .eq('employee_id', context.employeeId!)
    .in('status', [...input.statuses])
  if (input.requestId) query = query.eq('id', input.requestId)
  if (input.startAfter) query = query.gt('start_date', input.startAfter)
  const requestsResult = await query
    .order('start_date', { ascending: true })
    .limit(limit + 1)
  if (requestsResult.error) throw new LeaveServiceError('LEAVE_OPERATION_FAILED', 500)
  const sourceTruncated = requestsResult.data.length > limit
  const requestRows = requestsResult.data.slice(0, limit)
  if (requestRows.length === 0) {
    return { asOfDate: currentDateInAmsterdam(input.now), requests: [], sourceTruncated: false }
  }

  const requestIds = requestRows.map((request) => request.id)
  const directTypeIds = [...new Set(requestRows.flatMap((request) => request.leave_type_id ? [request.leave_type_id] : []))]
  const [allocationResult, directTypeResult] = await Promise.all([
    supabase
      .from('leave_request_allocations')
      .select('request_id,leave_type_id,allocated_hours')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', context.hrGroupId!)
      .eq('employee_id', context.employeeId!)
      .in('request_id', requestIds)
      .limit(5001),
    directTypeIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase
        .from('leave_types')
        .select('id,name')
        .eq('tenant_id', context.tenantId)
        .eq('hr_group_id', context.hrGroupId!)
        .in('id', directTypeIds)
        .limit(501),
  ])
  if (allocationResult.error || directTypeResult.error) throw new LeaveServiceError('LEAVE_OPERATION_FAILED', 500)
  const allocations = allocationResult.data.slice(0, 5000)
  const allTypeIds = [...new Set([
    ...allocations.map((allocation) => allocation.leave_type_id),
    ...requestRows.flatMap((request) => request.leave_type_id ? [request.leave_type_id] : []),
  ])]
  const missingTypeIds = allTypeIds.filter((id) => !directTypeResult.data.some((type) => type.id === id))
  const allocationTypesResult = missingTypeIds.length === 0
    ? { data: [], error: null }
    : await supabase
      .from('leave_types')
      .select('id,name')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', context.hrGroupId!)
      .in('id', missingTypeIds)
      .limit(500)
  if (allocationTypesResult.error) throw new LeaveServiceError('LEAVE_OPERATION_FAILED', 500)
  const typeNames = new Map([
    ...directTypeResult.data.map((type) => [type.id, type.name] as const),
    ...allocationTypesResult.data.map((type) => [type.id, type.name] as const),
  ])
  const allocationsByRequest = new Map<string, Map<string, number>>()
  for (const allocation of allocations) {
    const byType = allocationsByRequest.get(allocation.request_id) ?? new Map<string, number>()
    byType.set(allocation.leave_type_id, (byType.get(allocation.leave_type_id) ?? 0) + Number(allocation.allocated_hours))
    allocationsByRequest.set(allocation.request_id, byType)
  }

  const requests: EmployeeLeaveRequest[] = requestRows.map((request) => {
    const byType = allocationsByRequest.get(request.id)
    const entries = byType && byType.size > 0
      ? [...byType.entries()]
      : request.leave_type_id
        ? [[request.leave_type_id, Number(request.requested_minutes) / 60] as const]
        : []
    return {
      requestId: request.id,
      startDate: request.start_date,
      endDate: request.end_date,
      requestedHours: Number(request.requested_minutes) / 60,
      status: request.status,
      timeMode: request.time_mode,
      leaveTypes: entries.flatMap(([leaveTypeId, hours]) => {
        const name = typeNames.get(leaveTypeId)
        return name ? [{ name, hours }] : []
      }),
    }
  })

  return {
    asOfDate: currentDateInAmsterdam(input.now),
    requests,
    sourceTruncated: sourceTruncated || allocationResult.data.length > 5000 || directTypeResult.data.length > 500 || allocationTypesResult.data.length > 500,
  }
}

export async function listMyLeaveRequests(
  dependencies?: EmployeeLeaveReadDependencies,
  now = new Date(),
): Promise<EmployeeLeaveRequestList> {
  return queryEmployeeLeaveRequests({ statuses: SELF_SERVICE_REQUEST_STATUSES, limit: 50, now }, dependencies)
}

export async function getMyNextApprovedLeave(
  dependencies?: EmployeeLeaveReadDependencies,
  now = new Date(),
): Promise<{ asOfDate: string; nextLeave: EmployeeLeaveRequest | null }> {
  const asOfDate = currentDateInAmsterdam(now)
  const result = await queryEmployeeLeaveRequests({
    statuses: ['APPROVED'],
    startAfter: asOfDate,
    limit: 1,
    now,
  }, dependencies)
  return { asOfDate, nextLeave: result.requests[0] ?? null }
}

export async function getMyLeaveRequest(
  requestId: string,
  dependencies?: EmployeeLeaveReadDependencies,
  now = new Date(),
): Promise<EmployeeLeaveRequest> {
  const result = await queryEmployeeLeaveRequests({
    statuses: SELF_SERVICE_REQUEST_STATUSES,
    requestId,
    limit: 1,
    now,
  }, dependencies)
  const request = result.requests[0]
  if (!request) throw new LeaveServiceError('LEAVE_REQUEST_NOT_FOUND', 404)
  return request
}
