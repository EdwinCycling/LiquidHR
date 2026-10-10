import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  PayrollEngineError,
  buildCalculationInputs,
  calculatePayroll,
  sha256,
  stableSerialize,
  type PayrollCalculationResult,
  type PayrollSourceSnapshot,
} from '@liquid-hr/payroll-engine'
import { getRetailModeRuleBundle } from '../src/retail-mode'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const implementationPath = resolve(testDirectory, '../src/retail-mode.ts')

type Scenario = Readonly<Record<string, string | boolean>>

function sourceSnapshot(effectiveDate: string, scenario: Scenario): PayrollSourceSnapshot {
  const canonicalSource = { scenario }
  const month = effectiveDate < '2026-07-01' ? 6 : 7
  return {
    id: `synthetic-retail-mode-${effectiveDate}`,
    sourceTenantId: 'tenant-retail-mode-synthetic',
    sourceHrGroupId: 'group-retail-mode-synthetic',
    sourceAdministrationId: 'administration-retail-mode-synthetic',
    sourceEmployeeId: 'employee-retail-mode-synthetic',
    sourceEmploymentId: 'employment-retail-mode-synthetic',
    sourceIncomeRelationshipId: 'income-relationship-retail-mode-synthetic',
    periodReference: { year: 2026, month },
    canonicalSource,
    sourceVersionVector: { employment: 'synthetic-v1', compensation: 'synthetic-v1' },
    sourceGaps: [],
    sourceHash: sha256(stableSerialize(canonicalSource)),
    createdAt: '2026-10-03T08:00:00.000Z',
  }
}

function r1Scenario(overrides: Partial<Record<string, string | boolean>> = {}): Scenario {
  return {
    scenarioCode: 'R1',
    functionGroup: 'I',
    experienceRow: '15',
    contractHoursPerWeek: '38',
    fullTimeHoursPerWeek: '38',
    existingActualHourlyRate: '28.90',
    weekdayNightHours: '0',
    sundayHours: '0',
    dailyOvertimeHours: '0',
    isEcommerce: false,
    ...overrides,
  }
}

function r2Scenario(overrides: Partial<Record<string, string | boolean>> = {}): Scenario {
  return {
    scenarioCode: 'R2',
    functionGroup: 'C',
    experienceRow: '1',
    contractHoursPerWeek: '24',
    fullTimeHoursPerWeek: '38',
    existingActualHourlyRate: '0',
    weekdayNightHours: '1',
    sundayHours: '1',
    dailyOvertimeHours: '2',
    isEcommerce: false,
    ...overrides,
  }
}

function calculate(effectiveDate: string, scenario: Scenario): PayrollCalculationResult {
  const bundle = getRetailModeRuleBundle(effectiveDate)
  const snapshot = sourceSnapshot(effectiveDate, scenario)
  const inputs = buildCalculationInputs(snapshot, bundle.rulePackage, {
    effectiveDate,
    scopeInstanceIds: { EMPLOYMENT: snapshot.sourceEmploymentId! },
  })
  return calculatePayroll(inputs, bundle.registry)
}

function resultValue(result: PayrollCalculationResult, key: string): string | boolean {
  const row = result.resultRows.find((candidate) => candidate.key === key)
  if (!row) throw new Error(`Expected result mapping ${key}`)
  return row.value
}

function registeredRuleTrace(result: PayrollCalculationResult) {
  return result.trace.find((step) => step.componentCode === 'RETAIL_MODE_GROSS')?.registeredRuleTrace ?? []
}

function expectEngineCode(operation: () => unknown, code: string): void {
  try {
    operation()
    throw new Error(`Expected PayrollEngineError ${code}`)
  } catch (error) {
    expect(error).toBeInstanceOf(PayrollEngineError)
    expect((error as PayrollEngineError).code).toBe(code)
  }
}

describe('Retail Non-Food 2026 gross mode', () => {
  it('selects only the pinned January and July versions at their inclusive boundaries', () => {
    const beforeJuly = getRetailModeRuleBundle('2026-06-30')
    const fromJuly = getRetailModeRuleBundle('2026-07-01')
    const janParameters = beforeJuly.rulePackage.components.find((component) => component.code === 'RETAIL_MODE_GROSS')?.parameters
    const julParameters = fromJuly.rulePackage.components.find((component) => component.code === 'RETAIL_MODE_GROSS')?.parameters

    expect(beforeJuly.arrangementVersion).toBe('retail-non-food/2026.01')
    expect(janParameters?.tableCRow1?.value).toBe('15.15')
    expect(janParameters?.tableIRow15?.value).toBe('28.41')
    expect(janParameters?.monthlyConversionHours?.value).toBe('164.67')
    expect(fromJuly.arrangementVersion).toBe('retail-non-food/2026.07')
    expect(julParameters?.tableCRow1?.value).toBe('15.44')
    expect(julParameters?.tableIRow15?.value).toBe('28.95')
    expect(julParameters?.monthlyConversionHours?.value).toBe('164.67')
    expectEngineCode(() => getRetailModeRuleBundle('2027-01-01'), 'RETAIL_MODE_DATE_UNSUPPORTED')
    expectEngineCode(() => getRetailModeRuleBundle('2026-02-30'), 'RETAIL_MODE_DATE_INVALID')
  })

  it('discloses the excluded 8% vacation allowance, supported rows, and implementation source hash', async () => {
    const bundle = getRetailModeRuleBundle('2026-07-01')
    const source = (await readFile(implementationPath, 'utf8')).replace(/\r\n/g, '\n')
    const normalizedSource = source.replace(
      /const RULE_IMPLEMENTATION_HASH = '[^']+'/,
      "const RULE_IMPLEMENTATION_HASH = '__RETAIL_IMPLEMENTATION_SHA256__'",
    )
    const expectedHash = createHash('sha256').update(normalizedSource, 'utf8').digest('hex')
    const scopeNotice = bundle.rulePackage.metadata?.sourceMetadata?.grossScopeNotice
    const unsupported = bundle.rulePackage.metadata?.sourceMetadata?.unsupported

    expect(bundle.registry[0]?.implementationHash).toBe(expectedHash)
    expect(scopeNotice).toContain('8% vacation allowance (vakantietoeslag)')
    expect(scopeNotice).toContain('C/1 (R2) and I/15 (R1)')
    expect(unsupported).toContain('8% vacation allowance (vakantietoeslag) excluded from gross pay')
  })

  it('applies the July R1 1.9% actual-wage index and caps at the pinned group I maximum', () => {
    // Independent oracle: 28.90 × 1.019 = 29.4491; the published July cap is 28.95.
    const january = calculate('2026-06-30', r1Scenario())
    const july = calculate('2026-07-01', r1Scenario())
    const julyTrace = registeredRuleTrace(july).find((step) => step.code === 'RETAIL_R1_JULY_ACTUAL_RATE_INDEXATION_CAP')

    expect(resultValue(january, 'hourly_base_rate')).toBe('28.90')
    expect(resultValue(january, 'gross_pay')).toBe('4758.96')
    expect(resultValue(july, 'hourly_base_rate')).toBe('28.95')
    expect(resultValue(july, 'base_monthly_gross')).toBe('4767.20')
    expect(resultValue(july, 'gross_pay')).toBe('4767.20')
    expect(julyTrace?.values.indexedHourlyRateBeforeRounding?.value).toBe('29.4491')
    expect(julyTrace?.values.indexedHourlyRateBeforeCap?.value).toBe('29.45')
    expect(julyTrace?.values.hourlyRateAfterCap?.value).toBe('28.95')
    expect(july.resultRows.some((row) => row.key.includes('net') || row.key.includes('tax'))).toBe(false)
  })

  it('uses group C row 1 and one best-of 50% premium for each non-overlapping R2 hour', () => {
    // Independent oracle: 15.44 × 164.67 × 24 / 38 = 1,605.79; two distinct
    // hours at the selected 50% rate add 15.44, for gross of 1,621.23.
    const january = calculate('2026-06-30', r2Scenario())
    const july = calculate('2026-07-01', r2Scenario())
    const premiumTrace = registeredRuleTrace(july).find((step) => step.code === 'RETAIL_R2_BEST_OF_PREMIUMS_NO_DOUBLE_PAY')

    expect(resultValue(january, 'hourly_base_rate')).toBe('15.15')
    expect(resultValue(july, 'hourly_base_rate')).toBe('15.44')
    expect(resultValue(july, 'base_monthly_gross')).toBe('1605.79')
    expect(resultValue(july, 'selected_premium_gross')).toBe('15.44')
    expect(resultValue(july, 'gross_pay')).toBe('1621.23')
    expect(premiumTrace?.values.dailyOvertimeOverlapHours?.value).toBe('2')
    expect(premiumTrace?.values.dailyOvertimeOnlyHours?.value).toBe('0')
  })

  it('rejects rows outside the explicit R1/R2 slice', () => {
    expectEngineCode(
      () => calculate('2026-07-01', r2Scenario({ experienceRow: '2' })),
      'RETAIL_MODE_ROW_UNSUPPORTED',
    )
    expectEngineCode(
      () => calculate('2026-07-01', r1Scenario({ functionGroup: 'H' })),
      'RETAIL_MODE_ROW_UNSUPPORTED',
    )
  })

  it('rejects invalid hours and unsupported e-commerce night-band inputs', () => {
    expectEngineCode(
      () => calculate('2026-07-01', r2Scenario({ contractHoursPerWeek: '-1' })),
      'RETAIL_MODE_INPUT_INVALID',
    )
    expectEngineCode(
      () => calculate('2026-07-01', r2Scenario({ fullTimeHoursPerWeek: '37' })),
      'RETAIL_MODE_FULL_TIME_UNSUPPORTED',
    )
    expectEngineCode(
      () => calculate('2026-07-01', r2Scenario({ isEcommerce: true })),
      'RETAIL_MODE_ECOMMERCE_NIGHT_BAND_UNSUPPORTED',
    )
  })
})
