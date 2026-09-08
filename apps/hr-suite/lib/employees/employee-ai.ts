import 'server-only'

import { createHash } from 'node:crypto'
import { z } from 'zod'
import { AiExecutionError, type AiExecutionResult, type AiInvocationInput, type AiJsonValue, type AiRuntimeDependencies, type AuthorizedAiContext } from '@/lib/ai/contracts'
import { CONVERSATION_PREPARATION_FEATURE, EMPLOYEE_SUMMARY_FEATURE } from '@/lib/ai/feature-registry'
import { createAiTextProposalValidator, createSafeTextProposalValidator, type AiTextProposal } from '@/lib/ai/everywhere/proposal'
import type { AuthContext } from '@/lib/auth/permissions'
import { getEmployeeEmploymentDetail } from '@/lib/employment/employment-service'
import { listTalentGoals } from '@/lib/talent/goal-service'
import { createServerAiRuntimeDependencies, runAuthorizedAiInvocation } from '@/lib/ai/runtime'
import { listEmployeeActivity } from './employee-activity-service'

export const employeeAiRequestSchema = z.object({ locale: z.enum(['nl', 'en']) }).strict()
export type EmployeeAiRequest = z.infer<typeof employeeAiRequestSchema>
export type EmployeeAiFeature = typeof EMPLOYEE_SUMMARY_FEATURE | typeof CONVERSATION_PREPARATION_FEATURE

type EmployeeAiGoal = {
  title: string
  description: string | null
  periodStart: string
  periodEnd: string | null
  progressPercent: number
  status: string
}

type EmployeeAiAction = { message: string; occurredAt: string }

const sensitiveHrText = /absence|absent|sick|sickness|medical|diagnos|doctor|occupational|arbodienst|verzuim|ziek|ziekte|arts|gezondheid/i

function safeNarrative(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && Boolean(value.trim()) && !sensitiveHrText.test(value)
}

async function authorizedGoals(authContext: AuthContext, employeeId: string): Promise<EmployeeAiGoal[]> {
  try {
    const mode = authContext.employeeId === employeeId ? 'self' : authContext.permissions.includes('talent-goal:manage') ? 'admin' : 'manager'
    const workspace = await listTalentGoals(mode, { employeeId }, { includeOptions: false, includeEmployeeOptions: false, includeCapabilityOptions: false })
    return workspace.goals
      .filter((goal) => safeNarrative(goal.title) && (!goal.description || safeNarrative(goal.description)))
      .map((goal) => ({
        title: goal.title,
        description: goal.description,
        periodStart: goal.period_start,
        periodEnd: goal.period_end,
        progressPercent: goal.progress_percent,
        status: goal.status,
      }))
      .slice(0, 20)
  } catch {
    return []
  }
}

async function authorizedActions(authContext: AuthContext, employeeId: string): Promise<EmployeeAiAction[]> {
  if (!authContext.permissions.includes('employee-activity:read')) return []
  try {
    return (await listEmployeeActivity(employeeId, 10))
      .filter((item) => safeNarrative(item.message))
      .map((item) => ({ message: item.message, occurredAt: item.createdAt }))
  } catch {
    return []
  }
}

async function loadEmployeeContext(authContext: AuthContext, employeeId: string): Promise<{
  employeeName: string
  employmentStatus: string
  role: string | null
  department: string | null
  manager: string | null
  hoursPerWeek: number | null
  goals: EmployeeAiGoal[]
  openActions: Array<{ title: string; dueOn: string | null }>
  recentActions: EmployeeAiAction[]
}> {
  const [detail, goals, recentActions] = await Promise.all([
    getEmployeeEmploymentDetail(employeeId, 'overview', { includeSalary: false }),
    authorizedGoals(authContext, employeeId),
    authorizedActions(authContext, employeeId),
  ])
  const current = detail.currentEmploymentSummary
  return {
    employeeName: `${detail.employee.firstName} ${detail.employee.birthName}`.trim(),
    employmentStatus: detail.status,
    role: current.jobTitle,
    department: current.departmentName,
    manager: current.managerName,
    hoursPerWeek: current.hoursPerWeek,
    goals,
    openActions: goals.filter((goal) => goal.status === 'ACTIVE' && goal.progressPercent < 100).map((goal) => ({ title: goal.title, dueOn: goal.periodEnd })),
    recentActions,
  }
}

function promptFor(feature: EmployeeAiFeature, locale: EmployeeAiRequest['locale']): string {
  if (feature === EMPLOYEE_SUMMARY_FEATURE) {
    return locale === 'nl'
      ? 'Maak een beknopte HR-samenvatting op basis van uitsluitend de aangeleverde, geautoriseerde context. Gebruik exact de koppen Rol en positie, Recente aandachtspunten, Ontwikkeling en Open acties. Noem alleen feiten die in de context staan. Vermeld bij ontbrekende informatie dat die niet bekend is. Sluit verzuim, medische of andere beschermde HR-informatie uit. Geef geen oordeel, score, risico-inschatting of advies.'
      : 'Create a concise HR summary using only the supplied authorized context. Use exactly the headings Role and position, Recent points of attention, Development, and Open actions. Mention only facts present in the context and say when information is not known. Exclude absence, medical, and other protected HR information. Do not provide a judgement, score, risk assessment, or advice.'
  }
  return locale === 'nl'
    ? 'Bereid een manager- of HR-gesprek voor op basis van uitsluitend de aangeleverde, geautoriseerde context. Gebruik exact de koppen Belangrijke gesprekspunten, Recente doelen en voortgang, Open acties en Mogelijke vragen. Beschrijf geen prestatiescore of kwaliteitsoordeel, classificeer de medewerker niet en adviseer geen disciplinaire actie. Sluit verzuim en medische informatie uit. Noem ontbrekende informatie als niet bekend.'
    : 'Prepare a manager or HR conversation using only the supplied authorized context. Use exactly the headings Important talking points, Recent goals and progress, Open actions, and Possible questions. Do not produce a performance score or quality judgement, classify the employee, or recommend disciplinary action. Exclude absence and medical information. State when information is not known.'
}

function businessObjectId(feature: EmployeeAiFeature, employeeId: string, request: EmployeeAiRequest): string {
  return createHash('sha256').update(JSON.stringify({ feature, employeeId, request })).digest('hex')
}

export function createEmployeeAiContextLoader(feature: EmployeeAiFeature, employeeId: string, request: EmployeeAiRequest) {
  return {
    async load(input: { authContext: AuthContext; businessObject: AuthorizedAiContext['source'] }): Promise<AuthorizedAiContext> {
      const context = await loadEmployeeContext(input.authContext, employeeId)
      const fields: Readonly<Record<string, AiJsonValue>> = {
        employeeName: context.employeeName,
        employmentStatus: context.employmentStatus,
        role: context.role,
        department: context.department,
        manager: context.manager,
        hoursPerWeek: context.hoursPerWeek,
        goals: context.goals,
        openActions: context.openActions,
        recentActions: context.recentActions,
      }
      return { source: input.businessObject, fields, prompt: { instructions: promptFor(feature, request.locale) } }
    },
  }
}

export function createEmployeeAiInvocationInput(feature: EmployeeAiFeature, employeeId: string, request: EmployeeAiRequest, idempotencyKey: string): Omit<AiInvocationInput, 'authContext'> {
  return {
    featureCode: feature,
    businessObject: { type: feature === EMPLOYEE_SUMMARY_FEATURE ? 'employee-summary' : 'employee-conversation-preparation', id: businessObjectId(feature, employeeId, request) },
    idempotencyKey,
    businessPermissionCode: 'employee:read',
    businessPermissionTargetId: employeeId,
    qualityProfile: 'EFFICIENT',
    writingStyle: null,
  }
}

const conversationValidator = createSafeTextProposalValidator({ forbidden: /\b(score|rating|ranking|high[- ]risk|low[- ]performer|good performer|bad performer|disciplin|prestatiescore|prestatiebeoordeling|disciplinaire)\b/i })

export async function runEmployeeAi(input: { employeeId: string; feature: EmployeeAiFeature; request: EmployeeAiRequest; idempotencyKey: string }): Promise<AiTextProposal> {
  const dependencies: AiRuntimeDependencies<AiTextProposal> = createServerAiRuntimeDependencies({
    contextLoader: createEmployeeAiContextLoader(input.feature, input.employeeId, input.request),
    validator: input.feature === CONVERSATION_PREPARATION_FEATURE ? conversationValidator : createAiTextProposalValidator(),
  })
  const result: AiExecutionResult<AiTextProposal> = await runAuthorizedAiInvocation(
    createEmployeeAiInvocationInput(input.feature, input.employeeId, input.request, input.idempotencyKey),
    dependencies,
  )
  if (result.kind === 'DUPLICATE') throw new AiExecutionError('DUPLICATE_COMPLETED')
  return result.output
}
