import type { AuthContext } from '@/lib/auth/permissions'
import type { ToggleableModuleCode } from '@/lib/modules/module-catalog'
import type { Json } from '@scope/db'
import { journeyTemplateDraftSchema, validateJourneyTemplate, type JourneyTemplateDraft, type JourneyTemplateIssue } from './domain'

export interface JourneyTemplateCatalogItem {
  readonly id: string
  readonly key: string
  readonly name: Json
  readonly description: Json
  readonly journeyType: JourneyTemplateDraft['journeyType']
  readonly lifecycle: 'DRAFT' | 'PUBLISHED' | 'RETIRED'
  readonly draftId: string
  readonly draftRevision: number
  readonly publishedVersionNumber: number | null
  readonly updatedAt: string
}

export interface JourneyTemplateDetail extends JourneyTemplateCatalogItem {
  readonly draft: JourneyTemplateDraft
  readonly versions: readonly {
    readonly id: string
    readonly versionNumber: number
    readonly publishedAt: string
  }[]
}

export interface JourneyTemplateRepository {
  list(tenantId: string, hrGroupId: string): Promise<readonly JourneyTemplateCatalogItem[]>
  get(tenantId: string, hrGroupId: string, templateId: string): Promise<JourneyTemplateDetail | null>
  create(tenantId: string, hrGroupId: string, key: string, draft: JourneyTemplateDraft): Promise<{ id: string; draftId: string; revision: number }>
  save(draftId: string, expectedRevision: number, draft: JourneyTemplateDraft): Promise<{ id: string; draftId: string; revision: number }>
  publish(draftId: string, expectedRevision: number): Promise<{ id: string; draftId: string; publishedVersionId: string; versionNumber: number; revision: number }>
  retire(templateId: string): Promise<void>
}

export class JourneyTemplateServiceError extends Error {
  constructor(readonly code: string, readonly status: number, readonly issues: readonly JourneyTemplateIssue[] = []) {
    super(code)
    this.name = 'JourneyTemplateServiceError'
  }
}

export interface JourneyTemplateServiceDependencies {
  readonly repository: JourneyTemplateRepository
  readonly authorize: (permissions: readonly string[]) => Promise<AuthContext>
  readonly requireModule: (moduleCode: ToggleableModuleCode) => Promise<void>
}

function requireGroup(context: AuthContext): string {
  if (!context.hrGroupId) throw new JourneyTemplateServiceError('JOURNEY_HR_GROUP_REQUIRED', 409)
  return context.hrGroupId
}

function validateDraft(input: unknown): JourneyTemplateDraft {
  const parsed = journeyTemplateDraftSchema.safeParse(input)
  if (!parsed.success) {
    throw new JourneyTemplateServiceError('JOURNEY_TEMPLATE_INVALID', 422, parsed.error.issues.map((issue) => ({ code: 'JOURNEY_TEMPLATE_SCHEMA_INVALID', path: issue.path.map(String) })))
  }
  const issues = validateJourneyTemplate(parsed.data)
  if (issues.length > 0) throw new JourneyTemplateServiceError('JOURNEY_TEMPLATE_INVALID', 422, issues)
  return parsed.data
}

export function createJourneyTemplateService(dependencies: JourneyTemplateServiceDependencies) {
  async function contextFor(permissions: readonly string[]): Promise<AuthContext> {
    const context = await dependencies.authorize(permissions)
    await dependencies.requireModule('JOURNEYS')
    requireGroup(context)
    return context
  }

  return {
    async listTemplates(): Promise<readonly JourneyTemplateCatalogItem[]> {
      const context = await contextFor(['journey-template:read', 'journey-template:write', 'journey-template:publish'])
      return dependencies.repository.list(context.tenantId, requireGroup(context))
    },
    async getTemplate(templateId: string): Promise<JourneyTemplateDetail> {
      const context = await contextFor(['journey-template:read', 'journey-template:write', 'journey-template:publish'])
      const template = await dependencies.repository.get(context.tenantId, requireGroup(context), templateId)
      if (!template) throw new JourneyTemplateServiceError('JOURNEY_TEMPLATE_NOT_FOUND', 404)
      return template
    },
    async createTemplate(input: { readonly key: string; readonly draft: unknown }) {
      const context = await contextFor(['journey-template:write'])
      const draft = validateDraft(input.draft)
      if (!/^[a-z][a-z0-9_-]{0,79}$/.test(input.key)) throw new JourneyTemplateServiceError('JOURNEY_TEMPLATE_KEY_INVALID', 400)
      return dependencies.repository.create(context.tenantId, requireGroup(context), input.key, draft)
    },
    async saveTemplate(draftId: string, expectedRevision: number, input: unknown) {
      await contextFor(['journey-template:write'])
      if (!Number.isInteger(expectedRevision) || expectedRevision < 1) throw new JourneyTemplateServiceError('JOURNEY_TEMPLATE_REVISION_INVALID', 400)
      return dependencies.repository.save(draftId, expectedRevision, validateDraft(input))
    },
    async publishJourneyTemplate(draftId: string, expectedVersion: number) {
      await contextFor(['journey-template:publish'])
      if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new JourneyTemplateServiceError('JOURNEY_TEMPLATE_REVISION_INVALID', 400)
      return dependencies.repository.publish(draftId, expectedVersion)
    },
    async retireTemplate(templateId: string): Promise<void> {
      await contextFor(['journey-template:publish'])
      await dependencies.repository.retire(templateId)
    },
  }
}

export type JourneyTemplateService = ReturnType<typeof createJourneyTemplateService>
