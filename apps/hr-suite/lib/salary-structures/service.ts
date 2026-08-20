import type { Database, Json } from '@scope/db'
import { z } from 'zod'
import { AuthorizationError, requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import type { SalaryStructureCreateInput, SalaryStructureDraftInput } from './schemas'

type SalaryStructureRow = Database['public']['Tables']['salary_structures']['Row']
type SalaryStructureRevisionRow = Database['public']['Tables']['salary_structure_revisions']['Row']
type SalaryScaleRow = Database['public']['Tables']['salary_scales']['Row']
type SalaryScaleRevisionValueRow = Database['public']['Tables']['salary_scale_revision_values']['Row']
type SalaryScaleStepRow = Database['public']['Tables']['salary_scale_steps']['Row']
type SalaryBandRow = Database['public']['Tables']['salary_bands']['Row']
type SalaryBandValueRow = Database['public']['Tables']['salary_band_values']['Row']
type LaborConditionSalaryStructureRow = Database['public']['Tables']['labor_condition_salary_structures']['Row']
type SalaryStructureMigrationConflictRow = Database['public']['Tables']['salary_structure_migration_conflicts']['Row']

export type SalaryStructureCatalog = {
  structures: SalaryStructureRow[]
  revisions: SalaryStructureRevisionRow[]
  scales: SalaryScaleRow[]
  scaleValues: SalaryScaleRevisionValueRow[]
  steps: SalaryScaleStepRow[]
  bands: SalaryBandRow[]
  bandValues: SalaryBandValueRow[]
  laborConditionRelations: LaborConditionSalaryStructureRow[]
  migrationConflicts: SalaryStructureMigrationConflictRow[]
  canReadAmounts: boolean
  canWriteStructures: boolean
  canWriteRelations: boolean
}

export type SalaryStructureMigrationConflictAction =
  | 'KEEP_SEPARATE'
  | 'RENAME_OR_RECODE'
  | 'TREAT_AS_SAME'
  | 'LATER'

export class SalaryStructureError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code)
    this.name = 'SalaryStructureError'
  }
}

function databaseError(message: string): never {
  const code = message.match(/[A-Z][A-Z_]+/)?.[0] ?? 'SALARY_STRUCTURE_FAILED'
  const status = code.includes('AUTHENTICATION') ? 401
    : code.includes('FORBIDDEN') ? 403
      : code.includes('NOT_FOUND') ? 404
        : code.includes('CONFLICT') || code.includes('DUPLICATE') || code.includes('IMMUTABLE') ? 409
          : 400
  throw new SalaryStructureError(code, status)
}

async function salaryContext(permission: string) {
  const auth = await requirePermission(permission)
  return { ...auth, hrGroupId: requireHrGroupId(auth) }
}

async function allowed(permission: string): Promise<boolean> {
  try {
    await requirePermission(permission)
    return true
  } catch (error) {
    if (error instanceof AuthorizationError) return false
    throw error
  }
}

function jsonPayload(value: object): Json {
  return JSON.parse(JSON.stringify(value)) as Json
}

const idResult = z.object({ id: z.guid() })
const draftResult = z.object({ id: z.guid(), revisionNumber: z.number().int().positive(), lockVersion: z.number().int().positive(), status: z.literal('DRAFT') })
const publishResult = z.object({ id: z.guid(), lockVersion: z.number().int().positive(), status: z.literal('PUBLISHED') })

export async function listSalaryStructureCatalog(): Promise<SalaryStructureCatalog> {
  const auth = await salaryContext('salary-structure:read')
  const canReadAmounts = await allowed('salary:read')
  const canWriteStructures = (await allowed('salary-structure:write')) && (await allowed('salary:write'))
  const canWriteRelations = await allowed('salary-structure:write')
  const supabase = await createClient()
  const [structures, revisions, scales, scaleValues, steps, bands, bandValues, laborConditionRelations, migrationConflicts] = await Promise.all([
    supabase.from('salary_structures').select('*').eq('tenant_id', auth.tenantId).eq('hr_group_id', auth.hrGroupId).order('name').limit(500),
    supabase.from('salary_structure_revisions').select('*').eq('tenant_id', auth.tenantId).eq('hr_group_id', auth.hrGroupId).order('effective_from', { ascending: false }).limit(2000),
    supabase.from('salary_scales').select('*').eq('tenant_id', auth.tenantId).eq('hr_group_id', auth.hrGroupId).order('code').limit(2000),
    supabase.from('salary_scale_revision_values').select('*').eq('tenant_id', auth.tenantId).eq('hr_group_id', auth.hrGroupId).order('sort_order').limit(5000),
    canReadAmounts
      ? supabase.from('salary_scale_steps').select('*').eq('tenant_id', auth.tenantId).eq('hr_group_id', auth.hrGroupId).order('sequence_number').limit(10000)
      : Promise.resolve({ data: [] as SalaryScaleStepRow[], error: null }),
    supabase.from('salary_bands').select('*').eq('tenant_id', auth.tenantId).eq('hr_group_id', auth.hrGroupId).order('identity_key').limit(2000),
    canReadAmounts
      ? supabase.from('salary_band_values').select('*').eq('tenant_id', auth.tenantId).eq('hr_group_id', auth.hrGroupId).order('sort_order').limit(5000)
      : Promise.resolve({ data: [] as SalaryBandValueRow[], error: null }),
    supabase.from('labor_condition_salary_structures').select('*').eq('tenant_id', auth.tenantId).eq('hr_group_id', auth.hrGroupId).limit(5000),
    supabase.from('salary_structure_migration_conflicts').select('*').eq('tenant_id', auth.tenantId).eq('hr_group_id', auth.hrGroupId).order('created_at').limit(500),
  ])
  const error = structures.error ?? revisions.error ?? scales.error ?? scaleValues.error ?? steps.error
    ?? bands.error ?? bandValues.error ?? laborConditionRelations.error ?? migrationConflicts.error
  if (error) databaseError(error.message)
  return {
    structures: structures.data ?? [], revisions: revisions.data ?? [],
    scales: scales.data ?? [], scaleValues: scaleValues.data ?? [], steps: steps.data ?? [],
    bands: bands.data ?? [], bandValues: bandValues.data ?? [],
    laborConditionRelations: laborConditionRelations.data ?? [],
    migrationConflicts: migrationConflicts.data ?? [],
    canReadAmounts,
    canWriteStructures,
    canWriteRelations,
  }
}

export async function createSalaryStructure(input: SalaryStructureCreateInput): Promise<string> {
  const auth = await salaryContext('salary-structure:write')
  await requirePermission('salary:write')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_salary_structure', {
    requested_hr_group_id: auth.hrGroupId,
    requested_payload: jsonPayload(input),
  })
  if (error || !data) databaseError(error?.message ?? 'SALARY_STRUCTURE_CREATE_FAILED')
  return idResult.parse(data).id
}

export async function createSalaryStructureDraft(structureId: string, draft: SalaryStructureDraftInput) {
  await salaryContext('salary-structure:write')
  await requirePermission('salary:write')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_salary_structure_draft', {
    requested_structure_id: structureId,
    requested_payload: jsonPayload(draft),
  })
  if (error || !data) databaseError(error?.message ?? 'SALARY_STRUCTURE_DRAFT_CREATE_FAILED')
  return draftResult.parse(data)
}

export async function saveSalaryStructureDraft(structureId: string, draftId: string, expectedLockVersion: number, draft: SalaryStructureDraftInput) {
  await salaryContext('salary-structure:write')
  await requirePermission('salary:write')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('save_salary_structure_draft', {
    requested_structure_id: structureId,
    requested_draft_id: draftId,
    requested_expected_lock_version: expectedLockVersion,
    requested_payload: jsonPayload(draft),
  })
  if (error || !data) databaseError(error?.message ?? 'SALARY_STRUCTURE_DRAFT_SAVE_FAILED')
  return draftResult.parse(data)
}

export async function publishSalaryStructureRevision(revisionId: string, expectedLockVersion: number) {
  await salaryContext('salary-structure:write')
  await requirePermission('salary:write')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('publish_salary_structure_revision', {
    requested_revision_id: revisionId,
    requested_expected_lock_version: expectedLockVersion,
  })
  if (error || !data) databaseError(error?.message ?? 'SALARY_STRUCTURE_PUBLISH_FAILED')
  return publishResult.parse(data)
}

export async function replaceLaborConditionSalaryStructures(laborConditionSetId: string, salaryStructureIds: string[]): Promise<number> {
  await salaryContext('salary-structure:write')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('replace_labor_condition_salary_structures', {
    requested_labor_condition_set_id: laborConditionSetId,
    requested_salary_structure_ids: salaryStructureIds,
  })
  if (error || !data) databaseError(error?.message ?? 'LABOR_CONDITION_SALARY_STRUCTURES_FAILED')
  return z.object({ count: z.number().int().nonnegative() }).parse(data).count
}

export async function resolveSalaryStructureMigrationConflict(
  conflictId: string,
  input: { action: SalaryStructureMigrationConflictAction; note: string | null },
): Promise<void> {
  const auth = await salaryContext('salary-structure:write')
  const supabase = await createClient()
  const status = input.action === 'LATER' ? 'IGNORED' : 'RESOLVED'
  const { error, count } = await supabase
    .from('salary_structure_migration_conflicts')
    .update({
      status,
      resolution: jsonPayload({ action: input.action, note: input.note }),
      resolved_at: status === 'RESOLVED' ? new Date().toISOString() : null,
      resolved_by_user_id: status === 'RESOLVED' ? auth.userId : null,
    }, { count: 'exact' })
    .eq('id', conflictId)
    .eq('tenant_id', auth.tenantId)
    .eq('hr_group_id', auth.hrGroupId)
  if (error) databaseError(error.message)
  if (!count) databaseError('SALARY_STRUCTURE_CONFLICT_NOT_FOUND')
}
