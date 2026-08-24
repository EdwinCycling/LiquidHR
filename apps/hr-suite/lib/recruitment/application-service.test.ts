import type { Database } from '@scope/db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { RecruitmentError } from './errors'
import { buildRecruitmentPipelineStages, createManualRecruitmentApplication, manualApplicationInputSchema, normalizeCandidateSignal, transitionRecruitmentApplication } from './application-service'

describe('application service contract', () => {
  it('houdt candidate-identiteit minimaal en application-specifiek', () => {
    const parsed = manualApplicationInputSchema.parse({
      vacancyId: '11111111-1111-4111-8111-111111111111',
      firstName: 'Lisa',
      lastName: 'Jansen',
      privateEmail: ' Lisa@example.com ',
      phone: null,
      motivation: 'TEST-RECRUITMENT-motivatie',
      source: 'MANUAL',
    })
    expect(parsed.privateEmail).toBe('Lisa@example.com')
    expect(normalizeCandidateSignal(parsed)).toEqual({ normalizedEmail: 'lisa@example.com', requiresHumanDecision: true })
  })

  it('maakt geen automatische merge van hetzelfde e-mailadres', () => {
    expect(normalizeCandidateSignal({ privateEmail: null })).toEqual({ normalizedEmail: null, requiresHumanDecision: true })
  })

  it('houdt fases zonder sollicitaties zichtbaar en telt alleen actieve sollicitaties per fase', () => {
    const stages = buildRecruitmentPipelineStages([
      { id: '11111111-1111-4111-8111-111111111111', name: 'Sollicitatie', sortOrder: 0, isActive: true },
      { id: '22222222-2222-4222-8222-222222222222', name: 'Screening', sortOrder: 1, isActive: true },
    ], [
      { stageId: '11111111-1111-4111-8111-111111111111' },
      { stageId: null },
    ])

    expect(stages.map((stage) => ({ name: stage.name, applicationCount: stage.applicationCount }))).toEqual([
      { name: 'Sollicitatie', applicationCount: 1 },
      { name: 'Screening', applicationCount: 0 },
    ])
  })

  it('maakt een manual application via de bestaande directe application-RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: '33333333-3333-4333-8333-333333333333', candidateId: '44444444-4444-4444-8444-444444444444', possibleDuplicate: false, version: 1 }, error: null })
    const client = { rpc } as unknown as SupabaseClient<Database>

    await expect(createManualRecruitmentApplication({ tenantId: '55555555-5555-4555-8555-555555555555', hrGroupId: '66666666-6666-4666-8666-666666666666' }, {
      vacancyId: '11111111-1111-4111-8111-111111111111', firstName: 'R4', lastName: 'Applicant', privateEmail: 'r4-rec-pipe-test@example.invalid', phone: null, motivation: 'R4-REC-PIPE manual application', source: 'MANUAL',
    }, client)).resolves.toEqual({ id: '33333333-3333-4333-8333-333333333333', candidateId: '44444444-4444-4444-8444-444444444444', possibleDuplicate: false, version: 1 })
    expect(rpc).toHaveBeenCalledWith('create_recruitment_application', {
      requested_vacancy_id: '11111111-1111-4111-8111-111111111111', requested_first_name: 'R4', requested_last_name: 'Applicant', requested_private_email: 'r4-rec-pipe-test@example.invalid', requested_phone: null, requested_motivation: 'R4-REC-PIPE manual application', requested_source: 'MANUAL',
    })
  })

  it('stuurt optimistic concurrency en idempotency door naar de bestaande stage-RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: '33333333-3333-4333-8333-333333333333', version: 2, idempotentReplay: false }, error: null })
    const client = { rpc } as unknown as SupabaseClient<Database>

    await expect(transitionRecruitmentApplication('33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', 1, 'R4-REC-PIPE-stage-1', client)).resolves.toEqual({
      id: '33333333-3333-4333-8333-333333333333',
      version: 2,
      idempotentReplay: false,
    })
    expect(rpc).toHaveBeenCalledWith('transition_recruitment_application', {
      requested_application_id: '33333333-3333-4333-8333-333333333333',
      requested_stage_id: '22222222-2222-4222-8222-222222222222',
      expected_version: 1,
      requested_idempotency_key: 'R4-REC-PIPE-stage-1',
    })
  })

  it('behoudt de bestaande 422-semantiek voor een ongeldige faseovergang', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'RECRUITMENT_STAGE_INVALID' } }) } as unknown as SupabaseClient<Database>

    await expect(transitionRecruitmentApplication('33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', 1, 'R4-REC-PIPE-stage-invalid', client)).rejects.toMatchObject({
      code: 'RECRUITMENT_STAGE_INVALID',
      status: 422,
    } satisfies Partial<RecruitmentError>)
  })
})
