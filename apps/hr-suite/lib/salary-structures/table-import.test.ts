import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parseSalaryTableImport, type SalaryTableImportMetadata } from './table-import'

const metadata: SalaryTableImportMetadata = {
  effectiveFrom: '2026-09-01',
  effectiveTo: '2026-12-31',
  salaryBasis: 'MONTHLY_BASE',
  sourceTitle: 'Official salary table',
  sourceVersion: '2026.09',
  sourceUrl: 'https://example.org/salary-table.pdf',
  sourceSha256: 'a'.repeat(64),
  sourceFileName: 'salary-table.pdf',
}

describe('salary table import preview', () => {
  it('groups all rows into a typed draft and reads Dutch thousands separators', () => {
    const result = parseSalaryTableImport([
      'scale_code;scale_name;step_code;step_name;step_order;amount',
      '6;Schaal 6;11;Salarisnummer 11;11;2.745',
      '6;Schaal 6;12;Salarisnummer 12;12;2.819',
    ].join('\n'), metadata)

    expect(result.errors).toEqual([])
    expect(result.draft).toMatchObject({
      structureType: 'SCALE_WITH_STEPS',
      effectiveFrom: '2026-09-01',
      scales: [{
        code: '6',
        steps: [
          { stepCode: '11', fulltimeAmount: '2745.00', stepKind: 'START' },
          { stepCode: '12', fulltimeAmount: '2819.00', stepKind: 'MAXIMUM' },
        ],
      }],
    })
    expect(result.draft?.description).toContain('SHA-256')
    expect(result.draft?.sourceMetadata).toMatchObject({
      title: 'Official salary table',
      version: '2026.09',
      effectiveFrom: '2026-09-01',
      effectiveTo: '2026-12-31',
      sha256: 'a'.repeat(64),
      fileName: 'salary-table.pdf',
      rowCount: 2,
    })
    expect(result.rows).toHaveLength(2)
  })

  it('records an hourly source value as a distinct hourly amount', () => {
    const result = parseSalaryTableImport([
      'scale_code,scale_name,step_code,step_name,step_order,amount',
      'I,Functiegroep I,15,Trede 15,15,"28,95"',
    ].join('\n'), { ...metadata, salaryBasis: 'HOURLY' })

    expect(result.errors).toEqual([])
    expect(result.draft?.structureType === 'SCALE_WITH_STEPS' && result.draft.scales[0]?.steps[0]).toMatchObject({
      fulltimeAmount: '28.95',
      hourlyAmount: '28.9500',
      stepKind: 'MAXIMUM',
    })
  })

  it('keeps explicitly provided step kinds and accepts the same scale order for each row', () => {
    const result = parseSalaryTableImport([
      'scale_code,scale_name,step_code,step_name,step_order,amount,scale_order,step_kind',
      '6,Schaal 6,11,Salarisnummer 11,11,2745,4,REGULAR',
      '6,Schaal 6,12,Salarisnummer 12,12,2819,4,MAXIMUM',
    ].join('\n'), metadata)

    expect(result.errors).toEqual([])
    expect(result.draft?.structureType === 'SCALE_WITH_STEPS' && result.draft.scales[0]).toMatchObject({ sortOrder: 4, steps: [{ stepKind: 'REGULAR' }, { stepKind: 'MAXIMUM' }] })
  })

  it('rejects impossible dates, invalid step kinds and hourly-only values for a monthly table', () => {
    const invalidDate = parseSalaryTableImport('scale_code,scale_name,step_code,step_name,step_order,amount\n6,Schaal 6,12,Salarisnummer 12,12,2819', { ...metadata, effectiveFrom: '2026-02-30' })
    const invalidKind = parseSalaryTableImport('scale_code,scale_name,step_code,step_name,step_order,amount,step_kind\n6,Schaal 6,12,Salarisnummer 12,12,2819,UNKNOWN', metadata)
    const hourlyOnly = parseSalaryTableImport('scale_code,scale_name,step_code,step_name,step_order,hourly_amount\n6,Schaal 6,12,Salarisnummer 12,12,18.25', metadata)

    expect(invalidDate.errors).toContain('EFFECTIVE_PERIOD_INVALID')
    expect(invalidKind.errors).toContain('CSV_ROW_2_STEP_KIND_INVALID')
    expect(hourlyOnly.errors).toContain('CSV_ROW_2_AMOUNT_INVALID')
  })

  it('blocks duplicate scale/step keys and unverified source metadata', () => {
    const result = parseSalaryTableImport([
      'scale_code,scale_name,step_code,step_name,step_order,amount',
      'C,Functiegroep C,1,Trede 1,1,15.44',
      'C,Functiegroep C,1,Trede 1,1,15.44',
    ].join('\n'), { ...metadata, sourceUrl: 'http://example.org/table', sourceSha256: 'not-a-hash' })

    expect(result.draft).toBeNull()
    expect(result.errors).toContain('CSV_ROW_3_DUPLICATE_STEP')
    expect(result.errors).toContain('SOURCE_URL_HTTPS_REQUIRED')
    expect(result.errors).toContain('SOURCE_HASH_INVALID')
  })

  it('keeps percentage cells as manual source rules and derives comparison rates from exact prior values', () => {
    const result = parseSalaryTableImport([
      'scale_code,scale_name,step_code,step_name,step_order,amount,scale_order,progression_type,source_rule_code,source_rule_percent,source_rule_description,source_rule_condition,source_rule_reference',
      'MODE_I,Functiegroep I,EXP_03,3 ervaringsjaren,9,15.44,8,MANUAL,,,,',
      'MODE_I,Functiegroep I,EXP_04,4 ervaringsjaren,10,2%,8,MANUAL,RETAIL_STEP_2_PERCENT,2.00,"Beoordelingsafhankelijke tredeverhoging van 2%","Zeer goed of uitmuntend functioneren",Bijlage 1a p. 29',
      'MODE_I,Functiegroep I,EXP_05,5 ervaringsjaren,11,2%,8,MANUAL,RETAIL_STEP_2_PERCENT,2.00,"Beoordelingsafhankelijke tredeverhoging van 2%","Zeer goed of uitmuntend functioneren",Bijlage 1a p. 29',
    ].join('\n'), { ...metadata, salaryBasis: 'HOURLY' })

    expect(result.errors).toEqual([])
    expect(result.rows.map((row) => row.fulltimeAmount)).toEqual(['15.44', '15.75', '16.06'])
    expect(result.rows[1]?.sourceRule).toMatchObject({ sourceCell: '2%', percentage: '2.00' })
    expect(result.draft?.structureType === 'SCALE_WITH_STEPS' && result.draft.scales[0]?.steps.map((step) => step.hourlyAmount))
      .toEqual(['15.4400', '15.7500', '16.0600'])
    expect(result.draft?.sourceMetadata).toMatchObject({
      stepRules: [{ code: 'RETAIL_STEP_2_PERCENT', percentage: '2.00', automaticallyApplied: false }],
      stepAdjustments: [
        { stepCode: 'EXP_04', basedOnStepCode: 'EXP_03', sourceCell: '2%', calculatedAmount: '15.75', calculationMethod: 'PREVIOUS_RATE_PERCENT_ROUNDED_HALF_UP_TO_CENT' },
        { stepCode: 'EXP_05', basedOnStepCode: 'EXP_04', sourceCell: '2%', calculatedAmount: '16.06', calculationMethod: 'PREVIOUS_RATE_PERCENT_ROUNDED_HALF_UP_TO_CENT' },
      ],
    })
  })

  it('rejects percentage cells without complete source metadata or a preceding published rate', () => {
    const missingRule = parseSalaryTableImport('scale_code,scale_name,step_code,step_name,step_order,amount\nI,Functiegroep I,EXP_01,1 ervaringsjaar,1,2%', { ...metadata, salaryBasis: 'HOURLY' })
    const missingPredecessor = parseSalaryTableImport([
      'scale_code,scale_name,step_code,step_name,step_order,amount,source_rule_code,source_rule_percent,source_rule_description,source_rule_condition,source_rule_reference',
      'I,Functiegroep I,EXP_01,1 ervaringsjaar,1,2%,RETAIL_STEP_2_PERCENT,2.00,Regel,Beoordeling,Bijlage 1a p. 29',
    ].join('\n'), { ...metadata, salaryBasis: 'HOURLY' })

    expect(missingRule.errors).toContain('CSV_ROW_2_PERCENT_RULE_METADATA_INVALID')
    expect(missingPredecessor.errors).toContain('CSV_ROW_2_PERCENT_RULE_PREDECESSOR_MISSING')
  })

  it('retains published euro amounts while recording a separate percentage source rule', () => {
    const result = parseSalaryTableImport([
      'scale_code,scale_name,step_code,step_name,step_order,amount,progression_type,source_rule_code,source_rule_percent,source_rule_description,source_rule_condition,source_rule_reference',
      'MODE_F,Functiegroep F,EXP_09,9 ervaringsjaren,9,20.11,TIME_IN_STEP,,,,,',
      'MODE_F,Functiegroep F,EXP_10,10 ervaringsjaren,10,20.51,TIME_IN_STEP,RETAIL_REVIEWED_STEP_2_PERCENT,2.00,"Beoordelingsafhankelijke tredeverhoging van 2%","Zeer goed of uitmuntend functioneren",Bijlage 1a p. 29',
      'MODE_F,Functiegroep F,EXP_11,11 ervaringsjaren,11,20.92,MANUAL,RETAIL_REVIEWED_STEP_2_PERCENT,2.00,"Beoordelingsafhankelijke tredeverhoging van 2%","Zeer goed of uitmuntend functioneren",Bijlage 1a p. 29',
    ].join('\n'), { ...metadata, salaryBasis: 'HOURLY' })

    expect(result.errors).toEqual([])
    expect(result.rows.map((row) => row.fulltimeAmount)).toEqual(['20.11', '20.51', '20.92'])
    expect(result.rows[1]?.sourceRule).toEqual({
      sourceCell: '2.00%',
      percentage: '2.00',
      description: 'Beoordelingsafhankelijke tredeverhoging van 2%',
    })
    expect(result.draft?.sourceMetadata).toMatchObject({
      stepRules: [{ code: 'RETAIL_REVIEWED_STEP_2_PERCENT', automaticallyApplied: false }],
      stepAdjustments: [
        { stepCode: 'EXP_10', basedOnStepCode: 'EXP_09', calculatedAmount: '20.51', calculationMethod: 'SOURCE_TABLE_PUBLISHED_AMOUNT' },
        { stepCode: 'EXP_11', basedOnStepCode: 'EXP_10', calculatedAmount: '20.92', calculationMethod: 'SOURCE_TABLE_PUBLISHED_AMOUNT' },
      ],
    })
    expect(result.draft?.structureType === 'SCALE_WITH_STEPS' && result.draft.scales[0]?.steps.map((step) => step.hourlyAmount))
      .toEqual(['20.1100', '20.5100', '20.9200'])
  })

  it('validates all four official Kinderopvang versions and the January minimum-wage update', () => {
    const verification = JSON.parse(readFileSync(new URL('../../../../docs/quality/acceptance/runs/PAYROLL-CORE-RESET-01/source-data/source-verification.json', import.meta.url), 'utf8')) as {
      title: string
      officialSourceUrl: string
      sourceFileName: string
      localSourceFile: string
      sourceSha256: string
      versions: Array<{ effectiveFrom: string; effectiveTo: string; rowCount: number; csvSha256: string }>
      checks: {
        changedRowsJanuary2026VsJuly2025: number
        scale6Number12September2026EUR: number
        scale6Number20September2026EUR: number
      }
    }
    const sourcePdf = readFileSync(new URL(`../../../../docs/quality/acceptance/runs/PAYROLL-CORE-RESET-01/source-data/${verification.localSourceFile}`, import.meta.url))
    expect(createHash('sha256').update(sourcePdf).digest('hex')).toBe(verification.sourceSha256)
    const results = verification.versions.map((version) => {
      const fileName = `cao-kinderopvang-${version.effectiveFrom}.csv`
      const csv = readFileSync(new URL(`../../../../docs/quality/acceptance/runs/PAYROLL-CORE-RESET-01/source-data/${fileName}`, import.meta.url), 'utf8')
      expect(createHash('sha256').update(csv).digest('hex')).toBe(version.csvSha256)
      const result = parseSalaryTableImport(csv, {
        effectiveFrom: version.effectiveFrom,
        effectiveTo: version.effectiveTo,
        salaryBasis: 'MONTHLY_BASE',
        sourceTitle: verification.title,
        sourceVersion: version.effectiveFrom,
        sourceUrl: verification.officialSourceUrl,
        sourceSha256: verification.sourceSha256,
        sourceFileName: verification.sourceFileName,
      })
      expect(result.errors).toEqual([])
      expect(result.rows).toHaveLength(version.rowCount)
      expect(result.draft?.structureType).toBe('SCALE_WITH_STEPS')
      if (result.draft?.structureType !== 'SCALE_WITH_STEPS') throw new Error('Expected a scale-and-step salary structure.')
      expect(result.draft.scales).toHaveLength(15)
      expect(result.draft?.sourceMetadata).toMatchObject({
        effectiveFrom: version.effectiveFrom,
        effectiveTo: version.effectiveTo,
        sha256: verification.sourceSha256,
        rowCount: version.rowCount,
      })
      return result
    })

    expect(results.flatMap((result) => result.rows)).toHaveLength(784)
    const julyAmounts = new Map(results[1]?.rows.map((row) => [`${row.scaleCode}/${row.stepCode}`, row.fulltimeAmount]))
    const januaryChanges = (results[2]?.rows ?? []).filter((row) => julyAmounts.get(`${row.scaleCode}/${row.stepCode}`) !== row.fulltimeAmount)
    expect(januaryChanges).toHaveLength(verification.checks.changedRowsJanuary2026VsJuly2025)
    expect(januaryChanges.every((row) => ['1', '2', '3', '4'].includes(row.scaleCode))).toBe(true)
    expect(results[3]?.rows.find((row) => row.scaleCode === '6' && row.stepCode === '12')?.fulltimeAmount)
      .toBe(verification.checks.scale6Number12September2026EUR.toFixed(2))
    expect(results[3]?.rows.find((row) => row.scaleCode === '6' && row.stepCode === '20')?.fulltimeAmount)
      .toBe(verification.checks.scale6Number20September2026EUR.toFixed(2))
  })

  it('records the official Kinderopvang Sunday premium, salary-number cap and exclusions', () => {
    const verification = JSON.parse(readFileSync(new URL('../../../../docs/quality/acceptance/runs/PAYROLL-CORE-RESET-01/source-data/source-verification.json', import.meta.url), 'utf8')) as {
      agreementSource: { localSourceFile: string; sourceSha256: string }
    }
    const rule = JSON.parse(readFileSync(new URL('../../../../docs/quality/acceptance/runs/PAYROLL-CORE-RESET-01/source-data/cao-kinderopvang-werkurentoeslag-2025-2026.json', import.meta.url), 'utf8')) as {
      source: { localFile: string; sha256: string }
      eligibility: {
        employerInstructionRequired: boolean
        excludedSalaryScales: { fromInclusive: number }
        excludedRoleAndSchedule: { condition: string }
      }
      premiumSchedule: Array<{ days: string; percentage?: string; applicable: boolean }>
      calculationBase: { maximumBasis: string }
    }
    const agreementPdf = readFileSync(new URL(`../../../../docs/quality/acceptance/runs/PAYROLL-CORE-RESET-01/source-data/${verification.agreementSource.localSourceFile}`, import.meta.url))
    expect(createHash('sha256').update(agreementPdf).digest('hex')).toBe(verification.agreementSource.sourceSha256)
    expect(rule.source).toMatchObject({ localFile: verification.agreementSource.localSourceFile, sha256: verification.agreementSource.sourceSha256 })
    expect(rule.premiumSchedule.filter((entry) => entry.days === 'SUNDAY_AND_PUBLIC_HOLIDAYS').map((entry) => entry.percentage))
      .toEqual(['45.00', '45.00'])
    expect(rule.calculationBase.maximumBasis).toContain('salary number 18')
    expect(rule.eligibility.employerInstructionRequired).toBe(true)
    expect(rule.eligibility.excludedSalaryScales.fromInclusive).toBe(11)
    expect(rule.eligibility.excludedRoleAndSchedule.condition).toContain('primary childcare process')
  })

  it('validates all four official Retail branch tables and keeps every percentage cell out of the euro input', () => {
    const retailMetadata: SalaryTableImportMetadata = {
      effectiveFrom: '2026-07-01',
      effectiveTo: '2026-12-31',
      salaryBasis: 'HOURLY',
      sourceTitle: 'CAO Retail Non-Food 2026-2027, bijlage 1b - loonregels per branche',
      sourceVersion: '2026-07',
      sourceUrl: 'https://www.inretail.nl/wp-content/uploads/2026/05/260527-Cao-Retail-Non-Food-juli-2026-def.pdf',
      sourceSha256: 'ec6fd7a8ee7c3b1f18f58ac6cc5081d6a72e053405480e346eb8a4c7d1e1d2cc',
      sourceFileName: 'cao-retail-non-food-2026-07.pdf',
    }
    const files = [
      'cao-retail-mode-2026-07.csv',
      'cao-retail-sport-en-schoenen-2026-07.csv',
      'cao-retail-tuincentra-2026-07.csv',
      'cao-retail-wonen-2026-07.csv',
    ]
    const results = files.map((file) => parseSalaryTableImport(
      readFileSync(new URL(`../../../../docs/quality/acceptance/runs/PAYROLL-CORE-RESET-01/source-data/${file}`, import.meta.url), 'utf8'),
      retailMetadata,
    ))
    const rows = results.flatMap((result) => result.rows)
    const rules = rows.filter((row) => row.sourceRule !== null)
    const amounts = rows.filter((row) => row.sourceRule === null)
    const allSteps = results.flatMap((result) => result.draft?.structureType === 'SCALE_WITH_STEPS' ? result.draft.scales.flatMap((scale) => scale.steps) : [])
    const verification = JSON.parse(readFileSync(new URL('../../../../docs/quality/acceptance/runs/PAYROLL-CORE-RESET-01/source-data/retail-non-food-2026-07-verification.json', import.meta.url), 'utf8')) as {
      branches: Array<{ stepAdjustments: Array<{ scaleCode: string; stepCode: string; calculatedAmount: string }> }>
    }
    const expectedAdjustments = verification.branches.flatMap((branch) => branch.stepAdjustments)
      .map(({ scaleCode, stepCode, calculatedAmount }) => ({ scaleCode, stepCode, calculatedAmount }))
    const actualAdjustments = results.flatMap((result) => result.draft?.sourceMetadata?.stepAdjustments ?? [])
      .map(({ scaleCode, stepCode, calculatedAmount }) => ({ scaleCode, stepCode, calculatedAmount }))

    expect(results.flatMap((result) => result.errors)).toEqual([])
    expect(rows).toHaveLength(577)
    expect(amounts).toHaveLength(427)
    expect(rules).toHaveLength(150)
    expect(allSteps).toHaveLength(577)
    expect(results.reduce((total, result) => total + (result.draft?.structureType === 'SCALE_WITH_STEPS' ? result.draft.scales.length : 0), 0)).toBe(36)
    expect(allSteps.every((step) => step.progressionType === 'MANUAL')).toBe(true)
    expect(results.every((result) => result.draft?.sourceMetadata?.stepRules?.every((rule) => rule.automaticallyApplied === false))).toBe(true)
    expect(results.flatMap((result) => result.draft?.sourceMetadata?.stepAdjustments ?? [])).toHaveLength(150)
    expect(actualAdjustments).toEqual(expectedAdjustments)
    expect(results[0]?.rows.find((row) => row.scaleCode === 'MODE_I' && row.stepCode === 'EXP_15')?.fulltimeAmount).toBe('28.95')
    expect(results[0]?.rows.find((row) => row.scaleCode === 'MODE_C' && row.stepCode === 'EXP_01')?.fulltimeAmount).toBe('15.44')
    expect(results[2]?.rows.find((row) => row.scaleCode === 'TUINCENTRA_I' && row.stepCode === 'EXP_15')?.fulltimeAmount).toBe('28.72')
  })

  it('requires a source file whose hash is captured before a table can be saved', () => {
    const result = parseSalaryTableImport([
      'scale_code,scale_name,step_code,step_name,step_order,amount',
      '6,Schaal 6,12,Salarisnummer 12,12,2819',
    ].join('\n'), { ...metadata, sourceFileName: '' })

    expect(result.draft).toBeNull()
    expect(result.errors).toContain('SOURCE_FILE_REQUIRED')
  })
})
