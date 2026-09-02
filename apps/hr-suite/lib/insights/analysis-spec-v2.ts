import { z } from 'zod'
import { AnalysisEngineError } from './analysis-errors'
import {
  ANALYSIS_ENTITY,
  ANALYSIS_MEASURE,
  ANALYSIS_SOURCE,
  EMPLOYMENT_TYPE_VALUES,
  findAnalysisV2Dimension,
  findAnalysisV2Filter,
  type AnalysisEmploymentType,
  type AnalysisV2DimensionKey,
  type AnalysisV2FilterDimensionKey,
} from './analysis-semantic-layer'

export type DateOnly = string & { readonly __dateOnly: unique symbol }
export type AnalysisV2PresentationIntent = 'auto' | 'kpi' | 'table' | 'comparison'

export interface AnalysisV2Presentation {
  readonly intent: AnalysisV2PresentationIntent
}

export interface AnalysisV2Filter {
  readonly dimension: AnalysisV2FilterDimensionKey
  readonly operator: 'eq' | 'in'
  readonly value: string | readonly string[]
}

export type AnalysisV2Sort =
  | { readonly by: 'label'; readonly direction: 'asc' | 'desc' }
  | { readonly by: 'measure'; readonly measure: typeof ANALYSIS_MEASURE; readonly direction: 'asc' | 'desc' }

export interface AnalysisV2Period {
  readonly kind: 'snapshot'
  readonly asOf: DateOnly
}

export interface AnalysisV2Comparison {
  readonly kind: 'explicit_period'
  readonly period: AnalysisV2Period
}

export interface AnalysisSpecV2 {
  readonly version: 2
  readonly source: typeof ANALYSIS_SOURCE
  readonly entity: typeof ANALYSIS_ENTITY
  readonly measures: readonly [typeof ANALYSIS_MEASURE]
  readonly dimensions: readonly AnalysisV2DimensionKey[]
  readonly filters: readonly AnalysisV2Filter[]
  readonly period: AnalysisV2Period
  readonly comparison: AnalysisV2Comparison | null
  readonly sort: AnalysisV2Sort | null
  readonly limit: number
  readonly presentation: AnalysisV2Presentation
}

declare const validatedAnalysisSpecV2Brand: unique symbol
export type ValidatedAnalysisSpecV2 = AnalysisSpecV2 & {
  readonly [validatedAnalysisSpecV2Brand]: true
}

const rawDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const rawFilterSchema = z.object({
  dimension: z.string(),
  operator: z.string(),
  value: z.unknown(),
}).strict()
const rawPeriodSchema = z.object({ kind: z.string(), asOf: z.string() }).strict()
const rawComparisonSchema = z.object({ kind: z.string(), period: rawPeriodSchema }).strict()
const rawSortSchema = z.union([
  z.object({ by: z.literal('label'), direction: z.enum(['asc', 'desc']) }).strict(),
  z.object({ by: z.literal('measure'), measure: z.string(), direction: z.enum(['asc', 'desc']) }).strict(),
]).nullable()
const rawSpecSchema = z.object({
  version: z.number().finite().int(),
  source: z.string(),
  entity: z.string(),
  measures: z.array(z.string()).min(1).max(3),
  dimensions: z.array(z.string()).max(2),
  filters: z.array(rawFilterSchema).max(8),
  period: rawPeriodSchema,
  comparison: rawComparisonSchema.nullable(),
  sort: rawSortSchema,
  limit: z.number().finite().int().min(1).max(100),
  presentation: z.object({ intent: z.enum(['auto', 'kpi', 'table', 'comparison']) }).strict(),
}).strict()

const filterValueSchema = z.union([
  z.string().trim().min(1).max(160),
  z.array(z.string().trim().min(1).max(160)).min(1).max(100),
])

function specError(code: ConstructorParameters<typeof AnalysisEngineError>[0]): never {
  throw new AnalysisEngineError(code, 400)
}

function isDateOnly(value: string): value is DateOnly {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function parsePeriod(value: z.infer<typeof rawPeriodSchema>): AnalysisV2Period {
  if (value.kind !== 'snapshot') specError('ANALYSIS_SPEC_INVALID')
  if (!rawDateSchema.safeParse(value.asOf).success || !isDateOnly(value.asOf)) specError('ANALYSIS_INVALID_DATE')
  return { kind: 'snapshot', asOf: value.asOf }
}

function normalizeFilter(rawFilter: z.infer<typeof rawFilterSchema>): AnalysisV2Filter {
  const filterDefinition = findAnalysisV2Filter(rawFilter.dimension)
  if (!filterDefinition) specError('ANALYSIS_UNSUPPORTED_FILTER')
  if (rawFilter.operator !== 'eq' && rawFilter.operator !== 'in') specError('ANALYSIS_INVALID_OPERATOR')
  if (!filterDefinition.allowedOperators.includes(rawFilter.operator)) specError('ANALYSIS_INVALID_OPERATOR')
  const parsedValue = filterValueSchema.safeParse(rawFilter.value)
  if (!parsedValue.success) specError('ANALYSIS_INVALID_FILTER_VALUE')
  const value = parsedValue.data
  if ((rawFilter.operator === 'eq' && Array.isArray(value)) || (rawFilter.operator === 'in' && typeof value === 'string')) {
    specError('ANALYSIS_INVALID_FILTER_VALUE')
  }
  const values = typeof value === 'string' ? [value] : value
  if (filterDefinition.allowedValues && values.some((candidate) => !filterDefinition.allowedValues?.includes(candidate))) {
    if (rawFilter.dimension === 'employment_status') specError('ANALYSIS_UNSUPPORTED_FILTER_VALUE')
    specError('ANALYSIS_INVALID_FILTER_VALUE')
  }
  return {
    dimension: filterDefinition.key,
    operator: rawFilter.operator,
    value: typeof value === 'string' ? value : [...new Set(value)],
  }
}

export function validateAnalysisSpecV2(input: unknown): ValidatedAnalysisSpecV2 {
  const parsed = rawSpecSchema.safeParse(input)
  if (!parsed.success) specError('ANALYSIS_SPEC_INVALID')
  const raw = parsed.data
  if (raw.version !== 2) specError('ANALYSIS_UNSUPPORTED_SPEC_VERSION')
  if (raw.source !== ANALYSIS_SOURCE) specError('ANALYSIS_UNSUPPORTED_SOURCE')
  if (raw.entity !== ANALYSIS_ENTITY) specError('ANALYSIS_UNSUPPORTED_ENTITY')
  if (raw.measures.length !== 1 || raw.measures[0] !== ANALYSIS_MEASURE) specError('ANALYSIS_UNSUPPORTED_MEASURE')
  if (new Set(raw.dimensions).size !== raw.dimensions.length) specError('ANALYSIS_SPEC_INVALID')
  const dimensions = raw.dimensions.map((key) => {
    const dimension = findAnalysisV2Dimension(key)
    if (!dimension) specError('ANALYSIS_UNSUPPORTED_DIMENSION')
    return dimension.key
  })
  const filters = raw.filters.map(normalizeFilter)
  if (new Set(filters.map((filter) => filter.dimension)).size !== filters.length) specError('ANALYSIS_SPEC_INVALID')
  if (raw.presentation.intent === 'kpi' && dimensions.length > 0) specError('ANALYSIS_INCOMPATIBLE_PRESENTATION')
  const period = parsePeriod(raw.period)
  let comparison: AnalysisV2Comparison | null = null
  if (raw.comparison !== null) {
    if (raw.comparison.kind !== 'explicit_period') specError('ANALYSIS_SPEC_INVALID')
    const comparisonPeriod = parsePeriod(raw.comparison.period)
    if (comparisonPeriod.asOf === period.asOf) specError('ANALYSIS_COMPARISON_SAME_DATE')
    comparison = { kind: 'explicit_period', period: comparisonPeriod }
  }
  if (raw.sort !== null && raw.sort.by === 'measure' && raw.sort.measure !== ANALYSIS_MEASURE) {
    specError('ANALYSIS_UNSUPPORTED_MEASURE')
  }
  const spec: AnalysisSpecV2 = {
    version: 2,
    source: ANALYSIS_SOURCE,
    entity: ANALYSIS_ENTITY,
    measures: [ANALYSIS_MEASURE],
    dimensions,
    filters,
    period,
    comparison,
    sort: raw.sort === null ? null : raw.sort.by === 'label'
      ? { by: 'label', direction: raw.sort.direction }
      : { by: 'measure', measure: ANALYSIS_MEASURE, direction: raw.sort.direction },
    limit: raw.limit,
    presentation: { intent: raw.presentation.intent },
  }
  return Object.freeze(spec) as ValidatedAnalysisSpecV2
}

export function isAnalysisEmploymentType(value: string): value is AnalysisEmploymentType {
  return EMPLOYMENT_TYPE_VALUES.includes(value as AnalysisEmploymentType)
}
