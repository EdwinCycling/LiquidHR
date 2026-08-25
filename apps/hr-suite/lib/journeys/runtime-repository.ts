import { z } from 'zod'
import type { Database, Json } from '@scope/db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AmbiguousManagerError, ManagerNotFoundError, resolveManagerForEmployee } from '@/lib/organization/manager-resolver'
import { createClient } from '@/lib/supabase/server'
import { journeyTemplateDraftSchema, resolveJourneyRole } from './domain'
import { deriveJourneyProgress, type JourneyActivationResolution, type JourneyActivationTemplate, type JourneyParticipantSource } from './runtime-domain'
import { JourneyRuntimeServiceError, type JourneyRuntimeDetail, type JourneyRuntimeListItem, type JourneyRuntimeRepository } from './runtime-service'

type JourneyRow = Database['public']['Tables']['journeys']['Row']
type ParticipantRow = Database['public']['Tables']['journey_participants']['Row']
type MomentRow = Database['public']['Tables']['journey_moments']['Row']
type TopicRow = Database['public']['Tables']['journey_topics']['Row']
type RuntimeTableName =
  | 'departments' | 'department_management' | 'employees' | 'employee_organizations' | 'employments' | 'management_roles'
  | 'journey_templates' | 'journey_template_versions' | 'journey_template_phases' | 'journey_template_roles'
  | 'journey_template_moments' | 'journey_template_topics' | 'journey_template_topic_audiences'
  | 'journeys' | 'journey_phases' | 'journey_participants' | 'journey_participant_changes'
  | 'journey_moments' | 'journey_topics' | 'journey_topic_assignments'
type RuntimeFunctionName = 'activate_journey' | 'transition_journey' | 'replace_journey_participant'
type RuntimeDatabase = {
  public: {
    Tables: Pick<Database['public']['Tables'], RuntimeTableName>
    Views: Record<never, never>
    Functions: Pick<Database['public']['Functions'], RuntimeFunctionName>
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

async function runtimeClient(): Promise<SupabaseClient<RuntimeDatabase>> {
  return await createClient() as unknown as SupabaseClient<RuntimeDatabase>
}

const activateResultSchema = z.object({ id: z.string().uuid(), version: z.number().int().positive(), idempotentReplay: z.boolean() })
const transitionResultSchema = z.object({ id: z.string().uuid(), status: z.string(), version: z.number().int().positive() })
const replaceResultSchema = z.object({ id: z.string().uuid(), participantId: z.string().uuid(), version: z.number().int().positive() })

function localized(value: Json): { nl: string; en: string } {
  const parsed = z.object({ nl: z.string(), en: z.string() }).safeParse(value)
  if (!parsed.success) throw new JourneyRuntimeServiceError('JOURNEY_DATA_INVALID', 500)
  return parsed.data
}

function personName(employee: { first_name: string; birth_name: string; birth_name_prefix: string | null }): string {
  return [employee.first_name, employee.birth_name_prefix, employee.birth_name].filter(Boolean).join(' ')
}

function errorCode(message: string): string {
  return message.match(/\bJOURNEY[A-Z0-9_:.-]+\b/)?.[0]?.replace(/[.:]$/, '') ?? 'JOURNEY_OPERATION_FAILED'
}

function databaseError(message: string): never {
  const code = errorCode(message)
  const status = code.includes('FORBIDDEN') || code.includes('MODULE_DISABLED') ? 403
    : code.includes('NOT_FOUND') || code.includes('NOT_PUBLISHED') ? 404
      : code.includes('CONFLICT') || code.includes('INVALID') || code.includes('BLOCKED') || code.includes('MISSING') || code.includes('CARDINALITY') ? 409
        : 500
  throw new JourneyRuntimeServiceError(code, status)
}

async function employeeNames(employeeIds: readonly string[]): Promise<Map<string, string>> {
  if (employeeIds.length === 0) return new Map()
  const supabase = await runtimeClient()
  const { data, error } = await supabase.from('employees').select('id,first_name,birth_name_prefix,birth_name').in('id', [...new Set(employeeIds)]).limit(500)
  if (error) databaseError(error.message)
  return new Map(data.map((employee) => [employee.id, personName(employee)]))
}

async function activationTemplate(tenantId: string, hrGroupId: string, versionId: string): Promise<JourneyActivationTemplate | null> {
  const supabase = await runtimeClient()
  const versionResult = await supabase.from('journey_template_versions').select('id,template_id,version_number,anchor_rule,status').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('id', versionId).eq('status', 'PUBLISHED').maybeSingle()
  if (versionResult.error) databaseError(versionResult.error.message)
  if (!versionResult.data || versionResult.data.version_number === null) return null
  const templateResult = await supabase.from('journey_templates').select('id,name,description,journey_type,lifecycle').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('id', versionResult.data.template_id).eq('lifecycle', 'PUBLISHED').maybeSingle()
  const phases = await supabase.from('journey_template_phases').select('*').eq('template_version_id', versionId).order('sort_order').limit(100)
  const roles = await supabase.from('journey_template_roles').select('*').eq('template_version_id', versionId).order('sort_order').limit(100)
  const moments = await supabase.from('journey_template_moments').select('*').eq('template_version_id', versionId).order('sort_order').limit(500)
  const topics = await supabase.from('journey_template_topics').select('*').eq('template_version_id', versionId).order('sort_order').limit(2000)
  const audiences = await supabase.from('journey_template_topic_audiences').select('*').eq('template_version_id', versionId).limit(5000)
  const error = [templateResult.error, phases.error, roles.error, moments.error, topics.error, audiences.error].find(Boolean)
  if (error) databaseError(error.message)
  if (!templateResult.data) return null
  const phaseKey = new Map((phases.data ?? []).map((phase) => [phase.id, phase.key]))
  const roleKey = new Map((roles.data ?? []).map((role) => [role.id, role.key]))
  const momentKey = new Map((moments.data ?? []).map((moment) => [moment.id, moment.key]))
  const audienceByTopic = new Map<string, string[]>()
  for (const audience of audiences.data ?? []) {
    const key = roleKey.get(audience.role_id)
    if (key) audienceByTopic.set(audience.topic_id, [...(audienceByTopic.get(audience.topic_id) ?? []), key])
  }
  const draft = journeyTemplateDraftSchema.parse({
    name: localized(templateResult.data.name), description: localized(templateResult.data.description), journeyType: templateResult.data.journey_type,
    anchorRule: versionResult.data.anchor_rule,
    phases: (phases.data ?? []).map((phase) => ({ key: phase.key, name: localized(phase.name), sortOrder: phase.sort_order })),
    roles: (roles.data ?? []).map((role) => ({ key: role.key, name: localized(role.name), required: role.is_required, cardinality: role.cardinality, resolverType: role.resolver_type, resolverRoleCode: role.resolver_role_code, resolverEmployeeId: role.resolver_employee_id, sortOrder: role.sort_order })),
    moments: (moments.data ?? []).map((moment) => ({ key: moment.key, phaseKey: phaseKey.get(moment.phase_id) ?? '', name: localized(moment.name), dateOffsetDays: moment.date_offset_days, availabilityOffsetDays: moment.availability_offset_days, sortOrder: moment.sort_order })),
    topics: (topics.data ?? []).map((topic) => ({ key: topic.key, momentKey: momentKey.get(topic.moment_id) ?? '', ownerRoleKey: roleKey.get(topic.owner_role_id) ?? '', topicType: topic.topic_type, title: localized(topic.title), body: localized(topic.body), actionUrl: topic.action_url, required: topic.is_required, sortOrder: topic.sort_order, audienceRoleKeys: (audienceByTopic.get(topic.id) ?? []).sort() })),
  })
  return { ...draft, templateId: templateResult.data.id, templateVersionId: versionResult.data.id, templateVersionNumber: versionResult.data.version_number }
}

async function resolveParticipants(input: Parameters<JourneyRuntimeRepository['resolveParticipants']>[0]) {
  const supabase = await runtimeClient()
  const targetResult = await supabase.from('employees').select('id,first_name,birth_name_prefix,birth_name').eq('tenant_id', input.tenantId).eq('hr_group_id', input.hrGroupId).eq('id', input.targetEmployeeId).eq('is_active', true).eq('is_archived', false).is('deleted_at', null).maybeSingle()
  if (targetResult.error) databaseError(targetResult.error.message)
  if (!targetResult.data) throw new JourneyRuntimeServiceError('JOURNEY_TARGET_NOT_FOUND', 404)
  let placementQuery = supabase.from('employee_organizations').select('employee_id,department_id,direct_manager_id,direct_manager_deputy_id,effective_from,effective_to,employment_id').eq('tenant_id', input.tenantId).eq('hr_group_id', input.hrGroupId).eq('employee_id', input.targetEmployeeId).lte('effective_from', input.anchorDate).or(`effective_to.is.null,effective_to.gte.${input.anchorDate}`).limit(20)
  if (input.employmentId) placementQuery = placementQuery.eq('employment_id', input.employmentId)
  const resolverRoleCodes = [...new Set(input.template.roles.map((role) => role.resolverRoleCode).filter((value): value is string => value !== null))]
  const placements = await placementQuery
  const departments = await supabase.from('departments').select('id,parent_id').eq('tenant_id', input.tenantId).eq('hr_group_id', input.hrGroupId).limit(1000)
  const managementRoles = await supabase.from('management_roles').select('id,code').in('code', resolverRoleCodes.length ? resolverRoleCodes : ['__NO_JOURNEY_ROLE__']).or(`tenant_id.is.null,tenant_id.eq.${input.tenantId}`).limit(200)
  const firstError = [placements.error, departments.error, managementRoles.error].find(Boolean)
  if (firstError) databaseError(firstError.message)
  const roleCodeById = new Map((managementRoles.data ?? []).map((role) => [role.id, role.code]))
  const roleIds = [...roleCodeById.keys()]
  const assignments = await supabase.from('department_management').select('department_id,management_role_id,employee_id,effective_from,effective_to').eq('tenant_id', input.tenantId).eq('hr_group_id', input.hrGroupId).in('management_role_id', roleIds.length ? roleIds : ['00000000-0000-0000-0000-000000000000']).lte('effective_from', input.anchorDate).or(`effective_to.is.null,effective_to.gte.${input.anchorDate}`).limit(2000)
  if (assignments.error) databaseError(assignments.error.message)
  const candidateIds = new Set<string>([input.targetEmployeeId])
  const rawByRole = new Map<string, Array<{ employeeId: string; source: JourneyParticipantSource }>>()
  const ambiguousRoleKeys = new Set<string>()
  for (const role of input.template.roles) {
    const manual = input.manualParticipants[role.key]
    if (manual && manual.length > 0) {
      rawByRole.set(role.key, manual.map((employeeId) => ({ employeeId, source: 'MANUAL' })))
      manual.forEach((employeeId) => candidateIds.add(employeeId))
      continue
    }
    if (role.resolverType === 'TARGET_EMPLOYEE') rawByRole.set(role.key, [{ employeeId: input.targetEmployeeId, source: 'TARGET_EMPLOYEE' }])
    else if (role.resolverType === 'SPECIFIC_EMPLOYEE' && role.resolverEmployeeId) rawByRole.set(role.key, [{ employeeId: role.resolverEmployeeId, source: 'SPECIFIC_EMPLOYEE' }])
    else if (role.resolverType === 'DIRECT_MANAGER') rawByRole.set(role.key, (placements.data ?? []).flatMap((placement) => placement.direct_manager_id ? [{ employeeId: placement.direct_manager_id, source: 'DIRECT_MANAGER' as const }] : []))
    else if (role.resolverType === 'DEPARTMENT_MANAGER' && role.resolverRoleCode) {
      const candidates: Array<{ employeeId: string; source: JourneyParticipantSource }> = []
      for (const placement of placements.data ?? []) {
        try {
          const manager = resolveManagerForEmployee({
            roleCode: role.resolverRoleCode,
            placement: { employeeId: placement.employee_id, departmentId: placement.department_id, directManagerId: placement.direct_manager_id, directManagerDeputyId: placement.direct_manager_deputy_id },
            departments: (departments.data ?? []).map((department) => ({ id: department.id, parentId: department.parent_id })),
            assignments: (assignments.data ?? []).flatMap((assignment) => {
              const roleCode = roleCodeById.get(assignment.management_role_id)
              return roleCode && assignment.department_id ? [{ departmentId: assignment.department_id, roleCode, employeeId: assignment.employee_id, effectiveFrom: assignment.effective_from, effectiveTo: assignment.effective_to }] : []
            }), unavailableEmployeeIds: [], asOfDate: input.anchorDate,
          })
          candidates.push({ employeeId: manager.employeeId, source: 'DEPARTMENT_MANAGER' })
        } catch (error) {
          if (!(error instanceof ManagerNotFoundError)) {
            if (error instanceof AmbiguousManagerError) { ambiguousRoleKeys.add(role.key); continue }
            throw error
          }
        }
      }
      rawByRole.set(role.key, candidates)
    } else rawByRole.set(role.key, [])
    rawByRole.get(role.key)?.forEach((candidate) => candidateIds.add(candidate.employeeId))
  }
  const names = await employeeNames([...candidateIds])
  const resolutions: JourneyActivationResolution[] = input.template.roles.map((role) => {
    if (ambiguousRoleKeys.has(role.key)) return { roleKey: role.key, status: 'AMBIGUOUS', candidateEmployeeIds: [], employees: [] }
    const candidates = rawByRole.get(role.key) ?? []
    const resolved = resolveJourneyRole({ roleKey: role.key, required: role.required, cardinality: role.cardinality }, candidates)
    if (resolved.status === 'RESOLVED') return { roleKey: role.key, status: 'RESOLVED', employees: resolved.employeeIds.map((employeeId) => ({ employeeId, name: names.get(employeeId) ?? employeeId, source: candidates.find((candidate) => candidate.employeeId === employeeId)?.source ?? 'MANUAL' })) }
    if (resolved.status === 'MISSING') return { roleKey: role.key, status: 'MISSING', blocking: resolved.blocking, employees: [] }
    return { roleKey: role.key, status: 'AMBIGUOUS', candidateEmployeeIds: resolved.candidateEmployeeIds, employees: [] }
  })
  return { targetEmployeeName: personName(targetResult.data), resolutions }
}

function listItem(row: JourneyRow, targetName: string, employeeNumber: string, moments: readonly MomentRow[], topics: readonly TopicRow[], participants: readonly ParticipantRow[], names: Map<string, string>): JourneyRuntimeListItem {
  const today = new Date().toISOString().slice(0, 10)
  const journeyMoments = moments.filter((moment) => moment.journey_id === row.id).sort((left, right) => left.scheduled_on.localeCompare(right.scheduled_on) || left.sort_order - right.sort_order)
  const next = journeyMoments.find((moment) => moment.scheduled_on >= today) ?? null
  const momentById = new Map(journeyMoments.map((moment) => [moment.id, moment]))
  const journeyTopics = topics.filter((topic) => topic.journey_id === row.id)
  const overdueRequiredTopics = journeyTopics.filter((topic) => topic.is_required && topic.status === 'PENDING' && (momentById.get(topic.moment_id)?.scheduled_on ?? today) < today).length
  return {
    id: row.id, templateName: localized(row.template_name), templateVersionNumber: row.template_version_number,
    targetEmployeeId: row.target_employee_id, targetEmployeeName: targetName, targetEmployeeNumber: employeeNumber,
    anchorDate: row.anchor_date, status: row.status, version: row.version,
    nextMomentOn: next?.scheduled_on ?? null, nextMomentName: next ? localized(next.name) : null, overdueRequiredTopics,
    progress: deriveJourneyProgress(journeyTopics),
    participantNames: [...new Set(participants.filter((participant) => participant.journey_id === row.id && (participant.status === 'ACTIVE' || participant.status === 'ASSIGNED')).map((participant) => names.get(participant.employee_id) ?? participant.employee_id))],
  }
}

export const supabaseJourneyRuntimeRepository: JourneyRuntimeRepository = {
  async listStartOptions(tenantId, hrGroupId) {
    const supabase = await runtimeClient()
    const templates = await supabase.from('journey_templates').select('id,name,journey_type,current_published_version_id').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('lifecycle', 'PUBLISHED').not('current_published_version_id', 'is', null).order('updated_at', { ascending: false }).limit(250)
    const employees = await supabase.from('employees').select('id,first_name,birth_name_prefix,birth_name,employee_number').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).eq('is_archived', false).is('deleted_at', null).order('birth_name').limit(500)
    const employments = await supabase.from('employments').select('id,employee_id,employment_number,starts_on,ends_on,is_primary').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).is('deleted_at', null).order('starts_on', { ascending: false }).limit(1000)
    const error = [templates.error, employees.error, employments.error].find(Boolean)
    if (error) databaseError(error.message)
    const versionIds = (templates.data ?? []).flatMap((template) => template.current_published_version_id ? [template.current_published_version_id] : [])
    const versions = await supabase.from('journey_template_versions').select('id,version_number').in('id', versionIds.length ? versionIds : ['00000000-0000-0000-0000-000000000000']).limit(250)
    if (versions.error) databaseError(versions.error.message)
    const versionById = new Map((versions.data ?? []).map((version) => [version.id, version.version_number]))
    return {
      templates: (templates.data ?? []).flatMap((template) => template.current_published_version_id && versionById.get(template.current_published_version_id) ? [{ id: template.id, versionId: template.current_published_version_id, versionNumber: versionById.get(template.current_published_version_id)!, name: localized(template.name), journeyType: template.journey_type }] : []),
      employees: (employees.data ?? []).map((employee) => ({ id: employee.id, name: personName(employee), employeeNumber: employee.employee_number })),
      employments: (employments.data ?? []).map((employment) => ({ id: employment.id, employeeId: employment.employee_id, employmentNumber: employment.employment_number ?? '', startsOn: employment.starts_on, endsOn: employment.ends_on, isPrimary: employment.is_primary })),
    }
  },
  getActivationTemplate: activationTemplate,
  resolveParticipants,
  async activate(input) {
    const supabase = await runtimeClient()
    const args = { requested_tenant_id: input.tenantId, requested_hr_group_id: input.hrGroupId, requested_template_version_id: input.templateVersionId, requested_target_employee_id: input.targetEmployeeId, requested_employment_id: input.employmentId, requested_anchor_date: input.anchorDate, requested_idempotency_key: input.idempotencyKey, requested_participants: input.participants as unknown as Json }
    const { data, error } = await supabase.rpc('activate_journey', args as unknown as Database['public']['Functions']['activate_journey']['Args'])
    if (error) databaseError(error.message)
    const parsed = activateResultSchema.safeParse(data)
    if (!parsed.success) throw new JourneyRuntimeServiceError('JOURNEY_OPERATION_FAILED', 500)
    return parsed.data
  },
  async list(tenantId, hrGroupId) {
    const supabase = await runtimeClient()
    const journeysResult = await supabase.from('journeys').select('*').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).order('updated_at', { ascending: false }).limit(250)
    if (journeysResult.error) databaseError(journeysResult.error.message)
    if (journeysResult.data.length === 0) return []
    const journeyIds = journeysResult.data.map((journey) => journey.id)
    const employeeIds = journeysResult.data.map((journey) => journey.target_employee_id)
    const employees = await supabase.from('employees').select('id,first_name,birth_name_prefix,birth_name,employee_number').in('id', employeeIds).limit(500)
    const moments = await supabase.from('journey_moments').select('*').in('journey_id', journeyIds).limit(5000)
    const topics = await supabase.from('journey_topics').select('*').in('journey_id', journeyIds).limit(10000)
    const participants = await supabase.from('journey_participants').select('*').in('journey_id', journeyIds).limit(5000)
    const error = [employees.error, moments.error, topics.error, participants.error].find(Boolean)
    if (error) databaseError(error.message)
    const participantNames = await employeeNames((participants.data ?? []).map((participant) => participant.employee_id))
    const targetById = new Map((employees.data ?? []).map((employee) => [employee.id, employee]))
    return journeysResult.data.map((journey) => { const target = targetById.get(journey.target_employee_id); return listItem(journey, target ? personName(target) : journey.target_employee_id, target?.employee_number ?? '', moments.data ?? [], topics.data ?? [], participants.data ?? [], participantNames) })
  },
  async get(tenantId, hrGroupId, journeyId) {
    const supabase = await runtimeClient()
    const journeyResult = await supabase.from('journeys').select('*').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('id', journeyId).maybeSingle()
    if (journeyResult.error) databaseError(journeyResult.error.message)
    if (!journeyResult.data) return null
    const target = await supabase.from('employees').select('id,first_name,birth_name_prefix,birth_name,employee_number').eq('id', journeyResult.data.target_employee_id).maybeSingle()
    const phases = await supabase.from('journey_phases').select('*').eq('journey_id', journeyId).order('sort_order').limit(100)
    const participants = await supabase.from('journey_participants').select('*').eq('journey_id', journeyId).order('assigned_at').limit(500)
    const moments = await supabase.from('journey_moments').select('*').eq('journey_id', journeyId).order('scheduled_on').order('sort_order').limit(1000)
    const topics = await supabase.from('journey_topics').select('*').eq('journey_id', journeyId).order('sort_order').limit(5000)
    const assignments = await supabase.from('journey_topic_assignments').select('*').eq('journey_id', journeyId).limit(10000)
    const changes = await supabase.from('journey_participant_changes').select('*').eq('journey_id', journeyId).order('changed_at', { ascending: false }).limit(500)
    const error = [target.error, phases.error, participants.error, moments.error, topics.error, assignments.error, changes.error].find(Boolean)
    if (error) databaseError(error.message)
    const names = await employeeNames((participants.data ?? []).map((participant) => participant.employee_id))
    const summary = listItem(journeyResult.data, target.data ? personName(target.data) : journeyResult.data.target_employee_id, target.data?.employee_number ?? '', moments.data ?? [], topics.data ?? [], participants.data ?? [], names)
    const participantById = new Map((participants.data ?? []).map((participant) => [participant.id, participant]))
    return {
      ...summary, employmentId: journeyResult.data.employment_id,
      phases: (phases.data ?? []).map((phase) => ({ id: phase.id, key: phase.key, name: localized(phase.name), sortOrder: phase.sort_order })),
      participants: (participants.data ?? []).map((participant) => ({ id: participant.id, roleKey: participant.role_key, roleName: localized(participant.role_name), employeeId: participant.employee_id, employeeName: names.get(participant.employee_id) ?? participant.employee_id, source: participant.source, status: participant.status, resolutionNote: participant.resolution_note })),
      moments: (moments.data ?? []).map((moment) => ({ id: moment.id, phaseId: moment.phase_id, key: moment.key, name: localized(moment.name), scheduledOn: moment.scheduled_on, availableOn: moment.available_on, sortOrder: moment.sort_order })),
      topics: (topics.data ?? []).map((topic) => ({ id: topic.id, momentId: topic.moment_id, key: topic.key, title: localized(topic.title), topicType: topic.topic_type, isRequired: topic.is_required, status: topic.status, ownerRoleKey: topic.owner_role_key, ownerNames: (assignments.data ?? []).filter((assignment) => assignment.topic_id === topic.id && assignment.is_owner).map((assignment) => names.get(participantById.get(assignment.participant_id)?.employee_id ?? '') ?? '') .filter(Boolean) })),
      changes: (changes.data ?? []).map((change) => ({ id: change.id, previousParticipantId: change.previous_participant_id, replacementParticipantId: change.replacement_participant_id, reason: change.reason, changedAt: change.changed_at })),
    } satisfies JourneyRuntimeDetail
  },
  async transition(journeyId, expectedVersion, action) {
    const supabase = await runtimeClient(); const { data, error } = await supabase.rpc('transition_journey', { requested_journey_id: journeyId, requested_expected_version: expectedVersion, requested_action: action }); if (error) databaseError(error.message)
    const parsed = transitionResultSchema.safeParse(data); if (!parsed.success) throw new JourneyRuntimeServiceError('JOURNEY_OPERATION_FAILED', 500); return parsed.data
  },
  async replaceParticipant(journeyId, participantId, replacementEmployeeId, expectedVersion, reason) {
    const supabase = await runtimeClient(); const { data, error } = await supabase.rpc('replace_journey_participant', { requested_journey_id: journeyId, requested_participant_id: participantId, requested_replacement_employee_id: replacementEmployeeId, requested_expected_version: expectedVersion, requested_reason: reason }); if (error) databaseError(error.message)
    const parsed = replaceResultSchema.safeParse(data); if (!parsed.success) throw new JourneyRuntimeServiceError('JOURNEY_OPERATION_FAILED', 500); return parsed.data
  },
}
