import { requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { createSalaryInsightReport } from './salary-insights-calculations'
import type { SalaryInsightProjectionRow, SalaryInsightReport } from './salary-insights-types'
import type { SalaryInsightQuery } from './salary-insights-query'

export class SalaryInsightsServiceError extends Error {
  constructor(readonly code: string, readonly status = 500) {
    super(code)
    this.name = 'SalaryInsightsServiceError'
  }
}
function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string') return value || null
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function requiredString(value: unknown): string | null {
  const result = stringValue(value)
  return result && result.length > 0 ? result : null
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function nullableBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function booleanValue(value: unknown): boolean {
  return value === true
}

function routeValue(value: unknown): SalaryInsightProjectionRow['salaryRoute'] {
  return value === 'MANUAL' || value === 'MINIMUM_WAGE' || value === 'SCALE_WITH_STEPS' || value === 'SALARY_BAND' ? value : null
}

function projectionRow(value: unknown): SalaryInsightProjectionRow | null {
  const row = record(value)
  if (!row) return null
  const employeeId = requiredString(row.employeeId)
  const employmentId = requiredString(row.employmentId)
  const administrationId = requiredString(row.administrationId)
  if (!employeeId || !employmentId || !administrationId) return null
  return {
    employeeId,
    employeeNumber: stringValue(row.employeeNumber),
    employeeName: stringValue(row.employeeName) ?? employeeId,
    employmentId,
    employmentNumber: stringValue(row.employmentNumber),
    administrationId,
    administrationName: stringValue(row.administrationName),
    administrationNumber: stringValue(row.administrationNumber),
    departmentId: stringValue(row.departmentId),
    departmentName: stringValue(row.departmentName),
    managerId: stringValue(row.managerId),
    managerName: stringValue(row.managerName),
    functionName: stringValue(row.functionName),
    functionGroupId: stringValue(row.functionGroupId),
    functionGroupName: stringValue(row.functionGroupName),
    seniorityId: stringValue(row.seniorityId),
    seniorityName: stringValue(row.seniorityName),
    locationId: stringValue(row.locationId),
    locationName: stringValue(row.locationName),
    laborConditionSetId: stringValue(row.laborConditionSetId),
    laborConditionSetName: stringValue(row.laborConditionSetName),
    employmentType: stringValue(row.employmentType),
    fte: stringValue(row.fte),
    fulltimeSalary: stringValue(row.fulltimeSalary),
    actualSalary: stringValue(row.actualSalary),
    salaryRoute: routeValue(row.salaryRoute),
    salaryStructureId: stringValue(row.salaryStructureId),
    salaryStructureName: stringValue(row.salaryStructureName),
    salaryStructureCode: stringValue(row.salaryStructureCode),
    salaryStructureActive: nullableBoolean(row.salaryStructureActive),
    revisionId: stringValue(row.revisionId),
    revisionEffectiveFrom: stringValue(row.revisionEffectiveFrom),
    revisionNumber: nullableNumber(row.revisionNumber),
    salaryBandId: stringValue(row.salaryBandId),
    salaryBandCode: stringValue(row.salaryBandCode),
    salaryBandName: stringValue(row.salaryBandName),
    bandMinimum: stringValue(row.bandMinimum),
    bandMidpoint: stringValue(row.bandMidpoint),
    bandMaximum: stringValue(row.bandMaximum),
    salaryScaleId: stringValue(row.salaryScaleId),
    salaryScaleCode: stringValue(row.salaryScaleCode),
    salaryScaleName: stringValue(row.salaryScaleName),
    salaryStepCode: stringValue(row.salaryStepCode),
    salaryStepName: stringValue(row.salaryStepName),
    hasPublishedRevision: booleanValue(row.hasPublishedRevision),
    hasResolvedBand: booleanValue(row.hasResolvedBand),
    hasResolvedScaleStep: booleanValue(row.hasResolvedScaleStep),
    structureDisabled: booleanValue(row.structureDisabled),
  }
}

function isHrAdmin(roles: readonly string[]): boolean {
  return roles.includes('TENANT_ADMIN') || roles.includes('HR_ADMIN')
}

export async function getSalaryInsightsReport(query: SalaryInsightQuery): Promise<SalaryInsightReport> {
  const context = await requirePermission('salary:read')
  const canUseInternalPosition = isHrAdmin(context.activeRoles)
  if (query.report === 'salary-internal-position' && !canUseInternalPosition) {
    throw new SalaryInsightsServiceError('SALARY_INSIGHTS_INTERNAL_POSITION_FORBIDDEN', 403)
  }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_salary_insights_projection' as never, {
    requested_tenant_id: context.tenantId,
    requested_hr_group_id: requireHrGroupId(context),
    requested_as_of: query.asOfDate,
  } as never)
  if (error) {
    const code = error.message.includes('FORBIDDEN') ? 'FORBIDDEN' : error.message.includes('AUTHENTICATION') ? 'AUTHENTICATION_REQUIRED' : 'SALARY_INSIGHTS_PROJECTION_FAILED'
    throw new SalaryInsightsServiceError(code, code === 'FORBIDDEN' ? 403 : code === 'AUTHENTICATION_REQUIRED' ? 401 : 500)
  }
  const rawRows = Array.isArray(data) ? data : []
  const rows = rawRows.map(projectionRow).filter((row): row is SalaryInsightProjectionRow => row !== null)
  return createSalaryInsightReport({ report: query.report, asOfDate: query.asOfDate, rows, filters: query, isHrAdmin: canUseInternalPosition })
}
