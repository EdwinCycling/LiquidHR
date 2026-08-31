import { z } from 'zod'
import { AnalysisEngineError } from './analysis-errors'
import { findSemanticDimension, findSemanticEntity, type AnalysisDimensionKey } from './analysis-semantic-layer'
import { validateAnalysisSpec, type AnalysisFilter, type ValidatedAnalysisSpec } from './analysis-spec'

const safeIdentifier = z.string().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/)
const contextValueSchema = z.string().trim().min(1).max(160)

export interface ValidatedAnalysisDrillRequest {
  readonly analysisSpec: ValidatedAnalysisSpec
  readonly contextDimension: AnalysisDimensionKey
  readonly contextValue: string
  readonly nextDimension: AnalysisDimensionKey
}

const analysisDrillRequestSchema = z.object({
  analysisSpec: z.unknown(),
  contextDimension: safeIdentifier,
  contextValue: contextValueSchema,
  nextDimension: safeIdentifier,
}).strict()

function drillError(code: ConstructorParameters<typeof AnalysisEngineError>[0]): never {
  throw new AnalysisEngineError(code, 400)
}

export function validateAnalysisDrillRequest(input: unknown): ValidatedAnalysisDrillRequest {
  const parsed = analysisDrillRequestSchema.safeParse(input)
  if (!parsed.success) drillError('ANALYSIS_DRILL_INVALID_REQUEST')

  let analysisSpec: ValidatedAnalysisSpec
  try {
    analysisSpec = validateAnalysisSpec(parsed.data.analysisSpec)
  } catch {
    drillError('ANALYSIS_DRILL_INVALID_REQUEST')
  }

  const contextDimension = parsed.data.contextDimension as AnalysisDimensionKey
  const nextDimension = parsed.data.nextDimension as AnalysisDimensionKey
  const entity = findSemanticEntity(analysisSpec.entity)
  if (!entity || !findSemanticDimension(entity, contextDimension)) drillError('ANALYSIS_DRILL_CONTEXT_INVALID')
  if (analysisSpec.dimensions.length !== 1 || analysisSpec.dimensions[0] !== contextDimension) {
    drillError('ANALYSIS_DRILL_CONTEXT_INVALID')
  }
  if (!entity || !findSemanticDimension(entity, nextDimension) || nextDimension === contextDimension) {
    drillError('ANALYSIS_DRILL_DIMENSION_INVALID')
  }

  return {
    analysisSpec,
    contextDimension,
    contextValue: parsed.data.contextValue,
    nextDimension,
  }
}

function valuesEqual(left: string | readonly string[], right: string): boolean {
  return typeof left === 'string' ? left === right : left.includes(right)
}

function filtersEqual(left: AnalysisFilter, right: AnalysisFilter): boolean {
  if (left.dimension !== right.dimension || left.operator !== right.operator) return false
  if (typeof left.value === 'string' || typeof right.value === 'string') return left.value === right.value
  return left.value.length === right.value.length && left.value.every((value, index) => value === right.value[index])
}

function deduplicateFilters(filters: readonly AnalysisFilter[]): readonly AnalysisFilter[] {
  return filters.filter((filter, index) => filters.findIndex((candidate) => filtersEqual(candidate, filter)) === index)
}

export function buildDrilledAnalysisSpec(request: ValidatedAnalysisDrillRequest): ValidatedAnalysisSpec {
  const contextFilters = request.analysisSpec.filters.filter((filter) => filter.dimension === request.contextDimension)
  const hasMatchingContext = contextFilters.some((filter) => valuesEqual(filter.value, request.contextValue))
  const hasConflictingContext = contextFilters.some((filter) => !valuesEqual(filter.value, request.contextValue))
  if (hasConflictingContext) drillError('ANALYSIS_DRILL_CONFLICT')

  const filters = hasMatchingContext
    ? deduplicateFilters(request.analysisSpec.filters)
    : deduplicateFilters([
      ...request.analysisSpec.filters,
      { dimension: request.contextDimension, operator: 'eq', value: request.contextValue },
    ])

  try {
    return validateAnalysisSpec({
      ...request.analysisSpec,
      dimensions: [request.nextDimension],
      filters,
    })
  } catch {
    drillError('ANALYSIS_DRILL_CONFLICT')
  }
}
