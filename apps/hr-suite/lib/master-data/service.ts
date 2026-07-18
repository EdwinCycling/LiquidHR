import type { Json } from '@scope/db'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import type { JobCreateInput, JobGroupCreateInput, SalaryRevisionInput, SalaryScaleCreateInput } from './schemas'

export class MasterDataError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); this.name = 'MasterDataError' }
}

async function context(permission: string) {
  const result = await requirePermission(permission)
  if (!result.administrationId) throw new MasterDataError('ADMINISTRATION_REQUIRED', 400)
  return { ...result, administrationId: result.administrationId }
}

async function allowed(permission: string): Promise<boolean> {
  try { await requirePermission(permission); return true } catch (error) { if (error instanceof AuthorizationError) return false; throw error }
}

function databaseError(message: string): never {
  const code = message.match(/[A-Z][A-Z_]+/)?.[0] ?? 'MASTER_DATA_FAILED'
  throw new MasterDataError(code, code === 'FORBIDDEN' ? 403 : code.includes('NOT_FOUND') ? 404 : code.includes('CONFLICT') ? 409 : 400)
}

export async function listJobCatalog() {
  const auth = await context('job-catalog:read')
  const supabase = await createClient()
  const [groups, jobs] = await Promise.all([
    supabase.from('job_groups').select('id, code, name, description, is_active').eq('administration_id', auth.administrationId).order('code').limit(500),
    supabase.from('jobs').select('id, code, job_group_id, is_active, job_revisions(id, name, description, valid_from, valid_until)').eq('administration_id', auth.administrationId).order('code').limit(500),
  ])
  if (groups.error || jobs.error) databaseError(groups.error?.message ?? jobs.error?.message ?? 'JOB_CATALOG_FAILED')
  return { groups: groups.data ?? [], jobs: jobs.data ?? [] }
}

export async function createJobGroup(input: JobGroupCreateInput) {
  const auth = await context('job-catalog:write')
  const supabase = await createClient()
  const { data, error } = await supabase.from('job_groups').insert({
    tenant_id: auth.tenantId, administration_id: auth.administrationId, code: input.code.toUpperCase(),
    name: input.name, description: input.description ?? null,
  }).select('id').single()
  if (error || !data) databaseError(error?.message ?? 'JOB_GROUP_CREATE_FAILED')
  return data.id
}

export async function createJob(input: JobCreateInput) {
  const auth = await context('job-catalog:write')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_job_with_revision', {
    requested_administration_id: auth.administrationId, requested_payload: input as Json,
  })
  if (error || !data) databaseError(error?.message ?? 'JOB_CREATE_FAILED')
  return data
}

export async function listSalaryStructures() {
  const auth = await context('salary-structure:read')
  const canReadAmounts = await allowed('salary:read')
  const supabase = await createClient()
  const scales = await supabase.from('salary_scales').select('id, code, name, description, is_active')
    .eq('administration_id', auth.administrationId).order('code').limit(500)
  const revisions = await supabase.from('salary_scale_revisions').select('id, salary_scale_id, revision_number, status, description, valid_from, valid_until, published_at')
    .eq('administration_id', auth.administrationId).order('valid_from', { ascending: false }).limit(1000)
  const steps = canReadAmounts
    ? await supabase.from('salary_scale_steps').select('id, salary_scale_revision_id, step_code, step_name, sequence_number, step_kind, fulltime_amount, hourly_amount, currency_code').eq('administration_id', auth.administrationId).order('sequence_number').limit(5000)
    : await supabase.from('salary_scale_steps').select('id, salary_scale_revision_id, step_code, step_name, sequence_number, step_kind, currency_code').eq('administration_id', auth.administrationId).order('sequence_number').limit(5000)
  if (scales.error || revisions.error || steps.error) databaseError(scales.error?.message ?? revisions.error?.message ?? steps.error?.message ?? 'SALARY_STRUCTURE_FAILED')
  return { scales: scales.data ?? [], revisions: revisions.data ?? [], steps: steps.data ?? [], canReadAmounts }
}

export async function createSalaryScale(input: SalaryScaleCreateInput) {
  const auth = await context('salary-structure:write')
  const supabase = await createClient()
  const { data, error } = await supabase.from('salary_scales').insert({
    tenant_id: auth.tenantId, administration_id: auth.administrationId, code: input.code.toUpperCase(),
    name: input.name, description: input.description ?? null,
  }).select('id').single()
  if (error || !data) databaseError(error?.message ?? 'SALARY_SCALE_CREATE_FAILED')
  return data.id
}

export async function publishSalaryRevision(input: SalaryRevisionInput) {
  const auth = await context('salary-structure:write')
  await requirePermission('salary:write')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('publish_salary_scale_revision', {
    requested_administration_id: auth.administrationId, requested_payload: input as Json,
  })
  if (error || !data) databaseError(error?.message ?? 'SALARY_REVISION_CREATE_FAILED')
  return data
}
