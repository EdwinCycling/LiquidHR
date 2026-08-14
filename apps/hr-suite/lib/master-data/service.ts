import type { Database, Json } from '@scope/db'
import { AuthorizationError, requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import {
  createSalaryStructure,
  createSalaryStructureDraft,
  listSalaryStructureCatalog,
  publishSalaryStructureRevision,
} from '@/lib/salary-structures/service'
import { createClient } from '@/lib/supabase/server'
import type { JobCreateInput, JobGroupCreateInput, JobGroupUpdateInput, JobUpdateInput, SalaryRevisionInput, SalaryScaleCreateInput } from './schemas'

export class MasterDataError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); this.name = 'MasterDataError' }
}

async function tenantContext(permission: string) {
  return requirePermission(permission)
}

async function allowed(permission: string): Promise<boolean> {
  try { await requirePermission(permission); return true } catch (error) { if (error instanceof AuthorizationError) return false; throw error }
}

function databaseError(message: string): never {
  const code = message.match(/[A-Z][A-Z_]+/)?.[0] ?? 'MASTER_DATA_FAILED'
  throw new MasterDataError(code, code === 'FORBIDDEN' ? 403 : code.includes('NOT_FOUND') ? 404 : code.includes('CONFLICT') || code.includes('IN_USE') || code.includes('DUPLICATE') || code.includes('NOT_ACTIVE') ? 409 : 400)
}

export async function listJobCatalog() {
  const auth = await tenantContext('job-catalog:read')
  const hrGroupId = requireHrGroupId(auth)
  const supabase = await createClient()
  const canReadTalentArchitecture = await allowed('talent:read')
  const [groups, jobs, relations, families, seniorities] = await Promise.all([
    supabase.from('job_groups').select('id, code, name, description, is_active, job_family_id').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).order('code').limit(500),
    supabase.from('jobs').select('id, code, job_group_id, seniority_id, is_active, job_revisions!job_revisions_job_hr_group_fkey(id, name, description, valid_from, valid_until)').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).order('code').limit(500),
    supabase.from('job_group_jobs').select('job_id, job_group_id').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).limit(5000),
    canReadTalentArchitecture ? supabase.from('job_families').select('id, code, name, description, status').eq('tenant_id', auth.tenantId).order('code').limit(500) : Promise.resolve({ data: [], error: null }),
    canReadTalentArchitecture ? supabase.from('talent_seniorities').select('id, code, name, description, sort_order, status').eq('tenant_id', auth.tenantId).order('sort_order').order('code').limit(500) : Promise.resolve({ data: [], error: null }),
  ])
  if (groups.error || jobs.error || relations.error || families.error || seniorities.error) databaseError(groups.error?.message ?? jobs.error?.message ?? relations.error?.message ?? families.error?.message ?? seniorities.error?.message ?? 'JOB_CATALOG_FAILED')
  const groupIdsByJob = new Map<string, string[]>()
  for (const relation of relations.data ?? []) groupIdsByJob.set(relation.job_id, [...(groupIdsByJob.get(relation.job_id) ?? []), relation.job_group_id])
  return { groups: groups.data ?? [], jobs: (jobs.data ?? []).map((job) => ({ ...job, job_group_ids: groupIdsByJob.get(job.id) ?? [job.job_group_id] })), families: families.data ?? [], seniorities: seniorities.data ?? [] }
}

async function assertActiveJobFamily(supabase: Awaited<ReturnType<typeof createClient>>, tenantId: string, familyId: string | null | undefined): Promise<void> {
  if (!familyId) return
  const { data, error } = await supabase.from('job_families').select('id').eq('tenant_id', tenantId).eq('id', familyId).eq('status', 'ACTIVE').maybeSingle()
  if (error) databaseError(error.message)
  if (!data) databaseError('JOB_FAMILY_NOT_ACTIVE')
}

async function assertActiveSeniority(supabase: Awaited<ReturnType<typeof createClient>>, tenantId: string, seniorityId: string | null | undefined): Promise<void> {
  if (!seniorityId) return
  const { data, error } = await supabase.from('talent_seniorities').select('id').eq('tenant_id', tenantId).eq('id', seniorityId).eq('status', 'ACTIVE').maybeSingle()
  if (error) databaseError(error.message)
  if (!data) databaseError('SENIORITY_NOT_ACTIVE')
}

export async function createJobGroup(input: JobGroupCreateInput) {
  const auth = await tenantContext('job-catalog:write')
  const hrGroupId = requireHrGroupId(auth)
  const supabase = await createClient()
  await assertActiveJobFamily(supabase, auth.tenantId, input.jobFamilyId)
  const { data, error } = await supabase.from('job_groups').insert({
    tenant_id: auth.tenantId, hr_group_id: hrGroupId, code: input.code.toUpperCase(),
    name: input.name, description: input.description ?? null,
    job_family_id: input.jobFamilyId ?? null,
  }).select('id').single()
  if (error || !data) databaseError(error?.message ?? 'JOB_GROUP_CREATE_FAILED')
  return data.id
}

export async function createJob(input: JobCreateInput) {
  const auth = await tenantContext('job-catalog:write')
  const hrGroupId = requireHrGroupId(auth)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_job_with_revision', {
    requested_tenant_id: auth.tenantId, requested_hr_group_id: hrGroupId, requested_payload: input as Json,
  })
  if (error || !data) databaseError(error?.message ?? 'JOB_CREATE_FAILED')
  return data
}

async function assertActiveJobGroups(supabase: Awaited<ReturnType<typeof createClient>>, tenantId: string, hrGroupId: string, groupIds: string[]): Promise<void> {
  const { data, error } = await supabase.from('job_groups').select('id').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).in('id', groupIds)
  if (error) databaseError(error.message)
  if ((data ?? []).length !== new Set(groupIds).size) databaseError('JOB_GROUP_NOT_ACTIVE')
}

export async function updateJobGroup(groupId: string, input: JobGroupUpdateInput): Promise<void> {
  const auth = await tenantContext('job-catalog:write')
  const hrGroupId = requireHrGroupId(auth)
  const supabase = await createClient()
  const payload: Database['public']['Tables']['job_groups']['Update'] = {}
  if (input.code !== undefined) payload.code = input.code.toUpperCase()
  if (input.name !== undefined) payload.name = input.name
  if (input.description !== undefined) payload.description = input.description
  if (input.jobFamilyId !== undefined) {
    await assertActiveJobFamily(supabase, auth.tenantId, input.jobFamilyId)
    payload.job_family_id = input.jobFamilyId
  }
  if (input.isActive !== undefined) payload.is_active = input.isActive
  const { data, error } = await supabase.from('job_groups').update(payload).eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('id', groupId).select('id').maybeSingle()
  if (error) databaseError(error.message)
  if (!data) databaseError('JOB_GROUP_NOT_FOUND')
}

export async function deleteJobGroup(groupId: string): Promise<void> {
  const auth = await tenantContext('job-catalog:write')
  const hrGroupId = requireHrGroupId(auth)
  const supabase = await createClient()
  const { count, error: relationError } = await supabase.from('job_group_jobs').select('job_id', { count: 'exact', head: true }).eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('job_group_id', groupId)
  if (relationError) databaseError(relationError.message)
  if ((count ?? 0) > 0) databaseError('JOB_GROUP_IN_USE')
  const { data, error } = await supabase.from('job_groups').delete().eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('id', groupId).select('id').maybeSingle()
  if (error) databaseError(error.message)
  if (!data) databaseError('JOB_GROUP_NOT_FOUND')
}

export async function updateJob(jobId: string, input: JobUpdateInput): Promise<void> {
  const auth = await tenantContext('job-catalog:write')
  const hrGroupId = requireHrGroupId(auth)
  const supabase = await createClient()
  if (input.jobGroupIds) await assertActiveJobGroups(supabase, auth.tenantId, hrGroupId, input.jobGroupIds)
  await assertActiveSeniority(supabase, auth.tenantId, input.seniorityId)
  const jobPayload: Database['public']['Tables']['jobs']['Update'] = {}
  if (input.code !== undefined) jobPayload.code = input.code.toUpperCase()
  if (input.isActive !== undefined) jobPayload.is_active = input.isActive
  if (input.jobGroupIds) jobPayload.job_group_id = input.jobGroupIds[0]
  if (input.seniorityId !== undefined) jobPayload.seniority_id = input.seniorityId
  const { data: job, error: jobError } = await supabase.from('jobs').update(jobPayload).eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('id', jobId).select('id').maybeSingle()
  if (jobError) databaseError(jobError.message)
  if (!job) databaseError('JOB_NOT_FOUND')
  if (input.jobGroupIds) {
    const { error: deleteRelationsError } = await supabase.from('job_group_jobs').delete().eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('job_id', jobId)
    if (deleteRelationsError) databaseError(deleteRelationsError.message)
    const { error: relationError } = await supabase.from('job_group_jobs').insert(input.jobGroupIds.map((jobGroupId) => ({ tenant_id: auth.tenantId, hr_group_id: hrGroupId, job_group_id: jobGroupId, job_id: jobId })))
    if (relationError) databaseError(relationError.message)
  }
  if (input.name !== undefined || input.description !== undefined) {
    const { data: revision, error: revisionError } = await supabase.from('job_revisions').select('id, name, description').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('job_id', jobId).order('valid_from', { ascending: false }).limit(1).maybeSingle()
    if (revisionError) databaseError(revisionError.message)
    if (!revision) databaseError('JOB_REVISION_NOT_FOUND')
    const { error } = await supabase.from('job_revisions').update({ name: input.name ?? revision.name, description: input.description === undefined ? revision.description : input.description }).eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('id', revision.id)
    if (error) databaseError(error.message)
  }
}

export async function deleteJob(jobId: string): Promise<void> {
  const auth = await tenantContext('job-catalog:write')
  const hrGroupId = requireHrGroupId(auth)
  const supabase = await createClient()
  const { count, error: usageError } = await supabase.from('employee_organizations').select('id', { count: 'exact', head: true }).eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('job_id', jobId)
  if (usageError) databaseError(usageError.message)
  if ((count ?? 0) > 0) databaseError('JOB_IN_USE')
  const { data, error } = await supabase.from('jobs').delete().eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('id', jobId).select('id').maybeSingle()
  if (error) databaseError(error.message)
  if (!data) databaseError('JOB_NOT_FOUND')
}

export async function listSalaryStructures() {
  const catalog = await listSalaryStructureCatalog()
  return {
    scales: catalog.structures
      .filter((structure) => structure.structure_type === 'SCALE_WITH_STEPS')
      .map((structure) => ({ ...structure, code: structure.code ?? '' })),
    revisions: catalog.revisions
      .filter((revision) => catalog.structures.some((structure) => structure.id === revision.salary_structure_id && structure.structure_type === 'SCALE_WITH_STEPS'))
      .map((revision) => ({
        id: revision.id,
        salary_scale_id: revision.salary_structure_id,
        revision_number: revision.revision_number,
        status: revision.status,
        description: revision.description,
        valid_from: revision.effective_from,
        valid_until: null,
        published_at: revision.published_at,
      })),
    steps: catalog.steps.map((step) => ({
      ...step,
      salary_scale_revision_id: step.salary_structure_revision_id,
    })),
    canReadAmounts: catalog.canReadAmounts,
  }
}

export async function createSalaryScale(input: SalaryScaleCreateInput) {
  return createSalaryStructure({
    structureType: 'SCALE_WITH_STEPS',
    code: input.code.toUpperCase(),
    name: input.name,
    description: input.description ?? null,
  })
}

export async function publishSalaryRevision(input: SalaryRevisionInput) {
  const catalog = await listSalaryStructureCatalog()
  const structure = catalog.structures.find((candidate) => candidate.id === input.scaleId && candidate.structure_type === 'SCALE_WITH_STEPS')
  if (!structure) databaseError('SALARY_STRUCTURE_NOT_FOUND')
  const logicalScale = catalog.scales.find((scale) => scale.salary_structure_id === input.scaleId)
  const draft = await createSalaryStructureDraft(input.scaleId, {
    structureType: 'SCALE_WITH_STEPS',
    effectiveFrom: input.validFrom,
    salaryBasis: 'MONTHLY_BASE',
    currencyCode: 'EUR',
    description: input.description ?? null,
    scales: [{
      ...(logicalScale ? { logicalScaleId: logicalScale.id } : {}),
      code: logicalScale?.code ?? structure.code ?? 'SCHAAL',
      name: logicalScale?.name ?? structure.name,
      description: logicalScale?.description ?? structure.description,
      sortOrder: 0,
      progressionType: 'MANUAL',
      defaultMonthsToNextStep: null,
      steps: input.steps.map((step) => ({
        stepCode: step.stepCode,
        stepName: step.stepName,
        sequenceNumber: step.sequenceNumber,
        fulltimeAmount: step.fulltimeAmount.toFixed(2),
        hourlyAmount: step.hourlyAmount === null || step.hourlyAmount === undefined ? null : step.hourlyAmount.toFixed(4),
        progressionType: 'MANUAL',
        monthsToNextStep: null,
        stepKind: step.stepKind,
      })),
    }],
  })
  return publishSalaryStructureRevision(draft.id, draft.lockVersion)
}
