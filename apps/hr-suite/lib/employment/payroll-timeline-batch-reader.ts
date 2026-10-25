import type { createClient } from '@/lib/supabase/server'
import { loadQueriesInBatches } from '@/lib/supabase/bounded-query-loader'

export interface PayrollTimelineTarget { readonly employeeId: string; readonly employmentId: string }
export interface PayrollTimelineScope { readonly tenantId: string; readonly hrGroupId: string; readonly administrationId: string }

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Interne leesgrens: de service autoriseert ieder doel voordat deze groep met dezelfde scope wordt gelezen. */
export async function readPayrollTimelineBatch(
  client: Awaited<ReturnType<typeof createClient>>,
  scope: PayrollTimelineScope,
  targets: readonly PayrollTimelineTarget[],
) {
  if (targets.length === 0 || targets.length > 4 || targets.some((target) =>
    !uuid.test(target.employeeId) || !uuid.test(target.employmentId))) throw new Error('PAYROLL_TIMELINE_BATCH_INVALID')
  const pairs = targets.map((target) => `and(employee_id.eq.${target.employeeId},employment_id.eq.${target.employmentId})`).join(',')
  const employmentPairs = targets.map((target) => `and(employee_id.eq.${target.employeeId},id.eq.${target.employmentId})`).join(',')
  const limit = targets.length * 100
  const [employmentResult, contractResult, laborResult, organizationResult, salaryResult, scheduleResult, pensionAssignmentResult] = await loadQueriesInBatches([
    () => client.from('employments')
      .select('id, tenant_id, hr_group_id, administration_id, employee_id, starts_on, ends_on, record_status, employment_type, contract_type, original_hire_date, seniority_date, updated_at, deleted_at')
      .eq('tenant_id', scope.tenantId).eq('hr_group_id', scope.hrGroupId).eq('administration_id', scope.administrationId)
      .or(employmentPairs).limit(targets.length + 1),
    () => client.from('employment_contracts')
      .select('id, employee_id, employment_id, labor_condition_set_id, fulltime_hours_per_week, starts_on, ends_on, updated_at')
      .eq('tenant_id', scope.tenantId).eq('hr_group_id', scope.hrGroupId).eq('administration_id', scope.administrationId)
      .or(pairs).order('starts_on').limit(limit),
    () => client.from('employment_labor_conditions')
      .select('id, employee_id, employment_id, employment_contract_id, condition_group, valid_from, valid_until, updated_at')
      .eq('tenant_id', scope.tenantId).eq('hr_group_id', scope.hrGroupId).eq('administration_id', scope.administrationId)
      .or(pairs).order('valid_from').limit(limit),
    () => client.from('employee_organizations')
      .select('id, employee_id, employment_id, department_id, job_id, job_title, effective_from, effective_to, updated_at')
      .eq('tenant_id', scope.tenantId).eq('hr_group_id', scope.hrGroupId).eq('administration_id', scope.administrationId)
      .or(pairs).order('effective_from').limit(limit),
    () => client.from('employment_salaries')
      .select('id, employee_id, employment_id, salary_basis, salary_route, payment_type, payment_frequency, currency_code, fulltime_amount, parttime_amount, hourly_rate, salary_structure_id, salary_scale_id, salary_scale_step_id, salary_step_code, cao_scale_name, cao_step_name, salary_band_id, valid_from, valid_until, updated_at')
      .eq('tenant_id', scope.tenantId).eq('hr_group_id', scope.hrGroupId).eq('administration_id', scope.administrationId)
      .or(pairs).order('valid_from').limit(limit),
    () => client.from('employment_schedules')
      .select('id, employee_id, employment_id, average_days_per_week, average_hours_per_week, fulltime_hours_per_week, part_time_factor, schedule_type, is_on_call, start_week, time_for_time_accrual, monday_hours, tuesday_hours, wednesday_hours, thursday_hours, friday_hours, saturday_hours, sunday_hours, valid_from, valid_until, updated_at')
      .eq('tenant_id', scope.tenantId).eq('administration_id', scope.administrationId)
      .or(pairs).order('valid_from').limit(limit),
    () => client.from('employment_pension_arrangement_assignments')
      .select('id, employment_id, pension_arrangement_id, effective_from, effective_to, participation_start_date, assignment_reason, provenance_json, updated_at, version_number, supersedes_assignment_id')
      .eq('tenant_id', scope.tenantId).eq('hr_group_id', scope.hrGroupId).eq('administration_id', scope.administrationId)
      .in('employment_id', targets.map((target) => target.employmentId)).order('effective_from').limit(limit),
  ], 4)

  function partition<T extends { employee_id: unknown; employment_id: unknown }>(rows: readonly T[] | null, target: PayrollTimelineTarget) {
    return (rows ?? []).filter((row) => row.employee_id === target.employeeId && row.employment_id === target.employmentId)
      .map(({ employee_id, employment_id, ...row }) => { void employee_id; void employment_id; return row })
  }
  function bounded<T extends object>(rows: readonly T[], orderKey: keyof T): T[] {
    // Behoud de oorspronkelijke limiet en volgorde wanneer batchgelijkheid niet aantoonbaar is.
    if (rows.length >= 100 || new Set(rows.map((row) => row[orderKey])).size !== rows.length) {
      throw new Error('PAYROLL_TIMELINE_BATCH_FALLBACK_REQUIRED')
    }
    return [...rows]
  }
  if ((employmentResult.data?.length ?? 0) > targets.length
    || [contractResult, laborResult, organizationResult, salaryResult, scheduleResult, pensionAssignmentResult]
      .some((result) => (result.data?.length ?? 0) >= limit)) throw new Error('PAYROLL_TIMELINE_BATCH_LIMIT_REACHED')

  return targets.map((target) => ({
    employmentResult: { ...employmentResult, data: employmentResult.data?.find((row) => row.id === target.employmentId && row.employee_id === target.employeeId) ?? null },
    contractResult: { ...contractResult, data: bounded(partition(contractResult.data, target), 'starts_on') },
    laborResult: { ...laborResult, data: bounded(partition(laborResult.data, target), 'valid_from') },
    organizationResult: { ...organizationResult, data: bounded(partition(organizationResult.data, target), 'effective_from') },
    salaryResult: { ...salaryResult, data: bounded(partition(salaryResult.data, target), 'valid_from') },
    scheduleResult: { ...scheduleResult, data: bounded(partition(scheduleResult.data, target), 'valid_from') },
    pensionAssignmentResult: { ...pensionAssignmentResult, data: bounded((pensionAssignmentResult.data ?? [])
      .filter((row) => row.employment_id === target.employmentId).map(({ employment_id, ...row }) => { void employment_id; return row }), 'effective_from') },
  }))
}
