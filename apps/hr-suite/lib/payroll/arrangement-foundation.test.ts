import { describe, expect, it } from 'vitest'
import {
  ARRANGEMENT_PACKAGES,
  ArrangementFoundationError,
  buildCalculationCompositionSnapshot,
  hashArrangementPackageVersion,
  resolveArrangementVersion,
  SYNTHETIC_ARRANGEMENT_FIXTURES,
  validateArrangementSelection,
} from './arrangement-foundation'

const scaleFixture = SYNTHETIC_ARRANGEMENT_FIXTURES[0]!
const openBandFixture = SYNTHETIC_ARRANGEMENT_FIXTURES[1]!
const negotiatedFixture = SYNTHETIC_ARRANGEMENT_FIXTURES[2]!

function testPackage(id: string, versions: readonly { version: string; effectiveFrom: string; effectiveTo: string | null; supportedSalaryStrategies: readonly ['DISCRETE_SCALE_STEP']; sourceMetadata: typeof ARRANGEMENT_PACKAGES[number]['versions'][number]['sourceMetadata'] }[]) {
  return {
    id,
    displayName: id,
    kind: 'COLLECTIVE_AGREEMENT' as const,
    versions,
  }
}

describe('CAO-BENCH02 arrangement foundation contracts', () => {
  it('keeps the catalog provenance explicit about its reference-only scope', () => {
    const childcare = ARRANGEMENT_PACKAGES.find((item) => item.id === 'KINDEROPVANG_2025_2026')!
    const demoPolicy = ARRANGEMENT_PACKAGES.find((item) => item.id === 'LHR_DEMO_OPEN_BANDS_2026')!

    expect(childcare.versions.every((version) => version.sourceMetadata.status === 'REFERENCE_ONLY')).toBe(true)
    expect(childcare.versions.filter((version) => version.version !== '2026.07' && version.version !== '2026.09').every((version) =>
      version.sourceMetadata.note.includes('not implemented in CAO-BENCH02 Phase 1'))).toBe(true)
    expect(childcare.versions.find((version) => version.version === '2026.07')?.sourceMetadata.note)
      .toContain('does not ingest their terms')
    const childcareSeptember = childcare.versions.find((version) => version.version === '2026.09')!
    expect(childcareSeptember.sourceMetadata.note).toBe('Reference metadata for the named agreement release only. CAO-BENCH02 Phase 2 evaluates limited synthetic scenarios; it does not implement the complete agreement, determine legal applicability, or calculate tax or net pay.')
    expect(hashArrangementPackageVersion(childcare, childcareSeptember)).toBe('ef7b8446d8bc6d7a7527e7b3c04945a6c5aa4ddefd82c8a9ad779af879c1332c')
    const openBandJuly = demoPolicy.versions.find((version) => version.version === '2026.07')!
    expect(openBandJuly.sourceMetadata.note).toBe('Synthetic LiquidHR demo policy. Cases B1/B2 reference published 2026 band figures for a fictional benchmark only; no collective agreement applicability, other terms, or tax/net pay is inferred.')
    expect(hashArrangementPackageVersion(demoPolicy, openBandJuly)).toBe('683c5d9db669b0738dd6b1435ff338ec8e1680f3260993e46e80d52a54013806')
  })

  it('represents scale/step, open band, and freely negotiated salary as distinct strategies', () => {
    expect(scaleFixture.salaryStrategy).toBe('DISCRETE_SCALE_STEP')
    expect(openBandFixture.salaryStrategy).toBe('OPEN_SALARY_BAND')
    expect(negotiatedFixture.salaryStrategy).toBe('FREELY_NEGOTIATED')
    expect(validateArrangementSelection({
      fixtureCode: scaleFixture.code,
      packageId: 'RETAIL_NON_FOOD_MODE_2026_2027',
      salaryStrategy: 'DISCRETE_SCALE_STEP',
    }).arrangementPackage.id).toBe('RETAIL_NON_FOOD_MODE_2026_2027')
    expect(validateArrangementSelection({
      fixtureCode: openBandFixture.code,
      packageId: 'LHR_DEMO_OPEN_BANDS_2026',
      salaryStrategy: 'OPEN_SALARY_BAND',
    }).arrangementPackage.id).toBe('LHR_DEMO_OPEN_BANDS_2026')
    expect(validateArrangementSelection({
      fixtureCode: negotiatedFixture.code,
      packageId: 'LHR_DEMO_OPEN_BANDS_2026',
      salaryStrategy: 'FREELY_NEGOTIATED',
    }).arrangementPackage.id).toBe('LHR_DEMO_OPEN_BANDS_2026')
  })

  it('selects the exact package version on each side of effective-date transitions', () => {
    const retail = ARRANGEMENT_PACKAGES.find((item) => item.id === 'RETAIL_NON_FOOD_MODE_2026_2027')!
    const company = ARRANGEMENT_PACKAGES.find((item) => item.id === 'LHR_DEMO_OPEN_BANDS_2026')!
    const childcare = ARRANGEMENT_PACKAGES.find((item) => item.id === 'KINDEROPVANG_2025_2026')!

    expect(resolveArrangementVersion(retail, '2026-06-30').version).toBe('2026.01')
    expect(resolveArrangementVersion(retail, '2026-07-01').version).toBe('2026.07')
    expect(resolveArrangementVersion(company, '2026-06-30').version).toBe('2026.01')
    expect(resolveArrangementVersion(company, '2026-07-01').version).toBe('2026.07')
    expect(resolveArrangementVersion(childcare, '2026-08-31').version).toBe('2026.07')
    expect(resolveArrangementVersion(childcare, '2026-09-01').version).toBe('2026.09')
    expect(() => resolveArrangementVersion(retail, '2025-12-31')).toThrowError(
      expect.objectContaining<Partial<ArrangementFoundationError>>({ code: 'ARRANGEMENT_VERSION_NOT_FOUND' }),
    )
    expect(() => resolveArrangementVersion(retail, '2027-01-01')).toThrowError(
      expect.objectContaining<Partial<ArrangementFoundationError>>({ code: 'ARRANGEMENT_VERSION_NOT_FOUND' }),
    )
    expect(() => resolveArrangementVersion(retail, 'not-a-date')).toThrowError(
      expect.objectContaining<Partial<ArrangementFoundationError>>({ code: 'ARRANGEMENT_DATE_INVALID' }),
    )
  })

  it('rejects no match and overlapping version matches', () => {
    const sourceMetadata = ARRANGEMENT_PACKAGES[0]!.versions[0]!.sourceMetadata
    const noMatch = testPackage('NO_MATCH', [{
      version: '1', effectiveFrom: '2025-01-01', effectiveTo: '2025-06-30',
      supportedSalaryStrategies: ['DISCRETE_SCALE_STEP'], sourceMetadata,
    }])
    const overlap = testPackage('OVERLAP', [
      { version: '1', effectiveFrom: '2025-01-01', effectiveTo: '2025-12-31', supportedSalaryStrategies: ['DISCRETE_SCALE_STEP'], sourceMetadata },
      { version: '2', effectiveFrom: '2025-12-01', effectiveTo: null, supportedSalaryStrategies: ['DISCRETE_SCALE_STEP'], sourceMetadata },
    ])

    expect(() => resolveArrangementVersion(noMatch, '2026-01-01')).toThrowError(
      expect.objectContaining<Partial<ArrangementFoundationError>>({ code: 'ARRANGEMENT_VERSION_NOT_FOUND' }),
    )
    expect(() => resolveArrangementVersion(overlap, '2025-12-15')).toThrowError(
      expect.objectContaining<Partial<ArrangementFoundationError>>({ code: 'ARRANGEMENT_VERSION_AMBIGUOUS' }),
    )
  })

  it('rejects a package or salary strategy that the synthetic fixture does not permit', () => {
    expect(() => validateArrangementSelection({
      fixtureCode: scaleFixture.code,
      packageId: 'LHR_DEMO_OPEN_BANDS_2026',
      salaryStrategy: 'DISCRETE_SCALE_STEP',
    })).toThrowError(expect.objectContaining<Partial<ArrangementFoundationError>>({ code: 'ARRANGEMENT_FIXTURE_PACKAGE_FORBIDDEN' }))
    expect(() => validateArrangementSelection({
      fixtureCode: openBandFixture.code,
      packageId: 'LHR_DEMO_OPEN_BANDS_2026',
      salaryStrategy: 'DISCRETE_SCALE_STEP',
    })).toThrowError(expect.objectContaining<Partial<ArrangementFoundationError>>({ code: 'ARRANGEMENT_STRATEGY_UNSUPPORTED' }))
  })

  it('hash-pins a September 2026 composition and reproduces the same historical snapshot', () => {
    const inputs = {
      tenantId: 'a1e00000-0000-4000-8000-000000000001',
      hrGroupId: 'a1e00000-0000-4000-8000-000000000002',
      administrationId: 'a1e00000-0000-4000-8000-000000000003',
      payrollAdministrationId: 'a1e00000-0000-4000-8000-000000000004',
      assignmentId: 'a1e00000-0000-4000-8000-000000000005',
      fixtureCode: openBandFixture.code,
      sourceEmploymentId: openBandFixture.sourceEmploymentId,
      packageId: 'LHR_DEMO_OPEN_BANDS_2026',
      salaryStrategy: 'OPEN_SALARY_BAND' as const,
      assignmentEffectiveFrom: '2026-09-01',
      assignmentEffectiveTo: null,
      asOfDate: '2026-09-30',
    }
    const first = buildCalculationCompositionSnapshot(inputs)
    const second = buildCalculationCompositionSnapshot({ ...inputs })

    expect(first.content.arrangement.version).toBe('2026.07')
    expect(first.content.calculationStatus).toBe('FOUNDATION_ONLY')
    expect(first.contentHash).toMatch(/^[0-9a-f]{64}$/)
    expect(first.contentHash).toBe(second.contentHash)
    expect(first.content.arrangement.packageVersionHash).toBe(
      hashArrangementPackageVersion(ARRANGEMENT_PACKAGES.find((item) => item.id === inputs.packageId)!,
        ARRANGEMENT_PACKAGES.find((item) => item.id === inputs.packageId)!.versions[1]!),
    )
  })

  it('rejects an assignment that is not yet effective or a fixture ID that was changed', () => {
    expect(() => buildCalculationCompositionSnapshot({
      tenantId: 'a1e00000-0000-4000-8000-000000000001',
      hrGroupId: 'a1e00000-0000-4000-8000-000000000002',
      administrationId: 'a1e00000-0000-4000-8000-000000000003',
      payrollAdministrationId: 'a1e00000-0000-4000-8000-000000000004',
      assignmentId: 'a1e00000-0000-4000-8000-000000000005',
      fixtureCode: openBandFixture.code,
      sourceEmploymentId: openBandFixture.sourceEmploymentId,
      packageId: 'LHR_DEMO_OPEN_BANDS_2026',
      salaryStrategy: 'OPEN_SALARY_BAND',
      assignmentEffectiveFrom: '2026-10-01',
      assignmentEffectiveTo: null,
      asOfDate: '2026-09-30',
    })).toThrowError(expect.objectContaining<Partial<ArrangementFoundationError>>({ code: 'ARRANGEMENT_ASSIGNMENT_INACTIVE' }))
    expect(() => buildCalculationCompositionSnapshot({
      tenantId: 'a1e00000-0000-4000-8000-000000000001',
      hrGroupId: 'a1e00000-0000-4000-8000-000000000002',
      administrationId: 'a1e00000-0000-4000-8000-000000000003',
      payrollAdministrationId: 'a1e00000-0000-4000-8000-000000000004',
      assignmentId: 'a1e00000-0000-4000-8000-000000000005',
      fixtureCode: openBandFixture.code,
      sourceEmploymentId: 'b2e00000-0000-4000-8000-000000000099',
      packageId: 'LHR_DEMO_OPEN_BANDS_2026',
      salaryStrategy: 'OPEN_SALARY_BAND',
      assignmentEffectiveFrom: '2026-09-01',
      assignmentEffectiveTo: null,
      asOfDate: '2026-09-30',
    })).toThrowError(expect.objectContaining<Partial<ArrangementFoundationError>>({ code: 'ARRANGEMENT_ASSIGNMENT_INACTIVE' }))
  })
})
