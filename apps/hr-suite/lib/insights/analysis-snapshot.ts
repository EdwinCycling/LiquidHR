import { AnalysisEngineError } from './analysis-errors'
import { isAnalysisEmploymentType, type AnalysisSpecV2 } from './analysis-spec-v2'
import { findAnalysisV2Dimension, type AnalysisEmploymentType, type AnalysisV2DimensionKey } from './analysis-semantic-layer'

export type SnapshotPopulationMode = 'HR_GROUP' | 'DIRECT_REPORTS'

export interface SnapshotSourcePlacement {
  readonly id: string
  readonly tenantId: string
  readonly hrGroupId: string
  readonly employeeId: string
  readonly employmentId: string | null
  readonly departmentId: string | null
  readonly jobId: string | null
  readonly directManagerId: string | null
  readonly effectiveFrom: string
  readonly effectiveTo: string | null
  readonly departmentLabel: string | null
  readonly jobLabel: string | null
}

export interface SnapshotSourceRow {
  readonly employmentId: string
  readonly employeeId: string
  readonly tenantId: string
  readonly hrGroupId: string
  readonly startsOn: string
  readonly endsOn: string | null
  readonly recordStatus: string
  readonly deletedAt: string | null
  readonly employeeDeletedAt: string | null
  readonly isPrimary: boolean
  readonly employmentType: string
  readonly placement: SnapshotSourcePlacement | null
}

export interface SnapshotSource {
  readonly asOf: string
  readonly rows: readonly SnapshotSourceRow[]
  readonly expectedEmploymentCount: number
  readonly retrievedEmploymentCount: number
  readonly complete: true
}

export interface SnapshotEmployeeRecord {
  readonly employeeId: string
  readonly departmentKey: string | null
  readonly departmentLabel: string | null
  readonly jobKey: string | null
  readonly jobLabel: string | null
  readonly employmentType: AnalysisEmploymentType | null
}

function fail(code: ConstructorParameters<typeof AnalysisEngineError>[0], status: 400 | 403 | 500 = 500): never {
  throw new AnalysisEngineError(code, status)
}

function valuesForDimension(record: SnapshotEmployeeRecord, dimension: AnalysisV2DimensionKey): string | null {
  switch (dimension) {
    case 'department':
      return record.departmentKey
    case 'job':
      return record.jobKey
    case 'employment_type':
      return record.employmentType
  }
}

function labelForDimension(record: SnapshotEmployeeRecord, dimension: AnalysisV2DimensionKey): string | null {
  switch (dimension) {
    case 'department':
      return record.departmentLabel
    case 'job':
      return record.jobLabel
    case 'employment_type':
      return record.employmentType
  }
}

function requiredDimensions(spec: AnalysisSpecV2): readonly AnalysisV2DimensionKey[] {
  return [...new Set([
    ...spec.dimensions,
    ...spec.filters
      .map((filter) => filter.dimension)
      .filter((dimension): dimension is AnalysisV2DimensionKey => dimension !== 'employment_status'),
  ])]
}

function assertPlacement(row: SnapshotSourceRow, placement: SnapshotSourcePlacement, asOf: string, mode: SnapshotPopulationMode, actorEmployeeId: string | null): void {
  if (
    placement.tenantId !== row.tenantId
    || placement.hrGroupId !== row.hrGroupId
    || placement.employeeId !== row.employeeId
    || (placement.employmentId !== null && placement.employmentId !== row.employmentId)
    || placement.effectiveFrom > asOf
    || (placement.effectiveTo !== null && placement.effectiveTo < asOf)
  ) fail('ANALYSIS_SNAPSHOT_DATA_INVALID')
  if (mode === 'DIRECT_REPORTS' && (!actorEmployeeId || placement.employmentId !== row.employmentId || placement.directManagerId !== actorEmployeeId)) {
    fail('ANALYSIS_SCOPE_NOT_PROVABLE', 403)
  }
}

function projectRow(
  row: SnapshotSourceRow,
  asOf: string,
  mode: SnapshotPopulationMode,
  actorEmployeeId: string | null,
  required: readonly AnalysisV2DimensionKey[],
): SnapshotEmployeeRecord {
  if (row.recordStatus !== 'CONFIRMED' || row.deletedAt !== null || row.startsOn > asOf || (row.endsOn !== null && row.endsOn < asOf)) {
    fail('ANALYSIS_SNAPSHOT_DATA_INVALID')
  }
  if (!isAnalysisEmploymentType(row.employmentType)) fail('ANALYSIS_SNAPSHOT_DATA_INVALID')

  const placement = row.placement
  if (mode === 'DIRECT_REPORTS' && placement === null) fail('ANALYSIS_SCOPE_NOT_PROVABLE', 403)
  if (placement === null) {
    if (required.includes('department')) fail('ANALYSIS_REFERENCE_NOT_RESOLVED')
    return { employeeId: row.employeeId, departmentKey: null, departmentLabel: null, jobKey: null, jobLabel: null, employmentType: row.employmentType }
  }

  assertPlacement(row, placement, asOf, mode, actorEmployeeId)
  if (required.includes('department') && (placement.departmentId === null || placement.departmentLabel === null || placement.departmentLabel.trim() === '')) {
    fail('ANALYSIS_REFERENCE_NOT_RESOLVED')
  }
  if (required.includes('job') && placement.jobId !== null && (placement.jobLabel === null || placement.jobLabel.trim() === '')) {
    fail('ANALYSIS_REFERENCE_NOT_RESOLVED')
  }
  return {
    employeeId: row.employeeId,
    departmentKey: placement.departmentId,
    departmentLabel: placement.departmentLabel,
    jobKey: placement.jobId,
    jobLabel: placement.jobLabel,
    employmentType: row.employmentType,
  }
}

function assertCommonValues(records: readonly SnapshotEmployeeRecord[], dimensions: readonly AnalysisV2DimensionKey[]): void {
  for (const dimension of dimensions) {
    const values = new Set(records.map((record) => valuesForDimension(record, dimension)))
    if (values.size > 1) fail('ANALYSIS_SNAPSHOT_AMBIGUOUS')
  }
}

function selectParallelEmployment(records: readonly SnapshotEmployeeRecord[], rows: readonly SnapshotSourceRow[], spec: AnalysisSpecV2): SnapshotEmployeeRecord {
  const primaryRows = rows.filter((row) => row.isPrimary)
  if (primaryRows.length > 1) fail('ANALYSIS_SNAPSHOT_AMBIGUOUS')
  const needed = requiredDimensions(spec)
  const projected = records
  if (primaryRows.length === 1) {
    return projected[rows.indexOf(primaryRows[0])] as SnapshotEmployeeRecord
  }
  assertCommonValues(projected, needed)
  const first = projected[0]
  if (!first) fail('ANALYSIS_SNAPSHOT_DATA_INVALID')
  return {
    employeeId: first.employeeId,
    departmentKey: needed.includes('department') ? first.departmentKey : null,
    departmentLabel: needed.includes('department') ? first.departmentLabel : null,
    jobKey: needed.includes('job') ? first.jobKey : null,
    jobLabel: needed.includes('job') ? first.jobLabel : null,
    employmentType: needed.includes('employment_type') ? first.employmentType : null,
  }
}

function matchesFilter(record: SnapshotEmployeeRecord, filter: AnalysisSpecV2['filters'][number]): boolean {
  if (filter.dimension === 'employment_status') return true
  const value = valuesForDimension(record, filter.dimension)
  if (value === null) return false
  return filter.operator === 'eq'
    ? typeof filter.value === 'string' && value === filter.value
    : typeof filter.value !== 'string' && filter.value.includes(value)
}

export function resolveSnapshotPopulation(
  source: SnapshotSource,
  spec: AnalysisSpecV2,
  options: { readonly mode: SnapshotPopulationMode; readonly actorEmployeeId: string | null },
): readonly SnapshotEmployeeRecord[] {
  if (!source.complete || source.expectedEmploymentCount !== source.retrievedEmploymentCount || source.rows.length !== source.retrievedEmploymentCount) {
    fail('ANALYSIS_RETRIEVAL_INCOMPLETE')
  }
  const required = requiredDimensions(spec)
  const rowsByEmployee = new Map<string, SnapshotSourceRow[]>()
  for (const row of source.rows) {
    if (row.tenantId.trim() === '' || row.hrGroupId.trim() === '' || row.employeeId.trim() === '' || row.employmentId.trim() === '') {
      fail('ANALYSIS_SNAPSHOT_DATA_INVALID')
    }
    const rows = rowsByEmployee.get(row.employeeId) ?? []
    rows.push(row)
    rowsByEmployee.set(row.employeeId, rows)
  }

  const employees: SnapshotEmployeeRecord[] = []
  for (const rows of rowsByEmployee.values()) {
    const liveRows = rows.filter((row) => row.employeeDeletedAt === null
      && row.recordStatus === 'CONFIRMED'
      && row.deletedAt === null
      && row.startsOn <= source.asOf
      && (row.endsOn === null || row.endsOn >= source.asOf))
    if (liveRows.length === 0) continue
    const projected = liveRows.map((row) => projectRow(row, source.asOf, options.mode, options.actorEmployeeId, required))
    const selected = selectParallelEmployment(projected, liveRows, spec)
    if (spec.filters.every((filter) => matchesFilter(selected, filter))) employees.push(selected)
  }
  return employees
}

export function dimensionKeyValue(record: SnapshotEmployeeRecord, dimension: AnalysisV2DimensionKey): string | null {
  return valuesForDimension(record, dimension)
}

export function dimensionLabelValue(record: SnapshotEmployeeRecord, dimension: AnalysisV2DimensionKey): string | null {
  const definition = findAnalysisV2Dimension(dimension)
  if (!definition) return null
  return labelForDimension(record, dimension)
}
