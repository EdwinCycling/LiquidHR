import { z } from 'zod'
import { AnalysisEngineError } from './analysis-errors'
import { SavedAnalysisError } from './saved-analysis-errors'
import { validateAnalysisSpec, type ValidatedAnalysisSpec } from './analysis-spec'

export const SAVED_ANALYSIS_NAME_MAX_LENGTH = 120 as const

const savedAnalysisNameSchema = z.string().trim().min(1).max(SAVED_ANALYSIS_NAME_MAX_LENGTH)
const savedAnalysisIdSchema = z.string().uuid()

export interface SavedAnalysisCreateInput {
  readonly name: string
  readonly analysisSpec: ValidatedAnalysisSpec
}

export interface SavedAnalysisUpdateInput {
  readonly name?: string
  readonly analysisSpec?: ValidatedAnalysisSpec
}

export interface SavedAnalysisListItem {
  readonly id: string
  readonly name: string
  readonly createdAt: string
  readonly updatedAt: string
}

export interface SavedAnalysisDefinition extends SavedAnalysisListItem {
  readonly spec: ValidatedAnalysisSpec
}

const savedAnalysisCreatePayloadSchema = z.object({
  name: z.unknown(),
  analysisSpec: z.unknown(),
}).strict()

const savedAnalysisUpdatePayloadSchema = z.object({
  name: z.unknown().optional(),
  analysisSpec: z.unknown().optional(),
}).strict()

type SavedAnalysisPersistenceProjection = {
  readonly id: unknown
  readonly name: unknown
  readonly analysis_spec: unknown
  readonly definition_version: unknown
  readonly created_at: unknown
  readonly updated_at: unknown
}

const savedAnalysisPersistenceProjectionSchema = z.object({
  id: savedAnalysisIdSchema,
  name: savedAnalysisNameSchema,
  analysis_spec: z.unknown(),
  definition_version: z.number().int().positive(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
}).strict()

const savedAnalysisListProjectionSchema = z.object({
  id: savedAnalysisIdSchema,
  name: savedAnalysisNameSchema,
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
}).strict()

function inputError(): never {
  throw new SavedAnalysisError('SAVED_ANALYSIS_INPUT_INVALID', 400)
}

function definitionError(): never {
  throw new SavedAnalysisError('SAVED_ANALYSIS_DEFINITION_INVALID', 500)
}

function validateStoredSpec(spec: unknown, definitionVersion: number): ValidatedAnalysisSpec {
  try {
    const validated = validateAnalysisSpec(spec)
    if (validated.version !== definitionVersion) definitionError()
    return validated
  } catch (error) {
    if (error instanceof SavedAnalysisError) throw error
    if (error instanceof AnalysisEngineError) definitionError()
    definitionError()
  }
}

export function parseSavedAnalysisId(input: unknown): string {
  const parsed = savedAnalysisIdSchema.safeParse(input)
  if (!parsed.success) throw new SavedAnalysisError('SAVED_ANALYSIS_INVALID_ID', 400)
  return parsed.data
}

export function validateSavedAnalysisCreateInput(input: unknown): SavedAnalysisCreateInput {
  const parsed = savedAnalysisCreatePayloadSchema.safeParse(input)
  if (!parsed.success) inputError()

  const name = savedAnalysisNameSchema.safeParse(parsed.data.name)
  if (!name.success) inputError()

  return {
    name: name.data,
    analysisSpec: validateAnalysisSpec(parsed.data.analysisSpec),
  }
}

export function validateSavedAnalysisUpdateInput(input: unknown): SavedAnalysisUpdateInput {
  const parsed = savedAnalysisUpdatePayloadSchema.safeParse(input)
  if (!parsed.success) inputError()

  const hasName = Object.prototype.hasOwnProperty.call(parsed.data, 'name')
  const hasAnalysisSpec = Object.prototype.hasOwnProperty.call(parsed.data, 'analysisSpec')
  if (!hasName && !hasAnalysisSpec) inputError()

  let normalizedName: string | undefined
  if (hasName) {
    const name = savedAnalysisNameSchema.safeParse(parsed.data.name)
    if (!name.success) inputError()
    normalizedName = name.data
  }

  return {
    ...(normalizedName === undefined ? {} : { name: normalizedName }),
    ...(hasAnalysisSpec ? { analysisSpec: validateAnalysisSpec(parsed.data.analysisSpec) } : {}),
  }
}

function projectionWithoutScope(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) return input
  const candidate = input as Record<string, unknown>
  return {
    id: candidate.id,
    name: candidate.name,
    analysis_spec: candidate.analysis_spec,
    definition_version: candidate.definition_version,
    created_at: candidate.created_at,
    updated_at: candidate.updated_at,
  }
}

function listProjectionWithoutScope(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) return input
  const candidate = input as Record<string, unknown>
  return {
    id: candidate.id,
    name: candidate.name,
    created_at: candidate.created_at,
    updated_at: candidate.updated_at,
  }
}

export function parseSavedAnalysisRow(input: unknown): SavedAnalysisDefinition {
  const parsed = savedAnalysisPersistenceProjectionSchema.safeParse(projectionWithoutScope(input))
  if (!parsed.success) definitionError()

  return {
    id: parsed.data.id,
    name: parsed.data.name,
    spec: validateStoredSpec(parsed.data.analysis_spec, parsed.data.definition_version),
    createdAt: parsed.data.created_at,
    updatedAt: parsed.data.updated_at,
  }
}

export function parseSavedAnalysisListRow(input: unknown): SavedAnalysisListItem {
  const parsed = savedAnalysisListProjectionSchema.safeParse(listProjectionWithoutScope(input))
  if (!parsed.success) {
    throw new SavedAnalysisError('SAVED_ANALYSIS_DATA_INVALID', 500)
  }

  return {
    id: parsed.data.id,
    name: parsed.data.name,
    createdAt: parsed.data.created_at,
    updatedAt: parsed.data.updated_at,
  }
}

export type { SavedAnalysisPersistenceProjection }
