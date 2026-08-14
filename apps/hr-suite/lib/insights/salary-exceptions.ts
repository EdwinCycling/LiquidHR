import { requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { findSalaryExceptionForRule, type SalaryExceptionRecord } from '@/lib/salary-application/exceptions'

export type SalaryExceptionReport = {
  report: 'salary-exceptions'
  generatedOn: string
  rows: SalaryExceptionRecord[]
  filterOptions: { teams: string[]; segments: string[]; reasons: string[] }
}

export async function getSalaryExceptionReport(today = new Date().toISOString().slice(0, 10)): Promise<SalaryExceptionReport> {
  const auth = await requirePermission('salary:write')
  const hrGroupId = requireHrGroupId(auth)
  const supabase = await createClient()
  const [salariesResult, employmentsResult, employeesResult, administrationsResult, structuresResult, scalesResult, bandsResult, revisionsResult] = await Promise.all([
    supabase.from('employment_salaries').select('id, employment_id, employee_id, valid_from, valid_until, salary_route, salary_structure_id, salary_scale_id, salary_step_code, salary_band_id, fulltime_amount')
      .eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).order('valid_from', { ascending: false }).limit(10_000),
    supabase.from('employments').select('id, employment_number, administration_id, starts_on, ends_on')
      .eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).is('deleted_at', null).limit(10_000),
    supabase.from('employees').select('id, first_name, birth_name')
      .eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).is('deleted_at', null).limit(10_000),
    supabase.from('administrations').select('id, name')
      .eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).limit(500),
    supabase.from('salary_structures').select('id, code, name')
      .eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).limit(1_000),
    supabase.from('salary_scales').select('id, salary_structure_id, code, name')
      .eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).limit(2_000),
    supabase.from('salary_bands').select('id, salary_structure_id, identity_key')
      .eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).limit(2_000),
    supabase.from('salary_structure_revisions').select('id, salary_structure_id, effective_from, revision_number, status')
      .eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('status', 'PUBLISHED').limit(5_000),
  ])
  const firstError = salariesResult.error ?? employmentsResult.error ?? employeesResult.error ?? administrationsResult.error
    ?? structuresResult.error ?? scalesResult.error ?? bandsResult.error ?? revisionsResult.error
  if (firstError) throw new Error('SALARY_EXCEPTION_REPORT_FAILED')

  const revisionRows = revisionsResult.data ?? []
  const revisionIds = revisionRows.map((revision) => revision.id)
  const [scaleValuesResult, stepsResult, bandValuesResult] = revisionIds.length > 0
    ? await Promise.all([
      supabase.from('salary_scale_revision_values').select('salary_structure_revision_id, salary_scale_id, code, name')
        .eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).in('salary_structure_revision_id', revisionIds).limit(10_000),
      supabase.from('salary_scale_steps').select('id, salary_structure_revision_id, salary_scale_id, step_code, step_name, fulltime_amount')
        .eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).in('salary_structure_revision_id', revisionIds).limit(20_000),
      supabase.from('salary_band_values').select('id, salary_structure_revision_id, salary_band_id, code, name, minimum_amount, midpoint_amount, maximum_amount')
        .eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).in('salary_structure_revision_id', revisionIds).limit(20_000),
    ])
    : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }] as const
  if (scaleValuesResult.error || stepsResult.error || bandValuesResult.error) throw new Error('SALARY_EXCEPTION_REPORT_FAILED')

  const employments = employmentsResult.data ?? []
  const employeesById = new Map((employeesResult.data ?? []).map((employee) => [employee.id, `${employee.first_name} ${employee.birth_name}`.trim()]))
  const administrationsById = new Map((administrationsResult.data ?? []).map((administration) => [administration.id, administration.name]))
  const salaryRowsByEmployment = new Map<string, typeof salariesResult.data>()
  for (const row of salariesResult.data ?? []) {
    const current = salaryRowsByEmployment.get(row.employment_id) ?? []
    current.push(row)
    salaryRowsByEmployment.set(row.employment_id, current)
  }
  const structures = (structuresResult.data ?? []).map((structure) => ({ id: structure.id, code: structure.code, name: structure.name }))
  const scales = (scalesResult.data ?? []).map((scale) => ({ id: scale.id, code: scale.code, name: scale.name, structureId: scale.salary_structure_id }))
  const bands = (bandsResult.data ?? []).map((band) => ({ id: band.id, code: band.identity_key, name: band.identity_key, structureId: band.salary_structure_id }))
  const revisions = revisionRows.map((revision) => ({ id: revision.id, salaryStructureId: revision.salary_structure_id, effectiveFrom: revision.effective_from, revisionNumber: revision.revision_number, status: revision.status }))
  const scaleValues = (scaleValuesResult.data ?? []).map((value) => ({ revisionId: value.salary_structure_revision_id, salaryScaleId: value.salary_scale_id, code: value.code, name: value.name }))
  const steps = (stepsResult.data ?? []).map((step) => ({ id: step.id, revisionId: step.salary_structure_revision_id, salaryScaleId: step.salary_scale_id, stepCode: step.step_code, stepName: step.step_name ?? undefined, fulltimeAmount: step.fulltime_amount }))
  const bandValues = (bandValuesResult.data ?? []).map((value) => ({ id: value.id, revisionId: value.salary_structure_revision_id, salaryBandId: value.salary_band_id, code: value.code, name: value.name, minimumAmount: value.minimum_amount, midpointAmount: value.midpoint_amount, maximumAmount: value.maximum_amount }))
  const rows: SalaryExceptionRecord[] = []

  for (const employment of employments) {
    const isCurrentOrFuture = employment.starts_on > today || (employment.starts_on <= today && (!employment.ends_on || employment.ends_on >= today))
    if (!isCurrentOrFuture) continue
    const salaryRows = salaryRowsByEmployment.get(employment.id) ?? []
    const currentSalary = salaryRows.find((row) => row.valid_from <= today && (!row.valid_until || row.valid_until > today))
      ?? salaryRows.find((row) => row.valid_from > today)
      ?? salaryRows[0]
    if (!currentSalary) continue
    const exception = findSalaryExceptionForRule({
      row: {
        id: currentSalary.id,
        employmentId: currentSalary.employment_id,
        employeeId: currentSalary.employee_id,
        validFrom: currentSalary.valid_from,
        salaryRoute: currentSalary.salary_route,
        salaryStructureId: currentSalary.salary_structure_id,
        salaryScaleId: currentSalary.salary_scale_id,
        salaryStepCode: currentSalary.salary_step_code,
        salaryBandId: currentSalary.salary_band_id,
        fulltimeAmount: currentSalary.fulltime_amount,
      },
      today,
      employeeName: employeesById.get(currentSalary.employee_id) ?? currentSalary.employee_id,
      administrationName: administrationsById.get(employment.administration_id) ?? employment.administration_id,
      employmentNumber: employment.employment_number,
      structures,
      scales,
      bands,
      revisions,
      scaleValues,
      steps,
      bandValues,
    })
    if (exception) rows.push(exception)
  }

  return { report: 'salary-exceptions', generatedOn: today, rows: rows.sort((left, right) => left.invalidFrom.localeCompare(right.invalidFrom) || left.employeeName.localeCompare(right.employeeName)), filterOptions: { teams: [], segments: [], reasons: [] } }
}
