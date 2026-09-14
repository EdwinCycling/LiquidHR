import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { AiExecutionError, type AiExecutionResult, type AiInvocationInput, type AiJsonValue, type AiRuntimeDependencies, type AuthorizedAiContext } from './contracts'
import { createSafeTextProposalValidator, type AiTextProposal } from './everywhere/proposal'
import { TEAM_SUMMARY_FEATURE } from './feature-registry'
import { createServerAiRuntimeDependencies, runAuthorizedAiInvocation } from './runtime'
import { getAuthorizedTeamAiSession, type AuthorizedTeamAiSession, type TeamAiMember } from './team-scope'
import { parseTeamRealtimeVoiceToolArguments, type TeamRealtimeVoiceLocale, type TeamRealtimeVoiceToolName } from './realtime-voice'
import { executePersonalReminderTool, type PersonalReminderToolResult } from './personal-reminders'
import type { AuthContext } from '@/lib/auth/permissions'
import { runEmployeeAi } from '@/lib/employees/employee-ai'

export class TeamAiToolError extends Error {
  constructor(readonly code: 'TEAM_TOOL_INPUT_INVALID' | 'TEAM_EMPLOYEE_NOT_FOUND' | 'TEAM_EMPLOYEE_AMBIGUOUS' | 'TEAM_TOOL_FAILED', readonly status: 400 | 404 | 409 | 500) {
    super(code)
  }
}

export interface TeamAiToolResult {
  resultText: string
  proposedText?: string
  reminderId?: PersonalReminderToolResult['reminderId']
  title?: PersonalReminderToolResult['title']
  remindAt?: PersonalReminderToolResult['remindAt']
  created?: true
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('nl-NL')
}

function findMember(members: TeamAiMember[], requestedName: string): TeamAiMember {
  const wanted = normalizeName(requestedName)
  const matches = members.filter((member) => normalizeName(member.employeeName) === wanted)
  if (matches.length === 0) throw new TeamAiToolError('TEAM_EMPLOYEE_NOT_FOUND', 404)
  if (matches.length > 1) throw new TeamAiToolError('TEAM_EMPLOYEE_AMBIGUOUS', 409)
  return matches[0]
}

function overviewText(session: AuthorizedTeamAiSession, locale: TeamRealtimeVoiceLocale): string {
  const visibleMembers = session.members.slice(0, 12)
  const names = visibleMembers.map((member) => member.employeeName).join(', ')
  const suffix = session.members.length > visibleMembers.length
    ? locale === 'nl' ? ` en nog ${session.members.length - visibleMembers.length} anderen` : ` and ${session.members.length - visibleMembers.length} others`
    : ''
  return locale === 'nl'
    ? `${session.contextName} bevat ${session.members.length} medewerkers. Beschikbare namen: ${names || 'geen leden'}${suffix}. Ik toon geen rangorde of gevoelige inferenties.`
    : `${session.contextName} contains ${session.members.length} employees. Available names: ${names || 'no members'}${suffix}. I do not provide rankings or sensitive inferences.`
}

function teamSummaryPrompt(locale: TeamRealtimeVoiceLocale): string {
  return locale === 'nl'
    ? 'Maak een beknopt, feitelijk voorstel voor een persoonlijke logboeknotitie op basis van uitsluitend de aangeleverde teamcontext en de door de gebruiker beoordeelde samenvatting. Gebruik de koppen Context, Besproken punten en Vervolgacties. Voeg geen feiten, rangorde, prestatieoordeel, risico-inschatting, medische informatie of disciplinaire aanbeveling toe. Dit is een voorstel en wordt niet automatisch opgeslagen.'
    : 'Create a concise factual proposal for a personal logbook entry using only the supplied team context and the user-reviewed summary. Use the headings Context, Discussed points, and Follow-up actions. Do not add facts, rankings, performance judgements, risk assessments, medical information, or disciplinary recommendations. This is a proposal and is never saved automatically.'
}

function createTeamSummaryContextLoader(session: AuthorizedTeamAiSession, summaryText: string, locale: TeamRealtimeVoiceLocale) {
  return {
    async load(input: { authContext: AuthContext; businessObject: AuthorizedAiContext['source'] }): Promise<AuthorizedAiContext> {
      const members: AiJsonValue[] = session.members.map((member) => ({
        employeeName: member.employeeName,
        jobTitle: member.jobTitle,
        departmentName: member.departmentName,
      }))
      return {
        source: input.businessObject,
        fields: {
          scopeName: session.contextName,
          memberCount: session.members.length,
          members,
          reviewedSummaryText: summaryText,
          locale,
        },
        prompt: { instructions: teamSummaryPrompt(locale) },
      }
    },
  }
}

function createTeamSummaryInvocationInput(sessionId: string, summaryText: string, locale: TeamRealtimeVoiceLocale, idempotencyKey: string): Omit<AiInvocationInput, 'authContext'> {
  const businessObjectId = createHash('sha256').update(JSON.stringify({ sessionId, summaryText, locale })).digest('hex')
  return {
    featureCode: TEAM_SUMMARY_FEATURE,
    businessObject: { type: 'team-summary', id: businessObjectId },
    idempotencyKey,
    businessPermissionCode: 'ai:use',
    qualityProfile: 'EFFICIENT',
    writingStyle: null,
  }
}

const teamSummaryValidator = createSafeTextProposalValidator({ maxCharacters: 8_000, forbidden: /\b(ranking|rank|high[- ]risk|low[- ]performer|score|rating|prestatiescore|ranglijst|discrimin|disciplin|medisch|medical|diagnos)/i })

async function runTeamSummaryProposal(session: AuthorizedTeamAiSession, summaryText: string, locale: TeamRealtimeVoiceLocale): Promise<AiTextProposal> {
  const dependencies: AiRuntimeDependencies<AiTextProposal> = createServerAiRuntimeDependencies({
    contextLoader: createTeamSummaryContextLoader(session, summaryText, locale),
    validator: teamSummaryValidator,
  })
  const result: AiExecutionResult<AiTextProposal> = await runAuthorizedAiInvocation(
    createTeamSummaryInvocationInput(session.id, summaryText, locale, randomUUID()),
    dependencies,
  )
  if (result.kind === 'DUPLICATE') throw new AiExecutionError('DUPLICATE_COMPLETED')
  return result.output
}

export async function executeTeamAiTool(input: { auth: AuthContext; sessionId: string; name: TeamRealtimeVoiceToolName; arguments: unknown; locale: TeamRealtimeVoiceLocale }): Promise<TeamAiToolResult> {
  let args: ReturnType<typeof parseTeamRealtimeVoiceToolArguments>
  try {
    args = parseTeamRealtimeVoiceToolArguments(input.name, input.arguments)
  } catch {
    throw new TeamAiToolError('TEAM_TOOL_INPUT_INVALID', 400)
  }
  const session = await getAuthorizedTeamAiSession(input.auth, input.sessionId, { activeOnly: true })
  if (input.name === 'team_overview') return { resultText: overviewText(session, input.locale) }

  if (input.name === 'create_personal_reminder') {
    return executePersonalReminderTool({
      auth: input.auth,
      source: 'TEAM_AI',
      locale: input.locale,
      arguments: args,
    })
  }

  if (input.name === 'team_employee_summary' || input.name === 'team_conversation_preparation') {
    if (!args.employeeName) throw new TeamAiToolError('TEAM_TOOL_INPUT_INVALID', 400)
    const member = findMember(session.members, args.employeeName)
    const proposal = await runEmployeeAi({
      employeeId: member.employeeId,
      feature: input.name === 'team_employee_summary' ? 'EMPLOYEE_SUMMARY' : 'CONVERSATION_PREPARATION',
      request: { locale: input.locale },
      idempotencyKey: randomUUID(),
    })
    return { resultText: proposal.proposedText, proposedText: proposal.proposedText }
  }

  if (!args.summaryText) throw new TeamAiToolError('TEAM_TOOL_INPUT_INVALID', 400)
  const proposal = await runTeamSummaryProposal(session, args.summaryText, input.locale)
  return { resultText: proposal.proposedText, proposedText: proposal.proposedText }
}
