import 'server-only'

import { createHash } from 'node:crypto'
import type { Json } from '@scope/db'
import { AuthorizationError, requireAnyPermission, requirePermission, requireHrGroupId } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import {
  acknowledgementSchema,
  additionalReviewerSubmissionSchema,
  managerSubmissionSchema,
  reviewerRoleAssignmentSchema,
  roleFlipApplySchema,
  roleFlipPreviewSchema,
  roundSchema,
} from './performance-schema'
import { sanitizeDocumentFilename, validateDocumentFile } from '@/lib/documents/file-rules'
import { parseQuestionSetOverrides, savePerformanceReviewRoundQuestionSets, type QuestionSetRole } from './question-set-service'
import { PerformanceReviewError } from './performance-error'
export { PerformanceReviewError } from './performance-error'
import { questionAnswersSchema } from './question-set-schema'

type Client = Awaited<ReturnType<typeof createClient>>

export type PerformanceReviewErrorCode =
  | 'PERFORMANCE_REVIEW_READ_FAILED'
  | 'PERFORMANCE_REVIEW_COMMAND_FAILED'
  | 'PERFORMANCE_REVIEW_FORBIDDEN'
  | 'PERFORMANCE_REVIEW_NOT_FOUND'
  | 'PERFORMANCE_REVIEW_CONFLICT'

type RoundInput = {
  title: string
  introduction: string
  roundType: string
  periodStart: string
  periodEnd: string
  startDate: string
  dueDate?: string | null
  rating: { options: Array<{ score: number; label: string; description: string }> } | null
  additionalReviewerEnabled: boolean
  questionSets?: { enabled: boolean; defaults: Record<QuestionSetRole, string | null> }
}

function toError(error: { message?: string } | null, fallback: PerformanceReviewErrorCode): never {
  const message = error?.message ?? fallback
  const normalized = message.toLocaleUpperCase('en-US')
  const status = normalized.includes('FORBIDDEN') || normalized.includes('NOT_AUTHORIZED') ? 403 : normalized.includes('NOT_FOUND') || normalized.includes('MODULE_INACTIVE') ? 404 : normalized.includes('CONFLICT') || normalized.includes('IMMUTABLE') || normalized.includes('NOT_AVAILABLE') ? 409 : /PERFORMANCE_(?:RATING_(?:INVALID|NOT_ALLOWED|REQUIRED)|QUESTION_(?:SET|ANSWERS)_)/u.test(normalized) ? 400 : 500
  throw new PerformanceReviewError(normalized.match(/PERFORMANCE_[A-Z0-9_]+/)?.[0] ?? fallback, status)
}

async function contextFor(permission: string, employeeId?: string) {
  // Keep the canonical auth error intact so API routes preserve 401 for a
  // missing session and 403 for a signed-in actor without this permission.
  return requirePermission(permission, employeeId)
}

async function command(client: Client, name: string, args: Record<string, unknown>) {
  const result = await client.rpc(name as never, args as never)
  if (result.error) toError(result.error, 'PERFORMANCE_REVIEW_COMMAND_FAILED')
  return result.data
}

export async function createPerformanceReviewRound(input: unknown, idempotencyKey?: string | null) {
  const parsed = roundSchema.parse(input) as RoundInput
  const context = await contextFor('performance-review:manage')
  const hrGroupId = requireHrGroupId(context)
  const client = await createClient()
  const created = await command(client, 'create_performance_review_round_v2', {
    requested_hr_group: hrGroupId,
    requested_title: parsed.title,
    requested_introduction: parsed.introduction,
    requested_round_type: parsed.roundType,
    requested_period_start: parsed.periodStart,
    requested_period_end: parsed.periodEnd,
    requested_start_date: parsed.startDate,
    requested_due_date: parsed.dueDate ?? null,
    requested_rating_snapshot: parsed.rating as unknown as Json,
    requested_additional_reviewer_enabled: parsed.additionalReviewerEnabled,
    ...(idempotencyKey ? { requested_idempotency_key: idempotencyKey } : {}),
  })
  const createdRound = created as { id?: string }
  if (parsed.questionSets && createdRound.id) await savePerformanceReviewRoundQuestionSets({ roundId: createdRound.id, ...parsed.questionSets })
  return created
}

export async function updatePerformanceReviewRound(roundId: string, input: unknown, version: number) {
  const parsed = roundSchema.parse(input) as RoundInput
  await contextFor('performance-review:manage')
  const client = await createClient()
  const updated = await command(client, 'update_performance_review_round_v2', {
    requested_round: roundId,
    requested_title: parsed.title,
    requested_introduction: parsed.introduction,
    requested_round_type: parsed.roundType,
    requested_period_start: parsed.periodStart,
    requested_period_end: parsed.periodEnd,
    requested_start_date: parsed.startDate,
    requested_due_date: parsed.dueDate ?? null,
    requested_rating_snapshot: parsed.rating as unknown as Json,
    requested_additional_reviewer_enabled: parsed.additionalReviewerEnabled,
    expected_version: version,
  })
  if (parsed.questionSets) await savePerformanceReviewRoundQuestionSets({ roundId, ...parsed.questionSets })
  return updated
}

export async function publishPerformanceReviewRound(roundId: string, version = 1, idempotencyKey?: string | null) {
  await contextFor('performance-review:manage')
  const client = await createClient()
  return command(client, 'publish_performance_review_round', { requested_round: roundId, expected_version: version, ...(idempotencyKey ? { requested_idempotency_key: idempotencyKey } : {}) })
}

export async function addPerformanceReviewDossier(roundId: string, employeeId: string, reviewerEmployeeId?: string, administrationId?: string, idempotencyKey?: string | null, additionalReviewerEmployeeId?: string | null, questionSetOverrides?: unknown) {
  const context = await contextFor('performance-review:manage')
  const hrGroupId = requireHrGroupId(context)
  const client = await createClient()
  let reviewer = reviewerEmployeeId
  let administration = administrationId
  if (!reviewer || !administration) {
    const today = new Date().toISOString().slice(0, 10)
    const organization = await client.from('employee_organizations' as never).select('administration_id,direct_manager_id,direct_manager_deputy_id').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('employee_id', employeeId).lte('effective_from', today).or(`effective_to.is.null,effective_to.gte.${today}`).order('effective_from', { ascending: false }).limit(20)
    if (organization.error) toError(organization.error, 'PERFORMANCE_REVIEW_READ_FAILED')
    const assignments = (organization.data ?? []) as unknown as Array<{ administration_id: string; direct_manager_id: string | null; direct_manager_deputy_id: string | null }>
    if (assignments.length === 0) throw new PerformanceReviewError('PERFORMANCE_REVIEW_PARTICIPANTS_REQUIRED', 400)
    const candidateReviewers = Array.from(new Set(assignments.flatMap((assignment) => [assignment.direct_manager_id, assignment.direct_manager_deputy_id].filter((id): id is string => Boolean(id)))))
    const candidateAdministrations = Array.from(new Set(assignments.map((assignment) => assignment.administration_id)))
    reviewer ??= candidateReviewers.length === 1 ? candidateReviewers[0] : undefined
    administration ??= candidateAdministrations.length === 1 ? candidateAdministrations[0] : undefined
    if (reviewer && !candidateReviewers.includes(reviewer)) throw new PerformanceReviewError('PERFORMANCE_REVIEW_REVIEWER_INVALID', 400)
    if (administration && !candidateAdministrations.includes(administration)) throw new PerformanceReviewError('PERFORMANCE_REVIEW_ADMINISTRATION_INVALID', 400)
  }
  if (!reviewer || !administration) throw new PerformanceReviewError('PERFORMANCE_REVIEW_PARTICIPANTS_REQUIRED', 400)
  const args = {
    requested_round: roundId,
    requested_employee: employeeId,
    requested_reviewer: reviewer,
    requested_additional_reviewer: additionalReviewerEmployeeId ?? null,
    requested_administration: administration,
    ...(idempotencyKey ? { requested_idempotency_key: idempotencyKey } : {}),
  }
  const parsedOverrides = parseQuestionSetOverrides(questionSetOverrides)
  if (Object.keys(parsedOverrides).length > 0) {
    return command(client, 'add_performance_review_dossier_with_question_overrides', {
      ...args,
      requested_overrides: parsedOverrides,
    })
  }
  return command(client, 'add_performance_review_dossier_v2', args)
}

export async function searchPerformanceReviewEmployees(filters: {
  search?: string
  hrGroupId?: string | null
  administrationId?: string | null
  departmentId?: string | null
  jobId?: string | null
  locationId?: string | null
  managerId?: string | null
  employmentStatus?: 'ACTIVE' | 'ENDED' | 'ALL'
  employeeId?: string | null
  offset?: number
  limit?: number
} = {}) {
  const context = await contextFor('performance-review:manage')
  const hrGroupId = requireHrGroupId(context)
  if (filters.hrGroupId && filters.hrGroupId !== hrGroupId) throw new AuthorizationError('Geen toegang tot deze HR-groep.')
  const client = await createClient()
  const offset = Math.max(0, Math.min(10000, Math.trunc(filters.offset ?? 0)))
  const limit = Math.max(1, Math.min(100, Math.trunc(filters.limit ?? 25)))
  const result = await client.rpc('search_performance_review_candidates' as never, {
    requested_hr_group: hrGroupId,
    requested_search: (filters.search ?? '').trim().replace(/[^\p{L}\p{N}\s'-]/gu, '').slice(0, 120),
    requested_administration: filters.administrationId ?? null,
    requested_department: filters.departmentId ?? null,
    requested_job: filters.jobId ?? null,
    requested_location: filters.locationId ?? null,
    requested_manager: filters.managerId ?? null,
    requested_employment_status: filters.employmentStatus ?? 'ACTIVE',
    requested_employee: filters.employeeId ?? null,
    requested_offset: offset,
    requested_limit: limit,
  } as never)
  if (result.error) toError(result.error, 'PERFORMANCE_REVIEW_READ_FAILED')
  const items = (result.data ?? []) as unknown as Array<{
    employee_id: string
    first_name: string
    birth_name: string
    employee_number: string
    hr_group_id: string
    direct_manager_id: string | null
    direct_manager_name: string | null
    administration_id: string | null
    administration_name: string | null
    department_id: string | null
    department_name: string | null
    job_id: string | null
    job_title: string | null
    location_id: string | null
    location_name: string | null
    employment_status: string
    assignment_status: 'READY' | 'REVIEWER_REQUIRED' | 'ADMINISTRATION_REQUIRED'
    eligibility_message: string | null
    total_count: number
  }>
  const count = items[0]?.total_count ?? 0
  const reviewerSearch = Boolean(filters.employeeId)
  return {
    items: items.map((item) => ({
      id: item.employee_id,
      ...item,
      reviewerEmployeeId: reviewerSearch ? item.employee_id : item.direct_manager_id,
      reviewerName: reviewerSearch ? [item.first_name, item.birth_name].filter(Boolean).join(' ') || item.employee_number : item.direct_manager_name,
      administrationId: item.administration_id,
      administrationName: item.administration_name,
      assignmentStatus: item.assignment_status,
      eligibilityMessage: item.eligibility_message,
    })),
    nextCursor: offset + items.length < count ? String(offset + items.length) : null,
    total: count,
  }
}

export async function listPerformanceReviewEmployeeFilters(language: 'nl' | 'en' = 'nl') {
  const context = await contextFor('performance-review:manage')
  const hrGroupId = requireHrGroupId(context)
  const client = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const [hrGroup, administrations, departments, jobs, organizationRows] = await Promise.all([
    client.from('hr_groups').select('id,name').eq('tenant_id', context.tenantId).eq('id', hrGroupId).maybeSingle(),
    client.from('administrations').select('id,code,name').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).order('name').limit(200),
    client.from('departments').select('id,code,name').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).order('name').limit(500),
    client.from('jobs').select('id,code,job_revisions!job_revisions_job_hr_group_fkey(name,valid_from,valid_until)').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).order('code').limit(500),
    client.from('employee_organizations').select('direct_manager_id,direct_manager_deputy_id').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).lte('effective_from', today).or(`effective_to.is.null,effective_to.gte.${today}`).limit(5000),
  ])
  if (hrGroup.error || administrations.error || departments.error || jobs.error || organizationRows.error) {
    toError(hrGroup.error ?? administrations.error ?? departments.error ?? jobs.error ?? organizationRows.error, 'PERFORMANCE_REVIEW_READ_FAILED')
  }
  const locations = await client.from('administration_locations').select('id,name').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).order('name').limit(1000)
  if (locations.error) toError(locations.error, 'PERFORMANCE_REVIEW_READ_FAILED')
  const organizationValues = (organizationRows.data ?? []) as Array<{ direct_manager_id: string | null; direct_manager_deputy_id: string | null }>
  const managerIds = Array.from(new Set(organizationValues.flatMap((item) => [item.direct_manager_id, item.direct_manager_deputy_id].filter((id): id is string => Boolean(id)))))
  const managers = managerIds.length
    ? await client.from('employees' as never).select('id,first_name,birth_name,employee_number').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('id', managerIds).eq('is_active', true).eq('is_archived', false).is('deleted_at', null).order('birth_name').limit(1000)
    : { data: [], error: null }
  if (managers.error) toError(managers.error, 'PERFORMANCE_REVIEW_READ_FAILED')
  const jobRows = (jobs.data ?? []) as unknown as Array<{ id: string; code: string; job_revisions: Array<{ name: string; valid_from: string; valid_until: string | null }> | null }>
  return {
    hrGroups: hrGroup.data ? [{ id: hrGroup.data.id, label: hrGroup.data.name }] : [],
    administrations: (administrations.data ?? []).map((item) => ({ id: item.id, label: item.name, code: item.code })),
    departments: (departments.data ?? []).map((item) => ({ id: item.id, label: item.name, code: item.code })),
    jobs: jobRows.map((item) => ({ id: item.id, label: item.job_revisions?.[0]?.name ?? item.code, code: item.code })),
    locations: (locations.data ?? []).map((item) => ({ id: item.id, label: item.name })),
    managers: ((managers.data ?? []) as unknown as Array<{ id: string; first_name: string; birth_name: string; employee_number: string }>).map((item) => ({ id: item.id, label: [item.first_name, item.birth_name].filter(Boolean).join(' ') || item.employee_number })),
    employmentStatuses: [
      { id: 'ACTIVE', label: language === 'en' ? 'Active' : 'Actief' },
      { id: 'ENDED', label: language === 'en' ? 'Ended' : 'Beëindigd' },
      { id: 'ALL', label: language === 'en' ? 'All employments' : 'Alle dienstverbanden' },
    ],
  }
}

export async function listPerformanceReviewRounds() {
  const context = await contextFor('performance-review:read')
  const client = await createClient()
  const { data, error } = await client.from('performance_review_rounds' as never).select('*').eq('tenant_id', context.tenantId).order('start_date', { ascending: false })
  if (error) toError(error, 'PERFORMANCE_REVIEW_READ_FAILED')
  return data ?? []
}

export async function getPerformanceReviewRound(roundId: string) {
  const context = await contextFor('performance-review:read')
  const client = await createClient()
  const { data: round, error: roundError } = await client.from('performance_review_rounds' as never)
    .select('*')
    .eq('tenant_id', context.tenantId)
    .eq('id', roundId)
    .maybeSingle()
  if (roundError) toError(roundError, 'PERFORMANCE_REVIEW_READ_FAILED')
  if (!round) throw new PerformanceReviewError('PERFORMANCE_REVIEW_NOT_FOUND', 404)
  const { data: questionSetConfig, error: questionSetConfigError } = await client.from('performance_review_round_question_sets' as never)
    .select('enabled,defaults,published_defaults_snapshot,published_at').eq('round_id', roundId).maybeSingle()
  if (questionSetConfigError) toError(questionSetConfigError, 'PERFORMANCE_REVIEW_READ_FAILED')
  const { data, error } = await client.from('performance_review_dossiers' as never)
    .select('id,employee_id,reviewer_employee_id,additional_reviewer_employee_id,additional_reviewer_workflow,phase,version,created_at,performance_review_dossier_question_snapshots(respondent_role,selection_source,source_set_id,source_set_name,source_set_version,definition_json)')
    .eq('tenant_id', context.tenantId)
    .eq('round_id', roundId)
    .order('created_at', { ascending: false })
  if (error) toError(error, 'PERFORMANCE_REVIEW_READ_FAILED')
  const rows = (data ?? []) as unknown as Array<{ id: string; employee_id: string; reviewer_employee_id: string; additional_reviewer_employee_id: string | null; additional_reviewer_workflow: boolean; phase: string; version: number; created_at: string }>
  const employeeIds = Array.from(new Set(rows.flatMap((item) => [item.employee_id, item.reviewer_employee_id, ...(item.additional_reviewer_employee_id ? [item.additional_reviewer_employee_id] : [])])))
  const { data: employees, error: employeesError } = employeeIds.length
    ? await client.from('employees' as never).select('id,first_name,birth_name,employee_number').eq('tenant_id', context.tenantId).in('id', employeeIds)
    : { data: [], error: null }
  if (employeesError) toError(employeesError, 'PERFORMANCE_REVIEW_READ_FAILED')
  const names = new Map(((employees ?? []) as unknown as Array<{ id: string; first_name: string; birth_name: string; employee_number: string }>).map((item) => [item.id, [item.first_name, item.birth_name].filter(Boolean).join(' ') || item.employee_number]))
  return {
    ...(round as unknown as Record<string, unknown>),
    questionSetConfig: questionSetConfig ?? null,
    participants: rows.map((item) => ({
      id: item.id,
      employee_id: item.employee_id,
      reviewer_employee_id: item.reviewer_employee_id,
      additional_reviewer_employee_id: item.additional_reviewer_employee_id,
      additional_reviewer_workflow: item.additional_reviewer_workflow,
      employeeName: names.get(item.employee_id) ?? '',
      reviewerName: names.get(item.reviewer_employee_id) ?? '',
      additionalReviewerName: item.additional_reviewer_employee_id ? names.get(item.additional_reviewer_employee_id) ?? '' : '',
      phase: item.phase,
      version: item.version,
      created_at: item.created_at,
    })),
  }
}

export async function listPerformanceReviewWorkspace(role: 'hr' | 'manager' | 'employee' | 'additional-reviewer') {
  const context = role === 'hr'
    ? await contextFor('performance-review:read')
    : await requireAnyPermission(role === 'employee' || role === 'additional-reviewer'
      ? ['self:performance-review:read']
      : ['performance-review:team-read', 'performance-review:read'])
  if ((role === 'employee' || role === 'additional-reviewer') && !context.employeeId) throw new PerformanceReviewError('PERFORMANCE_REVIEW_FORBIDDEN', 403)
  const client = await createClient()
  let query = client.from('performance_review_dossiers' as never)
    .select('id,employee_id,reviewer_employee_id,additional_reviewer_employee_id,phase,version,created_at,performance_review_rounds(title,due_date,status)')
    .eq('tenant_id', context.tenantId)
    .order('created_at', { ascending: false })
  if (role === 'employee') query = query.eq('employee_id', context.employeeId as string)
  if (role === 'additional-reviewer') query = query.eq('additional_reviewer_employee_id', context.employeeId as string)
  const { data, error } = await query
  if (error) toError(error, 'PERFORMANCE_REVIEW_READ_FAILED')
  const rows = (data ?? []) as unknown as Array<{ id: string; employee_id: string; reviewer_employee_id: string; additional_reviewer_employee_id: string | null; phase: string; version: number; created_at: string; performance_review_rounds: { title: string; due_date: string | null; status: string } | null }>
  const employeeIds = Array.from(new Set(rows.flatMap((item) => role === 'additional-reviewer' ? [item.employee_id] : [item.employee_id, item.reviewer_employee_id])))
  const { data: employees, error: employeesError } = employeeIds.length
    ? await client.from('employees' as never).select('id,first_name,birth_name,employee_number').eq('tenant_id', context.tenantId).in('id', employeeIds)
    : { data: [], error: null }
  if (employeesError) toError(employeesError, 'PERFORMANCE_REVIEW_READ_FAILED')
  const names = new Map(((employees ?? []) as unknown as Array<{ id: string; first_name: string; birth_name: string; employee_number: string }>).map((item) => [item.id, [item.first_name, item.birth_name].filter(Boolean).join(' ') || item.employee_number]))
  return rows.map((item) => ({
    id: item.id,
    title: item.performance_review_rounds?.title ?? 'Performance review',
    employeeId: item.employee_id,
    employeeName: names.get(item.employee_id) ?? '',
    reviewerName: role === 'additional-reviewer' ? '' : names.get(item.reviewer_employee_id) ?? '',
    isAdditionalReviewerTask: role === 'additional-reviewer',
    phase: item.phase,
    version: item.version,
    dueDate: item.performance_review_rounds?.due_date ?? null,
    roundStatus: item.performance_review_rounds?.status ?? 'UNKNOWN',
    createdAt: item.created_at,
  }))
}

type PerformanceReviewDashboardItem = { id: string; title: string; phase: string; dueDate: string | null; roundStatus: string }

async function listPerformanceReviewDossierSummaries(role: 'hr' | 'manager' | 'employee' | 'additional-reviewer', employeeId?: string): Promise<PerformanceReviewDashboardItem[]> {
  const context = role === 'hr'
    ? await contextFor('performance-review:read')
    : await requireAnyPermission(role === 'employee' || role === 'additional-reviewer' ? ['self:performance-review:read'] : ['performance-review:team-read', 'performance-review:read'])
  if ((role === 'employee' || role === 'additional-reviewer') && !context.employeeId) throw new AuthorizationError('Medewerkerkoppeling ontbreekt.')
  const targetEmployeeId = employeeId ?? (role === 'employee' ? context.employeeId ?? undefined : undefined)
  if (employeeId && role !== 'employee' && role !== 'additional-reviewer') await requireAnyPermission(['performance-review:read', 'performance-review:team-read'], employeeId)
  const client = await createClient()
  let query = client.from('performance_review_dossiers' as never)
    .select('id,employee_id,phase,performance_review_rounds!inner(title,due_date,status)')
    .eq('tenant_id', context.tenantId)
    .order('created_at', { ascending: false })
  if (targetEmployeeId) query = query.eq('employee_id', targetEmployeeId)
  if (role === 'additional-reviewer') query = query.eq('additional_reviewer_employee_id', context.employeeId as string)
  const { data, error } = await query
  if (error) toError(error, 'PERFORMANCE_REVIEW_READ_FAILED')
  const rows = (data ?? []) as unknown as Array<{ id: string; employee_id: string; phase: string; performance_review_rounds: { title: string; due_date: string | null; status: string } | null }>
  return rows.map((row) => ({ id: row.id, title: row.performance_review_rounds?.title ?? 'Performance review', phase: row.phase, dueDate: row.performance_review_rounds?.due_date ?? null, roundStatus: row.performance_review_rounds?.status ?? 'UNKNOWN' }))
}

export async function getPerformanceReviewDashboard(role: 'hr' | 'manager' | 'employee' | 'additional-reviewer') {
  const items = await listPerformanceReviewDossierSummaries(role)
  const phaseCounts: Record<string, number> = {}
  for (const item of items) phaseCounts[item.phase] = (phaseCounts[item.phase] ?? 0) + 1
  phaseCounts.CLOSED_OPEN = items.filter((item) => item.roundStatus === 'CLOSED' && !item.phase.startsWith('COMPLETED')).length
  const nextActions = items
    .filter((item) => !item.phase.startsWith('COMPLETED') && item.roundStatus === 'ACTIVE')
    .sort((left, right) => (left.dueDate ?? '9999-12-31').localeCompare(right.dueDate ?? '9999-12-31'))
    .slice(0, 3)
  return { phaseCounts, nextActions }
}

export async function listPerformanceReviewHistory(employeeId: string) {
  const context = await requireAnyPermission(['performance-review:read', 'performance-review:team-read', 'self:performance-review:read'], employeeId)
  const client = await createClient()
  const { data, error } = await client.from('performance_review_dossiers' as never)
    .select('id,employee_id,reviewer_employee_id,additional_reviewer_employee_id,phase,performance_review_rounds!inner(title,due_date,period_start,period_end,status),performance_review_submissions(kind,body,score,submitted_at),performance_review_acknowledgements(decision,created_at)')
    .eq('tenant_id', context.tenantId)
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
  if (error) toError(error, 'PERFORMANCE_REVIEW_READ_FAILED')
  const rows = (data ?? []) as unknown as Array<{
    id: string
    employee_id: string
    reviewer_employee_id: string
    additional_reviewer_employee_id: string | null
    phase: string
    performance_review_rounds: { title: string; due_date: string | null; period_start: string; period_end: string; status: string } | null
    performance_review_submissions: Array<{ kind: string; body: string; score: number | null; submitted_at: string | null }> | null
    performance_review_acknowledgements: { decision: string; created_at: string } | Array<{ decision: string; created_at: string }> | null
  }>
  const employeeIds = Array.from(new Set(rows.flatMap((row) => [row.reviewer_employee_id, ...(row.additional_reviewer_employee_id ? [row.additional_reviewer_employee_id] : [])])))
  const { data: employees, error: employeesError } = employeeIds.length
    ? await client.from('employees' as never).select('id,first_name,birth_name,employee_number').eq('tenant_id', context.tenantId).in('id', employeeIds)
    : { data: [], error: null }
  if (employeesError) toError(employeesError, 'PERFORMANCE_REVIEW_READ_FAILED')
  const reviewerNames = new Map(((employees ?? []) as unknown as Array<{ id: string; first_name: string; birth_name: string; employee_number: string }>).map((item) => [item.id, [item.first_name, item.birth_name].filter(Boolean).join(' ') || item.employee_number]))
  return rows.map((row) => {
    const managerSubmission = row.performance_review_submissions?.find((submission) => submission.kind === 'MANAGER' && submission.submitted_at !== null)
    const acknowledgement = Array.isArray(row.performance_review_acknowledgements)
      ? row.performance_review_acknowledgements[0]
      : row.performance_review_acknowledgements
    return {
      id: row.id,
      title: row.performance_review_rounds?.title ?? 'Performance review',
      phase: row.phase,
      status: row.performance_review_rounds?.status === 'CLOSED' && !row.phase.startsWith('COMPLETED') ? 'CLOSED_OPEN' : row.phase,
      periodStart: row.performance_review_rounds?.period_start ?? null,
      periodEnd: row.performance_review_rounds?.period_end ?? null,
      dueDate: row.performance_review_rounds?.due_date ?? null,
      managerName: reviewerNames.get(row.reviewer_employee_id) ?? null,
      additionalReviewerName: row.additional_reviewer_employee_id ? reviewerNames.get(row.additional_reviewer_employee_id) ?? null : null,
      finalScore: managerSubmission?.score ?? null,
      additionalReviewerContribution: row.performance_review_submissions?.find((submission) => submission.kind === 'ADDITIONAL_REVIEWER' && submission.submitted_at !== null)?.body ?? null,
      completedAt: acknowledgement?.created_at ?? null,
    }
  })
}

export async function getPerformanceReviewDossier(dossierId: string) {
  const context = await requireAnyPermission(['performance-review:read', 'performance-review:team-read', 'self:performance-review:read'])
  const client = await createClient()
  const { data, error } = await client.from('performance_review_dossiers' as never).select('id,tenant_id,round_id,hr_group_id,administration_id,employee_id,reviewer_employee_id,additional_reviewer_employee_id,additional_reviewer_workflow,additional_reviewer_released_at,reviewer_assignment_override,process_instance_id,phase,version,created_at,performance_review_rounds(*),performance_review_submissions(*),performance_review_dossier_question_snapshots(respondent_role,selection_source,source_set_id,source_set_name,source_set_version,definition_json),performance_review_attachments(id,original_filename,content_type,file_size,checksum_sha256,released_at,created_at),performance_review_appraisal_links(appraisal_item_id),performance_review_acknowledgements(decision,reason,created_at)').eq('tenant_id', context.tenantId).eq('id', dossierId).maybeSingle()
  if (error) toError(error, 'PERFORMANCE_REVIEW_READ_FAILED')
  if (!data) throw new PerformanceReviewError('PERFORMANCE_REVIEW_NOT_FOUND', 404)
  return data
}

export async function saveSelfReflection(dossierId: string, version: number, body: string, submit: boolean, questionAnswers?: unknown) {
  const context = await contextFor('self:performance-review:submit')
  if (!context.employeeId) throw new AuthorizationError('Medewerkerkoppeling ontbreekt.')
  const client = await createClient()
  if (questionAnswers !== undefined) {
    const answers = questionAnswersSchema.parse(questionAnswers)
    return command(client, 'save_performance_review_response_with_questions', {
      requested_dossier: dossierId, requested_role: 'EMPLOYEE', requested_body: body,
      requested_answers: answers as unknown as Json, expected_version: version, submit_now: submit,
      requested_meeting_date: null, requested_score: null, requested_rating_explanation: null,
    })
  }
  return command(client, 'save_performance_review_self', { requested_dossier: dossierId, requested_body: body, expected_version: version, submit_now: submit })
}

export async function saveManagerResponse(dossierId: string, input: unknown, submit: boolean, questionAnswers?: unknown) {
  const parsed = managerSubmissionSchema.parse(input)
  const context = await requireAnyPermission(['performance-review:team-submit', 'self:performance-review:submit'])
  if (!context.employeeId) throw new AuthorizationError('Medewerkerkoppeling ontbreekt.')
  const client = await createClient()
  if (questionAnswers !== undefined) {
    const answers = questionAnswersSchema.parse(questionAnswers)
    return command(client, 'save_performance_review_response_with_questions', {
      requested_dossier: dossierId, requested_role: 'GV', requested_body: parsed.body,
      requested_answers: answers as unknown as Json, expected_version: parsed.version, submit_now: submit,
      requested_meeting_date: parsed.meetingDate ?? null, requested_score: parsed.score ?? null,
      requested_rating_explanation: parsed.ratingExplanation ?? null,
    })
  }
  return command(client, 'save_performance_review_manager', { requested_dossier: dossierId, requested_body: parsed.body, requested_meeting_date: parsed.meetingDate ?? null, requested_score: parsed.score ?? null, requested_rating_explanation: parsed.ratingExplanation ?? null, expected_version: parsed.version, submit_now: submit })
}

export async function acknowledgePerformanceReview(dossierId: string, input: unknown) {
  const parsed = acknowledgementSchema.parse(input)
  const context = await contextFor('self:performance-review:submit')
  if (!context.employeeId) throw new AuthorizationError('Medewerkerkoppeling ontbreekt.')
  const client = await createClient()
  return command(client, 'acknowledge_performance_review', { requested_dossier: dossierId, requested_decision: parsed.decision, requested_reason: parsed.decision === 'DISAGREE' ? parsed.reason : null, expected_version: parsed.version })
}

export async function saveAdditionalReviewerContribution(dossierId: string, input: unknown, submit: boolean, questionAnswers?: unknown) {
  const parsed = additionalReviewerSubmissionSchema.parse(input)
  const context = await contextFor('self:performance-review:submit')
  if (!context.employeeId) throw new AuthorizationError('Medewerkerkoppeling ontbreekt.')
  const client = await createClient()
  if (questionAnswers !== undefined) {
    const answers = questionAnswersSchema.parse(questionAnswers)
    return command(client, 'save_performance_review_response_with_questions', {
      requested_dossier: dossierId, requested_role: 'AB', requested_body: parsed.body,
      requested_answers: answers as unknown as Json, expected_version: parsed.version, submit_now: submit,
      requested_meeting_date: null, requested_score: null, requested_rating_explanation: null,
    })
  }
  return command(client, 'save_performance_review_additional_reviewer', {
    requested_dossier: dossierId,
    requested_body: parsed.body,
    expected_version: parsed.version,
    submit_now: submit,
  })
}

export async function closePerformanceReviewDossier(dossierId: string, version: number) {
  await requireAnyPermission(['performance-review:team-submit', 'self:performance-review:submit'])
  const client = await createClient()
  return command(client, 'close_performance_review_dossier_v2', { requested_dossier: dossierId, expected_version: version })
}

export async function releaseAdditionalReviewer(dossierId: string, version: number, reason: string) {
  await contextFor('performance-review:manage')
  if (!reason.trim()) throw new PerformanceReviewError('PERFORMANCE_REASON_REQUIRED', 400)
  const client = await createClient()
  return command(client, 'release_performance_review_additional_reviewer', {
    requested_dossier: dossierId,
    expected_version: version,
    requested_reason: reason,
  })
}

export async function savePrivateNote(dossierId: string, body: string, version: number) {
  await contextFor('performance-review:private-write')
  void version
  const client = await createClient()
  return command(client, 'save_performance_review_private_note', { requested_dossier: dossierId, requested_body: body })
}

export async function listPrivateNotes(dossierId: string) {
  await contextFor('performance-review:private-read')
  const client = await createClient()
  const { data, error } = await client.from('performance_review_private_notes' as never).select('id,body,version,author_user_id,created_at').eq('dossier_id', dossierId).order('version', { ascending: true })
  if (error) toError(error, 'PERFORMANCE_REVIEW_READ_FAILED')
  return data ?? []
}

export async function closePerformanceReviewRound(roundId: string, reason: string, version: number, idempotencyKey?: string | null) {
  await contextFor('performance-review:manage')
  const client = await createClient()
  return command(client, 'close_performance_review_round', { requested_round: roundId, requested_reason: reason, expected_version: version, ...(idempotencyKey ? { requested_idempotency_key: idempotencyKey } : {}) })
}

export async function configurePerformanceReviewReviewers(dossierId: string, input: unknown) {
  const parsed = reviewerRoleAssignmentSchema.parse(input)
  await contextFor('performance-review:manage')
  const client = await createClient()
  return command(client, 'configure_performance_review_reviewers', {
    requested_dossier: dossierId,
    requested_reviewer: parsed.reviewerEmployeeId,
    requested_additional_reviewer: parsed.additionalReviewerEmployeeId,
    expected_version: parsed.version,
    requested_reason: parsed.reason,
    requested_preserve_drafts: parsed.preserveDrafts,
  })
}

export async function searchPerformanceReviewRoleCandidates(dossierId: string, search = '') {
  await contextFor('performance-review:manage')
  const client = await createClient()
  const result = await client.rpc('search_performance_review_role_candidates' as never, {
    requested_dossier: dossierId,
    requested_search: search.trim().slice(0, 120),
  } as never)
  if (result.error) toError(result.error, 'PERFORMANCE_REVIEW_READ_FAILED')
  return (result.data ?? []) as unknown as Array<{ employee_id: string; first_name: string; birth_name: string; employee_number: string }>
}

export async function searchPerformanceReviewCandidateEmployees(employeeId: string, administrationId: string, search = '') {
  await contextFor('performance-review:manage')
  const client = await createClient()
  const result = await client.rpc('search_performance_review_candidate_employees' as never, {
    requested_employee: employeeId,
    requested_administration: administrationId,
    requested_search: search.trim().slice(0, 120),
  } as never)
  if (result.error) toError(result.error, 'PERFORMANCE_REVIEW_READ_FAILED')
  return ((result.data ?? []) as unknown as Array<{ employee_id: string; first_name: string; birth_name: string; employee_number: string }>).map((item) => ({
    id: item.employee_id,
    first_name: item.first_name,
    birth_name: item.birth_name,
    employee_number: item.employee_number,
  }))
}

export async function previewPerformanceReviewRoleFlip(roundId: string, input: unknown) {
  const parsed = roleFlipPreviewSchema.parse(input)
  await contextFor('performance-review:manage')
  if (parsed.scope !== 'ALL' && !parsed.participantIds?.length) throw new PerformanceReviewError('PERFORMANCE_SELECTION_REQUIRED', 400)
  const client = await createClient()
  return command(client, 'preview_performance_review_role_flip', {
    requested_round: roundId,
    requested_scope: parsed.scope,
    requested_ids: parsed.scope === 'ALL' ? null : parsed.participantIds,
  })
}

export async function applyPerformanceReviewRoleFlip(roundId: string, input: unknown, idempotencyKey: string) {
  const parsed = roleFlipApplySchema.parse(input)
  await contextFor('performance-review:manage')
  if (!/^[0-9a-f-]{8,160}$/iu.test(idempotencyKey)) throw new PerformanceReviewError('PERFORMANCE_IDEMPOTENCY_KEY_INVALID', 400)
  const client = await createClient()
  return command(client, 'apply_performance_review_role_flip', {
    requested_round: roundId,
    requested_ids: parsed.participantIds,
    requested_preview_hash: parsed.previewHash,
    requested_reason: parsed.reason,
    requested_preserve_drafts: parsed.preserveDrafts,
    requested_idempotency_key: idempotencyKey,
  })
}

const PERFORMANCE_REVIEW_BUCKET = 'performance-review-attachments'
const PERFORMANCE_REVIEW_TYPES = new Set(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])

export async function uploadPerformanceReviewAttachment(dossierId: string, file: File, idempotencyKey: string) {
  const context = await contextFor('performance-review:team-submit')
  const validation = await validateDocumentFile(file)
  if (!validation.ok || !PERFORMANCE_REVIEW_TYPES.has(validation.contentType)) throw new PerformanceReviewError('PERFORMANCE_ATTACHMENT_INVALID', 400)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) throw new PerformanceReviewError('PERFORMANCE_IDEMPOTENCY_KEY_INVALID', 400)
  const bytes = validation.bytes
  const checksum = createHash('sha256').update(bytes).digest('hex')
  const filename = sanitizeDocumentFilename(file.name)
  const storageKey = `${context.tenantId}/${dossierId}/${idempotencyKey}/${filename}`
  const client = await createClient()
  const result = await client.rpc('add_performance_review_attachment' as never, { requested_dossier: dossierId, requested_storage_key: storageKey, requested_filename: file.name, requested_content_type: validation.contentType, requested_size: file.size, requested_checksum: checksum, requested_idempotency_key: idempotencyKey } as never) as unknown as { data: unknown; error: { message?: string } | null }
  if (result.error || !result.data) toError(result.error, 'PERFORMANCE_REVIEW_COMMAND_FAILED')
  const folder = storageKey.slice(0, storageKey.lastIndexOf('/'))
  const storedName = storageKey.slice(storageKey.lastIndexOf('/') + 1)
  const storage = client.storage.from(PERFORMANCE_REVIEW_BUCKET)
  const findStoredObject = async () => {
    const listed = await storage.list(folder, { limit: 100, search: storedName })
    if (listed.error) throw new PerformanceReviewError('PERFORMANCE_ATTACHMENT_UPLOAD_FAILED', 502)
    return (listed.data ?? []).some((item) => item.name === storedName)
  }
  if (!(await findStoredObject())) {
    const upload = await storage.upload(storageKey, bytes, { contentType: validation.contentType, upsert: false })
    if (upload.error && !(await findStoredObject())) {
      await client.rpc('delete_performance_review_attachment' as never, { requested_attachment: (result.data as { id: string }).id } as never)
      throw new PerformanceReviewError('PERFORMANCE_ATTACHMENT_UPLOAD_FAILED', 502)
    }
  }
  return result.data
}

export async function downloadPerformanceReviewAttachment(dossierId: string, attachmentId: string) {
  const context = await requireAnyPermission(['performance-review:read', 'performance-review:team-read', 'self:performance-review:read'])
  const client = await createClient()
  const query = await client
    .from('performance_review_attachments' as never)
    .select('id,dossier_id,storage_key,original_filename,content_type,file_size,checksum_sha256,released_at,created_at,performance_review_dossiers!inner(tenant_id,employee_id,reviewer_employee_id,hr_group_id)')
    .eq('id', attachmentId)
    .eq('dossier_id', dossierId)
    .eq('performance_review_dossiers.tenant_id', context.tenantId)
    .maybeSingle() as unknown as { data: { id: string; dossier_id: string; storage_key: string; original_filename: string; content_type: string; file_size: number; checksum_sha256: string; released_at: string | null; created_at: string; performance_review_dossiers: { reviewer_employee_id: string } } | null; error: { message?: string } | null }
  if (query.error) toError(query.error, 'PERFORMANCE_REVIEW_READ_FAILED')
  const data = query.data
  if (!data || (data.released_at === null && context.employeeId !== data.performance_review_dossiers.reviewer_employee_id)) throw new PerformanceReviewError('PERFORMANCE_ATTACHMENT_NOT_FOUND', 404)
  const signed = await client.storage.from(PERFORMANCE_REVIEW_BUCKET).createSignedUrl(data.storage_key, 60)
  if (signed.error || !signed.data?.signedUrl) throw new PerformanceReviewError('PERFORMANCE_ATTACHMENT_DOWNLOAD_FAILED', 502)
  return { ...data, signedUrl: signed.data.signedUrl }
}

export async function deletePerformanceReviewAttachment(dossierId: string, attachmentId: string) {
  await contextFor('performance-review:team-submit')
  const client = await createClient()
  const query = await client
    .from('performance_review_attachments' as never)
    .select('id,dossier_id,storage_key')
    .eq('id', attachmentId)
    .eq('dossier_id', dossierId)
    .maybeSingle() as unknown as { data: { id: string; dossier_id: string; storage_key: string } | null; error: { message?: string } | null }
  if (query.error) toError(query.error, 'PERFORMANCE_REVIEW_READ_FAILED')
  if (!query.data) throw new PerformanceReviewError('PERFORMANCE_ATTACHMENT_NOT_FOUND', 404)
  const storage = await client.storage.from(PERFORMANCE_REVIEW_BUCKET).remove([query.data.storage_key])
  if (storage.error) throw new PerformanceReviewError('PERFORMANCE_ATTACHMENT_DELETE_FAILED', 502)
  await command(client, 'delete_performance_review_attachment', { requested_attachment: attachmentId })
  return { id: attachmentId, deleted: true }
}

export async function linkPerformanceAppraisal(dossierId: string, appraisalItemId: string) {
  await contextFor('performance-review:team-read')
  const client = await createClient()
  return command(client, 'link_performance_review_appraisal', { requested_dossier: dossierId, requested_item: appraisalItemId })
}
