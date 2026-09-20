import { describe, expect, it } from 'vitest'

import { normalizeLeaveWorkflowActionResult } from './workflow-service'

describe('Leave workflow action result', () => {
  it('normalizes the approval adapter result when booking omits leaveRequestId and businessStatus', () => {
    const result = normalizeLeaveWorkflowActionResult({
      processInstanceId: '370febd9-c63d-47a3-b7fc-cba7f19970a9',
      status: 'APPROVED',
      currentStepKey: 'completed',
      instanceVersion: 7,
      correlationId: 'ac6bafb8-1e78-45bc-acfc-d43380d525b3',
      eventId: 'a3f4ead2-c402-41da-b9f9-d1279822d9bc',
      requestId: '9df4d793-3296-4324-855f-8ef458438096',
      allocationCount: 1,
      alreadyBooked: false,
    })

    expect(result.leaveRequestId).toBe(result.requestId)
    expect(result.businessStatus).toBe('COMPLETED')
  })
})
