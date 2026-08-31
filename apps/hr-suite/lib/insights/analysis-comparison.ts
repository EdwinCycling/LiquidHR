import 'server-only'

import { z } from 'zod'
import { AnalysisEngineError } from './analysis-errors'
import {
  dimensionValue,
  executeAnalysisSpec,
  filterAnalysisRecords,
  loadAuthorizedAnalysisData,
  type AnalysisExecutionDependencies,
} from './analysis-engine'
import type { AnalysisDimensionKey } from './analysis-semantic-layer'
import { findSemanticDimension, findSemanticEntity } from './analysis-semantic-layer'
import { validateAnalysisSpec, type ValidatedAnalysisSpec } from './analysis-spec'
import type { AnalysisResult } from './analysis-result'

const safeIdentifier = z.string().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/)
const comparisonValueSchema = z.string().trim().min(1).max(160)

export interface ValidatedAnalysisComparisonRequest {
  readonly analysisSpec: ValidatedAnalysisSpec
  readonly comparisonDimension: AnalysisDimensionKey
  readonly comparisonValues: readonly [string, string]
}

export interface AnalysisComparisonRow {
  readonly dimension: string | null
  readonly left: number
  readonly right: number
  readonly difference: number
}

export interface AnalysisComparisonResult {
  readonly version: 1
  readonly comparisonDimension: AnalysisDimensionKey
  readonly comparisonValues: readonly [string, string]
  readonly breakdownDimension: AnalysisDimensionKey | null
  readonly rows: readonly AnalysisComparisonRow[]
  readonly summary: {
    readonly left: number
    readonly right: number
    readonly difference: number
  }
  readonly presentation: 'kpi' | 'table'
}

export type ComparisonRequest = ValidatedAnalysisComparisonRequest
export type ComparisonResult = AnalysisComparisonResult

const analysisComparisonRequestSchema = z.object({
  analysisSpec: z.unknown(),
  comparisonDimension: safeIdentifier,
  comparisonValues: z.array(comparisonValueSchema).length(2),
}).strict()

function comparisonError(code: ConstructorParameters<typeof AnalysisEngineError>[0]): never {
  throw new AnalysisEngineError(code, 400)
}

export function validateAnalysisComparisonRequest(input: unknown): ValidatedAnalysisComparisonRequest {
  const parsed = analysisComparisonRequestSchema.safeParse(input)
  if (!parsed.success) comparisonError('ANALYSIS_COMPARISON_INVALID_REQUEST')

  let analysisSpec: ValidatedAnalysisSpec
  try {
    analysisSpec = validateAnalysisSpec(parsed.data.analysisSpec)
  } catch {
    comparisonError('ANALYSIS_COMPARISON_INVALID_REQUEST')
  }

  const comparisonDimension = parsed.data.comparisonDimension as AnalysisDimensionKey
  const entity = findSemanticEntity(analysisSpec.entity)
  if (!entity || !findSemanticDimension(entity, comparisonDimension)) {
    comparisonError('ANALYSIS_COMPARISON_DIMENSION_INVALID')
  }
  if (analysisSpec.dimensions.includes(comparisonDimension)
    || analysisSpec.filters.some((filter) => filter.dimension === comparisonDimension)) {
    comparisonError('ANALYSIS_COMPARISON_CONTEXT_CONFLICT')
  }

  const [left, right] = parsed.data.comparisonValues
  if (!left || !right || left === right) comparisonError('ANALYSIS_COMPARISON_INVALID_REQUEST')
  return { analysisSpec, comparisonDimension, comparisonValues: [left, right] }
}

export function buildComparisonSpecs(request: ValidatedAnalysisComparisonRequest): readonly [ValidatedAnalysisSpec, ValidatedAnalysisSpec] {
  const [left, right] = request.comparisonValues
  try {
    return [
      validateAnalysisSpec({
        ...request.analysisSpec,
        filters: [...request.analysisSpec.filters, { dimension: request.comparisonDimension, operator: 'eq', value: left }],
      }),
      validateAnalysisSpec({
        ...request.analysisSpec,
        filters: [...request.analysisSpec.filters, { dimension: request.comparisonDimension, operator: 'eq', value: right }],
      }),
    ]
  } catch {
    comparisonError('ANALYSIS_COMPARISON_CONTEXT_CONFLICT')
  }
}

function compareLabels(left: string | null, right: string | null): number {
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1
  const leftNormalized = left.toLowerCase()
  const rightNormalized = right.toLowerCase()
  if (leftNormalized < rightNormalized) return -1
  if (leftNormalized > rightNormalized) return 1
  return left < right ? -1 : left > right ? 1 : 0
}

function resultGroups(result: AnalysisResult): Map<string, { readonly label: string | null; readonly count: number }> {
  return new Map(result.rows.map((row) => {
    const label = row.values.dimension ?? null
    return [label === null ? '__ANALYSIS_NULL__' : label, { label, count: row.values.headcount }]
  }))
}

function alignComparison(
  request: ValidatedAnalysisComparisonRequest,
  leftResult: AnalysisResult,
  rightResult: AnalysisResult,
): AnalysisComparisonResult {
  const breakdownDimension = request.analysisSpec.dimensions[0] ?? null
  if (!breakdownDimension) {
    const left = leftResult.summary.headcount
    const right = rightResult.summary.headcount
    return {
      version: 1,
      comparisonDimension: request.comparisonDimension,
      comparisonValues: request.comparisonValues,
      breakdownDimension: null,
      rows: [],
      summary: { left, right, difference: left - right },
      presentation: 'kpi',
    }
  }

  const leftGroups = resultGroups(leftResult)
  const rightGroups = resultGroups(rightResult)
  const labels = [...new Set([...leftGroups.keys(), ...rightGroups.keys()])]
    .map((key) => leftGroups.get(key)?.label ?? rightGroups.get(key)?.label ?? null)
    .sort((left, right) => {
      if (request.analysisSpec.sort?.by === 'label') {
        const order = compareLabels(left, right)
        return request.analysisSpec.sort.direction === 'asc' ? order : -order
      }
      const leftCount = Math.max(leftGroups.get(left ?? '__ANALYSIS_NULL__')?.count ?? 0, rightGroups.get(left ?? '__ANALYSIS_NULL__')?.count ?? 0)
      const rightCount = Math.max(leftGroups.get(right ?? '__ANALYSIS_NULL__')?.count ?? 0, rightGroups.get(right ?? '__ANALYSIS_NULL__')?.count ?? 0)
      if (leftCount !== rightCount) {
        const direction = request.analysisSpec.sort?.direction ?? 'desc'
        return direction === 'asc' ? leftCount - rightCount : rightCount - leftCount
      }
      return compareLabels(left, right)
    })

  const rows = labels.slice(0, request.analysisSpec.limit).map((label) => {
    const key = label === null ? '__ANALYSIS_NULL__' : label
    const left = leftGroups.get(key)?.count ?? 0
    const right = rightGroups.get(key)?.count ?? 0
    return { dimension: label, left, right, difference: left - right }
  })
  return {
    version: 1,
    comparisonDimension: request.comparisonDimension,
    comparisonValues: request.comparisonValues,
    breakdownDimension,
    rows,
    summary: { left: leftResult.summary.headcount, right: rightResult.summary.headcount, difference: leftResult.summary.headcount - rightResult.summary.headcount },
    presentation: 'table',
  }
}

export async function executeAnalysisComparison(
  input: unknown,
  dependencies: AnalysisExecutionDependencies = {},
): Promise<AnalysisComparisonResult> {
  const request = validateAnalysisComparisonRequest(input)
  const authorized = await loadAuthorizedAnalysisData(dependencies)
  const eligibleRecords = filterAnalysisRecords(authorized.records, request.analysisSpec.filters)
  const availableValues = new Set(eligibleRecords
    .map((record) => dimensionValue(record, request.comparisonDimension))
    .filter((value): value is string => value !== null))
  if (request.comparisonValues.some((value) => !availableValues.has(value))) {
    comparisonError('ANALYSIS_COMPARISON_VALUE_NOT_AUTHORIZED')
  }

  const [leftSpec, rightSpec] = buildComparisonSpecs(request)
  const sharedDependencies: AnalysisExecutionDependencies = {
    getContext: async () => authorized.context,
    retrieve: async () => authorized.records,
  }
  const [leftResult, rightResult] = await Promise.all([
    executeAnalysisSpec(leftSpec, sharedDependencies),
    executeAnalysisSpec(rightSpec, sharedDependencies),
  ])
  return alignComparison(request, leftResult, rightResult)
}
