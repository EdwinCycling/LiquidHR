import 'server-only'

import type { Json } from '@scope/db'
import { AuthorizationError, getRequestAuthorizationContext, requireHrGroupId, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { ANALYSIS_PERMISSION } from './analysis-contract'
import {
  parseSavedAnalysisId,
  parseSavedAnalysisListRow,
  parseSavedAnalysisRow,
  validateSavedAnalysisCreateInput,
  validateSavedAnalysisUpdateInput,
  type SavedAnalysisCreateInput,
  type SavedAnalysisDefinition,
  type SavedAnalysisListItem,
  type SavedAnalysisUpdateInput,
} from './saved-analysis-definition'
import { SavedAnalysisError } from './saved-analysis-errors'

const SAVED_ANALYSIS_TABLE = 'saved_analysis_definitions' as const
const SAVED_ANALYSIS_SELECT = 'id,tenant_id,hr_group_id,owner_user_id,name,analysis_spec,definition_version,created_at,updated_at' as const
export const SAVED_ANALYSIS_LIST_LIMIT = 100 as const
// The forward migration is intentionally not applied in this candidate. The
// existing V1-only database constraint must never turn a V2 save into a
// database error or become externally usable before that migration is gated.
export const SAVED_ANALYSIS_V2_PERSISTENCE_ENABLED = false as const

export interface SavedAnalysisPersistenceRow {
  readonly id: string
  readonly tenant_id: string
  readonly hr_group_id: string
  readonly owner_user_id: string
  readonly name: string
  readonly analysis_spec: Json
  readonly definition_version: number
  readonly created_at: string
  readonly updated_at: string
}

export interface SavedAnalysisScope {
  readonly tenantId: string
  readonly hrGroupId: string
  readonly ownerUserId: string
}

export interface SavedAnalysisRepositoryInput {
  readonly name?: string
  readonly analysisSpec?: Json
}

export interface SavedAnalysisRepository {
  list: (scope: SavedAnalysisScope) => Promise<readonly SavedAnalysisPersistenceRow[]>
  get: (scope: SavedAnalysisScope, id: string) => Promise<SavedAnalysisPersistenceRow | null>
  create: (scope: SavedAnalysisScope, input: { readonly name: string; readonly analysisSpec: Json; readonly definitionVersion: number }) => Promise<SavedAnalysisPersistenceRow>
  update: (scope: SavedAnalysisScope, id: string, input: SavedAnalysisRepositoryInput) => Promise<SavedAnalysisPersistenceRow | null>
  delete: (scope: SavedAnalysisScope, id: string) => Promise<boolean>
}

type QueryResult<T> = {
  readonly data: T | null
  readonly error: unknown | null
}

type SavedAnalysisQuery = {
  select: (columns: string) => SavedAnalysisQuery
  eq: (column: string, value: string) => SavedAnalysisQuery
  order: (column: 'updated_at', options: { readonly ascending: boolean }) => SavedAnalysisQuery
  limit: (count: number) => Promise<QueryResult<readonly SavedAnalysisPersistenceRow[]>>
  maybeSingle: () => Promise<QueryResult<SavedAnalysisPersistenceRow>>
  single: () => Promise<QueryResult<SavedAnalysisPersistenceRow>>
  insert: (payload: SavedAnalysisPersistenceInsert) => SavedAnalysisQuery
  update: (payload: SavedAnalysisPersistenceUpdate) => SavedAnalysisQuery
  delete: () => SavedAnalysisQuery
}

type SavedAnalysisClient = {
  from: (table: typeof SAVED_ANALYSIS_TABLE) => SavedAnalysisQuery
}

type SavedAnalysisPersistenceInsert = {
  readonly tenant_id: string
  readonly hr_group_id: string
  readonly owner_user_id: string
  readonly name: string
  readonly analysis_spec: Json
  readonly definition_version: number
}

type SavedAnalysisPersistenceUpdate = {
  readonly name?: string
  readonly analysis_spec?: Json
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>
export interface SavedAnalysisAuthorization {
  readonly supabase: SupabaseServerClient
  readonly context: AuthContext
}

export interface SavedAnalysisServiceDependencies {
  readonly getAuthorization?: () => Promise<SavedAnalysisAuthorization>
  readonly repository?: SavedAnalysisRepository
}

function asSavedAnalysisClient(client: unknown): SavedAnalysisClient {
  return client as unknown as SavedAnalysisClient
}

function persistenceError(code: 'SAVED_ANALYSIS_READ_FAILED' | 'SAVED_ANALYSIS_SAVE_FAILED' | 'SAVED_ANALYSIS_UPDATE_FAILED' | 'SAVED_ANALYSIS_DELETE_FAILED'): never {
  throw new SavedAnalysisError(code, 500)
}

/**
 * Direct browser access is disabled because the selected HR-group lives in a
 * server-side cookie context rather than in auth.jwt(). The active context,
 * permission, owner and tenant/group scope are checked before this narrow
 * server-only persistence seam is constructed.
 */
function createSupabaseRepository(): SavedAnalysisRepository {
  const savedAnalysisClient = asSavedAnalysisClient(createAdminClient())

  return {
    async list(scope) {
      const { data, error } = await savedAnalysisClient
        .from(SAVED_ANALYSIS_TABLE)
        .select(SAVED_ANALYSIS_SELECT)
        .eq('tenant_id', scope.tenantId)
        .eq('hr_group_id', scope.hrGroupId)
        .eq('owner_user_id', scope.ownerUserId)
        .order('updated_at', { ascending: false })
        .limit(SAVED_ANALYSIS_LIST_LIMIT)
      if (error) persistenceError('SAVED_ANALYSIS_READ_FAILED')
      return data ?? []
    },

    async get(scope, id) {
      const { data, error } = await savedAnalysisClient
        .from(SAVED_ANALYSIS_TABLE)
        .select(SAVED_ANALYSIS_SELECT)
        .eq('id', id)
        .eq('tenant_id', scope.tenantId)
        .eq('hr_group_id', scope.hrGroupId)
        .eq('owner_user_id', scope.ownerUserId)
        .maybeSingle()
      if (error) persistenceError('SAVED_ANALYSIS_READ_FAILED')
      return data
    },

    async create(scope, input) {
      const { data, error } = await savedAnalysisClient
        .from(SAVED_ANALYSIS_TABLE)
        .insert({
          tenant_id: scope.tenantId,
          hr_group_id: scope.hrGroupId,
          owner_user_id: scope.ownerUserId,
          name: input.name,
          analysis_spec: input.analysisSpec,
          definition_version: input.definitionVersion,
        })
        .select(SAVED_ANALYSIS_SELECT)
        .single()
      if (error || !data) persistenceError('SAVED_ANALYSIS_SAVE_FAILED')
      return data
    },

    async update(scope, id, input) {
      const { data, error } = await savedAnalysisClient
        .from(SAVED_ANALYSIS_TABLE)
        .update(input)
        .eq('id', id)
        .eq('tenant_id', scope.tenantId)
        .eq('hr_group_id', scope.hrGroupId)
        .eq('owner_user_id', scope.ownerUserId)
        .select(SAVED_ANALYSIS_SELECT)
        .maybeSingle()
      if (error) persistenceError('SAVED_ANALYSIS_UPDATE_FAILED')
      return data
    },

    async delete(scope, id) {
      const { data, error } = await savedAnalysisClient
        .from(SAVED_ANALYSIS_TABLE)
        .delete()
        .eq('id', id)
        .eq('tenant_id', scope.tenantId)
        .eq('hr_group_id', scope.hrGroupId)
        .eq('owner_user_id', scope.ownerUserId)
        .select('id')
        .maybeSingle()
      if (error) persistenceError('SAVED_ANALYSIS_DELETE_FAILED')
      return data !== null
    },
  }
}

function assertDashboardAccess(context: AuthContext): void {
  if (!context.permissions.includes(ANALYSIS_PERMISSION)) {
    throw new AuthorizationError('Je hebt onvoldoende rechten voor deze analyse.')
  }
}

async function resolveDependencies(dependencies?: SavedAnalysisServiceDependencies): Promise<{
  readonly auth: AuthContext
  readonly repository: SavedAnalysisRepository
  readonly scope: SavedAnalysisScope
}> {
  if (dependencies) {
    const authorization = await (dependencies.getAuthorization ?? getRequestAuthorizationContext)()
    assertDashboardAccess(authorization.context)
    const hrGroupId = requireHrGroupId(authorization.context)
    return {
      auth: authorization.context,
      repository: dependencies.repository ?? createSupabaseRepository(),
      scope: {
        tenantId: authorization.context.tenantId,
        hrGroupId,
        ownerUserId: authorization.context.userId,
      },
    }
  }

  const auth = await requirePermission(ANALYSIS_PERMISSION)
  const authorization = await getRequestAuthorizationContext()
  const hrGroupId = requireHrGroupId(auth)
  if (
    authorization.context.userId !== auth.userId
    || authorization.context.tenantId !== auth.tenantId
    || authorization.context.hrGroupId !== auth.hrGroupId
  ) {
    throw new SavedAnalysisError('SAVED_ANALYSIS_DATA_INVALID', 500)
  }
  return {
    auth,
    repository: createSupabaseRepository(),
    scope: { tenantId: auth.tenantId, hrGroupId, ownerUserId: auth.userId },
  }
}

function scopeMatches(row: SavedAnalysisPersistenceRow, scope: SavedAnalysisScope): boolean {
  return row.tenant_id === scope.tenantId
    && row.hr_group_id === scope.hrGroupId
    && row.owner_user_id === scope.ownerUserId
}

function assertRowScope(row: SavedAnalysisPersistenceRow, scope: SavedAnalysisScope): void {
  if (!scopeMatches(row, scope)) throw new SavedAnalysisError('SAVED_ANALYSIS_DATA_INVALID', 500)
}

function toPersistedSpec(spec: SavedAnalysisCreateInput['analysisSpec'] | SavedAnalysisUpdateInput['analysisSpec']): Json {
  if (!spec) throw new SavedAnalysisError('SAVED_ANALYSIS_INPUT_INVALID', 400)
  if (spec.version === 1) {
    return {
      version: spec.version,
      source: spec.source,
      entity: spec.entity,
      measures: [...spec.measures],
      dimensions: [...spec.dimensions],
      filters: spec.filters.map((filter) => ({
        dimension: filter.dimension,
        operator: filter.operator,
        value: typeof filter.value === 'string' ? filter.value : [...filter.value],
      })),
      limit: spec.limit,
      presentation: spec.presentation,
      sort: spec.sort === null ? null : { by: spec.sort.by, direction: spec.sort.direction },
    }
  }
  return {
    version: spec.version,
    source: spec.source,
    entity: spec.entity,
    measures: [...spec.measures],
    dimensions: [...spec.dimensions],
    filters: spec.filters.map((filter) => ({
      dimension: filter.dimension,
      operator: filter.operator,
      value: typeof filter.value === 'string' ? filter.value : [...filter.value],
    })),
    limit: spec.limit,
    presentation: { intent: spec.presentation.intent },
    period: { kind: spec.period.kind, asOf: spec.period.asOf },
    comparison: spec.comparison === null ? null : {
      kind: spec.comparison.kind,
      period: { kind: spec.comparison.period.kind, asOf: spec.comparison.period.asOf },
    },
    sort: spec.sort === null ? null : spec.sort.by === 'label'
      ? { by: 'label', direction: spec.sort.direction }
      : { by: 'measure', measure: spec.sort.measure, direction: spec.sort.direction },
  }
}

function notFound(): never {
  throw new SavedAnalysisError('SAVED_ANALYSIS_NOT_FOUND', 404)
}

export async function listMySavedAnalyses(dependencies?: SavedAnalysisServiceDependencies): Promise<readonly SavedAnalysisListItem[]> {
  const { repository, scope } = await resolveDependencies(dependencies)
  const rows = await repository.list(scope)
  return rows.filter((row) => scopeMatches(row, scope)).map(parseSavedAnalysisListRow)
}

export async function getSavedAnalysis(id: unknown, dependencies?: SavedAnalysisServiceDependencies): Promise<SavedAnalysisDefinition> {
  const { repository, scope } = await resolveDependencies(dependencies)
  const parsedId = parseSavedAnalysisId(id)
  const row = await repository.get(scope, parsedId)
  if (!row || !scopeMatches(row, scope)) notFound()
  assertRowScope(row, scope)
  return parseSavedAnalysisRow(row)
}

export async function createSavedAnalysis(input: unknown, dependencies?: SavedAnalysisServiceDependencies): Promise<SavedAnalysisDefinition> {
  const { repository, scope } = await resolveDependencies(dependencies)
  const validated = validateSavedAnalysisCreateInput(input)
  if (validated.analysisSpec.version === 2 && !SAVED_ANALYSIS_V2_PERSISTENCE_ENABLED) {
    throw new SavedAnalysisError('SAVED_ANALYSIS_VERSION_UNAVAILABLE', 409)
  }
  const row = await repository.create(scope, { name: validated.name, analysisSpec: toPersistedSpec(validated.analysisSpec), definitionVersion: validated.analysisSpec.version })
  assertRowScope(row, scope)
  return parseSavedAnalysisRow(row)
}

export async function updateSavedAnalysis(id: unknown, input: unknown, dependencies?: SavedAnalysisServiceDependencies): Promise<SavedAnalysisDefinition> {
  const { repository, scope } = await resolveDependencies(dependencies)
  const parsedId = parseSavedAnalysisId(id)
  const validated = validateSavedAnalysisUpdateInput(input)
  if (validated.analysisSpec?.version === 2 && !SAVED_ANALYSIS_V2_PERSISTENCE_ENABLED) {
    throw new SavedAnalysisError('SAVED_ANALYSIS_VERSION_UNAVAILABLE', 409)
  }
  const update: SavedAnalysisRepositoryInput = {
    ...(validated.name === undefined ? {} : { name: validated.name }),
    ...(validated.analysisSpec === undefined ? {} : { analysisSpec: toPersistedSpec(validated.analysisSpec) }),
  }
  const row = await repository.update(scope, parsedId, update)
  if (!row || !scopeMatches(row, scope)) notFound()
  assertRowScope(row, scope)
  return parseSavedAnalysisRow(row)
}

export async function renameSavedAnalysis(id: unknown, name: unknown, dependencies?: SavedAnalysisServiceDependencies): Promise<SavedAnalysisDefinition> {
  return updateSavedAnalysis(id, { name }, dependencies)
}

export async function deleteSavedAnalysis(id: unknown, dependencies?: SavedAnalysisServiceDependencies): Promise<boolean> {
  const { repository, scope } = await resolveDependencies(dependencies)
  const parsedId = parseSavedAnalysisId(id)
  const deleted = await repository.delete(scope, parsedId)
  if (!deleted) notFound()
  return true
}
