import { describe, expect, it } from 'vitest'
import { calculateCaoPayroll, type CaoPayrollIntegrationInput } from './cao-payroll-integration'

const baseInput: CaoPayrollIntegrationInput = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  hrGroupId: '20000000-0000-4000-8000-000000000002',
  administrationId: '30000000-0000-4000-8000-000000000003',
  employeeId: '40000000-0000-4000-8000-000000000004',
  employmentId: '50000000-0000-4000-8000-000000000005',
  incomeRelationshipId: '60000000-0000-4000-8000-000000000006',
  period: { year: 2026, month: 9 },
  activeStart: '2026-09-01',
  activeEndExclusive: '2026-10-01',
  laborConditionCode: 'CAO_KINDEROPVANG_2025_2026',
  laborConditionName: 'Cao Kinderopvang 2025-2026',
  salary: {
    id: '70000000-0000-4000-8000-000000000007',
    salaryBasis: 'CAO_SCALE',
    caoScaleName: 'Schaal 6',
    caoStepName: 'Salarisnummer 12',
    salaryStepCode: '12',
    hourlyRate: null,
    validFrom: '2026-01-01',
  },
  schedule: { contractHoursPerWeek: 24, fullTimeHoursPerWeek: 36 },
  actualWorkEntries: [{
    family: 'WORK', typeCode: 'SUNDAY_PREMIUM', typeName: 'Zondagwerk', hours: '4', status: 'APPROVED',
  }],
}

describe('normal-source CAO payroll integration', () => {
  it('calculates the existing Kinderopvang K2 scope from Core-shaped inputs', () => {
    const result = calculateCaoPayroll(baseInput)

    expect(result.status).toBe('CALCULATED')
    expect(result.family).toBe('KINDEROPVANG')
    expect(result.packageId).toBe('CAO-KINDEROPVANG-2025-2026')
    expect(result.fullTimeMonthlyAmount).toBe('2819')
    expect(result.baseAmount).toBe('1879.333333333333333333')
    expect(result.grossAmount).toBe('1911.735632183908045976')
    expect(result.actualWorkConsumed).toBe(true)
    expect(result.sourceHash).toMatch(/^[0-9a-f]{64}$/)
    expect(result.inputHash).toMatch(/^[0-9a-f]{64}$/)
    expect(result.resultHash).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(result)).not.toMatch(/synthetic|fixture|benchmark/i)
  })

  it('selects the Retail Mode R1 and R2 rows and effective July table', () => {
    const r1 = calculateCaoPayroll({
      ...baseInput,
      period: { year: 2026, month: 7 },
      activeEndExclusive: '2026-08-01',
      laborConditionCode: 'RETAIL_NON_FOOD_MODE_2026_2027',
      laborConditionName: 'Retail Non-Food / Mode',
      salary: { ...baseInput.salary!, caoScaleName: 'I', caoStepName: '15', salaryStepCode: '15', hourlyRate: 28.9 },
      schedule: { contractHoursPerWeek: 38, fullTimeHoursPerWeek: 38 },
      actualWorkEntries: [],
    })
    const r2 = calculateCaoPayroll({
      ...baseInput,
      period: { year: 2026, month: 7 },
      activeEndExclusive: '2026-08-01',
      laborConditionCode: 'RETAIL_NON_FOOD_MODE_2026_2027',
      laborConditionName: 'Retail Non-Food / Mode',
      retailBusinessScope: {
        value: 'IN_STORE',
        sourceClassification: 'SYNTHETIC_FIXTURE',
        sourceReference: 'SYNTHETIC_FIXTURE:CAO integration test; activity scope is explicitly stipulated for this case',
        sourceVersion: 'CAO-RETAIL-INTEGRATION-TEST-v1',
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
      },
      salary: { ...baseInput.salary!, caoScaleName: 'C', caoStepName: '1', salaryStepCode: '1', hourlyRate: 0 },
      schedule: { contractHoursPerWeek: 24, fullTimeHoursPerWeek: 38 },
      actualWorkEntries: [
        { family: 'WORK', typeCode: 'NIGHT', typeName: 'Nachtwerk', hours: '1', status: 'APPROVED' },
        { family: 'WORK', typeCode: 'SUNDAY', typeName: 'Zondagwerk', hours: '1', status: 'APPROVED' },
        { family: 'OVERTIME', typeCode: 'OVERTIME', typeName: 'Overwerk', hours: '2', status: 'APPROVED' },
      ],
    })

    expect(r1.status).toBe('CALCULATED')
    expect(r1.grossAmount).toBe('4767.20')
    expect(r2.status).toBe('CALCULATED')
    expect(r2.baseAmount).toBe('1605.79')
    expect(r2.premiumAmount).toBe('15.44')
    expect(r2.grossAmount).toBe('1621.23')
  })

  it('blocks a supported CAO when a scale source is missing', () => {
    const result = calculateCaoPayroll({
      ...baseInput,
      salary: { ...baseInput.salary!, caoScaleName: null },
    })

    expect(result).toMatchObject({
      status: 'BLOCKED',
      family: 'KINDEROPVANG',
      reasonCode: 'CAO_SALARY_SCALE_MISSING',
      blockingStatus: 'SOURCE_GAP',
    })
  })

  it('does not treat an unrelated labor condition as a CAO assignment', () => {
    expect(calculateCaoPayroll({
      ...baseInput,
      laborConditionCode: 'COMPANY',
      laborConditionName: 'Company labor conditions',
    })).toEqual({ status: 'NOT_APPLICABLE' })
  })
})
