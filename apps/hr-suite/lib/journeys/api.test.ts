import { describe, expect, it } from 'vitest'
import { journeyPreviewSchema } from './api'

describe('Journey runtime API-schema', () => {
  it('accepteert PostgreSQL-UUIDs uit bestaande development/test data', () => {
    expect(journeyPreviewSchema.safeParse({
      templateVersionId: 'b4b241c2-6955-46f9-9ca0-c2c370533ade',
      targetEmployeeId: 'fd3f6020-a7df-af87-7d4d-d611c6b906a3',
      employmentId: null,
      anchorDate: '2026-08-12',
      manualParticipants: {},
    }).success).toBe(true)
  })
})
