import 'server-only'

import { createHash } from 'node:crypto'
import { z } from 'zod'
import { AiExecutionError, type AiExecutionResult, type AiInvocationInput, type AiJsonValue, type AiRuntimeDependencies, type AuthorizedAiContext } from '@/lib/ai/contracts'
import { createAiTextProposalValidator, type AiTextProposal } from '@/lib/ai/everywhere/proposal'
import { VACANCY_DRAFT_FEATURE } from '@/lib/ai/feature-registry'
import { requireAuthContext, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { createServerAiRuntimeDependencies, runAuthorizedAiInvocation } from '@/lib/ai/runtime'
import { getRecruitmentVacancy, type VacancyDetail } from './vacancy-service'
import { recruitmentGuidSchema } from './domain'

const vacancyContextSchema = z.object({
  title: z.string().trim().min(1).max(180),
  locationLabel: z.string().trim().max(160).default(''),
  workMode: z.enum(['ON_SITE', 'HYBRID', 'REMOTE']).nullable().default(null),
  minHours: z.number().min(0).max(168).nullable().default(null),
  maxHours: z.number().min(0).max(168).nullable().default(null),
  sections: z.array(z.object({
    sectionType: z.enum(['INTRODUCTION', 'ROLE', 'PROFILE', 'OFFER', 'PROCESS', 'CONTACT']),
    title: z.string().trim().min(1).max(180),
    content: z.string().max(20_000),
    isVisible: z.boolean(),
  }).strict()).length(6),
}).strict()

const vacancySectionTypeSchema = z.enum(['ALL', 'INTRODUCTION', 'ROLE', 'PROFILE', 'OFFER', 'PROCESS', 'CONTACT'])

export const vacancyDraftRequestSchema = z.object({
  vacancyId: recruitmentGuidSchema.optional(),
  vacancy: vacancyContextSchema.optional(),
  targetSection: vacancySectionTypeSchema.default('ALL'),
  instruction: z.string().trim().max(1_000).optional(),
  locale: z.enum(['nl', 'en']),
}).strict().superRefine((value, context) => {
  if (!value.vacancyId && !value.vacancy) context.addIssue({ code: 'custom', path: ['vacancy'], message: 'AI_EVERYWHERE_VACANCY_REQUIRED' })
})
export type VacancyDraftRequest = z.infer<typeof vacancyDraftRequestSchema>

type VacancyAiContext = {
  title: string
  locationLabel: string
  workMode: VacancyDetail['workMode']
  minHours: number | null
  maxHours: number | null
  sections: Array<{ sectionType: string; title: string; content: string }>
  targetSection: z.infer<typeof vacancySectionTypeSchema>
  instruction: string | null
}

function canonicalContext(vacancy: VacancyDetail, instruction: string | undefined, targetSection: VacancyDraftRequest['targetSection']): VacancyAiContext {
  return {
    title: vacancy.title,
    locationLabel: vacancy.locationLabel ?? '',
    workMode: vacancy.workMode,
    minHours: vacancy.minHours,
    maxHours: vacancy.maxHours,
    sections: vacancy.sections.filter((section) => section.isVisible).map((section) => ({ sectionType: section.sectionType, title: section.title, content: section.content.slice(0, 3_000) })),
    targetSection,
    instruction: instruction?.trim() || null,
  }
}

function submittedContext(request: VacancyDraftRequest): VacancyAiContext {
  if (!request.vacancy) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  return {
    title: request.vacancy.title,
    locationLabel: request.vacancy.locationLabel,
    workMode: request.vacancy.workMode,
    minHours: request.vacancy.minHours,
    maxHours: request.vacancy.maxHours,
    sections: request.vacancy.sections.filter((section) => section.isVisible).map((section) => ({ sectionType: section.sectionType, title: section.title, content: section.content.slice(0, 3_000) })),
    targetSection: request.targetSection,
    instruction: request.instruction?.trim() || null,
  }
}

function prompt(locale: VacancyDraftRequest['locale'], targetSection: VacancyDraftRequest['targetSection']): string {
  const sectionInstruction = targetSection === 'ALL'
    ? locale === 'nl' ? 'Gebruik exact de koppen Introductie, Wat ga je doen?, Wat breng je mee?, Wat bieden wij? en Afsluiting.' : 'Use exactly the headings Introduction, What will you do?, What do you bring?, What we offer, and Closing.'
    : locale === 'nl' ? `Schrijf alleen de inhoud voor het vacatureblok ${targetSection}. Neem geen kop over in de tekst.` : `Write only the content for vacancy section ${targetSection}. Do not include a heading in the text.`
  return locale === 'nl'
    ? `Schrijf een vacaturetekst als voorstel op basis van uitsluitend de aangeleverde vacaturecontext. ${sectionInstruction} Gebruik bestaande feiten opnieuw, verzin geen salaris, voordelen, arbeidsvoorwaarden, bedrijfsfeiten of vaardigheden. Als informatie ontbreekt, laat die weg of benoem dat de informatie niet bekend is. Publiceer niets en wijzig geen vacaturegegevens.`
    : `Write a vacancy text as a proposal using only the supplied vacancy context. ${sectionInstruction} Reuse existing facts and do not invent salary, benefits, employment conditions, company facts, or skills. If information is missing, omit it or state that it is not known. Do not publish or change vacancy data.`
}

function businessObjectId(request: VacancyDraftRequest, context: VacancyAiContext): string {
  return request.vacancyId ?? createHash('sha256').update(JSON.stringify(context)).digest('hex')
}

export function createVacancyDraftContextLoader(context: VacancyAiContext, request: VacancyDraftRequest) {
  return {
    async load(input: { businessObject: AuthorizedAiContext['source'] }): Promise<AuthorizedAiContext> {
      const fields: Readonly<Record<string, AiJsonValue>> = {
        title: context.title,
        locationLabel: context.locationLabel,
        workMode: context.workMode,
        minHours: context.minHours,
        maxHours: context.maxHours,
        sections: context.sections,
        instruction: context.instruction,
      }
      return { source: input.businessObject, fields, prompt: { instructions: prompt(request.locale, request.targetSection) } }
    },
  }
}

export function createVacancyDraftInvocationInput(request: VacancyDraftRequest, idempotencyKey: string, businessObjectIdValue: string): Omit<AiInvocationInput, 'authContext'> {
  return {
    featureCode: VACANCY_DRAFT_FEATURE,
    businessObject: { type: 'recruitment-vacancy-draft', id: businessObjectIdValue },
    idempotencyKey,
    businessPermissionCode: 'recruitment-vacancy:write',
    businessPermissionTargetId: request.vacancyId,
    qualityProfile: 'EFFICIENT',
    writingStyle: null,
  }
}

async function resolveContext(request: VacancyDraftRequest): Promise<{ authContext: AuthContext; context: VacancyAiContext }> {
  const authContext = await requireAuthContext()
  if (!request.vacancyId) {
    await requirePermission('recruitment-vacancy:write')
    return { authContext, context: submittedContext(request) }
  }
  await requirePermission('recruitment-vacancy:write', request.vacancyId)
  const vacancy = await getRecruitmentVacancy(authContext, request.vacancyId, await createClient())
  if (!vacancy) throw new AiExecutionError('UNAUTHORIZED')
  return { authContext, context: canonicalContext(vacancy, request.instruction, request.targetSection) }
}

export async function runVacancyDraft(input: { request: VacancyDraftRequest; idempotencyKey: string }): Promise<AiTextProposal> {
  const resolved = await resolveContext(input.request)
  const dependencies: AiRuntimeDependencies<AiTextProposal> = createServerAiRuntimeDependencies({
    contextLoader: createVacancyDraftContextLoader(resolved.context, input.request),
    validator: createAiTextProposalValidator(),
  })
  const result: AiExecutionResult<AiTextProposal> = await runAuthorizedAiInvocation(
    createVacancyDraftInvocationInput(input.request, input.idempotencyKey, businessObjectId(input.request, resolved.context)),
    dependencies,
  )
  if (result.kind === 'DUPLICATE') throw new AiExecutionError('DUPLICATE_COMPLETED')
  return result.output
}
