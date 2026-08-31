import 'server-only'

import type { AuthContext } from '@/lib/auth/permissions'
import { getRequestAuthorizationContext, requireHrGroupId } from '@/lib/auth/permissions'
import type { EmployeeOverview } from '@/lib/employment/employee-overview'
import { listEmployeesOverview } from '@/lib/employment/employment-service'
import { ANALYSIS_PERMISSION } from './analysis-contract'
import { AnalysisEngineError } from './analysis-errors'
import type { AnalysisResult, AnalysisResultRow } from './analysis-result'
import {
  ANALYSIS_DATA_PERMISSIONS,
  ANALYSIS_ENTITY,
  ANALYSIS_MEASURE,
  ANALYSIS_SOURCE,
  findSemanticDimension,
  findSemanticEntity,
  findSemanticMeasure,
  type AnalysisDimensionKey,
} from './analysis-semantic-layer'
import type { AnalysisFilter, ValidatedAnalysisSpec } from './analysis-spec'

export interface AnalysisEmployeeRecord {
  readonly id: string
  readonly tenantId: string
  readonly hrGroupId: string
  readonly department: string | null
  readonly job: string | null
  readonly employmentStatus: EmployeeOverview['status']
}

export interface AnalysisExecutionDependencies {
  readonly getContext?: () => Promise<AuthContext>
  readonly retrieve?: (context: AuthContext) => Promise<readonly AnalysisEmployeeRecord[]>
}

export interface AuthorizedAnalysisData {
  readonly context: AuthContext
  readonly hrGroupId: string
  readonly records: readonly AnalysisEmployeeRecord[]
}

interface AnalysisPlan {
  readonly dimension: AnalysisDimensionKey | null
}

function resolvePlan(spec: ValidatedAnalysisSpec): AnalysisPlan {
  const entity = findSemanticEntity(spec.entity)
  if (!entity || entity.source !== spec.source) throw new AnalysisEngineError('ANALYSIS_UNSUPPORTED_ENTITY', 400)

  const measure = findSemanticMeasure(entity, spec.measures[0])
  if (!measure || measure.key !== ANALYSIS_MEASURE) throw new AnalysisEngineError('ANALYSIS_UNSUPPORTED_MEASURE', 400)

  if (spec.dimensions.length > 1) throw new AnalysisEngineError('ANALYSIS_INCOMPATIBLE_MEASURE_DIMENSION', 400)
  const dimension = spec.dimensions[0] ?? null
  if (dimension && (!findSemanticDimension(entity, dimension) || !measure.allowedDimensions.includes(dimension))) {
    throw new AnalysisEngineError('ANALYSIS_INCOMPATIBLE_MEASURE_DIMENSION', 400)
  }

  if (spec.presentation === 'kpi' && dimension) throw new AnalysisEngineError('ANALYSIS_INCOMPATIBLE_PRESENTATION', 400)
  return { dimension }
}

function hasAnalysisDataPermission(context: AuthContext): boolean {
  return ANALYSIS_DATA_PERMISSIONS.some((permission) => context.permissions.includes(permission))
}

function authorizeAnalysis(context: AuthContext): string {
  if (!context.permissions.includes(ANALYSIS_PERMISSION) || !hasAnalysisDataPermission(context)) {
    throw new AnalysisEngineError('ANALYSIS_UNAUTHORIZED', 403)
  }

  try {
    return requireHrGroupId(context)
  } catch {
    throw new AnalysisEngineError('ANALYSIS_UNAUTHORIZED', 403)
  }
}

async function defaultContext(): Promise<AuthContext> {
  return (await getRequestAuthorizationContext()).context
}

function toAnalysisEmployeeRecord(employee: EmployeeOverview, context: AuthContext, hrGroupId: string): AnalysisEmployeeRecord {
  return {
    id: employee.id,
    tenantId: context.tenantId,
    hrGroupId,
    department: employee.departmentName?.trim() || null,
    job: employee.jobTitle?.trim() || null,
    employmentStatus: employee.status,
  }
}

async function defaultRetrieve(context: AuthContext): Promise<readonly AnalysisEmployeeRecord[]> {
  const hrGroupId = authorizeAnalysis(context)
  const request = await getRequestAuthorizationContext()
  if (
    request.context.userId !== context.userId
    || request.context.tenantId !== context.tenantId
    || request.context.hrGroupId !== context.hrGroupId
  ) {
    throw new AnalysisEngineError('ANALYSIS_SCOPE_VIOLATION', 403)
  }

  const employees = await listEmployeesOverview(
    'active',
    'all',
    { activeDirectoryOnly: false },
    { context: request.context, supabase: request.supabase },
  )
  return employees.map((employee) => toAnalysisEmployeeRecord(employee, context, hrGroupId))
}

export function dimensionValue(record: AnalysisEmployeeRecord, dimension: AnalysisDimensionKey): string | null {
  switch (dimension) {
    case 'department':
      return record.department
    case 'job':
      return record.job
    case 'employment_status':
      return record.employmentStatus
  }
}

function matchesFilter(record: AnalysisEmployeeRecord, filter: AnalysisFilter): boolean {
  const value = dimensionValue(record, filter.dimension)
  if (filter.operator === 'eq') return value !== null && typeof filter.value === 'string' && value === filter.value
  return value !== null && typeof filter.value !== 'string' && filter.value.includes(value)
}

function compareLabels(left: string | null, right: string | null): number {
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1

  const leftNormalized = left.toLowerCase()
  const rightNormalized = right.toLowerCase()
  if (leftNormalized < rightNormalized) return -1
  if (leftNormalized > rightNormalized) return 1
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

interface AnalysisGroup {
  readonly label: string | null
  readonly count: number
}

function compareGroups(left: AnalysisGroup, right: AnalysisGroup, spec: ValidatedAnalysisSpec): number {
  const sort = spec.sort
  if (sort?.by === 'label') {
    const labelOrder = compareLabels(left.label, right.label)
    if (labelOrder !== 0) return sort.direction === 'asc' ? labelOrder : -labelOrder
  } else {
    const countOrder = left.count - right.count
    if (countOrder !== 0) return sort?.direction === 'asc' ? countOrder : -countOrder
  }
  return compareLabels(left.label, right.label)
}

function resultRowsWithoutDimension(count: number): readonly AnalysisResultRow[] {
  return [{ values: { headcount: count } }]
}

function resultRowsWithDimension(
  records: readonly AnalysisEmployeeRecord[],
  dimension: AnalysisDimensionKey,
  spec: ValidatedAnalysisSpec,
): { readonly rows: readonly AnalysisResultRow[]; readonly groupCount: number } {
  const counts = new Map<string | null, number>()
  for (const record of records) {
    const label = dimensionValue(record, dimension)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }

  const groups: AnalysisGroup[] = [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => compareGroups(left, right, spec))

  return {
    groupCount: groups.length,
    rows: groups.slice(0, spec.limit).map((group) => ({
      values: { dimension: group.label, headcount: group.count },
    })),
  }
}

function assertRecordScope(records: readonly AnalysisEmployeeRecord[], context: AuthContext, hrGroupId: string): void {
  for (const record of records) {
    if (record.tenantId !== context.tenantId || record.hrGroupId !== hrGroupId) {
      throw new AnalysisEngineError('ANALYSIS_SCOPE_VIOLATION', 403)
    }
  }
}

function distinctEmployeeRecords(records: readonly AnalysisEmployeeRecord[]): readonly AnalysisEmployeeRecord[] {
  const seenEmployeeIds = new Set<string>()
  return records.filter((record) => {
    if (seenEmployeeIds.has(record.id)) return false
    seenEmployeeIds.add(record.id)
    return true
  })
}

export function filterAnalysisRecords(
  records: readonly AnalysisEmployeeRecord[],
  filters: readonly AnalysisFilter[],
): readonly AnalysisEmployeeRecord[] {
  return distinctEmployeeRecords(records).filter((record) => filters.every((filter) => matchesFilter(record, filter)))
}

export async function loadAuthorizedAnalysisData(
  dependencies: AnalysisExecutionDependencies = {},
): Promise<AuthorizedAnalysisData> {
  const context = await (dependencies.getContext ?? defaultContext)()
  const hrGroupId = authorizeAnalysis(context)
  const records = await (dependencies.retrieve ?? defaultRetrieve)(context)
  assertRecordScope(records, context, hrGroupId)
  return { context, hrGroupId, records }
}

export async function executeAnalysisSpec(
  spec: ValidatedAnalysisSpec,
  dependencies: AnalysisExecutionDependencies = {},
): Promise<AnalysisResult> {
  const plan = resolvePlan(spec)
  const { records } = await loadAuthorizedAnalysisData(dependencies)

  const filteredRecords = filterAnalysisRecords(records, spec.filters)
  const dimensionResult = plan.dimension
    ? resultRowsWithDimension(filteredRecords, plan.dimension, spec)
    : { rows: resultRowsWithoutDimension(filteredRecords.length), groupCount: 0 }
  const preferred = spec.presentation === 'auto'
    ? plan.dimension ? 'table' : 'kpi'
    : spec.presentation

  return {
    version: 1,
    source: ANALYSIS_SOURCE,
    entity: ANALYSIS_ENTITY,
    measures: [ANALYSIS_MEASURE],
    dimensions: plan.dimension ? [plan.dimension] : [],
    metadata: {
      matchedRecordCount: filteredRecords.length,
      groupCount: dimensionResult.groupCount,
    },
    columns: plan.dimension
      ? [{ key: 'dimension', dataType: 'string' }, { key: 'headcount', dataType: 'integer' }]
      : [{ key: 'headcount', dataType: 'integer' }],
    rows: dimensionResult.rows,
    summary: { headcount: filteredRecords.length },
    presentationHints: { preferred, fallback: 'table' },
  }
}
