import { getRequestAuthorizationContext, requireHrGroupId, type AuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import {
  journeyProjectionListSchema,
  journeyProjectionSchema,
  journeyTopicOutcomeResultSchema,
  type JourneyProjection,
  type JourneyProjectionList,
  type JourneyTopicOutcomeResult,
  type JourneyTopicOutcome,
} from './projection-domain'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

interface ProjectionRpcError {
  message: string
}

interface ProjectionRpcClient {
  rpc(functionName: string, args: Record<string, unknown>): Promise<{ data: unknown; error: ProjectionRpcError | null }>
}

const PROJECTION_ERROR_STATUS: Readonly<Record<string, number>> = {
  JOURNEY_AUTHENTICATION_REQUIRED: 401,
  JOURNEY_FORBIDDEN: 403,
  JOURNEY_NOT_FOUND: 404,
  JOURNEY_TOPIC_NOT_FOUND: 404,
  JOURNEY_TOPIC_ACTION_UNAVAILABLE: 409,
  JOURNEY_TOPIC_OUTCOME_INVALID: 400,
  JOURNEY_TOPIC_OUTCOME_NOTE_INVALID: 400,
  JOURNEY_TOPIC_CHECK_IN_NOTE_REQUIRED: 400,
}

export class JourneyProjectionServiceError extends Error {
  constructor(readonly code: string, readonly status: number, message = code) {
    super(message)
    this.name = 'JourneyProjectionServiceError'
  }
}

function rpcClient(supabase: SupabaseServerClient): ProjectionRpcClient {
  return supabase as unknown as ProjectionRpcClient
}

function databaseError(error: ProjectionRpcError): JourneyProjectionServiceError {
  const code = Object.keys(PROJECTION_ERROR_STATUS).find((candidate) => error.message.includes(candidate))
  return new JourneyProjectionServiceError(code ?? 'JOURNEY_PROJECTION_OPERATION_FAILED', code ? PROJECTION_ERROR_STATUS[code] ?? 500 : 500)
}

function parseProjection(data: unknown): JourneyProjection {
  const result = journeyProjectionSchema.safeParse(data)
  if (!result.success) throw new JourneyProjectionServiceError('JOURNEY_PROJECTION_INVALID', 500)
  return result.data
}

function parseProjectionList(data: unknown): JourneyProjectionList {
  const result = journeyProjectionListSchema.safeParse(data)
  if (!result.success) throw new JourneyProjectionServiceError('JOURNEY_PROJECTION_INVALID', 500)
  return result.data
}

async function authorizedClient(): Promise<{ supabase: SupabaseServerClient; tenantId: string; hrGroupId: string }> {
  const { supabase, context } = await getRequestAuthorizationContext()
  return { supabase, tenantId: context.tenantId, hrGroupId: requireHrGroupId(context) }
}

export async function listJourneyProjectionsForContext(
  supabase: SupabaseServerClient,
  context: Pick<AuthContext, 'tenantId' | 'hrGroupId'>,
): Promise<JourneyProjectionList> {
  const hrGroupId = requireHrGroupId(context)
  const { data, error } = await rpcClient(supabase).rpc('list_journey_projections', {
    requested_tenant_id: context.tenantId,
    requested_hr_group_id: hrGroupId,
  })
  if (error) throw databaseError(error)
  return parseProjectionList(data)
}

export async function getJourneyProjection(journeyId: string): Promise<JourneyProjection> {
  const { supabase } = await getRequestAuthorizationContext()
  const { data, error } = await rpcClient(supabase).rpc('get_journey_projection', { requested_journey_id: journeyId })
  if (error) throw databaseError(error)
  if (data === null) throw new JourneyProjectionServiceError('JOURNEY_NOT_FOUND', 404)
  return parseProjection(data)
}

export async function listJourneyProjections(): Promise<JourneyProjectionList> {
  const { supabase, tenantId, hrGroupId } = await authorizedClient()
  return listJourneyProjectionsForContext(supabase, { tenantId, hrGroupId })
}

export async function getEmployeeJourneyProjections(employeeId: string): Promise<JourneyProjectionList> {
  const { supabase, tenantId, hrGroupId } = await authorizedClient()
  const { data, error } = await rpcClient(supabase).rpc('get_employee_journey_projection', {
    requested_tenant_id: tenantId,
    requested_hr_group_id: hrGroupId,
    requested_employee_id: employeeId,
  })
  if (error) throw databaseError(error)
  return parseProjectionList(data)
}

export async function recordJourneyTopicOutcome(input: {
  journeyId: string
  topicId: string
  outcomeType: JourneyTopicOutcome
  note?: string
}): Promise<JourneyTopicOutcomeResult> {
  const { supabase } = await getRequestAuthorizationContext()
  const { data, error } = await rpcClient(supabase).rpc('record_journey_topic_outcome', {
    requested_journey_id: input.journeyId,
    requested_topic_id: input.topicId,
    requested_outcome_type: input.outcomeType,
    requested_note: input.note ?? null,
  })
  if (error) throw databaseError(error)
  const result = journeyTopicOutcomeResultSchema.safeParse(data)
  if (!result.success) throw new JourneyProjectionServiceError('JOURNEY_PROJECTION_INVALID', 500)
  return result.data
}
