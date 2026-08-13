import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { applicationStateSchema, type ApplicationProjection, type RecruitmentActorContext, type TerminalTransitionInput } from './domain'
import { recruitmentDatabaseError } from './errors'

export interface RecruitmentRepository {
  getApplication(actor: RecruitmentActorContext, applicationId: string): Promise<ApplicationProjection | null>
  transitionStage(input: { readonly applicationId: string; readonly stageId: string; readonly expectedVersion: number; readonly idempotencyKey: string }): Promise<{ readonly id: string; readonly version: number; readonly idempotentReplay: boolean }>
  transitionTerminal(input: TerminalTransitionInput): Promise<{ readonly id: string; readonly version: number; readonly outcome: string; readonly idempotentReplay: boolean }>
  reopen(input: { readonly applicationId: string; readonly stageId: string; readonly expectedVersion: number; readonly idempotencyKey: string }): Promise<{ readonly id: string; readonly version: number; readonly idempotentReplay: boolean; readonly participantsRestored: false }>
}

type ApplicationRow = {
  id: string
  tenant_id: string
  hr_group_id: string
  active_stage_id: string | null
  terminal_outcome: 'AFGEWEZEN' | 'AANGENOMEN' | null
  version: number
}

type ParticipationRow = {
  tenant_id: string
  hr_group_id: string
  application_id: string
  employee_id: string
  status: 'ASSIGNED' | 'ACTIVE' | 'REVOKED'
  capabilities: Array<'APPLICATION_READ' | 'DOCUMENT_READ' | 'INTERVIEW_READ' | 'ASSESSMENT_READ' | 'ASSESSMENT_WRITE'>
}

type RecruitmentDatabase = {
  public: {
    Tables: {
      recruitment_applications: { Row: ApplicationRow; Insert: never; Update: never; Relationships: [] }
      recruitment_participations: { Row: ParticipationRow; Insert: never; Update: never; Relationships: [] }
    }
    Views: Record<never, never>
    Functions: {
      transition_recruitment_application: { Args: { requested_application_id: string; requested_stage_id: string; expected_version: number; requested_idempotency_key: string }; Returns: unknown }
      terminal_transition_recruitment_application: { Args: { requested_application_id: string; requested_outcome: string; requested_reason: string; expected_version: number; requested_idempotency_key: string }; Returns: unknown }
      reopen_recruitment_application: { Args: { requested_application_id: string; requested_stage_id: string; expected_version: number; requested_idempotency_key: string }; Returns: unknown }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

const mutationResultSchema = z.object({ id: z.guid(), version: z.number().int().positive(), idempotentReplay: z.boolean() }).passthrough()
const terminalResultSchema = mutationResultSchema.extend({ outcome: z.enum(['AFGEWEZEN', 'AANGENOMEN']) })
const reopenResultSchema = mutationResultSchema.extend({ participantsRestored: z.literal(false) })

async function recruitmentClient(): Promise<SupabaseClient<RecruitmentDatabase>> {
  return await createClient() as unknown as SupabaseClient<RecruitmentDatabase>
}

export const supabaseRecruitmentRepository: RecruitmentRepository = {
  async getApplication(actor, applicationId) {
    const supabase = await recruitmentClient()
    const application = await supabase.from('recruitment_applications')
      .select('id,tenant_id,hr_group_id,active_stage_id,terminal_outcome,version')
      .eq('tenant_id', actor.tenantId).eq('hr_group_id', actor.hrGroupId).eq('id', applicationId).maybeSingle()
    if (application.error) throw recruitmentDatabaseError(application.error)
    if (!application.data) return null
    const participations = await supabase.from('recruitment_participations')
      .select('employee_id,status,capabilities')
      .eq('tenant_id', actor.tenantId).eq('hr_group_id', actor.hrGroupId).eq('application_id', applicationId).limit(100)
    if (participations.error) throw recruitmentDatabaseError(participations.error)
    const state = application.data.terminal_outcome
      ? applicationStateSchema.parse({ kind: 'TERMINAL', outcome: application.data.terminal_outcome, version: application.data.version })
      : applicationStateSchema.parse({ kind: 'ACTIVE', stageId: application.data.active_stage_id, version: application.data.version })
    return {
      id: application.data.id,
      tenantId: application.data.tenant_id,
      hrGroupId: application.data.hr_group_id,
      state,
      participations: participations.data.map((participation) => ({ employeeId: participation.employee_id, status: participation.status, capabilities: participation.capabilities })),
    }
  },
  async transitionStage(input) {
    const supabase = await recruitmentClient()
    const result = await supabase.rpc('transition_recruitment_application', {
      requested_application_id: input.applicationId,
      requested_stage_id: input.stageId,
      expected_version: input.expectedVersion,
      requested_idempotency_key: input.idempotencyKey,
    })
    if (result.error) throw recruitmentDatabaseError(result.error)
    return mutationResultSchema.parse(result.data)
  },
  async transitionTerminal(input) {
    const supabase = await recruitmentClient()
    const result = await supabase.rpc('terminal_transition_recruitment_application', {
      requested_application_id: input.applicationId,
      requested_outcome: input.outcome,
      requested_reason: input.reason,
      expected_version: input.expectedVersion,
      requested_idempotency_key: input.idempotencyKey,
    })
    if (result.error) throw recruitmentDatabaseError(result.error)
    return terminalResultSchema.parse(result.data)
  },
  async reopen(input) {
    const supabase = await recruitmentClient()
    const result = await supabase.rpc('reopen_recruitment_application', {
      requested_application_id: input.applicationId,
      requested_stage_id: input.stageId,
      expected_version: input.expectedVersion,
      requested_idempotency_key: input.idempotencyKey,
    })
    if (result.error) throw recruitmentDatabaseError(result.error)
    return reopenResultSchema.parse(result.data)
  },
}
