import type { Database } from '@scope/db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { AuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { recruitmentDatabaseError, RecruitmentError } from './errors'
import { assessmentInputSchema, toAssessmentRpcScores } from './assessment-service'
import { interviewInputSchema } from './interview-service'
import { libraryItemInputSchema } from './library-service'
import { retentionSettingsSchema } from './retention-service'
import { setItemTypeSchema } from './set-service'

type SupabaseServerClient = SupabaseClient<Database>
type RpcClient = SupabaseServerClient & {
  rpc(name: string, args?: Record<string, unknown>): Promise<{ readonly data: unknown; readonly error: { readonly message: string } | null }>
}

export interface GuidedLibraryItem {
  readonly id: string
  readonly ownerType: 'SYSTEM' | 'HR_GROUP'
  readonly itemType: 'APPLICATION_QUESTION' | 'INTERVIEW_QUESTION' | 'CRITERION' | 'PREPARATION'
  readonly stableCode: string
  readonly title: string
  readonly content: Record<string, unknown>
  readonly isActive: boolean
  readonly isEnabled: boolean
  readonly version: number
}

export interface GuidedSet {
  readonly id: string
  readonly ownerType: 'SYSTEM' | 'HR_GROUP'
  readonly stableCode: string
  readonly name: string
  readonly description: string | null
  readonly isActive: boolean
  readonly version: number
  readonly itemIds: readonly string[]
}

export interface GuidedInterview {
  readonly id: string
  readonly applicationId: string
  readonly title: string
  readonly scheduledAt: string | null
  readonly status: string
  readonly preparation: readonly unknown[]
  readonly questions: readonly unknown[]
  readonly criteria: readonly unknown[]
  readonly version: number
}

export interface RecruitmentSettings {
  readonly id: string
  readonly retentionDays: number
  readonly publicBranding: Record<string, unknown>
  readonly publicationDefaults: Record<string, unknown>
  readonly version: number
}

export interface ParticipantAssignment {
  readonly applicationId: string
  readonly candidateName: string
  readonly vacancyTitle: string
  readonly stageName: string | null
  readonly version: number
}

export interface RecruitmentParticipantOption {
  readonly id: string
  readonly name: string
}

export interface ParticipantDetail {
  readonly applicationId: string
  readonly candidateName: string
  readonly candidateEmail: string | null
  readonly candidatePhone: string | null
  readonly motivation: string | null
  readonly vacancyTitle: string
  readonly stageName: string | null
  readonly version: number
  readonly interviews: readonly Record<string, unknown>[]
}

const guid = z.guid()
const recordSchema = z.record(z.string(), z.unknown())
const jsonArraySchema = z.array(z.unknown())
const libraryRowSchema = z.object({ id: guid, owner_type: z.enum(['SYSTEM', 'HR_GROUP']), item_type: z.enum(['APPLICATION_QUESTION', 'INTERVIEW_QUESTION', 'CRITERION', 'PREPARATION']), stable_code: z.string(), title: z.string(), content: recordSchema, is_active: z.boolean(), version: z.number().int().positive() })
const setRowSchema = z.object({ id: guid, owner_type: z.enum(['SYSTEM', 'HR_GROUP']), stable_code: z.string(), name: z.string(), description: z.string().nullable(), is_active: z.boolean(), version: z.number().int().positive() })
const interviewRowSchema = z.object({ id: guid, application_id: guid, title: z.string(), scheduled_at: z.string().nullable(), status: z.string(), preparation_snapshot: jsonArraySchema, questions_snapshot: jsonArraySchema, criteria_snapshot: jsonArraySchema, version: z.number().int().positive() })
const settingsRowSchema = z.object({ id: guid, retention_days: z.number().int().positive(), public_branding: recordSchema, publication_defaults: recordSchema, version: z.number().int().positive() })
const objectResultSchema = z.record(z.string(), z.unknown())

function rpc(client: SupabaseServerClient): RpcClient {
  return client as unknown as RpcClient
}

function parseObject(result: { readonly data: unknown; readonly error: { readonly message: string } | null }): Record<string, unknown> {
  if (result.error) throw recruitmentDatabaseError(result.error)
  return objectResultSchema.parse(result.data)
}

export function scope(context: Pick<AuthContext, 'tenantId' | 'hrGroupId'>): { readonly tenantId: string; readonly hrGroupId: string } {
  if (!context.hrGroupId) throw new RecruitmentError('RECRUITMENT_HR_GROUP_REQUIRED', 403)
  return { tenantId: context.tenantId, hrGroupId: context.hrGroupId }
}

export async function listGuidedLibrary(context: Pick<AuthContext, 'tenantId' | 'hrGroupId'>, client: SupabaseServerClient): Promise<GuidedLibraryItem[]> {
  const { tenantId, hrGroupId } = scope(context)
  const [items, states] = await Promise.all([
    client.from('recruitment_library_items').select('id,owner_type,item_type,stable_code,title,content,is_active,version').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).order('item_type').order('title').limit(500),
    client.from('recruitment_library_item_states').select('library_item_id,is_enabled').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).limit(500),
  ])
  if (items.error) throw recruitmentDatabaseError(items.error)
  if (states.error) throw recruitmentDatabaseError(states.error)
  const stateById = new Map(states.data.map((state) => [state.library_item_id, state.is_enabled]))
  return items.data.map((row) => {
    const item = libraryRowSchema.parse(row)
    return { id: item.id, ownerType: item.owner_type, itemType: item.item_type, stableCode: item.stable_code, title: item.title, content: item.content, isActive: item.is_active, isEnabled: stateById.get(item.id) ?? item.is_active, version: item.version }
  })
}

export async function listGuidedSets(context: Pick<AuthContext, 'tenantId' | 'hrGroupId'>, client: SupabaseServerClient): Promise<GuidedSet[]> {
  const { tenantId, hrGroupId } = scope(context)
  const [sets, items] = await Promise.all([
    client.from('recruitment_sets').select('id,owner_type,stable_code,name,description,is_active,version').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).order('name').limit(100),
    client.from('recruitment_set_items').select('set_id,library_item_id').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).order('sort_order').limit(1_000),
  ])
  if (sets.error) throw recruitmentDatabaseError(sets.error)
  if (items.error) throw recruitmentDatabaseError(items.error)
  const itemIdsBySet = new Map<string, string[]>()
  for (const item of items.data) itemIdsBySet.set(item.set_id, [...(itemIdsBySet.get(item.set_id) ?? []), item.library_item_id])
  return sets.data.map((row) => {
    const set = setRowSchema.parse(row)
    return { id: set.id, ownerType: set.owner_type, stableCode: set.stable_code, name: set.name, description: set.description, isActive: set.is_active, version: set.version, itemIds: itemIdsBySet.get(set.id) ?? [] }
  })
}

export async function listGuidedInterviews(context: Pick<AuthContext, 'tenantId' | 'hrGroupId'>, applicationId: string, client: SupabaseServerClient): Promise<GuidedInterview[]> {
  const { tenantId, hrGroupId } = scope(context)
  const result = await client.from('recruitment_interviews').select('id,application_id,title,scheduled_at,status,preparation_snapshot,questions_snapshot,criteria_snapshot,version').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('application_id', applicationId).order('scheduled_at').limit(100)
  if (result.error) throw recruitmentDatabaseError(result.error)
  return result.data.map((row) => {
    const interview = interviewRowSchema.parse(row)
    return { id: interview.id, applicationId: interview.application_id, title: interview.title, scheduledAt: interview.scheduled_at, status: interview.status, preparation: interview.preparation_snapshot, questions: interview.questions_snapshot, criteria: interview.criteria_snapshot, version: interview.version }
  })
}

export async function getRecruitmentSettings(context: Pick<AuthContext, 'tenantId' | 'hrGroupId'>, client: SupabaseServerClient): Promise<RecruitmentSettings> {
  const { tenantId, hrGroupId } = scope(context)
  const result = await client.from('recruitment_settings').select('id,retention_days,public_branding,publication_defaults,version').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).maybeSingle()
  if (result.error) throw recruitmentDatabaseError(result.error)
  if (!result.data) throw new RecruitmentError('RECRUITMENT_SETTINGS_NOT_FOUND', 404)
  const settings = settingsRowSchema.parse(result.data)
  return { id: settings.id, retentionDays: settings.retention_days, publicBranding: settings.public_branding, publicationDefaults: settings.publication_defaults, version: settings.version }
}

export async function listRecruitmentPipelineStages(context: Pick<AuthContext, 'tenantId' | 'hrGroupId'>, client: SupabaseServerClient) {
  const { tenantId, hrGroupId } = scope(context)
  const result = await client.from('recruitment_pipeline_stages').select('id,code,name,sort_order,is_active,version').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).order('sort_order').limit(100)
  if (result.error) throw recruitmentDatabaseError(result.error)
  return result.data
}

export async function listRecruitmentParticipantOptions(context: Pick<AuthContext, 'tenantId' | 'hrGroupId'>, client: SupabaseServerClient): Promise<RecruitmentParticipantOption[]> {
  const { tenantId, hrGroupId } = scope(context)
  const result = await client.from('employees').select('id,first_name,birth_name').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).is('deleted_at', null).order('first_name').order('birth_name').limit(250)
  if (result.error) throw recruitmentDatabaseError(result.error)
  return result.data.map((employee) => ({ id: employee.id, name: `${employee.first_name} ${employee.birth_name}`.trim() }))
}

export async function createGuidedLibraryItem(context: Pick<AuthContext, 'tenantId' | 'hrGroupId'>, input: unknown, client: SupabaseServerClient) {
  const parsed = libraryItemInputSchema.parse(input)
  const { tenantId, hrGroupId } = scope(context)
  return parseObject(await rpc(client).rpc('create_recruitment_library_item', { requested_tenant_id: tenantId, requested_hr_group_id: hrGroupId, requested_item_type: parsed.itemType, requested_stable_code: parsed.stableCode, requested_title: parsed.title, requested_content: parsed.content }))
}

export async function updateGuidedLibraryItem(itemId: string, input: { readonly title: string; readonly content: Record<string, unknown>; readonly isActive: boolean; readonly expectedVersion: number }, client: SupabaseServerClient) {
  return parseObject(await rpc(client).rpc('update_recruitment_library_item', { requested_item_id: guid.parse(itemId), requested_title: input.title, requested_content: input.content, requested_is_active: input.isActive, requested_expected_version: input.expectedVersion }))
}

export async function setGuidedLibraryItemEnabled(itemId: string, enabled: boolean, client: SupabaseServerClient) {
  return parseObject(await rpc(client).rpc('set_recruitment_library_item_enabled', { requested_item_id: guid.parse(itemId), requested_is_enabled: enabled }))
}

export async function createGuidedSet(context: Pick<AuthContext, 'tenantId' | 'hrGroupId'>, input: { readonly stableCode: string; readonly name: string; readonly description: string; readonly itemIds: readonly string[] }, client: SupabaseServerClient) {
  const { tenantId, hrGroupId } = scope(context)
  return parseObject(await rpc(client).rpc('create_recruitment_set', { requested_tenant_id: tenantId, requested_hr_group_id: hrGroupId, requested_stable_code: input.stableCode, requested_name: input.name, requested_description: input.description, requested_item_ids: input.itemIds }))
}

export async function updateGuidedSet(setId: string, input: { readonly name: string; readonly description: string; readonly isActive: boolean; readonly itemIds: readonly string[]; readonly expectedVersion: number }, client: SupabaseServerClient) {
  return parseObject(await rpc(client).rpc('update_recruitment_set', { requested_set_id: guid.parse(setId), requested_name: input.name, requested_description: input.description, requested_is_active: input.isActive, requested_item_ids: input.itemIds, requested_expected_version: input.expectedVersion }))
}

export async function createGuidedInterview(input: unknown, client: SupabaseServerClient) {
  const parsed = interviewInputSchema.parse(input)
  return parseObject(await rpc(client).rpc('create_recruitment_interview', { requested_application_id: parsed.applicationId, requested_title: parsed.title, requested_scheduled_at: parsed.scheduledAt, requested_set_id: parsed.setId, requested_participant_employee_ids: parsed.participants }))
}

export async function upsertAssessmentDraft(input: unknown, client: SupabaseServerClient) {
  const parsed = assessmentInputSchema.parse(input)
  return parseObject(await rpc(client).rpc('upsert_recruitment_assessment_draft', { requested_interview_id: parsed.interviewId, requested_scores: toAssessmentRpcScores(parsed.scores) }))
}

export async function submitAssessment(assessmentId: string, expectedVersion: number, client: SupabaseServerClient) {
  return parseObject(await rpc(client).rpc('submit_recruitment_assessment', { requested_assessment_id: guid.parse(assessmentId), requested_expected_version: expectedVersion }))
}

export async function correctAssessment(assessmentId: string, reason: string, scores: unknown, client: SupabaseServerClient) {
  const parsed = assessmentInputSchema.shape.scores.parse(scores)
  return parseObject(await rpc(client).rpc('correct_recruitment_assessment', { requested_assessment_id: guid.parse(assessmentId), requested_reason: reason, requested_scores: toAssessmentRpcScores(parsed) }))
}

export async function updateRecruitmentSettings(context: Pick<AuthContext, 'tenantId' | 'hrGroupId'>, input: { readonly retentionDays: number; readonly publicBranding: Record<string, unknown>; readonly publicationDefaults: Record<string, unknown>; readonly expectedVersion: number }, client: SupabaseServerClient) {
  const parsed = retentionSettingsSchema.parse({ retentionDays: input.retentionDays })
  const { tenantId, hrGroupId } = scope(context)
  return parseObject(await rpc(client).rpc('update_recruitment_settings', { requested_tenant_id: tenantId, requested_hr_group_id: hrGroupId, requested_retention_days: parsed.retentionDays, requested_public_branding: input.publicBranding, requested_publication_defaults: input.publicationDefaults, requested_expected_version: input.expectedVersion }))
}

export async function createRecruitmentPipelineStage(context: Pick<AuthContext, 'tenantId' | 'hrGroupId'>, input: { readonly code: string; readonly name: string; readonly sortOrder: number }, client: SupabaseServerClient) {
  const { tenantId, hrGroupId } = scope(context)
  return parseObject(await rpc(client).rpc('create_recruitment_pipeline_stage', { requested_tenant_id: tenantId, requested_hr_group_id: hrGroupId, requested_code: input.code, requested_name: input.name, requested_sort_order: input.sortOrder }))
}

export async function updateRecruitmentPipelineStage(input: { readonly id: string; readonly name: string; readonly sortOrder: number; readonly isActive: boolean; readonly expectedVersion: number }, client: SupabaseServerClient) {
  return parseObject(await rpc(client).rpc('update_recruitment_pipeline_stage', { requested_stage_id: guid.parse(input.id), requested_name: input.name, requested_sort_order: input.sortOrder, requested_is_active: input.isActive, requested_expected_version: input.expectedVersion }))
}

export async function listAssignedRecruitmentApplications(client?: SupabaseServerClient): Promise<ParticipantAssignment[]> {
  const result = await rpc(client ?? await createClient()).rpc('recruitment_participant_assigned_applications')
  if (result.error) throw recruitmentDatabaseError(result.error)
  return z.array(z.object({ applicationId: guid, candidateName: z.string(), vacancyTitle: z.string(), stageName: z.string().nullable(), version: z.number().int().positive() })).parse(result.data).map((row) => row)
}

export async function getAssignedRecruitmentApplication(applicationId: string, client?: SupabaseServerClient): Promise<ParticipantDetail | null> {
  const result = await rpc(client ?? await createClient()).rpc('recruitment_participant_detail_projection', { requested_application_id: guid.parse(applicationId) })
  if (result.error) throw recruitmentDatabaseError(result.error)
  const row = z.array(z.object({ applicationId: guid, candidateName: z.string(), candidateEmail: z.string().nullable(), candidatePhone: z.string().nullable(), motivation: z.string().nullable(), vacancyTitle: z.string(), stageName: z.string().nullable(), version: z.number().int().positive(), interviews: z.array(recordSchema) })).parse(result.data)[0]
  return row ?? null
}

export async function getRecruitmentAnalytics(context: Pick<AuthContext, 'tenantId' | 'hrGroupId'>, client: SupabaseServerClient) {
  const { tenantId, hrGroupId } = scope(context)
  const result = await rpc(client).rpc('recruitment_analytics_projection', { requested_tenant_id: tenantId, requested_hr_group_id: hrGroupId })
  if (result.error) throw recruitmentDatabaseError(result.error)
  return recordSchema.parse(result.data)
}

export async function anonymizeRecruitmentApplication(applicationId: string, client: SupabaseServerClient) {
  return parseObject(await rpc(client).rpc('recruitment_anonymize_application', { requested_application_id: guid.parse(applicationId) }))
}

export async function runRecruitmentRetention(limit: number, client: SupabaseServerClient) {
  return parseObject(await rpc(client).rpc('recruitment_run_retention', { requested_limit: limit }))
}

export async function createRecruitmentAdminClientForStorage(): Promise<SupabaseClient<Database>> {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  return createAdminClient()
}

export const guidedSchemas = { setItemTypeSchema }
