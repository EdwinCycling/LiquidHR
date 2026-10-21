import { describe, expect, it } from 'vitest'
import {
  buildCalculationInputs,
  calculatePayroll,
  sha256,
  stableSerialize,
  type PayrollSourceSnapshot,
} from '@liquid-hr/payroll-engine'
import { NL_2026_RULE_PACKAGE, NL_2026_RULE_REGISTRY } from '../package-definition'

function sourceSnapshot(): PayrollSourceSnapshot {
  const canonicalSource = {
    regularWage: {
      fiscalYear: '2026',
      table: 'WHITE',
      residence: 'NL',
      ageCategory: 'UNDER_AOW',
      herleiding: 'STD',
      timePeriod: 'WEEK_DAY_2_1',
      payrollTaxCredit: false,
      regularWage: true,
      fullPeriod: false,
      hasSpecialSituation: false,
      incomeRelationshipCount: '1',
      grossAmount: '1758.50',
    },
  }
  return {
    id: 'snapshot-nl-2026-broken-period',
    sourceTenantId: 'tenant-nl-2026-broken-period',
    sourceHrGroupId: 'group-nl-2026-broken-period',
    sourceAdministrationId: 'administration-nl-2026-broken-period',
    sourceEmployeeId: 'employee-nl-2026-broken-period',
    sourceEmploymentId: 'employment-nl-2026-broken-period',
    sourceIncomeRelationshipId: 'ikv-nl-2026-broken-period',
    periodReference: { year: 2026, month: 10 },
    canonicalSource,
    sourceVersionVector: { source: 'broken-period-v1' },
    sourceGaps: [],
    sourceHash: sha256(stableSerialize(canonicalSource)),
    createdAt: '2026-10-31T08:00:00.000Z',
  }
}

describe('NL 2026 composite week/day wage withholding', () => {
  it('aggregates two week-table and one day-table withholding amounts', () => {
    const snapshot = sourceSnapshot()
    const result = calculatePayroll(buildCalculationInputs(snapshot, NL_2026_RULE_PACKAGE, {
      scopeInstanceIds: { INCOME_RELATIONSHIP: snapshot.sourceIncomeRelationshipId! },
    }), NL_2026_RULE_REGISTRY)
    const values = Object.fromEntries(result.resultRows.map((row) => [row.key, row.value]))

    expect(result.status).toBe('CALCULATED')
    expect(values).toMatchObject({
      gross_salary: '1758.50',
      taxable_wage: '1758.50',
      wage_tax: '630.04',
      net_salary: '1128.46',
    })
    expect(result.controls.every((control) => control.status === 'PASS')).toBe(true)
    const registeredTrace = result.trace.flatMap((step) => step.registeredRuleTrace ?? [])
    expect(registeredTrace.find((trace) => trace.code === 'result.period-values.week')?.values).toMatchObject({
      tablePeriodWage: { valueType: 'MONEY', value: '798.58' },
      wageTax: { valueType: 'MONEY', value: '286.38' },
    })
    expect(registeredTrace.find((trace) => trace.code === 'result.period-values.day')?.values).toMatchObject({
      tablePeriodWage: { valueType: 'MONEY', value: '159.72' },
      wageTax: { valueType: 'MONEY', value: '57.28' },
    })
  })

  it('matches the official monthly-table cell for Emma without tax credit', () => {
    const snapshot = sourceSnapshot()
    const canonicalSource = structuredClone(snapshot.canonicalSource) as Record<string, unknown>
    const regularWage = canonicalSource.regularWage as Record<string, unknown>
    regularWage.timePeriod = 'MONTH'
    regularWage.fullPeriod = true
    regularWage.grossAmount = '2110.20'

    const monthlySnapshot = {
      ...snapshot,
      id: 'snapshot-nl-2026-full-month-part-time',
      canonicalSource: canonicalSource as typeof snapshot.canonicalSource,
    }
    const result = calculatePayroll(buildCalculationInputs(monthlySnapshot, NL_2026_RULE_PACKAGE, {
      scopeInstanceIds: { INCOME_RELATIONSHIP: monthlySnapshot.sourceIncomeRelationshipId! },
    }), NL_2026_RULE_REGISTRY)
    const values = Object.fromEntries(result.resultRows.map((row) => [row.key, row.value]))

    expect(result.status).toBe('CALCULATED')
    expect(values).toMatchObject({
      gross_salary: '2110.20',
      taxable_wage: '2110.20',
      wage_tax: '752.83',
      net_salary: '1357.37',
    })
    expect(result.controls.every((control) => control.status === 'PASS')).toBe(true)
  })
})
