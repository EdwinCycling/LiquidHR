import { describe, expect, it, vi } from 'vitest'
import { createJourneyParticipantService, findJourneyParticipantAssignment, listJourneyParticipantAssignments, type JourneyParticipantAssignment } from './participant-service'
import type { JourneyProjection } from './projection-domain'

const activeAssignment: JourneyParticipantAssignment = {
  id: '11111111-1111-4111-8111-111111111111',
  roleKey: 'buddy',
  roleName: { nl: 'Buddy', en: 'Buddy' },
  employeeId: '22222222-2222-4222-8222-222222222222',
  employeeName: 'Ada Lovelace',
  source: 'MANUAL',
  status: 'ACTIVE',
  resolutionNote: null,
}

const assignedAssignment: JourneyParticipantAssignment = {
  ...activeAssignment,
  id: '33333333-3333-4333-8333-333333333333',
  employeeId: '44444444-4444-4444-8444-444444444444',
  employeeName: 'Grace Hopper',
  status: 'ASSIGNED',
}

describe('Journey participant service', () => {
  const projection = { id: '66666666-6666-4666-8666-666666666666' } as JourneyProjection

  it('leest detail via de actor-veilige projection seam', async () => {
    const readProjection = vi.fn().mockResolvedValue(projection)
    const service = createJourneyParticipantService({ readProjection, recordProgress: vi.fn() })

    await expect(service.getDetail(projection.id)).resolves.toBe(projection)
    expect(readProjection).toHaveBeenCalledWith(projection.id)
  })

  it('geeft progress-mutations door aan de bestaande outcome seam', async () => {
    const result = { topicId: activeAssignment.id, status: 'COMPLETED', outcomeId: activeAssignment.id, idempotentReplay: false } as const
    const recordProgress = vi.fn().mockResolvedValue(result)
    const service = createJourneyParticipantService({ readProjection: vi.fn(), recordProgress })
    const input = { journeyId: projection.id, topicId: activeAssignment.id, outcomeType: 'COMPLETE' as const }

    await expect(service.recordProgress(input)).resolves.toEqual(result)
    expect(recordProgress).toHaveBeenCalledWith(input)
  })

  it('toont alleen live assignments en bewaart de runtime-volgorde', () => {
    const assignments = listJourneyParticipantAssignments([
      activeAssignment,
      { ...assignedAssignment, status: 'REPLACED' },
      assignedAssignment,
      { ...activeAssignment, id: '55555555-5555-4555-8555-555555555555', status: 'REMOVED' },
    ])

    expect(assignments.map((assignment) => assignment.id)).toEqual([activeAssignment.id, assignedAssignment.id])
  })

  it('vindt een assignment op id en geeft onbekende ids veilig niet terug', () => {
    expect(findJourneyParticipantAssignment([activeAssignment], activeAssignment.id)).toEqual(activeAssignment)
    expect(findJourneyParticipantAssignment([activeAssignment], assignedAssignment.id)).toBeNull()
  })
})
