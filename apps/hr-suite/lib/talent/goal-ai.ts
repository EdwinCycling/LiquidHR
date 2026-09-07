import 'server-only'

import { createHash } from 'node:crypto'
import { z } from 'zod'
import { AiExecutionError, type AiExecutionResult, type AiInvocationInput, type AiJsonValue, type AiRuntimeDependencies, type AuthorizedAiContext } from '@/lib/ai/contracts'
import { createAiTextProposalValidator, type AiTextProposal } from '@/lib/ai/everywhere/proposal'
import { DEVELOPMENT_GOAL_SMART_FEATURE } from '@/lib/ai/feature-registry'
import { requireAuthContext, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { createServerAiRuntimeDependencies, runAuthorizedAiInvocation } from '@/lib/ai/runtime'

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
export const developmentGoalSmartRequestSchema = z.object({
  goalId: uuid.optional(),
  employeeId: uuid.optional(),
  sourceText: z.string().trim().min(1).max(4_000),
  locale: z.enum(['nl', 'en']),
}).strict()
export type DevelopmentGoalSmartRequest = z.infer<typeof developmentGoalSmartRequestSchema>

type GoalSource = { title: string | null; description: string | null; periodStart: string | null; periodEnd: string | null }

async function resolveTarget(input: DevelopmentGoalSmartRequest): Promise<{ context: AuthContext; employeeId: string; source: GoalSource | null }> {
  const context = await requireAuthContext()
  if (input.goalId) {
    const supabase = await createClient()
    const result = await supabase.from('talent_development_goals').select('employee_id,title,description,period_start,period_end').eq('tenant_id', context.tenantId).eq('id', input.goalId).maybeSingle()
    if (result.error || !result.data) throw new AiExecutionError('UNAUTHORIZED')
    await requirePermission('talent-goal:write', result.data.employee_id)
    return { context, employeeId: result.data.employee_id, source: { title: result.data.title, description: result.data.description, periodStart: result.data.period_start, periodEnd: result.data.period_end } }
  }
  const employeeId = input.employeeId ?? context.employeeId
  if (!employeeId) throw new AiExecutionError('UNAUTHORIZED')
  await requirePermission('talent-goal:write', employeeId)
  return { context, employeeId, source: null }
}

function prompt(locale: DevelopmentGoalSmartRequest['locale']): string {
  return locale === 'nl'
    ? 'Maak een voorstel om het bestaande ontwikkeldoel SMART te formuleren. Behoud de bedoeling van de aangeleverde tekst en voeg geen feiten toe. Gebruik exact de koppen Specifiek, Meetbaar, Acceptabel/haalbaar, Relevant, Tijdgebonden en Voorstel doeltekst. Gebruik onbekend waar de bron onvoldoende informatie bevat. Dit is alleen een voorstel: overschrijf of bewaar het bestaande doel niet.'
    : 'Create a proposal to make the existing development goal SMART. Preserve the intention of the supplied text and do not add facts. Use exactly the headings Specific, Measurable, Achievable, Relevant, Time-bound, and Proposed goal text. Say when the source lacks information. This is a proposal only: do not overwrite or save the existing goal.'
}

function businessObjectId(input: DevelopmentGoalSmartRequest, employeeId: string): string {
  return input.goalId ?? createHash('sha256').update(JSON.stringify({ employeeId, sourceText: input.sourceText, locale: input.locale })).digest('hex')
}

export function createDevelopmentGoalSmartContextLoader(input: DevelopmentGoalSmartRequest, source: GoalSource | null) {
  return {
    async load(contextInput: { businessObject: AuthorizedAiContext['source'] }): Promise<AuthorizedAiContext> {
      const fields: Readonly<Record<string, AiJsonValue>> = {
        sourceText: input.sourceText,
        existingTitle: source?.title ?? null,
        existingDescription: source?.description ?? null,
        periodStart: source?.periodStart ?? null,
        periodEnd: source?.periodEnd ?? null,
        locale: input.locale,
      }
      return { source: contextInput.businessObject, fields, prompt: { instructions: prompt(input.locale) } }
    },
  }
}

export function createDevelopmentGoalSmartInvocationInput(input: DevelopmentGoalSmartRequest, employeeId: string, idempotencyKey: string): Omit<AiInvocationInput, 'authContext'> {
  return {
    featureCode: DEVELOPMENT_GOAL_SMART_FEATURE,
    businessObject: { type: 'development-goal', id: businessObjectId(input, employeeId) },
    idempotencyKey,
    businessPermissionCode: 'talent-goal:write',
    businessPermissionTargetId: employeeId,
    qualityProfile: 'EFFICIENT',
    writingStyle: null,
  }
}

export async function runDevelopmentGoalSmart(input: { request: DevelopmentGoalSmartRequest; idempotencyKey: string }): Promise<AiTextProposal> {
  const target = await resolveTarget(input.request)
  const dependencies: AiRuntimeDependencies<AiTextProposal> = createServerAiRuntimeDependencies({
    contextLoader: createDevelopmentGoalSmartContextLoader(input.request, target.source),
    validator: createAiTextProposalValidator(),
  })
  const result: AiExecutionResult<AiTextProposal> = await runAuthorizedAiInvocation(
    createDevelopmentGoalSmartInvocationInput(input.request, target.employeeId, input.idempotencyKey),
    dependencies,
  )
  if (result.kind === 'DUPLICATE') throw new AiExecutionError('DUPLICATE_COMPLETED')
  return result.output
}
