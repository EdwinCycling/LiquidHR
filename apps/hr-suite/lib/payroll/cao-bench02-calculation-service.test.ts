import { describe, expect, it, vi } from 'vitest'
import { buildCalculationInputs, calculatePayroll, type PayrollSourceSnapshot } from '@liquid-hr/payroll-engine'
import { getKinderopvangRuleBundle } from '@liquid-hr/payroll-rules-cao-bench02'
import {
  CAO_BENCH02_CALCULATION_CASES,
  getCaoBench02ScopeInstanceIds,
  getCaoBench02H1Examples,
  getCaoBench02RuleMetadata,
  isCaoBench02CalculationCase,
  loadCaoBench02RunForRequest,
  selectCaoBench02RunForRequest,
} from './cao-bench02-calculation-service'

describe('CAO-BENCH02 calculation-service case catalog', () => {
  it('exposes exactly seven allowlisted engine cases with the intended synthetic assignments', () => {
    expect(CAO_BENCH02_CALCULATION_CASES).toEqual([
      'CAO-BENCH02-K1', 'CAO-BENCH02-K2', 'CAO-BENCH02-R1', 'CAO-BENCH02-R2',
      'CAO-BENCH02-B1', 'CAO-BENCH02-B2', 'CAO-BENCH02-C1',
    ])
    expect(isCaoBench02CalculationCase('CAO-BENCH02-K1')).toBe(true)
    expect(isCaoBench02CalculationCase('CAO-BENCH02-H1')).toBe(false)
    expect(isCaoBench02CalculationCase('CAO-BENCH02-C1&arbitrary=true')).toBe(false)

    const metadata = CAO_BENCH02_CALCULATION_CASES.map((caseKey) => getCaoBench02RuleMetadata(caseKey))
    expect(metadata.every((item) => item !== null)).toBe(true)
    expect(metadata.map((item) => item?.period.month)).toEqual([8, 9, 7, 7, 7, 7, 7])
    expect(metadata.map((item) => item?.fixtureCode)).toEqual([
      'CAO-BENCH02-KINDEROPVANG', 'CAO-BENCH02-KINDEROPVANG',
      'CAO-BENCH02-RETAIL-MODE', 'CAO-BENCH02-RETAIL-MODE',
      'CAO-BENCH02-OPEN-BAND-BENCHMARK', 'CAO-BENCH02-OPEN-BAND-BENCHMARK',
      'CAO-BENCH02-CEO-BENCHMARK',
    ])
    expect(metadata.map((item) => item?.arrangementVersion)).toEqual([
      '2026.07', '2026.09', '2026.07', '2026.07',
      '2026.07', '2026.07', '2026.07',
    ])
    expect(metadata.map((item) => item?.rulePackageVersion)).toEqual([
      '2026.01', '2026.09', '2026.7', '2026.7',
      '2026.07', '2026.07', '2026.07',
    ])
    expect(metadata.map((item) => item?.rulePackageId)).toEqual([
      'CAO-KINDEROPVANG-2025-2026', 'CAO-KINDEROPVANG-2025-2026',
      'CAO-RETAIL-NON-FOOD-2026', 'CAO-RETAIL-NON-FOOD-2026',
      'LHR_DEMO_OPEN_BANDS_2026', 'LHR_DEMO_OPEN_BANDS_2026', 'LHR_DEMO_OPEN_BANDS_2026',
    ])
  })

  it('keeps the supported fixture inputs and result mappings inside the rule package contract', () => {
    const kinderopvang = getCaoBench02RuleMetadata('CAO-BENCH02-K2')
    const retail = getCaoBench02RuleMetadata('CAO-BENCH02-R2')
    const band = getCaoBench02RuleMetadata('CAO-BENCH02-B2')
    const ceo = getCaoBench02RuleMetadata('CAO-BENCH02-C1')

    expect(kinderopvang?.input).toMatchObject({ contractHoursPerWeek: '24', fullTimeHoursPerWeek: '36', sundayHoursInPeriod: '4' })
    expect(retail?.input).toMatchObject({ functionGroup: 'C', experienceRow: '1', dailyOvertimeHours: '2', isEcommerce: false })
    expect(band?.input).toMatchObject({ bandCode: 'F', agreedHourlyRate: '21.00', contractHoursPerWeek: '32', fullTimeHoursPerWeek: '40' })
    expect(band?.outputs.map((row) => row.key)).toContain('band_applied')
    expect(ceo?.input).toMatchObject({ scenarioCode: 'C1', monthlyGrossSalary: '12000', bandCode: '' })
    expect(ceo?.outputs.map((row) => row.key)).toContain('gross_salary')
  })

  it('returns a case-scoped run only when its requested ID matches the current stored run', () => {
    const latest = { caseKey: 'CAO-BENCH02-C1', runId: '3f415a2d-22c5-4f14-af24-88f2cdb7758e' }
    expect(selectCaoBench02RunForRequest(latest, 'CAO-BENCH02-C1', latest.runId)).toBe(latest)
    expect(selectCaoBench02RunForRequest(latest, 'CAO-BENCH02-B1', latest.runId)).toBeNull()
    expect(selectCaoBench02RunForRequest(latest, 'CAO-BENCH02-C1', '00000000-0000-4000-8000-000000000000')).toBeNull()
    expect(selectCaoBench02RunForRequest(null, 'CAO-BENCH02-C1', latest.runId)).toBeNull()
  })

  it('forwards an exact historical run ID to the reader instead of limiting lookup to the latest run', async () => {
    const previousRun = { caseKey: 'CAO-BENCH02-C1', runId: '3f415a2d-22c5-4f14-af24-88f2cdb7758e' }
    const readRun = vi.fn(async (runId?: string) => runId === previousRun.runId ? previousRun : null)

    await expect(loadCaoBench02RunForRequest(readRun, 'CAO-BENCH02-C1', previousRun.runId)).resolves.toBe(previousRun)
    expect(readRun).toHaveBeenCalledWith(previousRun.runId)
  })
})

describe('CAO-BENCH02 gross-only input scope', () => {
  it('calculates K1 without manufacturing an income-relationship identity', () => {
    const snapshot = {
      id: '80000000-0000-4000-8000-000000000008',
      sourceTenantId: '10000000-0000-4000-8000-000000000001',
      sourceHrGroupId: '20000000-0000-4000-8000-000000000002',
      sourceAdministrationId: '30000000-0000-4000-8000-000000000003',
      sourceEmployeeId: 'c2b00000-0000-4000-8000-000000000004',
      sourceEmploymentId: 'b2e00000-0000-4000-8000-000000000004',
      sourceIncomeRelationshipId: null,
      periodReference: { year: 2026, month: 8 },
      canonicalSource: {
        schemaVersion: 'payroll-source-v1',
        employment: {
          source: 'SYNTHETIC_FIXTURE',
          fixtureCode: 'CAO-BENCH02-KINDEROPVANG',
          startsOn: '2026-07-01',
          endsOn: null,
          employmentType: 'REGULAR',
          contractType: 'PERMANENT',
          recordStatus: 'CONFIRMED',
        },
        scenario: {
          caseKey: 'CAO-BENCH02-K1',
          effectiveDate: '2026-08-01',
          packageId: 'KINDEROPVANG_2025_2026',
          scenarioCode: 'K1',
          salaryScale: '6',
          salaryNumber: '12',
          contractHoursPerWeek: '36',
          fullTimeHoursPerWeek: '36',
          sundayHoursInPeriod: '0',
          arrangementSelection: {
            packageId: 'KINDEROPVANG_2025_2026',
            arrangementVersion: '2026.07',
            packageVersionHash: '6fd9984fdd5fb45b793d92230c6d3e52b0a048eb0dc1c4677bedb3e4e3a1cc0a',
            compositionSnapshotHash: '7a685489cb77b3ffbfe67611d59b179fffaa5af3d8c43d58eab0cbcf12fd129a',
            asOfDate: '2026-08-01',
            fixtureCode: 'CAO-BENCH02-KINDEROPVANG',
            salaryStrategy: 'DISCRETE_SCALE_STEP',
          },
        },
        incomeRelationship: { status: 'UNSUPPORTED', reasonCode: 'CAO_BENCH02_GROSS_ONLY' },
        fiscalProfile: { status: 'SOURCE_GAP', reasonCode: 'NO_ACCEPTED_FISCAL_SCENARIO' },
      },
      sourceVersionVector: {
        'package:KINDEROPVANG_2025_2026': '2026.07:6fd9984fdd5fb45b793d92230c6d3e52b0a048eb0dc1c4677bedb3e4e3a1cc0a',
        'arrangement-composition:CAO-BENCH02-KINDEROPVANG:2026-08-01': '7a685489cb77b3ffbfe67611d59b179fffaa5af3d8c43d58eab0cbcf12fd129a',
      },
      sourceGaps: [
        { field: 'incomeRelationship', status: 'UNSUPPORTED', reasonCode: 'CAO_BENCH02_GROSS_ONLY' },
        { field: 'fiscalProfile', status: 'SOURCE_GAP', reasonCode: 'NO_ACCEPTED_FISCAL_SCENARIO' },
      ],
      sourceHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      createdAt: '2026-10-04T00:00:00.000Z',
    } satisfies PayrollSourceSnapshot

    const bundle = getKinderopvangRuleBundle('2026-08-01')
    const scopeInstanceIds = getCaoBench02ScopeInstanceIds(snapshot)
    expect(scopeInstanceIds).toEqual({
      EMPLOYEE: snapshot.sourceEmployeeId,
      EMPLOYMENT: snapshot.sourceEmploymentId,
    })

    const inputs = buildCalculationInputs(snapshot, bundle.rulePackage, {
      effectiveDate: '2026-08-01',
      scopeInstanceIds,
    })
    const result = calculatePayroll(inputs, bundle.registry)

    expect(result.status).toBe('CALCULATED')
    expect(Object.fromEntries(result.resultRows.map((row) => [row.key, row.value]))).toEqual({
      base_salary: '2777.000000000000000000',
      work_hour_supplement: '0.000000000000000000',
      gross_salary: '2777.000000000000000000',
    })
    expect(getCaoBench02RuleMetadata('CAO-BENCH02-K1')).toMatchObject({
      arrangementVersion: '2026.07',
      rulePackageVersion: '2026.01',
    })
  })
})

describe('CAO-BENCH02 H1 applicability-only examples', () => {
  it('distinguishes a stipulated higher specialist, excluded director and missing evidence', () => {
    const examples = getCaoBench02H1Examples()
    expect(examples.supported.status).toBe('SUPPORTED')
    expect(examples.excludedDirector.status).toBe('EXCLUDED')
    expect(examples.excludedDirector.reasonCode).toBe('EXCLUDED_ROLE_CATEGORY')
    expect(examples.evidenceGap.status).toBe('REQUIRES_REVIEW')
    expect(examples.evidenceGap.missingEvidence).toContain('employerScope')
    expect(examples.evidenceGap.missingEvidence).toContain('functionLevel')
  })
})
