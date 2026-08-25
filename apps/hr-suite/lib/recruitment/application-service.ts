import type { Database, Json } from '@scope/db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { AuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { recruitmentGuidSchema } from './domain'
import { recruitmentDatabaseError, RecruitmentError } from './errors'

export const manualApplicationInputSchema = z.object({
  vacancyId: recruitmentGuidSchema,
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(160),
  privateEmail: z.string().trim().pipe(z.email().max(254)),
  phone: z.string().trim().max(40).nullable().default(null),
  motivation: z.string().trim().max(10_000).nullable().default(null),
  source: z.enum(['MANUAL', 'PUBLIC']).default('MANUAL'),
}).strict()

export const publicApplicationInputSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(160),
  email: z.string().trim().pipe(z.email().max(254)),
  phone: z.string().trim().max(40).default(''),
  motivation: z.string().trim().max(10_000).default(''),
  answers: z.array(z.object({ questionId: recruitmentGuidSchema, value: z.unknown() }).strict()).max(100).default([]),
  challengeToken: z.string().trim().min(1).max(4_000),
  honeypot: z.string().max(0),
  renderedAt: z.iso.datetime(),
  idempotencyKey: z.string().trim().min(8).max(160),
}).strict()

export type ManualApplicationInput = z.infer<typeof manualApplicationInputSchema>
export type PublicApplicationInput = z.infer<typeof publicApplicationInputSchema>

export function normalizeCandidateSignal(input: { readonly privateEmail: string | null }): { readonly normalizedEmail: string | null; readonly requiresHumanDecision: true } {
  return { normalizedEmail: input.privateEmail ? input.privateEmail.trim().toLowerCase() : null, requiresHumanDecision: true }
}

export function publicIntakeFailureState(code: string): { readonly kind: 'SECURITY_BLOCKED' } {
  if (code.startsWith('RECRUITMENT_BOT_') || code.startsWith('RECRUITMENT_MALWARE_') || code === 'RECRUITMENT_DOCUMENT_REJECTED') return { kind: 'SECURITY_BLOCKED' }
  return { kind: 'SECURITY_BLOCKED' }
}

export interface ApplicationCard {
  readonly id: string
  readonly candidateId: string
  readonly candidateName: string
  readonly vacancyId: string
  readonly vacancyTitle: string
  readonly stageId: string | null
  readonly stageName: string | null
  readonly terminalOutcome: 'AFGEWEZEN' | 'AANGENOMEN' | null
  readonly source: 'MANUAL' | 'PUBLIC'
  readonly createdAt: string
  readonly version: number
}

export interface RecruitmentPipelineStage {
  readonly id: string
  readonly name: string
  readonly sortOrder: number
  readonly isActive: boolean
  readonly applicationCount: number
}

export interface RecruitmentVacancyPipeline {
  readonly vacancyId: string
  readonly vacancyTitle: string
  readonly stages: readonly RecruitmentPipelineStage[]
  readonly applications: readonly ApplicationCard[]
}

export interface ApplicationDetail extends ApplicationCard {
  readonly privateEmail: string | null
  readonly phone: string | null
  readonly motivation: string | null
  readonly terminalReason: string | null
  readonly terminalNote: string | null
  readonly answers: readonly { readonly id: string; readonly label: string; readonly value: Json }[]
  readonly documents: readonly { readonly id: string; readonly fileName: string; readonly scanStatus: string }[]
  readonly events: readonly { readonly id: string; readonly type: string; readonly createdAt: string }[]
  readonly otherApplications: readonly { readonly id: string; readonly vacancyTitle: string; readonly outcome: string | null; readonly stageName: string | null }[]
}

type SupabaseServerClient = SupabaseClient<Database>
type RpcClient = SupabaseServerClient & {
  rpc(name: string, args: Record<string, unknown>): Promise<{ readonly data: unknown; readonly error: { readonly message: string } | null }>
}

const applicationRowSchema = z.object({
  id: recruitmentGuidSchema,
  candidate_id: recruitmentGuidSchema,
  vacancy_id: recruitmentGuidSchema,
  active_stage_id: recruitmentGuidSchema.nullable(),
  terminal_outcome: z.enum(['AFGEWEZEN', 'AANGENOMEN']).nullable(),
  source: z.enum(['MANUAL', 'PUBLIC']),
  motivation: z.string().nullable(),
  terminal_reason: z.string().nullable(),
  terminal_note: z.string().nullable(),
  created_at: z.string(),
  version: z.number().int().positive(),
})

const candidateRowSchema = z.object({ id: recruitmentGuidSchema, first_name: z.string(), last_name: z.string(), private_email: z.string().nullable(), phone: z.string().nullable() })
const stageNameRowSchema = z.object({ id: recruitmentGuidSchema, name: z.string() })
const stageRowSchema = z.object({ id: recruitmentGuidSchema, name: z.string(), sort_order: z.number().int(), is_active: z.boolean() })

function rpc(supabase: SupabaseServerClient): RpcClient {
  return supabase as unknown as RpcClient
}

function parseRpcObject(result: { readonly data: unknown; readonly error: { readonly message: string } | null }): Record<string, unknown> {
  if (result.error) throw recruitmentDatabaseError(result.error)
  if (typeof result.data !== 'object' || result.data === null || Array.isArray(result.data)) throw new RecruitmentError('RECRUITMENT_OPERATION_FAILED', 500)
  return result.data as Record<string, unknown>
}

export function buildRecruitmentPipelineStages(
  stages: readonly Omit<RecruitmentPipelineStage, 'applicationCount'>[],
  applications: readonly Pick<ApplicationCard, 'stageId'>[],
): RecruitmentPipelineStage[] {
  const counts = new Map<string, number>()
  for (const application of applications) {
    if (application.stageId) counts.set(application.stageId, (counts.get(application.stageId) ?? 0) + 1)
  }
  return stages.map((stage) => ({ ...stage, applicationCount: counts.get(stage.id) ?? 0 }))
}

export async function listRecruitmentVacancyPipeline(context: Pick<AuthContext, 'tenantId' | 'hrGroupId'>, vacancyId: string, supabase: SupabaseServerClient): Promise<RecruitmentVacancyPipeline> {
  if (!context.hrGroupId) throw new RecruitmentError('RECRUITMENT_HR_GROUP_REQUIRED', 403)
  const [applications, vacancies, stages] = await Promise.all([
    supabase.from('recruitment_applications').select('id,candidate_id,vacancy_id,active_stage_id,terminal_outcome,source,motivation,terminal_reason,terminal_note,created_at,version').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('vacancy_id', vacancyId).is('anonymized_at', null).order('created_at', { ascending: false }).limit(500),
    supabase.from('recruitment_vacancies').select('id,title').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('id', vacancyId).maybeSingle(),
    supabase.from('recruitment_pipeline_stages').select('id,name,sort_order,is_active').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).order('sort_order').order('id').limit(100),
  ])
  if (applications.error) throw recruitmentDatabaseError(applications.error)
  if (vacancies.error) throw recruitmentDatabaseError(vacancies.error)
  if (stages.error) throw recruitmentDatabaseError(stages.error)
  if (!vacancies.data) throw new RecruitmentError('RECRUITMENT_VACANCY_NOT_FOUND', 404)
  const candidateIds = [...new Set(applications.data.map((row) => row.candidate_id))]
  const candidates = candidateIds.length > 0
    ? await supabase.from('recruitment_candidates').select('id,first_name,last_name,private_email,phone').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).in('id', candidateIds)
    : { data: [], error: null }
  if (candidates.error) throw recruitmentDatabaseError(candidates.error)
  const candidateById = new Map(candidates.data.map((row) => [row.id, candidateRowSchema.parse(row)]))
  const stageRows = stages.data.map((row) => stageRowSchema.parse(row))
  const stageById = new Map(stageRows.map((row) => [row.id, row]))
  const vacancyTitle = vacancies.data.title
  const applicationCards = applications.data.map((row) => {
    const application = applicationRowSchema.parse(row)
    const candidate = candidateById.get(application.candidate_id)
    if (!candidate) throw new RecruitmentError('RECRUITMENT_OPERATION_FAILED', 500)
    return {
      id: application.id, candidateId: application.candidate_id, candidateName: `${candidate.first_name} ${candidate.last_name}`,
      vacancyId: application.vacancy_id, vacancyTitle, stageId: application.active_stage_id, stageName: application.active_stage_id ? stageById.get(application.active_stage_id)?.name ?? null : null,
      terminalOutcome: application.terminal_outcome, source: application.source, createdAt: application.created_at, version: application.version,
    }
  })
  return {
    vacancyId: vacancies.data.id,
    vacancyTitle,
    stages: buildRecruitmentPipelineStages(stageRows.map((stage) => ({ id: stage.id, name: stage.name, sortOrder: stage.sort_order, isActive: stage.is_active })), applicationCards),
    applications: applicationCards,
  }
}

export async function listRecruitmentApplications(context: Pick<AuthContext, 'tenantId' | 'hrGroupId'>, vacancyId: string, supabase: SupabaseServerClient): Promise<ApplicationCard[]> {
  const pipeline = await listRecruitmentVacancyPipeline(context, vacancyId, supabase)
  return [...pipeline.applications]
}

export async function getRecruitmentApplication(context: Pick<AuthContext, 'tenantId' | 'hrGroupId'>, applicationId: string, supabase: SupabaseServerClient): Promise<ApplicationDetail | null> {
  if (!context.hrGroupId) throw new RecruitmentError('RECRUITMENT_HR_GROUP_REQUIRED', 403)
  const applicationResult = await supabase.from('recruitment_applications').select('id,candidate_id,vacancy_id,active_stage_id,terminal_outcome,source,motivation,terminal_reason,terminal_note,created_at,version').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('id', applicationId).maybeSingle()
  if (applicationResult.error) throw recruitmentDatabaseError(applicationResult.error)
  if (!applicationResult.data) return null
  const application = applicationRowSchema.parse(applicationResult.data)
  const [candidateResult, vacancyResult, stageResult, answersResult, documentsResult, eventsResult, otherResult] = await Promise.all([
    supabase.from('recruitment_candidates').select('id,first_name,last_name,private_email,phone').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('id', application.candidate_id).maybeSingle(),
    supabase.from('recruitment_vacancies').select('id,title').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('id', application.vacancy_id).maybeSingle(),
    application.active_stage_id ? supabase.from('recruitment_pipeline_stages').select('id,name').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('id', application.active_stage_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabase.from('recruitment_application_answers').select('id,label_snapshot,value').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('application_id', application.id).order('created_at'),
    supabase.from('recruitment_documents').select('id,original_filename,scan_status').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('application_id', application.id).is('deleted_at', null).eq('scan_status', 'CLEAN').order('created_at', { ascending: false }),
    supabase.from('recruitment_events').select('id,event_type,created_at').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('application_id', application.id).order('created_at', { ascending: false }).limit(100),
    supabase.from('recruitment_applications').select('id,vacancy_id,terminal_outcome,active_stage_id').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('candidate_id', application.candidate_id).neq('id', application.id).limit(50),
  ])
  for (const result of [candidateResult, vacancyResult, stageResult, answersResult, documentsResult, eventsResult, otherResult]) if (result.error) throw recruitmentDatabaseError(result.error)
  const candidate = candidateResult.data ? candidateRowSchema.parse(candidateResult.data) : null
  const vacancy = vacancyResult.data
  if (!candidate || !vacancy) throw new RecruitmentError('RECRUITMENT_OPERATION_FAILED', 500)
  const stage = stageResult.data ? stageNameRowSchema.parse(stageResult.data) : null
  const other = otherResult.data as Array<{ id: string; vacancy_id: string; terminal_outcome: string | null; active_stage_id: string | null }>
  const otherVacancyIds = [...new Set(other.map((row) => row.vacancy_id))]
  const otherVacancies = otherVacancyIds.length > 0 ? await supabase.from('recruitment_vacancies').select('id,title').in('id', otherVacancyIds).eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId) : { data: [], error: null }
  if (otherVacancies.error) throw recruitmentDatabaseError(otherVacancies.error)
  const otherStages = other.map((row) => row.active_stage_id).filter((id): id is string => typeof id === 'string')
  const otherStageRows = otherStages.length > 0 ? await supabase.from('recruitment_pipeline_stages').select('id,name').in('id', otherStages).eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId) : { data: [], error: null }
  if (otherStageRows.error) throw recruitmentDatabaseError(otherStageRows.error)
  const vacancyById = new Map((otherVacancies.data ?? []).map((row) => [row.id, row.title]))
  const stageById = new Map((otherStageRows.data ?? []).map((row) => [row.id, row.name]))
  return {
    id: application.id, candidateId: application.candidate_id, candidateName: `${candidate.first_name} ${candidate.last_name}`,
    vacancyId: application.vacancy_id, vacancyTitle: vacancy.title, stageId: application.active_stage_id, stageName: stage?.name ?? null,
    terminalOutcome: application.terminal_outcome, source: application.source, createdAt: application.created_at, version: application.version,
    privateEmail: candidate.private_email, phone: candidate.phone, motivation: application.motivation, terminalReason: application.terminal_reason, terminalNote: application.terminal_note,
    answers: (answersResult.data ?? []).map((row) => ({ id: row.id, label: row.label_snapshot, value: row.value })),
    documents: (documentsResult.data ?? []).map((row) => ({ id: row.id, fileName: row.original_filename, scanStatus: row.scan_status })),
    events: (eventsResult.data ?? []).map((row) => ({ id: row.id, type: row.event_type, createdAt: row.created_at })),
    otherApplications: other.map((row) => ({ id: row.id, vacancyTitle: vacancyById.get(row.vacancy_id) ?? 'Vacature', outcome: row.terminal_outcome, stageName: row.active_stage_id ? stageById.get(row.active_stage_id) ?? null : null })),
  }
}

export async function createManualRecruitmentApplication(context: Pick<AuthContext, 'tenantId' | 'hrGroupId'>, input: ManualApplicationInput, supabase: SupabaseServerClient): Promise<{ readonly id: string; readonly candidateId: string; readonly possibleDuplicate: boolean; readonly version: number }> {
  if (!context.hrGroupId) throw new RecruitmentError('RECRUITMENT_HR_GROUP_REQUIRED', 403)
  const parsed = manualApplicationInputSchema.parse(input)
  const result = await rpc(supabase).rpc('create_recruitment_application', {
    requested_vacancy_id: parsed.vacancyId, requested_first_name: parsed.firstName, requested_last_name: parsed.lastName,
    requested_private_email: parsed.privateEmail, requested_phone: parsed.phone, requested_motivation: parsed.motivation, requested_source: parsed.source,
  })
  const data = parseRpcObject(result)
  if (typeof data.id !== 'string' || typeof data.candidateId !== 'string' || typeof data.possibleDuplicate !== 'boolean' || typeof data.version !== 'number') throw new RecruitmentError('RECRUITMENT_OPERATION_FAILED', 500)
  return { id: data.id, candidateId: data.candidateId, possibleDuplicate: data.possibleDuplicate, version: data.version }
}

export async function submitPublicRecruitmentApplication(publicationId: string, slug: string, input: PublicApplicationInput, intakeProof: string, supabase?: SupabaseServerClient): Promise<string> {
  const parsed = publicApplicationInputSchema.parse(input)
  const client = supabase ?? await createClient()
  const payload: Record<string, unknown> = {
    firstName: parsed.firstName, lastName: parsed.lastName, email: parsed.email, phone: parsed.phone || null,
    motivation: parsed.motivation || null, answers: parsed.answers,
  }
  const result = await rpc(client).rpc('recruitment_submit_public_application', {
    requested_publication_id: publicationId, requested_slug: slug, requested_payload: payload, requested_intake_proof: intakeProof,
  })
  if (result.error) throw recruitmentDatabaseError(result.error)
  if (typeof result.data !== 'string') throw new RecruitmentError('RECRUITMENT_OPERATION_FAILED', 500)
  return result.data
}

export async function transitionRecruitmentApplication(applicationId: string, stageId: string, expectedVersion: number, idempotencyKey: string, supabase: SupabaseServerClient): Promise<Record<string, unknown>> {
  const result = await rpc(supabase).rpc('transition_recruitment_application', { requested_application_id: applicationId, requested_stage_id: stageId, expected_version: expectedVersion, requested_idempotency_key: idempotencyKey })
  return parseRpcObject(result)
}

export async function rejectRecruitmentApplication(applicationId: string, reason: string, expectedVersion: number, idempotencyKey: string, supabase: SupabaseServerClient): Promise<Record<string, unknown>> {
  const result = await rpc(supabase).rpc('terminal_transition_recruitment_application', { requested_application_id: applicationId, requested_outcome: 'AFGEWEZEN', requested_reason: reason, expected_version: expectedVersion, requested_idempotency_key: idempotencyKey })
  return parseRpcObject(result)
}

export async function reopenRecruitmentApplication(applicationId: string, stageId: string, expectedVersion: number, idempotencyKey: string, supabase: SupabaseServerClient): Promise<Record<string, unknown>> {
  const result = await rpc(supabase).rpc('reopen_recruitment_application', { requested_application_id: applicationId, requested_stage_id: stageId, expected_version: expectedVersion, requested_idempotency_key: idempotencyKey })
  return parseRpcObject(result)
}

export async function hireRecruitmentApplication(applicationId: string, administrationId: string, employeeId: string, employmentId: string | null, expectedVersion: number, idempotencyKey: string, supabase: SupabaseServerClient): Promise<Record<string, unknown>> {
  const result = await rpc(supabase).rpc('hire_recruitment_application', { requested_application_id: applicationId, requested_administration_id: administrationId, requested_employee_id: employeeId, requested_employment_id: employmentId, requested_expected_version: expectedVersion, requested_idempotency_key: idempotencyKey })
  return parseRpcObject(result)
}
