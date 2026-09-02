import 'server-only'

import type { AuthContext } from '@/lib/auth/permissions'
import { getRequestAuthorizationContext, requireHrGroupId } from '@/lib/auth/permissions'
import { ANALYSIS_PERMISSION } from './analysis-contract'
import { AnalysisEngineError } from './analysis-errors'
import { loadSnapshotSource, type LoadSnapshotSourceInput } from './analysis-snapshot-retrieval'
import {
  dimensionKeyValue,
  dimensionLabelValue,
  resolveSnapshotPopulation,
  type SnapshotEmployeeRecord,
  type SnapshotPopulationMode,
  type SnapshotSource,
} from './analysis-snapshot'
import type { AnalysisResultV2, AnalysisResultV2Column, AnalysisResultV2Row } from './analysis-result-v2'
import type { AnalysisSpecV2, ValidatedAnalysisSpecV2 } from './analysis-spec-v2'
import { ANALYSIS_DATA_PERMISSIONS, ANALYSIS_MEASURE } from './analysis-semantic-layer'

export interface AnalysisSnapshotExecutionDependencies {
  readonly getContext?: () => Promise<AuthContext>
  readonly retrieve?: (input: LoadSnapshotSourceInput) => Promise<SnapshotSource>
}

interface SnapshotGroup {
  readonly key: string
  readonly values: readonly (string | null)[]
  readonly labels: readonly (string | null)[]
  readonly count: number
}

function defaultContext(): Promise<AuthContext> {
  return getRequestAuthorizationContext().then((request) => request.context)
}

function hasAnalysisDataPermission(context: AuthContext): boolean {
  return ANALYSIS_DATA_PERMISSIONS.some((permission) => context.permissions.includes(permission))
}

function resolvePopulationMode(context: AuthContext): SnapshotPopulationMode {
  if (context.activeRoles.some((role) => role === 'TENANT_ADMIN' || role === 'HR_ADMIN' || role === 'HR_MANAGER')) return 'HR_GROUP'
  if (context.activeRoles.includes('DIRECT_MANAGER')) return 'DIRECT_REPORTS'
  throw new AnalysisEngineError('ANALYSIS_UNAUTHORIZED', 403)
}

function authorize(context: AuthContext): { readonly hrGroupId: string; readonly populationMode: SnapshotPopulationMode } {
  if (!context.permissions.includes(ANALYSIS_PERMISSION) || !hasAnalysisDataPermission(context)) {
    throw new AnalysisEngineError('ANALYSIS_UNAUTHORIZED', 403)
  }
  try {
    return { hrGroupId: requireHrGroupId(context), populationMode: resolvePopulationMode(context) }
  } catch (error) {
    if (error instanceof AnalysisEngineError) throw error
    throw new AnalysisEngineError('ANALYSIS_UNAUTHORIZED', 403)
  }
}

function assertSourceDate(source: SnapshotSource, asOf: string): void {
  if (source.asOf !== asOf || !source.complete || source.expectedEmploymentCount !== source.retrievedEmploymentCount) {
    throw new AnalysisEngineError('ANALYSIS_RETRIEVAL_INCOMPLETE', 500)
  }
}

function groupRecords(records: readonly SnapshotEmployeeRecord[], dimensions: readonly ValidatedAnalysisSpecV2['dimensions'][number][]): readonly SnapshotGroup[] {
  const grouped = new Map<string, { readonly values: readonly (string | null)[]; readonly labels: readonly (string | null)[]; count: number }>()
  if (dimensions.length === 0) {
    return records.length === 0 ? [] : [{ key: '[]', values: [], labels: [], count: records.length }]
  }
  for (const record of records) {
    const values = dimensions.map((dimension) => dimensionKeyValue(record, dimension))
    const labels = dimensions.map((dimension) => dimensionLabelValue(record, dimension))
    const key = JSON.stringify(values)
    const existing = grouped.get(key)
    if (existing) {
      existing.count += 1
    } else {
      grouped.set(key, { values, labels, count: 1 })
    }
  }
  return [...grouped.entries()].map(([key, group]) => ({ key, ...group }))
}

function compareLabels(left: readonly (string | null)[], right: readonly (string | null)[]): number {
  const leftText = left.map((value) => value?.toLocaleLowerCase() ?? '\uffff').join('\u0000')
  const rightText = right.map((value) => value?.toLocaleLowerCase() ?? '\uffff').join('\u0000')
  if (leftText < rightText) return -1
  if (leftText > rightText) return 1
  return 0
}

function sortGroups(groups: readonly SnapshotGroup[], spec: AnalysisSpecV2): readonly SnapshotGroup[] {
  return [...groups].sort((left, right) => {
    if (spec.sort?.by === 'measure') {
      const measureOrder = left.count - right.count
      if (measureOrder !== 0) return spec.sort.direction === 'asc' ? measureOrder : -measureOrder
    }
    const labelOrder = compareLabels(left.labels, right.labels)
    if (labelOrder !== 0 && spec.sort?.direction === 'desc') return -labelOrder
    if (labelOrder !== 0) return labelOrder
    return left.key < right.key ? -1 : left.key > right.key ? 1 : 0
  })
}

function percentage(delta: number, denominator: number): number | null {
  if (denominator === 0) return null
  return (delta / denominator) * 100
}

function columns(spec: ValidatedAnalysisSpecV2, comparison: boolean): readonly AnalysisResultV2Column[] {
  return [
    ...spec.dimensions.map((dimension) => ({ key: dimension, dataType: 'string' as const })),
    { key: 'headcount' as const, dataType: 'integer' as const },
    ...(comparison ? [
      { key: 'comparisonHeadcount' as const, dataType: 'integer' as const },
      { key: 'delta' as const, dataType: 'integer' as const },
      { key: 'deltaPct' as const, dataType: 'number' as const },
    ] : []),
  ]
}

function rowValues(dimensions: readonly ValidatedAnalysisSpecV2['dimensions'][number][], labels: readonly (string | null)[], current: number, comparison?: number): AnalysisResultV2Row['values'] {
  const dimensionValues: Partial<Record<ValidatedAnalysisSpecV2['dimensions'][number], string | null>> = {}
  dimensions.forEach((dimension, index) => { dimensionValues[dimension] = labels[index] ?? null })
  if (comparison === undefined) return { dimensions: dimensionValues, headcount: current }
  const delta = current - comparison
  return { dimensions: dimensionValues, headcount: current, comparisonHeadcount: comparison, delta, deltaPct: percentage(delta, comparison) }
}

function executeGrouped(spec: ValidatedAnalysisSpecV2, current: readonly SnapshotEmployeeRecord[], previous: readonly SnapshotEmployeeRecord[] | null): AnalysisResultV2 {
  const currentGroups = groupRecords(current, spec.dimensions)
  if (previous === null) {
    const sorted = sortGroups(currentGroups, spec)
    const rows: AnalysisResultV2Row[] = spec.dimensions.length === 0
      ? [{ values: rowValues([], [], current.length) }]
      : sorted.slice(0, spec.limit).map((group) => ({ values: rowValues(spec.dimensions, group.labels, group.count) }))
    return {
      version: 2,
      source: 'workforce',
      entity: 'employees',
      measures: [ANALYSIS_MEASURE],
      dimensions: spec.dimensions,
      period: spec.period,
      comparison: null,
      metadata: { complete: true, matchedEmployeeCount: current.length, groupCount: currentGroups.length },
      columns: columns(spec, false),
      rows,
      summary: { headcount: current.length },
      presentationHints: { preferred: spec.presentation.intent === 'kpi' || (spec.presentation.intent === 'auto' && spec.dimensions.length === 0) ? 'kpi' : 'table', fallback: 'table' },
    }
  }

  const previousGroups = groupRecords(previous, spec.dimensions)
  const previousByKey = new Map(previousGroups.map((group) => [group.key, group]))
  const aligned = currentGroups.map((group) => ({ current: group, previous: previousByKey.get(group.key) }))
  for (const group of previousGroups) if (!currentGroups.some((currentGroup) => currentGroup.key === group.key)) aligned.push({ current: { key: group.key, values: group.values, labels: group.labels, count: 0 }, previous: group })
  const sorted = sortGroups(aligned.map(({ current, previous: previousGroup }) => ({ ...current, count: current.count, labels: current.labels, key: current.key, values: current.values, previousCount: previousGroup?.count ?? 0 } as SnapshotGroup & { readonly previousCount: number })), spec)
  const alignedByKey = new Map(aligned.map((item) => [item.current.key, item]))
  const rows = spec.dimensions.length === 0
    ? [{ values: rowValues([], [], current.length, previous.length) }]
    : sorted.slice(0, spec.limit).map((group) => {
      const item = alignedByKey.get(group.key)
      const previousCount = item?.previous?.count ?? 0
      return { values: rowValues(spec.dimensions, group.labels, group.count, previousCount) }
    })
  const delta = current.length - previous.length
  return {
    version: 2,
    source: 'workforce',
    entity: 'employees',
    measures: [ANALYSIS_MEASURE],
    dimensions: spec.dimensions,
    period: spec.period,
    comparison: spec.comparison,
    metadata: { complete: true, matchedEmployeeCount: current.length, comparisonMatchedEmployeeCount: previous.length, groupCount: currentGroups.length + previousGroups.filter((group) => !currentGroups.some((currentGroup) => currentGroup.key === group.key)).length },
    columns: columns(spec, true),
    rows,
    summary: { headcount: current.length, comparisonHeadcount: previous.length, delta, deltaPct: percentage(delta, previous.length) },
    presentationHints: { preferred: 'comparison', fallback: 'table' },
  }
}

export async function executeAnalysisSpecV2(spec: ValidatedAnalysisSpecV2, dependencies: AnalysisSnapshotExecutionDependencies = {}): Promise<AnalysisResultV2> {
  const context = await (dependencies.getContext ?? defaultContext)()
  const { hrGroupId, populationMode } = authorize(context)
  const retrieve = dependencies.retrieve ?? loadSnapshotSource
  const currentInput: LoadSnapshotSourceInput = { authContext: context, asOf: spec.period.asOf, populationMode }
  const currentSource = await retrieve(currentInput)
  assertSourceDate(currentSource, spec.period.asOf)
  const current = resolveSnapshotPopulation(currentSource, spec, { mode: populationMode, actorEmployeeId: context.employeeId })
  if (context.tenantId !== currentSource.rows[0]?.tenantId && currentSource.rows.length > 0) throw new AnalysisEngineError('ANALYSIS_SCOPE_VIOLATION', 403)
  if (hrGroupId !== currentSource.rows[0]?.hrGroupId && currentSource.rows.length > 0) throw new AnalysisEngineError('ANALYSIS_SCOPE_VIOLATION', 403)

  if (!spec.comparison) return executeGrouped(spec, current, null)
  const comparisonInput: LoadSnapshotSourceInput = { authContext: context, asOf: spec.comparison.period.asOf, populationMode }
  const comparisonSource = await retrieve(comparisonInput)
  assertSourceDate(comparisonSource, spec.comparison.period.asOf)
  const comparison = resolveSnapshotPopulation(comparisonSource, { ...spec, period: spec.comparison.period, comparison: null }, { mode: populationMode, actorEmployeeId: context.employeeId })
  if (context.tenantId !== comparisonSource.rows[0]?.tenantId && comparisonSource.rows.length > 0) throw new AnalysisEngineError('ANALYSIS_SCOPE_VIOLATION', 403)
  if (hrGroupId !== comparisonSource.rows[0]?.hrGroupId && comparisonSource.rows.length > 0) throw new AnalysisEngineError('ANALYSIS_SCOPE_VIOLATION', 403)
  return executeGrouped(spec, current, comparison)
}
