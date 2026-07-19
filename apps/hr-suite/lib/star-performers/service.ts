import 'server-only'
import type { Json } from '@scope/db'
import { requirePermission } from '@/lib/auth/permissions'
import { employeeAvatarHref } from '@/lib/employees/employee-service'
import { createClient } from '@/lib/supabase/server'
import type {
  StarPerformerAssessmentInput,
  StarPerformerTagCreateInput,
  StarPerformerTagUpdateInput,
} from './schemas'

export class StarPerformerError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code)
    this.name = 'StarPerformerError'
  }
}

export interface StarPerformerTag {
  id: string
  name: string
  isActive: boolean
  usageCount: number
}

export interface StarPerformerAssessment {
  id: string
  employeeId: string
  jobId: string | null
  jobGroupId: string | null
  criticalityLevel: number
  tagIds: string[]
  updatedAt: string
}

export interface StarPerformerEmployee {
  id: string
  employeeNumber: string
  firstName: string
  birthName: string
  workEmail: string | null
  avatarUrl: string | null
  departmentId: string | null
  departmentName: string | null
  jobId: string | null
  jobName: string | null
  jobGroupId: string | null
  jobGroupName: string | null
}

export interface StarPerformerScopeOption {
  id: string
  code: string
  name: string
  jobGroupId?: string | null
}

export interface StarPerformerWorkspace {
  tags: StarPerformerTag[]
  assessments: StarPerformerAssessment[]
  employees: StarPerformerEmployee[]
  jobGroups: StarPerformerScopeOption[]
  jobs: StarPerformerScopeOption[]
}

function databaseError(message: string): never {
  const code = message.match(/[A-Z][A-Z_]+/)?.[0] ?? 'STAR_PERFORMER_FAILED'
  throw new StarPerformerError(
    code,
    code === 'FORBIDDEN'
      ? 403
      : code.includes('NOT_FOUND')
        ? 404
        : code.includes('CONFLICT') || code.includes('duplicate') || code.includes('DUPLICATE')
          ? 409
          : 400,
  )
}

function latestRevisionNameByJobId(
  revisions: Array<{
    job_id: string
    name: string
    valid_from: string
    valid_until: string | null
  }>,
) {
  const names = new Map<string, string>()
  for (const revision of revisions) {
    if (!names.has(revision.job_id)) names.set(revision.job_id, revision.name)
  }
  return names
}

export async function listStarPerformerWorkspace(): Promise<StarPerformerWorkspace> {
  const auth = await requirePermission('star-performer:read')
  if (!auth.administrationId) throw new StarPerformerError('ADMINISTRATION_REQUIRED', 400)

  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const organizationsResult = await supabase
    .from('employee_organizations')
    .select('employee_id, department_id, job_id, job_title, effective_from')
    .eq('administration_id', auth.administrationId)
    .lte('effective_from', today)
    .or(`effective_to.is.null,effective_to.gte.${today}`)
    .order('effective_from', { ascending: false })
    .limit(4000)

  if (organizationsResult.error) databaseError(organizationsResult.error.message)

  const latestOrganizationByEmployee = new Map<
    string,
    NonNullable<typeof organizationsResult.data>[number]
  >()
  for (const organization of organizationsResult.data ?? []) {
    if (!latestOrganizationByEmployee.has(organization.employee_id)) {
      latestOrganizationByEmployee.set(organization.employee_id, organization)
    }
  }

  const employeeIds = [...latestOrganizationByEmployee.keys()]
  const departmentIds = [
    ...new Set(
      [...latestOrganizationByEmployee.values()]
        .flatMap((organization) => (organization.department_id ? [organization.department_id] : [])),
    ),
  ]
  const jobIds = [
    ...new Set(
      [...latestOrganizationByEmployee.values()]
        .flatMap((organization) => (organization.job_id ? [organization.job_id] : [])),
    ),
  ]

  const [
    employeesResult,
    departmentsResult,
    jobsResult,
    jobRevisionsResult,
    assessmentsResult,
    tagsResult,
  ] = await Promise.all([
    employeeIds.length
      ? supabase
          .from('employees')
          .select('id, employee_number, first_name, birth_name, work_email, avatar_url, is_archived')
          .in('id', employeeIds)
          .eq('is_archived', false)
          .order('birth_name')
          .limit(2000)
      : Promise.resolve({ data: [], error: null }),
    departmentIds.length
      ? supabase.from('departments').select('id, name').in('id', departmentIds).limit(500)
      : Promise.resolve({ data: [], error: null }),
    jobIds.length
      ? supabase
          .from('jobs')
          .select('id, code, job_group_id')
          .eq('administration_id', auth.administrationId)
          .in('id', jobIds)
          .limit(2000)
      : Promise.resolve({ data: [], error: null }),
    jobIds.length
      ? supabase
          .from('job_revisions')
          .select('job_id, name, valid_from, valid_until')
          .eq('administration_id', auth.administrationId)
          .in('job_id', jobIds)
          .lte('valid_from', today)
          .or(`valid_until.is.null,valid_until.gt.${today}`)
          .order('valid_from', { ascending: false })
          .limit(4000)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('star_performer_assessments')
      .select('id, employee_id, job_id, job_group_id, criticality_level, updated_at')
      .eq('administration_id', auth.administrationId)
      .limit(5000),
    supabase
      .from('star_performer_tags')
      .select('id, name, is_active')
      .eq('tenant_id', auth.tenantId)
      .order('name')
      .limit(500),
  ])

  const failed = [
    employeesResult,
    departmentsResult,
    jobsResult,
    jobRevisionsResult,
    assessmentsResult,
    tagsResult,
  ].find((result) => result.error)
  if (failed?.error) databaseError(failed.error.message)

  const jobGroupIds = [
    ...new Set((jobsResult.data ?? []).map((job) => job.job_group_id)),
  ]

  const [jobGroupsResult, assessmentTagLinksResult] = await Promise.all([
    jobGroupIds.length
      ? supabase
          .from('job_groups')
          .select('id, code, name')
          .eq('administration_id', auth.administrationId)
          .in('id', jobGroupIds)
          .limit(500)
      : Promise.resolve({ data: [], error: null }),
    (assessmentsResult.data ?? []).length
      ? supabase
          .from('star_performer_assessment_tags')
          .select('assessment_id, tag_id')
          .in('assessment_id', (assessmentsResult.data ?? []).map((assessment) => assessment.id))
          .limit(5000)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (jobGroupsResult.error || assessmentTagLinksResult.error) {
    databaseError(jobGroupsResult.error?.message ?? assessmentTagLinksResult.error?.message ?? 'STAR_PERFORMER_CONTEXT_FAILED')
  }

  const departmentById = new Map((departmentsResult.data ?? []).map((department) => [department.id, department.name]))
  const jobById = new Map((jobsResult.data ?? []).map((job) => [job.id, job]))
  const jobGroupById = new Map((jobGroupsResult.data ?? []).map((group) => [group.id, group]))
  const jobRevisionNameById = latestRevisionNameByJobId(jobRevisionsResult.data ?? [])
  const tagUsageCountById = new Map<string, number>()
  const tagIdsByAssessmentId = new Map<string, string[]>()

  for (const link of assessmentTagLinksResult.data ?? []) {
    tagUsageCountById.set(link.tag_id, (tagUsageCountById.get(link.tag_id) ?? 0) + 1)
    tagIdsByAssessmentId.set(link.assessment_id, [
      ...(tagIdsByAssessmentId.get(link.assessment_id) ?? []),
      link.tag_id,
    ])
  }

  const employees: StarPerformerEmployee[] = (employeesResult.data ?? []).map((employee) => {
    const organization = latestOrganizationByEmployee.get(employee.id)
    const job = organization?.job_id ? jobById.get(organization.job_id) : undefined

    return {
      id: employee.id,
      employeeNumber: employee.employee_number,
      firstName: employee.first_name,
      birthName: employee.birth_name,
      workEmail: employee.work_email,
      avatarUrl: employeeAvatarHref(employee.id, employee.avatar_url),
      departmentId: organization?.department_id ?? null,
      departmentName: organization?.department_id ? (departmentById.get(organization.department_id) ?? null) : null,
      jobId: organization?.job_id ?? null,
      jobName: organization?.job_id
        ? (jobRevisionNameById.get(organization.job_id) ?? organization.job_title ?? job?.code ?? null)
        : (organization?.job_title ?? null),
      jobGroupId: job?.job_group_id ?? null,
      jobGroupName: job?.job_group_id ? (jobGroupById.get(job.job_group_id)?.name ?? null) : null,
    }
  })

  const collator = new Intl.Collator('nl-NL', { sensitivity: 'base' })

  return {
    tags: (tagsResult.data ?? []).map((tag) => ({
      id: tag.id,
      name: tag.name,
      isActive: tag.is_active,
      usageCount: tagUsageCountById.get(tag.id) ?? 0,
    })),
    assessments: (assessmentsResult.data ?? []).map((assessment) => ({
      id: assessment.id,
      employeeId: assessment.employee_id,
      jobId: assessment.job_id,
      jobGroupId: assessment.job_group_id,
      criticalityLevel: assessment.criticality_level,
      tagIds: tagIdsByAssessmentId.get(assessment.id) ?? [],
      updatedAt: assessment.updated_at,
    })),
    employees,
    jobGroups: [...new Map(
      employees
        .filter((employee) => employee.jobGroupId && employee.jobGroupName)
        .map((employee) => [employee.jobGroupId!, {
          id: employee.jobGroupId!,
          code: jobGroupById.get(employee.jobGroupId!)?.code ?? employee.jobGroupName!,
          name: employee.jobGroupName!,
        }]),
    ).values()].sort((left, right) => collator.compare(left.name, right.name)),
    jobs: [...new Map(
      employees
        .filter((employee) => employee.jobId && employee.jobName)
        .map((employee) => [employee.jobId!, {
          id: employee.jobId!,
          code: jobById.get(employee.jobId!)?.code ?? employee.jobName!,
          name: employee.jobName!,
          jobGroupId: employee.jobGroupId,
        }]),
    ).values()].sort((left, right) => collator.compare(left.name, right.name)),
  }
}

export async function listStarPerformerTagCatalog(): Promise<StarPerformerTag[]> {
  const auth = await requirePermission('star-performer:read')
  const supabase = await createClient()

  const [tagsResult, linksResult] = await Promise.all([
    supabase
      .from('star_performer_tags')
      .select('id, name, is_active')
      .eq('tenant_id', auth.tenantId)
      .order('name')
      .limit(500),
    supabase
      .from('star_performer_assessment_tags')
      .select('tag_id')
      .eq('tenant_id', auth.tenantId)
      .limit(5000),
  ])

  if (tagsResult.error || linksResult.error) {
    databaseError(tagsResult.error?.message ?? linksResult.error?.message ?? 'STAR_PERFORMER_TAGS_FAILED')
  }

  const usageCountById = new Map<string, number>()
  for (const link of linksResult.data ?? []) {
    usageCountById.set(link.tag_id, (usageCountById.get(link.tag_id) ?? 0) + 1)
  }

  return (tagsResult.data ?? []).map((tag) => ({
    id: tag.id,
    name: tag.name,
    isActive: tag.is_active,
    usageCount: usageCountById.get(tag.id) ?? 0,
  }))
}

export async function createStarPerformerTag(input: StarPerformerTagCreateInput) {
  const auth = await requirePermission('star-performer:write')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('star_performer_tags')
    .insert({
      tenant_id: auth.tenantId,
      name: input.name,
    })
    .select('id')
    .single()

  if (error || !data) databaseError(error?.message ?? 'STAR_PERFORMER_TAG_CREATE_FAILED')
  return data.id
}

export async function updateStarPerformerTag(tagId: string, input: StarPerformerTagUpdateInput) {
  const auth = await requirePermission('star-performer:write')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('star_performer_tags')
    .update({
      name: input.name,
      is_active: input.isActive,
    })
    .eq('tenant_id', auth.tenantId)
    .eq('id', tagId)
    .select('id')
    .single()

  if (error || !data) databaseError(error?.message ?? 'STAR_PERFORMER_TAG_UPDATE_FAILED')
  return data.id
}

export async function saveStarPerformerAssessment(input: StarPerformerAssessmentInput) {
  const auth = await requirePermission('star-performer:write')
  if (!auth.administrationId) throw new StarPerformerError('ADMINISTRATION_REQUIRED', 400)

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('upsert_star_performer_assessment', {
    requested_administration_id: auth.administrationId,
    requested_payload: input as Json,
  })

  if (error || !data) databaseError(error?.message ?? 'STAR_PERFORMER_ASSESSMENT_SAVE_FAILED')

  const [assessmentResult, linksResult] = await Promise.all([
    supabase
      .from('star_performer_assessments')
      .select('id, employee_id, job_id, job_group_id, criticality_level, updated_at')
      .eq('id', data)
      .single(),
    supabase
      .from('star_performer_assessment_tags')
      .select('tag_id')
      .eq('assessment_id', data)
      .limit(100),
  ])

  if (assessmentResult.error || !assessmentResult.data || linksResult.error) {
    databaseError(assessmentResult.error?.message ?? linksResult.error?.message ?? 'STAR_PERFORMER_ASSESSMENT_FETCH_FAILED')
  }

  return {
    id: assessmentResult.data.id,
    employeeId: assessmentResult.data.employee_id,
    jobId: assessmentResult.data.job_id,
    jobGroupId: assessmentResult.data.job_group_id,
    criticalityLevel: assessmentResult.data.criticality_level,
    tagIds: (linksResult.data ?? []).map((link) => link.tag_id),
    updatedAt: assessmentResult.data.updated_at,
  } satisfies StarPerformerAssessment
}
