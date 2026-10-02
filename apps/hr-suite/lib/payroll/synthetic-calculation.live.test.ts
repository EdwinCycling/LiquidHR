import { loadEnvConfig } from '@next/env'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getLatestSyntheticPayroll, runSyntheticPayroll } from './synthetic-calculation-service'

const runLiveLabChecks = process.env.PAYLAB_LIVE_TEST === '1'
if (runLiveLabChecks) {
  vi.stubEnv('NODE_ENV', 'development')
  loadEnvConfig(fileURLToPath(new URL('../..', import.meta.url)))
}
const scope = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  hrGroupId: '10000000-0000-4000-8000-000000000002',
  administrationId: '10000000-0000-4000-8000-000000000003',
}
const payrollAdministrationId = '10000000-0000-4000-8000-000000000004'
const actorUserId = '10000000-0000-4000-8000-000000000005'
const expectedKeys = [
  'gross_salary',
  'employee_pension',
  'wage_tax',
  'net_salary',
  'employer_pension',
  'employer_insurance',
  'employer_zvw',
  'holiday_allowance_accrual',
  'total_employer_cost',
]

describe.skipIf(!runLiveLabChecks)('Payroll Lab GC-NL-001 live persistence', () => {
  beforeAll(() => {
    if (process.env.VERCEL || process.env.VERCEL_ENV) {
      throw new Error('PAYLAB_LIVE_TEST is available only in the local development runtime.')
    }
    if (process.env.PAYROLL_LAB_ENABLED !== 'true') {
      throw new Error('PAYLAB_LIVE_TEST requires PAYROLL_LAB_ENABLED=true.')
    }
  })

  afterAll(() => {
    if (runLiveLabChecks) vi.unstubAllEnvs()
  })

  it('persists two deterministic runs with the exact GC-NL-001 outputs', async () => {
    const first = await runSyntheticPayroll(scope, payrollAdministrationId, actorUserId)
    const second = await runSyntheticPayroll(scope, payrollAdministrationId, actorUserId)
    const latest = await getLatestSyntheticPayroll(scope, payrollAdministrationId)

    expect(first.status).toBe('SUCCEEDED')
    expect(second.status).toBe('SUCCEEDED')
    expect(first.runId).not.toBe(second.runId)
    expect(second.runId).toBe(latest?.runId)
    expect(first.payrollPeriod).toEqual({ year: 2026, month: 9 })
    expect(second.payrollPeriod).toEqual(first.payrollPeriod)
    expect(second.sourceHash).toBe(first.sourceHash)
    expect(second.inputHash).toBe(first.inputHash)
    expect(second.resultHash).toBe(first.resultHash)
    expect(second.components.map((component) => component.key).sort()).toEqual([...expectedKeys].sort())
    expect(second.components.every((component) => typeof component.amount === 'string')).toBe(true)
    expect(second.components.find((component) => component.key === 'net_salary')?.amount).toBe('3175.00')
    expect(second.components.find((component) => component.key === 'holiday_allowance_accrual')?.amount).toBe('320.00')
    expect(second.components.find((component) => component.key === 'total_employer_cost')?.amount).toBe('4910.00')
    expect(second.trace).not.toBeNull()
    expect(second.controls.length).toBeGreaterThan(0)
    expect(latest?.sourceHash).toBe(first.sourceHash)
    expect(latest?.inputHash).toBe(first.inputHash)
  }, 60_000)
})
