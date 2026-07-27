import type { Database, Json } from '@scope/db'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import type { JobCreateInput, JobGroupCreateInput, JobGroupUpdateInput, JobUpdateInput, SalaryRevisionInput, SalaryScaleCreateInput } from './schemas'

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
  throw new MasterDataError(code, code === 'FORBIDDEN' ? 403 : code.includes('NOT_FOUND') ? 404 : code.includes('CONFLICT') || code.includes('IN_USE') ? 409 : 400)
}

export async function listJobCatalog() {
  const auth = await context('job-catalog:read')
  const supabase = await createClient()
  const [groups, jobs, relations] = await Promise.all([
    supabase.from('job_groups').select('id, code, name, description, is_active').eq('administration_id', auth.administrationId).order('code').limit(500),
    supabase.from('jobs').select('id, code, job_group_id, is_active, job_revisions(id, name, description, valid_from, valid_until)').eq('administration_id', auth.administrationId).order('code').limit(500),
    supabase.from('job_group_jobs').select('job_id, job_group_id').eq('administration_id', auth.administrationId).limit(5000),
  ])
  if (groups.error || jobs.error || relations.error) databaseError(groups.error?.message ?? jobs.error?.message ?? relations.error?.message ?? 'JOB_CATALOG_FAILED')
  const groupIdsByJob = new Map<string, string[]>()
  for (const relation of relations.data ?? []) groupIdsByJob.set(relation.job_id, [...(groupIdsByJob.get(relation.job_id) ?? []), relation.job_group_id])
  return { groups: groups.data ?? [], jobs: (jobs.data ?? []).map((job) => ({ ...job, job_group_ids: groupIdsByJob.get(job.id) ?? [job.job_group_id] })) }
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

async function assertActiveJobGroups(supabase: Awaited<ReturnType<typeof createClient>>, tenantId: string, administrationId: string, groupIds: string[]): Promise<void> {
  const { data, error } = await supabase.from('job_groups').select('id').eq('tenant_id', tenantId).eq('administration_id', administrationId).eq('is_active', true).in('id', groupIds)
  if (error) databaseError(error.message)
  if ((data ?? []).length !== new Set(groupIds).size) databaseError('JOB_GROUP_NOT_ACTIVE')
}

export async function updateJobGroup(groupId: string, input: JobGroupUpdateInput): Promise<void> {
  const auth = await context('job-catalog:write')
  const supabase = await createClient()
  const payload: Database['public']['Tables']['job_groups']['Update'] = {}
  if (input.code !== undefined) payload.code = input.code.toUpperCase()
  if (input.name !== undefined) payload.name = input.name
  if (input.description !== undefined) payload.description = input.description
  if (input.isActive !== undefined) payload.is_active = input.isActive
  const { data, error } = await supabase.from('job_groups').update(payload).eq('tenant_id', auth.tenantId).eq('administration_id', auth.administrationId).eq('id', groupId).select('id').maybeSingle()
  if (error) databaseError(error.message)
  if (!data) databaseError('JOB_GROUP_NOT_FOUND')
}

export async function deleteJobGroup(groupId: string): Promise<void> {
  const auth = await context('job-catalog:write')
  const supabase = await createClient()
  const { count, error: relationError } = await supabase.from('job_group_jobs').select('job_id', { count: 'exact', head: true }).eq('tenant_id', auth.tenantId).eq('administration_id', auth.administrationId).eq('job_group_id', groupId)
  if (relationError) databaseError(relationError.message)
  if ((count ?? 0) > 0) databaseError('JOB_GROUP_IN_USE')
  const { data, error } = await supabase.from('job_groups').delete().eq('tenant_id', auth.tenantId).eq('administration_id', auth.administrationId).eq('id', groupId).select('id').maybeSingle()
  if (error) databaseError(error.message)
  if (!data) databaseError('JOB_GROUP_NOT_FOUND')
}

export async function updateJob(jobId: string, input: JobUpdateInput): Promise<void> {
  const auth = await context('job-catalog:write')
  const supabase = await createClient()
  if (input.jobGroupIds) await assertActiveJobGroups(supabase, auth.tenantId, auth.administrationId, input.jobGroupIds)
  const jobPayload: Database['public']['Tables']['jobs']['Update'] = {}
  if (input.code !== undefined) jobPayload.code = input.code.toUpperCase()
  if (input.isActive !== undefined) jobPayload.is_active = input.isActive
  if (input.jobGroupIds) jobPayload.job_group_id = input.jobGroupIds[0]
  const { data: job, error: jobError } = await supabase.from('jobs').update(jobPayload).eq('tenant_id', auth.tenantId).eq('administration_id', auth.administrationId).eq('id', jobId).select('id').maybeSingle()
  if (jobError) databaseError(jobError.message)
  if (!job) databaseError('JOB_NOT_FOUND')
  if (input.jobGroupIds) {
    const { error: deleteRelationsError } = await supabase.from('job_group_jobs').delete().eq('tenant_id', auth.tenantId).eq('administration_id', auth.administrationId).eq('job_id', jobId)
    if (deleteRelationsError) databaseError(deleteRelationsError.message)
    const { error: relationError } = await supabase.from('job_group_jobs').insert(input.jobGroupIds.map((jobGroupId) => ({ tenant_id: auth.tenantId, administration_id: auth.administrationId, job_group_id: jobGroupId, job_id: jobId })))
    if (relationError) databaseError(relationError.message)
  }
  if (input.name !== undefined || input.description !== undefined) {
    const { data: revision, error: revisionError } = await supabase.from('job_revisions').select('id, name, description').eq('tenant_id', auth.tenantId).eq('administration_id', auth.administrationId).eq('job_id', jobId).order('valid_from', { ascending: false }).limit(1).maybeSingle()
    if (revisionError) databaseError(revisionError.message)
    if (!revision) databaseError('JOB_REVISION_NOT_FOUND')
    const { error } = await supabase.from('job_revisions').update({ name: input.name ?? revision.name, description: input.description === undefined ? revision.description : input.description }).eq('tenant_id', auth.tenantId).eq('administration_id', auth.administrationId).eq('id', revision.id)
    if (error) databaseError(error.message)
  }
}

export async function deleteJob(jobId: string): Promise<void> {
  const auth = await context('job-catalog:write')
  const supabase = await createClient()
  const { count, error: usageError } = await supabase.from('employee_organizations').select('id', { count: 'exact', head: true }).eq('tenant_id', auth.tenantId).eq('administration_id', auth.administrationId).eq('job_id', jobId)
  if (usageError) databaseError(usageError.message)
  if ((count ?? 0) > 0) databaseError('JOB_IN_USE')
  const { data, error } = await supabase.from('jobs').delete().eq('tenant_id', auth.tenantId).eq('administration_id', auth.administrationId).eq('id', jobId).select('id').maybeSingle()
  if (error) databaseError(error.message)
  if (!data) databaseError('JOB_NOT_FOUND')
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
