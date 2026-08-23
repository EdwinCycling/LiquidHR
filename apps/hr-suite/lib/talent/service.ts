import type { Database, Json } from '@scope/db'
import { requirePermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import type {
  TalentCapabilityLevelContentInput,
  TalentCapabilityTagInput,
  TalentCapabilityUpdateInput,
  TalentCategoryCreateInput,
  TalentCategoryUpdateInput,
  JobFamilyCreateInput,
  JobFamilyUpdateInput,
  JobProfileCreateInput,
  JobProfileRequirementCreateInput,
  JobProfileRequirementUpdateInput,
  JobProfileVersionActivateInput,
  JobProfileVersionCopyInput,
  JobProfileVersionUpdateInput,
  TalentCapabilityCreateInput,
  TalentLevelCreateInput,
  TalentLevelModelUpdateInput,
  TalentLevelReorderInput,
  TalentLevelUpdateInput,
  TalentSeniorityCreateInput,
  TalentSeniorityUpdateInput,
} from './schemas'

export class TalentServiceError extends Error {
  constructor(public readonly code: string, public readonly status = 500) {
    super(code)
    this.name = 'TalentServiceError'
  }
}

type TalentTables = Database['public']['Tables']

type TalentFoundation = {
  models: Database['public']['Tables']['talent_level_models']['Row'][]
  levels: Database['public']['Tables']['talent_levels']['Row'][]
  seniorities: Database['public']['Tables']['talent_seniorities']['Row'][]
  families: Database['public']['Tables']['job_families']['Row'][]
  categories: Database['public']['Tables']['talent_categories']['Row'][]
  capabilities: Database['public']['Tables']['talent_capabilities']['Row'][]
  capabilityLevelContent: Database['public']['Tables']['talent_capability_level_content']['Row'][]
  capabilityTagRelations: Database['public']['Tables']['talent_capability_tags']['Row'][]
  tags: Database['public']['Tables']['star_performer_tags']['Row'][]
  profiles: Database['public']['Views']['talent_job_profile_readmodel']['Row'][]
}

async function readTalentFoundation(context: Awaited<ReturnType<typeof requirePermission>>, profileJobIds?: string[]): Promise<TalentFoundation> {
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const profilesQuery = profileJobIds === undefined
    ? supabase.from('talent_job_profile_readmodel').select('*').eq('tenant_id', context.tenantId).order('job_code').limit(500)
    : profileJobIds.length > 0
      ? supabase.from('talent_job_profile_readmodel').select('*').eq('tenant_id', context.tenantId).in('job_id', profileJobIds).order('job_code').limit(500)
      : null
  const [models, levels, seniorities, families, categories, capabilities, levelContent, tagRelations, tags, profiles] = await Promise.all([
    supabase.from('talent_level_models').select('*').eq('tenant_id', context.tenantId).order('code').limit(10),
    supabase.from('talent_levels').select('*').eq('tenant_id', context.tenantId).order('sort_order').order('code').limit(100),
    supabase.from('talent_seniorities').select('*').eq('tenant_id', context.tenantId).order('sort_order').order('code').limit(500),
    supabase.from('job_families').select('*').eq('tenant_id', context.tenantId).order('code').limit(500),
    supabase.from('talent_categories').select('*').eq('tenant_id', context.tenantId).order('code').limit(500),
    supabase.from('talent_capabilities').select('*').eq('tenant_id', context.tenantId).order('capability_type').order('name').limit(1000),
    supabase.from('talent_capability_level_content').select('*').eq('tenant_id', context.tenantId).order('talent_level_id').limit(5000),
    supabase.from('talent_capability_tags').select('*').eq('tenant_id', context.tenantId).limit(5000),
    supabase.from('star_performer_tags').select('*').eq('tenant_id', context.tenantId).order('name').limit(500),
    profilesQuery ?? Promise.resolve({ data: [], error: null }),
  ])
  const optionalTagRelationMissing = tagRelations.error && (
    tagRelations.error.code === '42P01'
    || tagRelations.error.code === 'PGRST205'
    || tagRelations.error.message.toLocaleLowerCase('en-US').includes('talent_capability_tags')
  )
  const error = models.error ?? levels.error ?? seniorities.error ?? families.error ?? categories.error ?? capabilities.error ?? levelContent.error ?? (optionalTagRelationMissing ? null : tagRelations.error) ?? tags.error ?? profiles.error
  if (error) throw new TalentServiceError('TALENT_FOUNDATION_READ_FAILED')
  const allCapabilityTypes = ['COMPETENCY', 'SKILL', 'KNOWLEDGE', 'LANGUAGE', 'CERTIFICATE']
  const normalizedCategories = (categories.data ?? []).map((category) => ({
    ...category,
    capability_types: category.capability_types?.length ? category.capability_types : allCapabilityTypes,
  }))
  const normalizedCapabilities = (capabilities.data ?? []).map((capability) => ({
    ...capability,
    language_code: capability.language_code ?? null,
    language_cefr: capability.language_cefr ?? null,
    language_is_native: capability.language_is_native ?? false,
    certificate_issuing_body: capability.certificate_issuing_body ?? null,
    certificate_validity_months: capability.certificate_validity_months ?? null,
    certificate_is_permanent: capability.certificate_is_permanent ?? false,
    certificate_code: capability.certificate_code ?? null,
    certificate_renewal_required: capability.certificate_renewal_required ?? false,
  }))
  return {
    models: models.data ?? [], levels: levels.data ?? [], seniorities: seniorities.data ?? [],
    families: families.data ?? [], categories: normalizedCategories, capabilities: normalizedCapabilities,
    capabilityLevelContent: levelContent.data ?? [], capabilityTagRelations: optionalTagRelationMissing ? [] : (tagRelations.data ?? []), tags: tags.data ?? [],
    profiles: profiles.data ?? [],
  }
}

export async function listTalentFoundation() {
  const context = await requirePermission('talent:manage')
  return readTalentFoundation(context)
}

type TalentProfileReadModelRow = Database['public']['Views']['talent_job_profile_readmodel']['Row']
type TalentCapabilityRow = Database['public']['Tables']['talent_capabilities']['Row']
type TalentLevelRow = Database['public']['Tables']['talent_levels']['Row']
type TalentReadRequirement = Database['public']['Tables']['job_profile_capability_requirements']['Row'] & {
  capability: Pick<TalentCapabilityRow, 'id' | 'code' | 'name' | 'capability_type'> | null
  targetLevel: Pick<TalentLevelRow, 'id' | 'code' | 'name'> | null
}

export type TalentWorkforceEmployee = {
  id: string
  label: string
  employeeNumber: string
  jobId: string
}

export type TalentWorkforceProfile = {
  profile: TalentProfileReadModelRow
  requirements: TalentReadRequirement[]
  employees: TalentWorkforceEmployee[]
}

export type MyTalentProfile = Database['public']['Functions']['get_my_talent_profile']['Returns'][number] & {
  requirements: Database['public']['Functions']['get_my_talent_profile_requirements']['Returns']
}

export async function listTalentProfilesForWorkforce(): Promise<TalentWorkforceProfile[]> {
  const context = await requirePermission('talent:manager-read')
  await requireTenantModule('TALENT')

  const supabase = await createClient()
  const canReadTenant = context.permissions.includes('talent:manage')
  let scopedJobIds: string[] | undefined
  if (!canReadTenant) {
    if (!context.employeeId) throw new TalentServiceError('EMPLOYEE_CONTEXT_REQUIRED', 403)
    const today = new Date().toISOString().slice(0, 10)
    const { data: organizations, error } = await supabase
      .from('employee_organizations')
      .select('job_id')
      .eq('tenant_id', context.tenantId)
      .eq('direct_manager_id', context.employeeId)
      .lte('effective_from', today)
      .or(`effective_to.is.null,effective_to.gt.${today}`)
    if (error) throw new TalentServiceError('TALENT_MANAGER_SCOPE_READ_FAILED')
    scopedJobIds = [...new Set((organizations ?? []).map((organization) => organization.job_id).filter((jobId): jobId is string => Boolean(jobId)))]
    if (scopedJobIds.length === 0) return []
  }

  let profilesQuery = supabase
    .from('talent_job_profile_readmodel')
    .select('*')
    .eq('tenant_id', context.tenantId)
    .eq('job_is_active', true)
    .eq('status', 'ACTIVE')
    .not('profile_version_id', 'is', null)
    .order('job_code')
    .limit(500)
  if (scopedJobIds) profilesQuery = profilesQuery.in('job_id', scopedJobIds)
  const { data: profiles, error: profileError } = await profilesQuery
  if (profileError) throw new TalentServiceError('TALENT_WORKFORCE_READ_FAILED')
  const profileRows = (profiles ?? []).filter((profile) => Boolean(profile.profile_version_id))
  if (profileRows.length === 0) return []

  const profileVersionIds = profileRows.map((profile) => profile.profile_version_id as string)
  const profileJobIds = [...new Set(profileRows.flatMap((profile) => profile.job_id ? [profile.job_id] : []))]
  const today = new Date().toISOString().slice(0, 10)
  const [requirementsResult, organizationsResult] = await Promise.all([
    supabase
      .from('job_profile_capability_requirements')
      .select('*')
      .eq('tenant_id', context.tenantId)
      .in('profile_version_id', profileVersionIds)
      .order('sort_order'),
    supabase
      .from('employee_organizations')
      .select('employee_id,job_id')
      .eq('tenant_id', context.tenantId)
      .in('job_id', profileJobIds)
      .lte('effective_from', today)
      .or(`effective_to.is.null,effective_to.gt.${today}`),
  ])
  if (requirementsResult.error || organizationsResult.error) throw new TalentServiceError('TALENT_WORKFORCE_READ_FAILED')
  const requirements = requirementsResult.data
  const organizations = organizationsResult.data ?? []
  const employeeIds = [...new Set(organizations.map((organization) => organization.employee_id))]
  const employeesResult = employeeIds.length > 0
    ? await supabase
      .from('employees')
      .select('id,first_name,birth_name,employee_number')
      .eq('tenant_id', context.tenantId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .in('id', employeeIds)
    : { data: [], error: null }
  if (employeesResult.error) throw new TalentServiceError('TALENT_WORKFORCE_READ_FAILED')
  const employeesById = new Map((employeesResult.data ?? []).map((employee) => [employee.id, employee]))
  const employeesByJob = new Map<string, TalentWorkforceEmployee[]>()
  for (const organization of organizations) {
    if (!organization.job_id) continue
    const employee = employeesById.get(organization.employee_id)
    if (!employee) continue
    const current = employeesByJob.get(organization.job_id) ?? []
    if (current.some((item) => item.id === employee.id)) continue
    current.push({
      id: employee.id,
      label: [employee.first_name, employee.birth_name].filter((value) => value.trim().length > 0).join(' ') || employee.employee_number,
      employeeNumber: employee.employee_number,
      jobId: organization.job_id,
    })
    employeesByJob.set(organization.job_id, current)
  }

  const capabilityIds = [...new Set((requirements ?? []).map((requirement) => requirement.capability_id))]
  const levelIds = [...new Set((requirements ?? []).map((requirement) => requirement.target_level_id).filter((levelId): levelId is string => Boolean(levelId)))]
  const [capabilities, levels] = await Promise.all([
    capabilityIds.length > 0
      ? supabase.from('talent_capabilities').select('id, code, name, capability_type').eq('tenant_id', context.tenantId).in('id', capabilityIds)
      : Promise.resolve({ data: [], error: null }),
    levelIds.length > 0
      ? supabase.from('talent_levels').select('id, code, name').eq('tenant_id', context.tenantId).in('id', levelIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (capabilities.error || levels.error) throw new TalentServiceError('TALENT_WORKFORCE_READ_FAILED')
  const capabilitiesById = new Map((capabilities.data ?? []).map((capability) => [capability.id, capability]))
  const levelsById = new Map((levels.data ?? []).map((level) => [level.id, level]))
  const requirementsByVersion = new Map<string, TalentReadRequirement[]>()
  for (const requirement of requirements ?? []) {
    const list = requirementsByVersion.get(requirement.profile_version_id) ?? []
    list.push({
      ...requirement,
      capability: capabilitiesById.get(requirement.capability_id) ?? null,
      targetLevel: requirement.target_level_id ? levelsById.get(requirement.target_level_id) ?? null : null,
    })
    requirementsByVersion.set(requirement.profile_version_id, list)
  }

  return profileRows.map((profile) => ({
    profile,
    requirements: requirementsByVersion.get(profile.profile_version_id as string) ?? [],
    employees: profile.job_id ? employeesByJob.get(profile.job_id) ?? [] : [],
  }))
}

function normalizeCatalogName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('nl-NL')
}

function databaseError(message: string, fallback: string): never {
  const normalized = message.toLocaleUpperCase('en-US')
  const explicitCode = normalized.match(/(?:TALENT|CAPABILITY|CATEGORY|SENIORITY|LEVEL|TAG|MODEL|PROFILE|JOB_FAMILY|FORBIDDEN|DUPLICATE|IN_USE)[A-Z0-9_]*/)?.[0]
  if (explicitCode) {
    const status = explicitCode.includes('FORBIDDEN') ? 403 : explicitCode.includes('NOT_FOUND') ? 404 : explicitCode.includes('DUPLICATE') || explicitCode.includes('IN_USE') || explicitCode.includes('LOCKED') ? 409 : 400
    throw new TalentServiceError(explicitCode, status)
  }
  if (normalized.includes('DUPLICATE') || normalized.includes('UNIQUE')) throw new TalentServiceError('TALENT_DUPLICATE', 409)
  if (normalized.includes('FOREIGN KEY') || normalized.includes('REFERENCED')) throw new TalentServiceError('TALENT_IN_USE', 409)
  throw new TalentServiceError(fallback)
}

function updatePayload<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as T
}

export async function getTalentLevelModel() {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const [modelResult, levelsResult] = await Promise.all([
    supabase.from('talent_level_models').select('*').eq('tenant_id', context.tenantId).order('code').limit(1).maybeSingle(),
    supabase.from('talent_levels').select('*').eq('tenant_id', context.tenantId).order('sort_order').order('code').limit(100),
  ])
  if (modelResult.error || levelsResult.error) throw new TalentServiceError('TALENT_LEVEL_MODEL_READ_FAILED')
  return { model: modelResult.data, levels: levelsResult.data ?? [] }
}

export async function updateTalentLevelModel(modelId: string, input: TalentLevelModelUpdateInput) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const payload = updatePayload({
    code: input.code?.toUpperCase(),
    name: input.name,
    description: input.description,
    status: input.status,
    updated_by_user_id: context.userId,
  })
  const { data, error } = await supabase.from('talent_level_models').update(payload).eq('tenant_id', context.tenantId).eq('id', modelId).select('id').maybeSingle()
  if (error) databaseError(error.message, 'TALENT_LEVEL_MODEL_UPDATE_FAILED')
  if (!data) throw new TalentServiceError('TALENT_LEVEL_MODEL_NOT_FOUND', 404)
  return data.id
}

export async function createTalentLevel(input: TalentLevelCreateInput) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data, error } = await supabase.from('talent_levels').insert({
    tenant_id: context.tenantId,
    level_model_id: input.levelModelId,
    code: input.code.toUpperCase(),
    name: input.name,
    description: input.description ?? null,
    sort_order: input.sortOrder,
  }).select('id').single()
  if (error || !data) databaseError(error?.message ?? 'TALENT_LEVEL_CREATE_FAILED', 'TALENT_LEVEL_CREATE_FAILED')
  return data.id
}

export async function updateTalentLevel(levelId: string, input: TalentLevelUpdateInput) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const payload = updatePayload({
    code: input.code?.toUpperCase(),
    name: input.name,
    description: input.description,
    sort_order: input.sortOrder,
  })
  const { data, error } = await supabase.from('talent_levels').update(payload).eq('tenant_id', context.tenantId).eq('id', levelId).select('id').maybeSingle()
  if (error) databaseError(error.message, 'TALENT_LEVEL_UPDATE_FAILED')
  if (!data) throw new TalentServiceError('TALENT_LEVEL_NOT_FOUND', 404)
  return data.id
}

export async function deleteTalentLevel(levelId: string) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { count, error: contentError } = await supabase.from('talent_capability_level_content').select('id', { count: 'exact', head: true }).eq('tenant_id', context.tenantId).eq('talent_level_id', levelId)
  if (contentError) throw new TalentServiceError('TALENT_LEVEL_USAGE_READ_FAILED')
  const { count: requirementCount, error: requirementError } = await supabase.from('job_profile_capability_requirements').select('id', { count: 'exact', head: true }).eq('tenant_id', context.tenantId).eq('target_level_id', levelId)
  if (requirementError) throw new TalentServiceError('TALENT_LEVEL_USAGE_READ_FAILED')
  if ((count ?? 0) + (requirementCount ?? 0) > 0) throw new TalentServiceError('LEVEL_IN_USE', 409)
  const { data, error } = await supabase.from('talent_levels').delete().eq('tenant_id', context.tenantId).eq('id', levelId).select('id').maybeSingle()
  if (error) databaseError(error.message, 'TALENT_LEVEL_DELETE_FAILED')
  if (!data) throw new TalentServiceError('TALENT_LEVEL_NOT_FOUND', 404)
  return data.id
}

export async function reorderTalentLevels(input: TalentLevelReorderInput) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data: levels, error: readError } = await supabase.from('talent_levels').select('id').eq('tenant_id', context.tenantId).limit(100)
  if (readError) throw new TalentServiceError('TALENT_LEVEL_READ_FAILED')
  const currentIds = new Set((levels ?? []).map((level) => level.id))
  if (currentIds.size !== input.levelIds.length || input.levelIds.some((id) => !currentIds.has(id))) throw new TalentServiceError('TALENT_LEVEL_ORDER_INVALID', 400)
  for (const [index, levelId] of input.levelIds.entries()) {
    const { error } = await supabase.from('talent_levels').update({ sort_order: index + 1 }).eq('tenant_id', context.tenantId).eq('id', levelId)
    if (error) databaseError(error.message, 'TALENT_LEVEL_REORDER_FAILED')
  }
}

export async function createTalentSeniority(input: TalentSeniorityCreateInput) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data, error } = await supabase.from('talent_seniorities').insert({
    tenant_id: context.tenantId, code: input.code.toUpperCase(), name: input.name,
    description: input.description ?? null, sort_order: input.sortOrder,
  }).select('id').single()
  if (error || !data) databaseError(error?.message ?? 'TALENT_SENIORITY_CREATE_FAILED', 'TALENT_SENIORITY_CREATE_FAILED')
  return data.id
}

export async function listTalentSeniorities() {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data, error } = await supabase.from('talent_seniorities').select('*').eq('tenant_id', context.tenantId).order('sort_order').order('code').limit(500)
  if (error) throw new TalentServiceError('TALENT_SENIORITY_READ_FAILED')
  return data ?? []
}

export async function updateTalentSeniority(seniorityId: string, input: TalentSeniorityUpdateInput) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const payload = updatePayload({
    code: input.code?.toUpperCase(),
    name: input.name,
    description: input.description,
    sort_order: input.sortOrder,
    status: input.status,
  })
  const { data, error } = await supabase.from('talent_seniorities').update(payload).eq('tenant_id', context.tenantId).eq('id', seniorityId).select('id').maybeSingle()
  if (error) databaseError(error.message, 'TALENT_SENIORITY_UPDATE_FAILED')
  if (!data) throw new TalentServiceError('TALENT_SENIORITY_NOT_FOUND', 404)
  return data.id
}

export async function deleteTalentSeniority(seniorityId: string) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { count, error: usageError } = await supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('tenant_id', context.tenantId).eq('seniority_id', seniorityId)
  if (usageError) throw new TalentServiceError('TALENT_SENIORITY_USAGE_READ_FAILED')
  if ((count ?? 0) > 0) throw new TalentServiceError('SENIORITY_IN_USE', 409)
  const { data, error } = await supabase.from('talent_seniorities').delete().eq('tenant_id', context.tenantId).eq('id', seniorityId).select('id').maybeSingle()
  if (error) databaseError(error.message, 'TALENT_SENIORITY_DELETE_FAILED')
  if (!data) throw new TalentServiceError('TALENT_SENIORITY_NOT_FOUND', 404)
  return data.id
}

export async function createTalentCategory(input: TalentCategoryCreateInput) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data, error } = await supabase.from('talent_categories').insert({
    tenant_id: context.tenantId,
    code: input.code.toUpperCase(),
    name: input.name,
    description: input.description ?? null,
    capability_types: input.capabilityTypes,
  }).select('id').single()
  if (error || !data) databaseError(error?.message ?? 'TALENT_CATEGORY_CREATE_FAILED', 'TALENT_CATEGORY_CREATE_FAILED')
  return data.id
}

export async function listTalentCategories() {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data, error } = await supabase.from('talent_categories').select('*').eq('tenant_id', context.tenantId).order('code').limit(500)
  if (error) throw new TalentServiceError('TALENT_CATEGORY_READ_FAILED')
  return data ?? []
}

export async function updateTalentCategory(categoryId: string, input: TalentCategoryUpdateInput) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const payload = updatePayload({
    code: input.code?.toUpperCase(),
    name: input.name,
    description: input.description,
    capability_types: input.capabilityTypes,
    status: input.status,
  })
  const { data, error } = await supabase.from('talent_categories').update(payload).eq('tenant_id', context.tenantId).eq('id', categoryId).select('id').maybeSingle()
  if (error) databaseError(error.message, 'TALENT_CATEGORY_UPDATE_FAILED')
  if (!data) throw new TalentServiceError('TALENT_CATEGORY_NOT_FOUND', 404)
  return data.id
}

export async function deleteTalentCategory(categoryId: string) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { count, error: usageError } = await supabase.from('talent_capabilities').select('id', { count: 'exact', head: true }).eq('tenant_id', context.tenantId).eq('category_id', categoryId)
  if (usageError) throw new TalentServiceError('TALENT_CATEGORY_USAGE_READ_FAILED')
  if ((count ?? 0) > 0) throw new TalentServiceError('CATEGORY_IN_USE', 409)
  const { data, error } = await supabase.from('talent_categories').delete().eq('tenant_id', context.tenantId).eq('id', categoryId).select('id').maybeSingle()
  if (error) databaseError(error.message, 'TALENT_CATEGORY_DELETE_FAILED')
  if (!data) throw new TalentServiceError('TALENT_CATEGORY_NOT_FOUND', 404)
  return data.id
}

export async function createTalentCapability(input: TalentCapabilityCreateInput) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const insert: TalentTables['talent_capabilities']['Insert'] = {
    tenant_id: context.tenantId,
    category_id: input.categoryId ?? null,
    capability_type: input.capabilityType,
    code: input.code.toUpperCase(),
    name: input.name,
    normalized_name: normalizeCatalogName(input.name),
    description: input.description ?? null,
    language_code: input.languageCode ?? null,
    language_cefr: input.languageCefr ?? null,
    language_is_native: input.languageIsNative,
    certificate_issuing_body: input.certificateIssuingBody ?? null,
    certificate_validity_months: input.certificateValidityMonths ?? null,
    certificate_is_permanent: input.certificateIsPermanent,
    certificate_code: input.certificateCode ?? null,
    certificate_renewal_required: input.certificateRenewalRequired,
  }
  const { data, error } = await supabase.from('talent_capabilities').insert(insert).select('id').single()
  if (error || !data) databaseError(error?.message ?? 'TALENT_CAPABILITY_CREATE_FAILED', 'TALENT_CAPABILITY_CREATE_FAILED')
  return data.id
}

export async function listTalentCapabilities(input: {
  search?: string
  capabilityType?: string
  categoryId?: string
  status?: string
  tagId?: string
  page: number
  pageSize: number
}) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  let capabilityIdsForTag: string[] | null = null
  if (input.tagId) {
    const { data, error } = await supabase.from('talent_capability_tags').select('capability_id').eq('tenant_id', context.tenantId).eq('tag_id', input.tagId).limit(5000)
    if (error) throw new TalentServiceError('TALENT_CAPABILITY_TAG_READ_FAILED')
    capabilityIdsForTag = (data ?? []).map((row) => row.capability_id)
    if (capabilityIdsForTag.length === 0) return { items: [], total: 0, page: input.page, pageSize: input.pageSize }
  }

  let query = supabase.from('talent_capabilities').select('*', { count: 'exact' }).eq('tenant_id', context.tenantId)
  if (input.search) {
    const search = input.search.replace(/[%_,]/g, ' ').trim()
    if (search) query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,description.ilike.%${search}%`)
  }
  if (input.capabilityType) query = query.eq('capability_type', input.capabilityType)
  if (input.categoryId) query = query.eq('category_id', input.categoryId)
  if (input.status) query = query.eq('status', input.status)
  if (capabilityIdsForTag) query = query.in('id', capabilityIdsForTag)
  const start = (input.page - 1) * input.pageSize
  const { data, count, error } = await query.order('name').range(start, start + input.pageSize - 1)
  if (error) throw new TalentServiceError('TALENT_CAPABILITY_READ_FAILED')
  return { items: data ?? [], total: count ?? 0, page: input.page, pageSize: input.pageSize }
}

export async function getTalentCapability(capabilityId: string) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const [capabilityResult, contentResult, tagsResult, usageResult] = await Promise.all([
    supabase.from('talent_capabilities').select('*').eq('tenant_id', context.tenantId).eq('id', capabilityId).maybeSingle(),
    supabase.from('talent_capability_level_content').select('*').eq('tenant_id', context.tenantId).eq('capability_id', capabilityId).order('talent_level_id').limit(100),
    supabase.from('talent_capability_tags').select('tag_id').eq('tenant_id', context.tenantId).eq('capability_id', capabilityId).limit(100),
    supabase.from('job_profile_capability_requirements').select('id', { count: 'exact', head: true }).eq('tenant_id', context.tenantId).eq('capability_id', capabilityId),
  ])
  if (capabilityResult.error || contentResult.error || tagsResult.error || usageResult.error) throw new TalentServiceError('TALENT_CAPABILITY_READ_FAILED')
  if (!capabilityResult.data) throw new TalentServiceError('TALENT_CAPABILITY_NOT_FOUND', 404)
  return {
    capability: capabilityResult.data,
    levelContent: contentResult.data ?? [],
    tagIds: (tagsResult.data ?? []).map((row) => row.tag_id),
    usageCount: usageResult.count ?? 0,
  }
}

export async function updateTalentCapability(capabilityId: string, input: TalentCapabilityUpdateInput) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data: current, error: currentError } = await supabase.from('talent_capabilities').select('id, capability_type, name').eq('tenant_id', context.tenantId).eq('id', capabilityId).maybeSingle()
  if (currentError) throw new TalentServiceError('TALENT_CAPABILITY_READ_FAILED')
  if (!current) throw new TalentServiceError('TALENT_CAPABILITY_NOT_FOUND', 404)
  const payload = updatePayload({
    name: input.name,
    normalized_name: input.name ? normalizeCatalogName(input.name) : undefined,
    description: input.description,
    category_id: input.categoryId,
    status: input.status,
    language_code: input.languageCode,
    language_cefr: input.languageCefr,
    language_is_native: input.languageIsNative,
    certificate_issuing_body: input.certificateIssuingBody,
    certificate_validity_months: input.certificateValidityMonths,
    certificate_is_permanent: input.certificateIsPermanent,
    certificate_code: input.certificateCode,
    certificate_renewal_required: input.certificateRenewalRequired,
  })
  const { data, error } = await supabase.from('talent_capabilities').update(payload).eq('tenant_id', context.tenantId).eq('id', capabilityId).select('id').maybeSingle()
  if (error) databaseError(error.message, 'TALENT_CAPABILITY_UPDATE_FAILED')
  if (!data) throw new TalentServiceError('TALENT_CAPABILITY_NOT_FOUND', 404)
  return data.id
}

export async function deleteTalentCapability(capabilityId: string) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { count, error: usageError } = await supabase.from('job_profile_capability_requirements').select('id', { count: 'exact', head: true }).eq('tenant_id', context.tenantId).eq('capability_id', capabilityId)
  if (usageError) throw new TalentServiceError('TALENT_CAPABILITY_USAGE_READ_FAILED')
  if ((count ?? 0) > 0) throw new TalentServiceError('CAPABILITY_IN_USE', 409)
  const { data, error } = await supabase.from('talent_capabilities').delete().eq('tenant_id', context.tenantId).eq('id', capabilityId).select('id').maybeSingle()
  if (error) databaseError(error.message, 'TALENT_CAPABILITY_DELETE_FAILED')
  if (!data) throw new TalentServiceError('TALENT_CAPABILITY_NOT_FOUND', 404)
  return data.id
}

export async function saveTalentCapabilityLevelContent(capabilityId: string, input: TalentCapabilityLevelContentInput) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data, error } = await supabase.from('talent_capability_level_content').upsert({
    tenant_id: context.tenantId,
    capability_id: capabilityId,
    talent_level_id: input.talentLevelId,
    indicator_text: input.indicatorText,
    examples: input.examples ?? null,
    coaching_notes: input.coachingNotes ?? null,
  }, { onConflict: 'tenant_id,capability_id,talent_level_id' }).select('id').single()
  if (error || !data) databaseError(error?.message ?? 'TALENT_CAPABILITY_LEVEL_CONTENT_SAVE_FAILED', 'TALENT_CAPABILITY_LEVEL_CONTENT_SAVE_FAILED')
  return data.id
}

export async function deleteTalentCapabilityLevelContent(contentId: string) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data, error } = await supabase.from('talent_capability_level_content').delete().eq('tenant_id', context.tenantId).eq('id', contentId).select('id').maybeSingle()
  if (error) databaseError(error.message, 'TALENT_CAPABILITY_LEVEL_CONTENT_DELETE_FAILED')
  if (!data) throw new TalentServiceError('TALENT_CAPABILITY_LEVEL_CONTENT_NOT_FOUND', 404)
  return data.id
}

export async function replaceTalentCapabilityTags(capabilityId: string, input: TalentCapabilityTagInput[]) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const tagIds = [...new Set(input.map((tag) => tag.tagId))]
  const supabase = await createClient()
  if (tagIds.length > 0) {
    const { data, error } = await supabase.from('star_performer_tags').select('id').eq('tenant_id', context.tenantId).eq('is_active', true).in('id', tagIds).limit(100)
    if (error) throw new TalentServiceError('TALENT_TAG_READ_FAILED')
    if ((data ?? []).length !== tagIds.length) throw new TalentServiceError('TALENT_TAG_NOT_ACTIVE', 409)
  }
  const { error: deleteError } = await supabase.from('talent_capability_tags').delete().eq('tenant_id', context.tenantId).eq('capability_id', capabilityId)
  if (deleteError) databaseError(deleteError.message, 'TALENT_CAPABILITY_TAG_DELETE_FAILED')
  if (tagIds.length === 0) return
  const { error: insertError } = await supabase.from('talent_capability_tags').insert(tagIds.map((tagId) => ({ tenant_id: context.tenantId, capability_id: capabilityId, tag_id: tagId })))
  if (insertError) databaseError(insertError.message, 'TALENT_CAPABILITY_TAG_SAVE_FAILED')
}

export async function createJobFamily(input: JobFamilyCreateInput) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data, error } = await supabase.from('job_families').insert({
    tenant_id: context.tenantId, code: input.code.toUpperCase(), name: input.name, description: input.description ?? null,
  }).select('id').single()
  if (error || !data) throw new TalentServiceError('JOB_FAMILY_CREATE_FAILED')
  return data.id
}

export async function updateJobFamily(familyId: string, input: JobFamilyUpdateInput) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const payload = updatePayload({
    code: input.code?.toUpperCase(),
    name: input.name,
    description: input.description,
    status: input.status,
  })
  const { data, error } = await supabase.from('job_families').update(payload).eq('tenant_id', context.tenantId).eq('id', familyId).select('id').maybeSingle()
  if (error) databaseError(error.message, 'JOB_FAMILY_UPDATE_FAILED')
  if (!data) throw new TalentServiceError('JOB_FAMILY_NOT_FOUND', 404)
  return data.id
}

export async function deleteJobFamily(familyId: string) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { count, error: usageError } = await supabase.from('job_groups').select('id', { count: 'exact', head: true }).eq('tenant_id', context.tenantId).eq('job_family_id', familyId)
  if (usageError) throw new TalentServiceError('JOB_FAMILY_USAGE_READ_FAILED')
  if ((count ?? 0) > 0) throw new TalentServiceError('JOB_FAMILY_IN_USE', 409)
  const { data, error } = await supabase.from('job_families').delete().eq('tenant_id', context.tenantId).eq('id', familyId).select('id').maybeSingle()
  if (error) databaseError(error.message, 'JOB_FAMILY_DELETE_FAILED')
  if (!data) throw new TalentServiceError('JOB_FAMILY_NOT_FOUND', 404)
  return data.id
}

type TalentJobProfileRow = Database['public']['Tables']['job_profiles']['Row']
type TalentJobRow = Database['public']['Tables']['jobs']['Row']
type TalentJobGroupRow = Database['public']['Tables']['job_groups']['Row']
type TalentJobFamilyRow = Database['public']['Tables']['job_families']['Row']
type TalentProfileVersionRow = Database['public']['Tables']['job_profile_versions']['Row']
type TalentProfileRequirementRow = Database['public']['Tables']['job_profile_capability_requirements']['Row']

export type TalentProfileManagementItem = {
  profile: TalentJobProfileRow
  job: TalentJobRow
  group: TalentJobGroupRow | null
  family: TalentJobFamilyRow | null
  seniority: Database['public']['Tables']['talent_seniorities']['Row'] | null
  versions: TalentProfileVersionRow[]
}

export type TalentProfileRequirementDetail = TalentProfileRequirementRow & {
  capability: Database['public']['Tables']['talent_capabilities']['Row'] | null
  targetLevel: Database['public']['Tables']['talent_levels']['Row'] | null
}

export type TalentProfileEditor = TalentProfileManagementItem & {
  requirements: Record<string, TalentProfileRequirementDetail[]>
}

async function readTalentProfileManagement(context: Awaited<ReturnType<typeof requirePermission>>): Promise<TalentProfileManagementItem[]> {
  const supabase = await createClient()
  const [profiles, jobs, groups, families, seniorities, versions] = await Promise.all([
    supabase.from('job_profiles').select('*').eq('tenant_id', context.tenantId).order('updated_at', { ascending: false }).limit(500),
    supabase.from('jobs').select('*').eq('tenant_id', context.tenantId).order('code').limit(500),
    supabase.from('job_groups').select('*').eq('tenant_id', context.tenantId).order('code').limit(500),
    supabase.from('job_families').select('*').eq('tenant_id', context.tenantId).order('code').limit(500),
    supabase.from('talent_seniorities').select('*').eq('tenant_id', context.tenantId).order('sort_order').order('code').limit(500),
    supabase.from('job_profile_versions').select('*').eq('tenant_id', context.tenantId).order('version_number').limit(2000),
  ])
  const error = profiles.error ?? jobs.error ?? groups.error ?? families.error ?? seniorities.error ?? versions.error
  if (error) throw new TalentServiceError('TALENT_PROFILE_MANAGEMENT_READ_FAILED')
  const groupsById = new Map((groups.data ?? []).map((item) => [item.id, item]))
  const familiesById = new Map((families.data ?? []).map((item) => [item.id, item]))
  const senioritiesById = new Map((seniorities.data ?? []).map((item) => [item.id, item]))
  const jobsById = new Map((jobs.data ?? []).map((item) => [item.id, item]))
  const versionsByProfile = new Map<string, TalentProfileVersionRow[]>()
  for (const version of versions.data ?? []) {
    const list = versionsByProfile.get(version.job_profile_id) ?? []
    list.push(version)
    versionsByProfile.set(version.job_profile_id, list)
  }
  return (profiles.data ?? []).flatMap((profile) => {
    const job = jobsById.get(profile.job_id)
    if (!job) return []
    const group = groupsById.get(job.job_group_id) ?? null
    return [{
      profile,
      job,
      group,
      family: group?.job_family_id ? familiesById.get(group.job_family_id) ?? null : null,
      seniority: job.seniority_id ? senioritiesById.get(job.seniority_id) ?? null : null,
      versions: (versionsByProfile.get(profile.id) ?? []).sort((left, right) => right.version_number - left.version_number),
    }]
  })
}

export async function listTalentProfileManagement() {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  return readTalentProfileManagement(context)
}

export async function getTalentProfileEditor(profileId: string): Promise<TalentProfileEditor> {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const profiles = await readTalentProfileManagement(context)
  const profile = profiles.find((item) => item.profile.id === profileId)
  if (!profile) throw new TalentServiceError('JOB_PROFILE_NOT_FOUND', 404)
  const supabase = await createClient()
  const versionIds = profile.versions.map((version) => version.id)
  const [requirements, capabilities, levels] = await Promise.all([
    versionIds.length > 0
      ? supabase.from('job_profile_capability_requirements').select('*').eq('tenant_id', context.tenantId).in('profile_version_id', versionIds).order('sort_order')
      : Promise.resolve({ data: [], error: null }),
    supabase.from('talent_capabilities').select('*').eq('tenant_id', context.tenantId).order('name').limit(1000),
    supabase.from('talent_levels').select('*').eq('tenant_id', context.tenantId).order('sort_order').limit(100),
  ])
  if (requirements.error || capabilities.error || levels.error) throw new TalentServiceError('TALENT_PROFILE_EDITOR_READ_FAILED')
  const capabilitiesById = new Map((capabilities.data ?? []).map((item) => [item.id, item]))
  const levelsById = new Map((levels.data ?? []).map((item) => [item.id, item]))
  const grouped: Record<string, TalentProfileRequirementDetail[]> = {}
  for (const requirement of requirements.data ?? []) {
    const list = grouped[requirement.profile_version_id] ?? []
    list.push({ ...requirement, capability: capabilitiesById.get(requirement.capability_id) ?? null, targetLevel: requirement.target_level_id ? levelsById.get(requirement.target_level_id) ?? null : null })
    grouped[requirement.profile_version_id] = list
  }
  return { ...profile, requirements: grouped }
}

export async function createJobProfile(input: JobProfileCreateInput) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data: profile, error: profileError } = await supabase.from('job_profiles').insert({
    tenant_id: context.tenantId, job_id: input.jobId, created_by_user_id: context.userId, updated_by_user_id: context.userId,
  }).select('id').single()
  if (profileError || !profile) throw new TalentServiceError('JOB_PROFILE_CREATE_FAILED')
  const { error: versionError } = await supabase.from('job_profile_versions').insert({
    tenant_id: context.tenantId, job_profile_id: profile.id, version_number: 1, status: 'DRAFT',
    purpose: input.purpose ?? null, summary: input.summary ?? null, created_by_user_id: context.userId,
  })
  if (versionError) throw new TalentServiceError('JOB_PROFILE_VERSION_CREATE_FAILED')
  return profile.id
}

export async function updateJobProfileVersion(versionId: string, input: JobProfileVersionUpdateInput) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data: current, error: currentError } = await supabase.from('job_profile_versions').select('*').eq('tenant_id', context.tenantId).eq('id', versionId).maybeSingle()
  if (currentError) throw new TalentServiceError('JOB_PROFILE_VERSION_READ_FAILED')
  if (!current) throw new TalentServiceError('JOB_PROFILE_VERSION_NOT_FOUND', 404)
  if (input.updatedAt && input.updatedAt !== current.updated_at) throw new TalentServiceError('JOB_PROFILE_VERSION_CONCURRENCY_CONFLICT', 409)
  if (current.status !== 'DRAFT') throw new TalentServiceError('JOB_PROFILE_VERSION_READ_ONLY', 409)
  const payload: TalentTables['job_profile_versions']['Update'] = {
    valid_from: input.validFrom ?? undefined,
    valid_until: input.validUntil ?? undefined,
    purpose: input.purpose,
    summary: input.summary,
    organizational_context: input.organizationalContext,
    tasks: input.tasks as Json | undefined,
    responsibilities: input.responsibilities as Json | undefined,
    result_areas: input.resultAreas as Json | undefined,
    updated_by_user_id: context.userId,
  }
  const { data, error } = await supabase.from('job_profile_versions').update(payload)
    .eq('tenant_id', context.tenantId).eq('id', versionId).eq('updated_at', current.updated_at).select('*').maybeSingle()
  if (error) databaseError(error.message, 'JOB_PROFILE_VERSION_UPDATE_FAILED')
  if (!data) throw new TalentServiceError('JOB_PROFILE_VERSION_CONCURRENCY_CONFLICT', 409)
  if (input.status === 'ACTIVE') return activateJobProfileVersion(versionId, { validFrom: input.validFrom ?? undefined, validUntil: input.validUntil ?? undefined, updatedAt: data.updated_at })
  return data
}

export async function copyJobProfileVersionToDraft(profileId: string, input: JobProfileVersionCopyInput) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('copy_job_profile_version_to_draft', {
    requested_tenant_id: context.tenantId,
    requested_profile_id: profileId,
    requested_source_version_id: input.sourceVersionId ?? undefined,
  })
  if (error || !data) databaseError(error?.message ?? 'JOB_PROFILE_VERSION_COPY_FAILED', 'JOB_PROFILE_VERSION_COPY_FAILED')
  return data
}

export async function activateJobProfileVersion(versionId: string, input: JobProfileVersionActivateInput) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data: current, error: currentError } = await supabase.from('job_profile_versions').select('*').eq('tenant_id', context.tenantId).eq('id', versionId).maybeSingle()
  if (currentError) throw new TalentServiceError('JOB_PROFILE_VERSION_READ_FAILED')
  if (!current) throw new TalentServiceError('JOB_PROFILE_VERSION_NOT_FOUND', 404)
  if (current.status !== 'DRAFT') throw new TalentServiceError('JOB_PROFILE_VERSION_READ_ONLY', 409)
  if (input.updatedAt && input.updatedAt !== current.updated_at) throw new TalentServiceError('JOB_PROFILE_VERSION_CONCURRENCY_CONFLICT', 409)
  const { error: updateError } = await supabase.from('job_profile_versions').update({
    valid_from: input.validFrom ?? current.valid_from,
    valid_until: input.validUntil ?? current.valid_until,
    updated_by_user_id: context.userId,
  }).eq('tenant_id', context.tenantId).eq('id', versionId).eq('updated_at', current.updated_at)
  if (updateError) databaseError(updateError.message, 'JOB_PROFILE_VERSION_UPDATE_FAILED')
  const { data, error } = await supabase.rpc('activate_job_profile_version', { requested_tenant_id: context.tenantId, requested_version_id: versionId })
  if (error || !data) databaseError(error?.message ?? 'JOB_PROFILE_ACTIVATION_FAILED', 'JOB_PROFILE_ACTIVATION_FAILED')
  return data
}

export async function addTalentProfileRequirement(versionId: string, input: JobProfileRequirementCreateInput) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data: version, error: versionError } = await supabase.from('job_profile_versions').select('status').eq('tenant_id', context.tenantId).eq('id', versionId).maybeSingle()
  if (versionError) throw new TalentServiceError('JOB_PROFILE_VERSION_READ_FAILED')
  if (!version) throw new TalentServiceError('JOB_PROFILE_VERSION_NOT_FOUND', 404)
  if (version.status !== 'DRAFT') throw new TalentServiceError('JOB_PROFILE_VERSION_READ_ONLY', 409)
  const { data, error } = await supabase.from('job_profile_capability_requirements').insert({
    tenant_id: context.tenantId, profile_version_id: versionId, capability_id: input.capabilityId,
    requirement_type: input.requirementType, target_level_id: input.targetLevelId ?? null,
    language_level: input.languageLevel ?? null, certificate_details: input.certificateDetails as Json | null ?? null,
    rationale: input.rationale ?? null, sort_order: input.sortOrder,
  }).select('*').single()
  if (error || !data) databaseError(error?.message ?? 'TALENT_PROFILE_REQUIREMENT_CREATE_FAILED', 'TALENT_PROFILE_REQUIREMENT_CREATE_FAILED')
  return data
}

export async function updateTalentProfileRequirement(requirementId: string, input: JobProfileRequirementUpdateInput) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data: current, error: currentError } = await supabase.from('job_profile_capability_requirements').select('*, job_profile_versions!inner(status)').eq('tenant_id', context.tenantId).eq('id', requirementId).maybeSingle()
  if (currentError) throw new TalentServiceError('TALENT_PROFILE_REQUIREMENT_READ_FAILED')
  if (!current) throw new TalentServiceError('TALENT_PROFILE_REQUIREMENT_NOT_FOUND', 404)
  const currentVersion = current.job_profile_versions as unknown as { status: string }
  if (currentVersion.status !== 'DRAFT') throw new TalentServiceError('JOB_PROFILE_VERSION_READ_ONLY', 409)
  const { data, error } = await supabase.from('job_profile_capability_requirements').update({
    capability_id: input.capabilityId, requirement_type: input.requirementType, target_level_id: input.targetLevelId,
    language_level: input.languageLevel, certificate_details: input.certificateDetails as Json | null,
    rationale: input.rationale, sort_order: input.sortOrder,
  }).eq('tenant_id', context.tenantId).eq('id', requirementId).select('*').maybeSingle()
  if (error || !data) databaseError(error?.message ?? 'TALENT_PROFILE_REQUIREMENT_UPDATE_FAILED', 'TALENT_PROFILE_REQUIREMENT_UPDATE_FAILED')
  return data
}

export async function deleteTalentProfileRequirement(requirementId: string) {
  const context = await requirePermission('talent:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data: current, error: currentError } = await supabase.from('job_profile_capability_requirements').select('id, job_profile_versions!inner(status)').eq('tenant_id', context.tenantId).eq('id', requirementId).maybeSingle()
  if (currentError) throw new TalentServiceError('TALENT_PROFILE_REQUIREMENT_READ_FAILED')
  if (!current) throw new TalentServiceError('TALENT_PROFILE_REQUIREMENT_NOT_FOUND', 404)
  const currentVersion = current.job_profile_versions as unknown as { status: string }
  if (currentVersion.status !== 'DRAFT') throw new TalentServiceError('JOB_PROFILE_VERSION_READ_ONLY', 409)
  const { data, error } = await supabase.from('job_profile_capability_requirements').delete().eq('tenant_id', context.tenantId).eq('id', requirementId).select('id').maybeSingle()
  if (error || !data) databaseError(error?.message ?? 'TALENT_PROFILE_REQUIREMENT_DELETE_FAILED', 'TALENT_PROFILE_REQUIREMENT_DELETE_FAILED')
  return data.id
}

export async function getMyTalentProfile() {
  const context = await requirePermission('self:talent:read')
  await requireTenantModule('TALENT')
  if (!context.employeeId) return null
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_my_talent_profile', { requested_tenant_id: context.tenantId }).maybeSingle()
  if (error) throw new TalentServiceError('MY_TALENT_PROFILE_READ_FAILED')
  if (!data) return null
  const { data: requirements, error: requirementError } = await supabase.rpc('get_my_talent_profile_requirements', {
    requested_tenant_id: context.tenantId,
    requested_profile_version_id: data.profile_version_id,
  })
  if (requirementError) throw new TalentServiceError('MY_TALENT_PROFILE_READ_FAILED')
  return { ...data, requirements: requirements ?? [] } satisfies MyTalentProfile
}
