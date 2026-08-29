import { z } from 'zod'
import { AnalysisEngineError } from './analysis-errors'
import {
  ANALYSIS_ENTITY,
  ANALYSIS_MEASURE,
  ANALYSIS_SEMANTIC_VERSION,
  ANALYSIS_SOURCE,
  findSemanticDimension,
  findSemanticEntity,
  findSemanticFilter,
  findSemanticMeasure,
  type AnalysisDimensionKey,
  type AnalysisFilterOperator,
} from './analysis-semantic-layer'

export type AnalysisPresentation = 'auto' | 'kpi' | 'table'

export interface AnalysisFilter {
  readonly dimension: AnalysisDimensionKey
  readonly operator: AnalysisFilterOperator
  readonly value: string | readonly string[]
}

export interface AnalysisSort {
  readonly by: 'label' | 'value'
  readonly direction: 'asc' | 'desc'
}

export interface AnalysisSpecV1 {
  readonly version: 1
  readonly source: typeof ANALYSIS_SOURCE
  readonly entity: typeof ANALYSIS_ENTITY
  readonly measures: readonly [typeof ANALYSIS_MEASURE]
  readonly dimensions: readonly AnalysisDimensionKey[]
  readonly filters: readonly AnalysisFilter[]
  readonly sort: AnalysisSort | null
  readonly limit: number
  readonly presentation: AnalysisPresentation
}

declare const validatedAnalysisSpecBrand: unique symbol

export type ValidatedAnalysisSpec = AnalysisSpecV1 & {
  readonly [validatedAnalysisSpecBrand]: true
}

const safeIdentifier = z.string().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/)

const rawAnalysisFilterSchema = z.object({
  dimension: safeIdentifier,
  operator: safeIdentifier,
  value: z.unknown(),
}).strict()

const rawAnalysisSpecSchema = z.object({
  version: z.number().finite().int(),
  source: safeIdentifier,
  entity: safeIdentifier,
  measures: z.array(safeIdentifier).min(1).max(3),
  dimensions: z.array(safeIdentifier).max(3),
  filters: z.array(rawAnalysisFilterSchema).max(20),
  sort: z.object({
    by: z.enum(['label', 'value']),
    direction: z.enum(['asc', 'desc']),
  }).strict().nullable(),
  limit: z.number().finite().int().min(1).max(100),
  presentation: z.enum(['auto', 'kpi', 'table']),
}).strict()

const analysisFilterValueSchema = z.union([
  z.string().trim().min(1).max(160),
  z.array(z.string().trim().min(1).max(160)).min(1).max(100),
])

type RawAnalysisSpec = z.infer<typeof rawAnalysisSpecSchema>
type RawAnalysisFilter = RawAnalysisSpec['filters'][number]

function specError(code: ConstructorParameters<typeof AnalysisEngineError>[0], message = code): never {
  throw new AnalysisEngineError(code, 400, message)
}

function duplicate(values: readonly string[]): boolean {
  return new Set(values).size !== values.length
}

function normalizeFilter(rawFilter: RawAnalysisFilter, entity: NonNullable<ReturnType<typeof findSemanticEntity>>): AnalysisFilter {
  const filterDefinition = findSemanticFilter(entity, rawFilter.dimension)
  if (!filterDefinition) specError('ANALYSIS_UNSUPPORTED_FILTER')

  const operator: AnalysisFilterOperator = rawFilter.operator === 'eq'
    ? 'eq'
    : rawFilter.operator === 'in'
      ? 'in'
      : specError('ANALYSIS_INVALID_OPERATOR')

  if (!filterDefinition.allowedOperators.includes(operator)) specError('ANALYSIS_INVALID_OPERATOR')

  const parsedValue = analysisFilterValueSchema.safeParse(rawFilter.value)
  if (!parsedValue.success) specError('ANALYSIS_INVALID_FILTER_VALUE')

  const value = parsedValue.data
  if ((operator === 'eq' && Array.isArray(value)) || (operator === 'in' && typeof value === 'string')) {
    specError('ANALYSIS_INVALID_FILTER_VALUE')
  }

  const values = typeof value === 'string' ? [value] : value
  if (filterDefinition.allowedValues && values.some((candidate) => !filterDefinition.allowedValues?.includes(candidate))) {
    specError('ANALYSIS_INVALID_FILTER_VALUE')
  }

  return {
    dimension: filterDefinition.key,
    operator,
    value: typeof value === 'string' ? value : [...new Set(value)],
  }
}

export function validateAnalysisSpec(input: unknown): ValidatedAnalysisSpec {
  const parsed = rawAnalysisSpecSchema.safeParse(input)
  if (!parsed.success) specError('ANALYSIS_SPEC_INVALID')
  const raw = parsed.data

  if (raw.version !== ANALYSIS_SEMANTIC_VERSION) specError('ANALYSIS_UNSUPPORTED_SPEC_VERSION')
  if (raw.source !== ANALYSIS_SOURCE) specError('ANALYSIS_UNSUPPORTED_SOURCE')
  if (raw.entity !== ANALYSIS_ENTITY) specError('ANALYSIS_UNSUPPORTED_ENTITY')

  const entity = findSemanticEntity(raw.entity)
  if (!entity) specError('ANALYSIS_UNSUPPORTED_ENTITY')
  if (entity.source !== raw.source) specError('ANALYSIS_UNSUPPORTED_SOURCE')

  if (duplicate(raw.measures)) specError('ANALYSIS_SPEC_INVALID')
  const measures = raw.measures.map((key) => {
    const measure = findSemanticMeasure(entity, key)
    if (!measure) specError('ANALYSIS_UNSUPPORTED_MEASURE')
    return measure.key
  })
  if (measures.length !== 1 || measures[0] !== ANALYSIS_MEASURE) specError('ANALYSIS_UNSUPPORTED_MEASURE')

  if (duplicate(raw.dimensions)) specError('ANALYSIS_SPEC_INVALID')
  const dimensions = raw.dimensions.map((key) => {
    const dimension = findSemanticDimension(entity, key)
    if (!dimension) specError('ANALYSIS_UNSUPPORTED_DIMENSION')
    return dimension.key
  })
  const measure = findSemanticMeasure(entity, ANALYSIS_MEASURE)
  if (!measure) specError('ANALYSIS_UNSUPPORTED_MEASURE')
  if (dimensions.length > 1 || dimensions.some((dimension) => !measure.allowedDimensions.includes(dimension))) {
    specError('ANALYSIS_INCOMPATIBLE_MEASURE_DIMENSION')
  }
  if (raw.presentation === 'kpi' && dimensions.length > 0) specError('ANALYSIS_INCOMPATIBLE_PRESENTATION')

  const filters = raw.filters.map((filter) => normalizeFilter(filter, entity))
  const spec: AnalysisSpecV1 = {
    version: 1,
    source: ANALYSIS_SOURCE,
    entity: ANALYSIS_ENTITY,
    measures: [ANALYSIS_MEASURE],
    dimensions,
    filters,
    sort: raw.sort,
    limit: raw.limit,
    presentation: raw.presentation,
  }

  return Object.freeze(spec) as ValidatedAnalysisSpec
}
