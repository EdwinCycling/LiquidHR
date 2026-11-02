import { describe, expect, it } from 'vitest'
import { calculateCaoPayroll, type CaoPayrollIntegrationInput } from './cao-payroll-integration'

type TableSourceRow = NonNullable<NonNullable<CaoPayrollIntegrationInput['salaryTableSource']>['source']>

function tableSource(overrides: Partial<TableSourceRow> = {}, kind: 'KO' | 'RETAIL' = 'KO') {
  const retail = kind === 'RETAIL'
  return {
    status: 'RESOLVED' as const,
    reasonCode: null,
    source: {
      salaryId: '70000000-0000-4000-8000-000000000007',
      structureId: retail ? 'structure-retail' : 'structure-ko',
      revisionId: retail ? 'revision-retail' : 'revision-ko',
      revisionNumber: 4,
      revisionUpdatedAt: '2026-08-01T00:00:00.000Z',
      salaryBasis: retail ? 'HOURLY' : 'MONTHLY_BASE',
      effectiveFrom: retail ? '2026-07-01' : '2026-09-01',
      effectiveTo: retail ? '2027-06-30' : '2026-12-31',
      sourceTitle: retail ? 'Retail Non-Food loongebouw' : 'Cao Kinderopvang salaristabel',
      sourceVersion: retail ? '2026.07' : '2026.09',
      sourceUrl: retail ? 'https://www.inretail.nl/retail-cao.pdf' : 'https://www.kinderopvang-werkt.nl/salaristabel.pdf',
      sourceHash: 'a'.repeat(64),
      sourceRowCount: 196,
      scaleId: retail ? 'scale-retail' : 'scale-ko',
      scaleCode: retail ? '6' : '6',
      scaleName: retail ? '6' : 'Schaal 6',
      stepId: retail ? 'step-retail' : 'step-ko',
      stepCode: retail ? '12' : '12',
      stepName: retail ? '12' : 'Salarisnummer 12',
      fulltimeAmount: retail ? '28.95' : '2819.00',
      hourlyAmount: retail ? '28.9500' : null,
      currencyCode: 'EUR',
      stepUpdatedAt: '2026-08-01T00:00:00.000Z',
      maximumStepFulltimeAmount: retail ? null : '3425.00',
      ...overrides,
    },
  }
}

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
    validUntil: null,
    paymentType: 'PERIODIC_FIXED',
    salaryStructureId: 'structure-ko',
    salaryScaleId: 'scale-ko',
    salaryScaleStepId: 'step-ko',
  },
  salaryTableSource: tableSource(),
  schedule: { contractHoursPerWeek: 24, fullTimeHoursPerWeek: 36 },
  actualWorkEntries: [{
    family: 'WORK', typeCode: 'SUNDAY_PREMIUM', typeName: 'Zondagwerk', workDate: '2026-09-06', isPublicHoliday: false, hours: '4', status: 'APPROVED',
  }],
}

describe('data-driven CAO payroll integration', () => {
  it('uses the effective Core salary row and official Kinderopvang Sunday rule', () => {
    const result = calculateCaoPayroll(baseInput)

    expect(result.status).toBe('CALCULATED')
    expect(result.family).toBe('KINDEROPVANG')
    expect(result.packageId).toBe('CORE_SALARY_STRUCTURE:structure-ko')
    expect(result.packageVersion).toBe('2026.09')
    expect(result.fullTimeMonthlyAmount).toBe('2819')
    expect(result.baseAmount).toBe('1879.333333333333333333')
    expect(result.premiumAmount).toBe('32.4022988505747126438')
    expect(result.grossAmount).toBe('1911.7356321839080459768')
    expect(result.actualWorkConsumed).toBe(true)
    expect(result.sourceHash).toMatch(/^[0-9a-f]{64}$/)
    expect(result.inputHash).toMatch(/^[0-9a-f]{64}$/)
    expect(result.resultHash).toMatch(/^[0-9a-f]{64}$/)
    expect(result.trace?.map((step) => step.code)).toEqual([
      'KINDEROPVANG_BASE_SALARY',
      'CAO_KINDEROPVANG_WORK_HOUR_PREMIUM',
      'KINDEROPVANG_GROSS_RESULT',
    ])
    expect(JSON.stringify(result)).not.toMatch(/synthetic|fixture|benchmark/i)
  })

  it('does not infer a CAO supplement from work-hour codes or display names', () => {
    const result = calculateCaoPayroll({
      ...baseInput,
      actualWorkEntries: [{
        family: 'WORK', typeCode: 'SUNDAY_PREMIUM', typeName: 'Zondagwerk', workDate: '2026-09-07',
        isPublicHoliday: false, hours: '4', status: 'APPROVED',
      }],
    })

    expect(result.status).toBe('CALCULATED')
    expect(result.premiumAmount).toBe('0')
    expect(result.grossAmount).toBe(result.baseAmount)
    expect(result.actualWorkConsumed).toBe(false)
  })

  it('calculates Retail Mode rows from the effective hourly table', () => {
    const retailSource = tableSource({
      scaleId: 'scale-retail-i', scaleCode: 'I', scaleName: 'I',
      stepId: 'step-retail-i15', stepCode: '15', stepName: '15',
    }, 'RETAIL')
    const r1 = calculateCaoPayroll({
      ...baseInput,
      period: { year: 2026, month: 7 },
      activeStart: '2026-07-01',
      activeEndExclusive: '2026-08-01',
      laborConditionCode: 'RETAIL_NON_FOOD_MODE_2026_2027',
      laborConditionName: 'Retail Non-Food / Mode',
      salary: {
        ...baseInput.salary!,
        caoScaleName: 'I', caoStepName: '15', salaryStepCode: '15', hourlyRate: 0,
        salaryStructureId: 'structure-retail', salaryScaleId: 'scale-retail-i', salaryScaleStepId: 'step-retail-i15',
      },
      salaryTableSource: retailSource,
      schedule: { contractHoursPerWeek: 38, fullTimeHoursPerWeek: 38 },
      actualWorkEntries: [],
    })
    const r2 = calculateCaoPayroll({
      ...baseInput,
      period: { year: 2026, month: 7 },
      activeStart: '2026-07-01',
      activeEndExclusive: '2026-08-01',
      laborConditionCode: 'RETAIL_NON_FOOD_MODE_2026_2027',
      laborConditionName: 'Retail Non-Food / Mode',
      salary: {
        ...baseInput.salary!,
        caoScaleName: 'C', caoStepName: '1', salaryStepCode: '1', hourlyRate: 0,
        salaryStructureId: 'structure-retail', salaryScaleId: 'scale-retail-c', salaryScaleStepId: 'step-retail-c1',
      },
      salaryTableSource: tableSource({
        scaleId: 'scale-retail-c', scaleCode: 'C', scaleName: 'C',
        stepId: 'step-retail-c1', stepCode: '1', stepName: '1',
        fulltimeAmount: '15.44', hourlyAmount: '15.4400',
      }, 'RETAIL'),
      schedule: { contractHoursPerWeek: 24, fullTimeHoursPerWeek: 38 },
      actualWorkEntries: [],
    })

    expect(r1.status).toBe('CALCULATED')
    expect(r1.hourlyBaseRate).toBe('28.95')
    expect(r1.fullTimeMonthlyAmount).toBe('4767.2')
    expect(r1.grossAmount).toBe('4767.20')
    expect(r2.status).toBe('CALCULATED')
    expect(r2.fullTimeMonthlyAmount).toBe('2542.5')
    expect(r2.baseAmount).toBe('1605.79')
    expect(r2.grossAmount).toBe('1605.79')
  })

  it('blocks a CAO salary when its published table row is missing or mismatched', () => {
    const missing = calculateCaoPayroll({ ...baseInput, salaryTableSource: undefined })
    const mismatch = calculateCaoPayroll({
      ...baseInput,
      salaryTableSource: tableSource({ stepId: 'another-step' }),
    })

    expect(missing).toMatchObject({
      status: 'BLOCKED', family: 'KINDEROPVANG',
      reasonCode: 'CAO_SALARY_TABLE_SOURCE_MISSING', blockingStatus: 'SOURCE_GAP',
    })
    expect(mismatch).toMatchObject({
      status: 'BLOCKED', family: 'KINDEROPVANG',
      reasonCode: 'CAO_SALARY_TABLE_LINK_OR_PERIOD_MISMATCH', blockingStatus: 'UNSUPPORTED',
    })
  })

  it('fails closed when Retail variable hours have no configured wage rule', () => {
    const result = calculateCaoPayroll({
      ...baseInput,
      period: { year: 2026, month: 7 },
      activeStart: '2026-07-01',
      activeEndExclusive: '2026-08-01',
      laborConditionCode: 'RETAIL_NON_FOOD_MODE_2026_2027',
      salary: { ...baseInput.salary!, paymentType: 'PERIODIC_FIXED' },
      salaryTableSource: tableSource({
        structureId: 'structure-ko', salaryBasis: 'HOURLY', effectiveFrom: '2026-07-01', effectiveTo: '2027-06-30',
        scaleId: 'scale-ko', scaleCode: '6', scaleName: 'Schaal 6',
        stepId: 'step-ko', stepCode: '12', stepName: 'Salarisnummer 12',
        hourlyAmount: '15.4400',
      }, 'RETAIL'),
      actualWorkEntries: [{ family: 'OVERTIME', typeCode: 'OVERTIME', typeName: 'Overwerk', hours: 2, status: 'APPROVED' }],
    })

    expect(result).toMatchObject({
      status: 'BLOCKED', family: 'RETAIL_MODE',
      reasonCode: 'CAO_RETAIL_VARIABLE_WAGE_RULE_NOT_CONFIGURED', blockingStatus: 'UNSUPPORTED',
    })
  })

  it('rejects Retail business scope from another tenant or with an invalid effective period', () => {
    const invalidScope = {
      tenantId: 'another-tenant',
      administrationId: baseInput.administrationId,
      value: 'IN_STORE' as const,
      sourceClassification: 'SYNTHETIC_FIXTURE' as const,
      sourceReference: 'test source',
      sourceVersion: 'test-v1',
      effectiveFrom: '2026-07-01',
      effectiveTo: '2026-06-30',
    }
    const result = calculateCaoPayroll({
      ...baseInput,
      period: { year: 2026, month: 7 },
      activeStart: '2026-07-01',
      activeEndExclusive: '2026-08-01',
      laborConditionCode: 'RETAIL_NON_FOOD_MODE_2026_2027',
      retailBusinessScope: invalidScope,
    })

    expect(result).toMatchObject({
      status: 'BLOCKED', reasonCode: 'CAO_RETAIL_BUSINESS_SCOPE_INVALID', blockingStatus: 'SOURCE_GAP',
    })
  })

  it('does not treat an unrelated labor condition as a CAO assignment', () => {
    expect(calculateCaoPayroll({
      ...baseInput,
      laborConditionCode: 'COMPANY',
      laborConditionName: 'Company labor conditions',
    })).toEqual({ status: 'NOT_APPLICABLE' })
  })

  it('does not let a stale CAO display name override an explicit non-CAO code', () => {
    expect(calculateCaoPayroll({
      ...baseInput,
      laborConditionCode: 'COMPANY_MARS',
      laborConditionName: 'Cao Kinderopvang 2025–2026',
    })).toEqual({ status: 'NOT_APPLICABLE' })
  })
})
