import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listTalentGoals: vi.fn(),
  createTalentGoal: vi.fn(),
}))

vi.mock('@/lib/talent/goal-service', () => ({
  listTalentGoals: mocks.listTalentGoals,
  createTalentGoal: mocks.createTalentGoal,
}))

import { GET } from './route'

describe('talent goals list route', () => {
  beforeEach(() => vi.clearAllMocks())

  it('forwards exact plan deep-link and status filters to the scoped service', async () => {
    mocks.listTalentGoals.mockResolvedValue({ goals: [], employees: [], capabilities: [] })
    const response = await GET(new Request('https://example.test/api/talent/goals?mode=manager&goalId=00000000-0000-0000-0000-000000000001&employeeId=00000000-0000-0000-0000-000000000002&status=ACTIVE'))

    expect(response.status).toBe(200)
    expect(mocks.listTalentGoals).toHaveBeenCalledWith('manager', {
      goalId: '00000000-0000-0000-0000-000000000001',
      employeeId: '00000000-0000-0000-0000-000000000002',
      status: 'ACTIVE',
    }, {
      includeOptions: false,
      includeEmployeeOptions: true,
      includeCapabilityOptions: false,
    })
  })
})
