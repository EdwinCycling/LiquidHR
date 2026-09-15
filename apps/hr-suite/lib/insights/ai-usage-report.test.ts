vi.mock('server-only', () => ({}))

import { describe, expect, it, vi } from 'vitest'
import { AuthorizationError, type AuthContext } from '@/lib/auth/permissions'
import { resolveAiUsagePeriod } from './ai-usage-query'
import { buildAiUsageReport, getAiUsageReport } from './ai-usage-report'
import type { AiUsageInvocationSourceRow, AiUsageVoiceSourceRow } from './ai-usage-types'

const scope = { tenantId: 'tenant-1', hrGroupId: 'group-1' }
const period = resolveAiUsagePeriod('last-30-days', new Date('2026-08-30T12:00:00.000Z'), 'Europe/Amsterdam')

function row(id: string, overrides: Partial<AiUsageInvocationSourceRow> = {}): AiUsageInvocationSourceRow {
  return {
    tenantId: scope.tenantId,
    hrGroupId: scope.hrGroupId,
    id,
    featureCode: 'improve_text',
    qualityProfile: 'BALANCED',
    executionStatus: 'SUCCEEDED',
    chargedCredits: 1,
    createdAt: '2026-08-10T10:00:00.000Z',
    finishedAt: '2026-08-10T10:01:00.000Z',
    ...overrides,
  }
}

function voiceRow(id: string, overrides: Partial<AiUsageVoiceSourceRow> = {}): AiUsageVoiceSourceRow {
  return {
    tenantId: scope.tenantId,
    hrGroupId: scope.hrGroupId,
    id,
    contextType: 'TEAM',
    sessionStatus: 'ENDED',
    terminationReason: 'NORMAL',
    durationSeconds: 60,
    billableVoiceUnits: 1,
    voiceCredits: 1,
    startedAt: '2026-08-10T10:00:00.000Z',
    endedAt: '2026-08-10T10:01:00.000Z',
    ...overrides,
  }
}

describe('AI usage report', () => {
  it('aggregates canonical accounting and exposes only safe categories', () => {
    const report = buildAiUsageReport(period, [
      row('success-1', { qualityProfile: 'EFFICIENT' }),
      row('success-2', { featureCode: 'improve-existing-hr-text', chargedCredits: 2 }),
      row('failed-1', { featureCode: 'future-feature', qualityProfile: 'IN_DEPTH', executionStatus: 'FAILED', chargedCredits: 0 }),
      row('failed-released', { executionStatus: 'FAILED', chargedCredits: 0 }),
      row('rejected-1', { executionStatus: 'REJECTED', qualityProfile: null, chargedCredits: 0 }),
      row('other-1', { executionStatus: 'VALIDATING', featureCode: 'future-feature', chargedCredits: 0 }),
      row('pending-1', { executionStatus: 'EXECUTING', finishedAt: null, chargedCredits: 0 }),
    ], 17, scope)

    expect(report).toMatchObject({ requests: 7, creditsRemaining: 17, creditsUsed: 3, successRate: 50 })
    expect(report.byFeature).toEqual([
      { key: 'IMPROVE_TEXT', requests: 4, creditsUsed: 3 },
      { key: 'OTHER', requests: 2, creditsUsed: 0 },
    ])
    expect(report.byStatus).toEqual([
      { key: 'SUCCEEDED', requests: 2, creditsUsed: 3 },
      { key: 'FAILED', requests: 2, creditsUsed: 0 },
      { key: 'REJECTED', requests: 1, creditsUsed: 0 },
      { key: 'IN_PROGRESS', requests: 1, creditsUsed: 0 },
      { key: 'OTHER', requests: 1, creditsUsed: 0 },
    ])
    expect(JSON.stringify(report)).not.toMatch(/prompt|input|output|provider|model|requestId|employeeId|business/i)
  })

  it('uses received time for requests and settled finish time for credits', () => {
    const report = buildAiUsageReport(period, [
      row('finished-in-period-created-before', { createdAt: '2026-07-31T10:00:00.000Z', chargedCredits: 4 }),
      row('created-in-period-finished-after', { createdAt: '2026-08-10T10:00:00.000Z', finishedAt: '2026-08-31T10:00:00.000Z', chargedCredits: 5 }),
    ], 0, scope)

    expect(report.requests).toBe(1)
    expect(report.creditsUsed).toBe(4)
  })

  it('rejects source rows outside the authorized tenant and HR group', () => {
    expect(() => buildAiUsageReport(period, [row('foreign', { tenantId: 'tenant-2' })], 0, scope)).toThrowError('INSIGHTS_AI_USAGE_SCOPE_VIOLATION')
    expect(() => buildAiUsageReport(period, [], 0, scope, [voiceRow('foreign-voice', { hrGroupId: 'group-2' })])).toThrowError('INSIGHTS_AI_USAGE_SCOPE_VIOLATION')
  })

  it('reports voice sessions and combines settled capability and voice credits without content metadata', () => {
    const report = buildAiUsageReport(period, [row('capability', { chargedCredits: 3 })], 17, scope, [
      voiceRow('team-success', { durationSeconds: 61, voiceCredits: 2 }),
      voiceRow('employee-failed', { contextType: 'EMPLOYEE', sessionStatus: 'FAILED', terminationReason: 'FAILURE', durationSeconds: 12, voiceCredits: 0 }),
      voiceRow('team-cancelled', { terminationReason: 'DISCONNECT', durationSeconds: 20, voiceCredits: 1 }),
    ])

    expect(report).toMatchObject({ capabilityCredits: 3, voiceCredits: 3, combinedCredits: 6, creditsUsed: 6 })
    expect(report.voice).toEqual({ sessions: 3, totalDurationSeconds: 93, averageDurationSeconds: 31, voiceCredits: 3, successful: 1, failed: 1, cancelled: 1, byContext: { employee: 1, team: 2, other: 0 } })
    expect(report.trend.find((point) => point.date === '2026-08-10')).toMatchObject({ capabilityCredits: 3, voiceCredits: 3, creditsUsed: 6 })
    expect(JSON.stringify(report)).not.toMatch(/prompt|input|output|provider|model|requestId|employeeId|business/i)
  })

  it('authorizes before reading canonical sources and derives scope from context', async () => {
    const context: AuthContext = {
      tenantId: scope.tenantId,
      hrGroupId: scope.hrGroupId,
      administrationId: 'administration-1',
      userId: 'user-1',
      employeeId: null,
      activeRoles: ['HR_ADMIN'],
      permissions: ['ai:usage-read'],
    }
    const readInvocations = vi.fn(async () => [row('scoped')])
    const readVoiceCharges = vi.fn(async () => [voiceRow('scoped-voice')])
    const readBalance = vi.fn(async () => 9)
    const report = await getAiUsageReport({ report: 'ai-usage', period: 'last-30-days' }, {
      authorize: async () => context,
      clock: { now: () => new Date('2026-08-30T12:00:00.000Z') },
      readInvocations,
      readVoiceCharges,
      readBalance,
    })

    expect(report.creditsRemaining).toBe(9)
    expect(readInvocations).toHaveBeenCalledWith(expect.objectContaining(scope), expect.objectContaining({ period: 'last-30-days' }))
    expect(readVoiceCharges).toHaveBeenCalledWith(expect.objectContaining(scope), expect.objectContaining({ period: 'last-30-days' }))
    expect(readBalance).toHaveBeenCalledWith(expect.objectContaining(scope))

    const deniedRead = vi.fn(async () => [row('must-not-read')])
    await expect(getAiUsageReport({ report: 'ai-usage', period: 'this-month' }, {
      authorize: async () => { throw new AuthorizationError('Denied') },
      readInvocations: deniedRead,
      readBalance,
    })).rejects.toBeInstanceOf(AuthorizationError)
    expect(deniedRead).not.toHaveBeenCalled()
  })
})
