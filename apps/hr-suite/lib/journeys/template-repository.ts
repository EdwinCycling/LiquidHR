import { z } from 'zod'
import type { Database, Json } from '@scope/db'
import { createClient } from '@/lib/supabase/server'
import { journeyTemplateDraftSchema, type JourneyTemplateDraft } from './domain'
import { JourneyTemplateServiceError, type JourneyTemplateCatalogItem, type JourneyTemplateDetail, type JourneyTemplateRepository } from './template-service'

type TemplateRow = Database['public']['Tables']['journey_templates']['Row']
type VersionRow = Database['public']['Tables']['journey_template_versions']['Row']
type PhaseRow = Database['public']['Tables']['journey_template_phases']['Row']
type RoleRow = Database['public']['Tables']['journey_template_roles']['Row']
type MomentRow = Database['public']['Tables']['journey_template_moments']['Row']
type TopicRow = Database['public']['Tables']['journey_template_topics']['Row']
type AudienceRow = Database['public']['Tables']['journey_template_topic_audiences']['Row']

const createResultSchema = z.object({ id: z.string().uuid(), draftId: z.string().uuid(), revision: z.number().int().positive() })
const publishResultSchema = createResultSchema.extend({ publishedVersionId: z.string().uuid(), versionNumber: z.number().int().positive() })

function rpcCode(message: string): string {
  return message.match(/\bJOURNEY[A-Z0-9_]+\b/)?.[0] ?? 'JOURNEY_TEMPLATE_OPERATION_FAILED'
}

function databaseError(message: string, fallbackStatus = 500): never {
  const code = rpcCode(message)
  const status = code.includes('FORBIDDEN') || code.includes('MODULE_DISABLED') ? 403
    : code.includes('NOT_FOUND') ? 404
      : code.includes('CONFLICT') || code.includes('IMMUTABLE') ? 409
        : code.includes('INVALID') || code.includes('INCOMPLETE') || code.includes('REQUIRED') ? 422
          : fallbackStatus
  throw new JourneyTemplateServiceError(code, status)
}

function localized(value: Json): { nl: string; en: string } {
  const parsed = z.object({ nl: z.string(), en: z.string() }).safeParse(value)
  if (!parsed.success) throw new JourneyTemplateServiceError('JOURNEY_TEMPLATE_DATA_INVALID', 500)
  return parsed.data
}

function catalogItem(template: TemplateRow, versions: readonly VersionRow[]): JourneyTemplateCatalogItem {
  const draft = versions.find((version) => version.status === 'DRAFT')
  if (!draft) throw new JourneyTemplateServiceError('JOURNEY_TEMPLATE_DRAFT_NOT_FOUND', 500)
  const published = versions.filter((version) => version.status === 'PUBLISHED').sort((a, b) => (b.version_number ?? 0) - (a.version_number ?? 0))[0]
  return {
    id: template.id,
    key: template.key,
    name: template.name,
    description: template.description,
    journeyType: template.journey_type,
    lifecycle: template.lifecycle,
    draftId: draft.id,
    draftRevision: draft.revision,
    publishedVersionNumber: published?.version_number ?? null,
    updatedAt: template.updated_at,
  }
}

function draftFromRows(
  template: TemplateRow,
  version: VersionRow,
  phases: readonly PhaseRow[],
  roles: readonly RoleRow[],
  moments: readonly MomentRow[],
  topics: readonly TopicRow[],
  audiences: readonly AudienceRow[],
): JourneyTemplateDraft {
  const phaseKeyById = new Map(phases.map((phase) => [phase.id, phase.key]))
  const roleKeyById = new Map(roles.map((role) => [role.id, role.key]))
  const momentKeyById = new Map(moments.map((moment) => [moment.id, moment.key]))
  const audiencesByTopic = new Map<string, string[]>()
  audiences.forEach((audience) => {
    const roleKey = roleKeyById.get(audience.role_id)
    if (!roleKey) return
    audiencesByTopic.set(audience.topic_id, [...(audiencesByTopic.get(audience.topic_id) ?? []), roleKey])
  })
  const candidate = {
    name: localized(template.name),
    description: localized(template.description),
    journeyType: template.journey_type,
    anchorRule: version.anchor_rule,
    phases: [...phases].sort((a, b) => a.sort_order - b.sort_order).map((phase) => ({ key: phase.key, name: localized(phase.name), sortOrder: phase.sort_order })),
    roles: [...roles].sort((a, b) => a.sort_order - b.sort_order).map((role) => ({
      key: role.key, name: localized(role.name), required: role.is_required, cardinality: role.cardinality,
      resolverType: role.resolver_type, resolverRoleCode: role.resolver_role_code,
      resolverEmployeeId: role.resolver_employee_id, sortOrder: role.sort_order,
    })),
    moments: [...moments].sort((a, b) => a.sort_order - b.sort_order).map((moment) => ({
      key: moment.key, phaseKey: phaseKeyById.get(moment.phase_id) ?? '', name: localized(moment.name),
      dateOffsetDays: moment.date_offset_days, availabilityOffsetDays: moment.availability_offset_days, sortOrder: moment.sort_order,
    })),
    topics: [...topics].sort((a, b) => a.sort_order - b.sort_order).map((topic) => ({
      key: topic.key, momentKey: momentKeyById.get(topic.moment_id) ?? '', ownerRoleKey: roleKeyById.get(topic.owner_role_id) ?? '',
      topicType: topic.topic_type, title: localized(topic.title), body: localized(topic.body), actionUrl: topic.action_url,
      required: topic.is_required, sortOrder: topic.sort_order, audienceRoleKeys: (audiencesByTopic.get(topic.id) ?? []).sort(),
    })),
  }
  const parsed = journeyTemplateDraftSchema.safeParse(candidate)
  if (!parsed.success) throw new JourneyTemplateServiceError('JOURNEY_TEMPLATE_DATA_INVALID', 500)
  return parsed.data
}

async function loadVersions(templateIds: readonly string[]): Promise<readonly VersionRow[]> {
  if (templateIds.length === 0) return []
  const supabase = await createClient()
  const result = await supabase.from('journey_template_versions').select('*').in('template_id', [...templateIds]).order('version_number', { ascending: false })
  if (result.error) databaseError(result.error.message)
  return result.data
}

export const supabaseJourneyTemplateRepository: JourneyTemplateRepository = {
  async list(tenantId, hrGroupId) {
    const supabase = await createClient()
    const result = await supabase.from('journey_templates').select('*').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).order('updated_at', { ascending: false }).limit(250)
    if (result.error) databaseError(result.error.message)
    const versions = await loadVersions(result.data.map((template) => template.id))
    return result.data.map((template) => catalogItem(template, versions.filter((version) => version.template_id === template.id)))
  },
  async get(tenantId, hrGroupId, templateId) {
    const supabase = await createClient()
    const templateResult = await supabase.from('journey_templates').select('*').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('id', templateId).maybeSingle()
    if (templateResult.error) databaseError(templateResult.error.message)
    if (!templateResult.data) return null
    const versions = await loadVersions([templateId])
    const draft = versions.find((version) => version.status === 'DRAFT')
    if (!draft) throw new JourneyTemplateServiceError('JOURNEY_TEMPLATE_DRAFT_NOT_FOUND', 500)
    const [phases, roles, moments, topics, audiences] = await Promise.all([
      supabase.from('journey_template_phases').select('*').eq('template_version_id', draft.id),
      supabase.from('journey_template_roles').select('*').eq('template_version_id', draft.id),
      supabase.from('journey_template_moments').select('*').eq('template_version_id', draft.id),
      supabase.from('journey_template_topics').select('*').eq('template_version_id', draft.id),
      supabase.from('journey_template_topic_audiences').select('*').eq('template_version_id', draft.id),
    ])
    const error = [phases.error, roles.error, moments.error, topics.error, audiences.error].find(Boolean)
    if (error) databaseError(error.message)
    return {
      ...catalogItem(templateResult.data, versions),
      draft: draftFromRows(templateResult.data, draft, phases.data ?? [], roles.data ?? [], moments.data ?? [], topics.data ?? [], audiences.data ?? []),
      versions: versions.filter((version) => version.status === 'PUBLISHED').map((version) => ({
        id: version.id, versionNumber: version.version_number!, publishedAt: version.published_at!,
      })),
    } satisfies JourneyTemplateDetail
  },
  async create(tenantId, hrGroupId, key, draft) {
    const supabase = await createClient()
    const result = await supabase.rpc('create_journey_template_draft', { requested_tenant_id: tenantId, requested_hr_group_id: hrGroupId, requested_key: key, requested_draft: draft as unknown as Json })
    if (result.error) databaseError(result.error.message, 409)
    const parsed = createResultSchema.safeParse(result.data)
    if (!parsed.success) throw new JourneyTemplateServiceError('JOURNEY_TEMPLATE_OPERATION_FAILED', 500)
    return parsed.data
  },
  async save(draftId, expectedRevision, draft) {
    const supabase = await createClient()
    const result = await supabase.rpc('save_journey_template_draft', { requested_draft_id: draftId, requested_expected_revision: expectedRevision, requested_draft: draft as unknown as Json })
    if (result.error) databaseError(result.error.message, 409)
    const parsed = createResultSchema.safeParse(result.data)
    if (!parsed.success) throw new JourneyTemplateServiceError('JOURNEY_TEMPLATE_OPERATION_FAILED', 500)
    return parsed.data
  },
  async publish(draftId, expectedRevision) {
    const supabase = await createClient()
    const result = await supabase.rpc('publish_journey_template', { requested_draft_id: draftId, requested_expected_revision: expectedRevision })
    if (result.error) databaseError(result.error.message, 409)
    const parsed = publishResultSchema.safeParse(result.data)
    if (!parsed.success) throw new JourneyTemplateServiceError('JOURNEY_TEMPLATE_OPERATION_FAILED', 500)
    return parsed.data
  },
  async retire(templateId) {
    const supabase = await createClient()
    const result = await supabase.rpc('retire_journey_template', { requested_template_id: templateId })
    if (result.error) databaseError(result.error.message, 409)
  },
}
