import { describe, expect, it } from 'vitest'
import type { SalaryStructureCatalog } from '@/lib/salary-structures/service'
import { CAO_SETUP_CATALOG } from './cao-setup-catalog'
import type { CaoSetupPensionMapping, CaoSetupPensionRecord } from './cao-setup-service'
import { buildCaoSetupCompleteness } from './cao-setup-completeness'

const condition = {
  id: 'condition-kinderopvang',
  name: 'Cao Kinderopvang 2025–2026 · 2026.09',
  code: 'CAO_KINDEROPVANG_2025_2026_2026_09',
  standardHoursPerWeek: 36,
  probationMaximumMonths: 1 as const,
  validFrom: '2026-09-01',
  predecessorId: null,
  isActive: true,
}

const pension: CaoSetupPensionRecord = {
  id: 'pension-pfzw',
  code: 'PFZW_2026_KINDEROPVANG',
  name: 'PFZW — Kinderopvang',
  arrangementType: 'FLAT_PREMIUM',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  flatTotalRate: 25.9,
  employeeSharePct: 49.8069,
  employerSharePct: 50.1931,
  annualFranchise: 17283,
  annualPensionableSalaryCap: 137800,
  pensionableSalaryDefinition: {
    provider: 'PFZW',
    sourceReference: 'https://www.pfzw.nl/werkgevers/premie-en-factuur/premiepercentages-en-franchises.html',
    method: 'pensionable salary minus franchise',
    partTimeMethod: 'contract hours / full-time hours',
    partMonthMethod: 'calendar-day proportion',
  },
  components: [{
    code: 'PFZW_OP_NP', name: 'OP/NP', componentType: 'BASE', effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31',
    basisCode: 'UPA_REGLN_AFTER_FRANCHISE_AND_CAP', basisDescription: 'RegLn less franchise, capped before part-time factor.',
    totalRate: 25.9, employeeRate: 12.9, employerRate: 13, annualFranchise: 17283, annualPensionableSalaryCap: 137800,
    eligibilityRule: 'Applicable PFZW participation.', calculationMethod: 'Annual share divided into monthly periods.',
    roundingRule: 'Half-up to cents per share.', sourceVersion: 'PFZW 2026',
    sourceReference: 'https://www.pfzw.nl/werkgevers/premie-en-factuur/premiepercentages-en-franchises.html', sourceSha256: 'b'.repeat(64),
    sourceValidationStatus: 'VERIFIED_SOURCE', taxTreatment: 'PRE_TAX_EMPLOYEE_DEDUCTION',
  }, {
    code: 'PFZW_WIA_EXCESS', name: 'WIA-excedent', componentType: 'ADDITIONAL', effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31',
    basisCode: 'UPA_REGLN_WITHOUT_OPNP_CAP', basisDescription: 'RegLn less WIA-excedent franchise, without the OP/NP salary cap.',
    totalRate: 3.4, employeeRate: 0, employerRate: 3.4, annualFranchise: 79409, annualPensionableSalaryCap: null,
    eligibilityRule: 'Applicable PFZW participation and WIA-excedent conditions.', calculationMethod: 'Annual employer-only share divided into monthly periods.',
    roundingRule: 'Half-up to cents for the employer share.', sourceVersion: 'PFZW 2026',
    sourceReference: 'https://www.pfzw.nl/werkgevers/premie-en-factuur/premiepercentages-en-franchises.html', sourceSha256: 'c'.repeat(64),
    sourceValidationStatus: 'VERIFIED_SOURCE', taxTreatment: 'EMPLOYER_COST_ONLY',
  }],
  eligibilityRule: { description: 'Participation follows the applicable PFZW conditions.' },
  sourceStatus: 'VALIDATED',
  sourceJson: { legalFiscalStatus: 'VALIDATED' },
  versionNumber: 1,
  currentVersionId: 'pension-pfzw-version-1',
  successorDraft: null,
  integrityHash: 'a'.repeat(64),
}

const mapping: CaoSetupPensionMapping = {
  id: 'mapping-pfzw',
  laborConditionSetId: condition.id,
  pensionArrangementId: pension.id,
  participantGroup: 'NEW_ENTRANT',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  versionNumber: 1,
  sourceStatus: 'VALIDATED',
}

const salaryCatalog = {
  structures: [{ id: 'salary-structure', name: 'Kinderopvang salaristabel', code: 'KO-2026' }],
  revisions: [{ salary_structure_id: 'salary-structure', effective_from: '2026-09-01', status: 'PUBLISHED' }],
  laborConditionRelations: [{ labor_condition_set_id: condition.id, salary_structure_id: 'salary-structure' }],
} as unknown as SalaryStructureCatalog

describe('cao setup completeness', () => {
  it('keeps missing Core sources visible and does not infer payroll readiness', () => {
    const records = buildCaoSetupCompleteness({
      catalog: CAO_SETUP_CATALOG,
      laborConditionTimelines: [],
      salaryStructureCatalog: null,
      pensions: [],
      pensionMappings: [],
    })
    const kinderopvang = records.find((record) => record.packageId === 'KINDEROPVANG_2025_2026')
    expect(kinderopvang).toBeDefined()
    expect(kinderopvang?.payrollReady).toBe(false)
    expect(kinderopvang?.blockers).toEqual(expect.arrayContaining(['core_regulation', 'pension_provider', 'pension_mapping']))
  })

  it('shows the stored Core fields while keeping catalogue-only legal validation open', () => {
    const records = buildCaoSetupCompleteness({
      catalog: CAO_SETUP_CATALOG,
      laborConditionTimelines: [{ id: condition.id, name: condition.name, code: condition.code, versions: [condition] }],
      salaryStructureCatalog: salaryCatalog,
      pensions: [pension],
      pensionMappings: [mapping],
    })
    const kinderopvang = records.find((record) => record.packageId === 'KINDEROPVANG_2025_2026')
    expect(kinderopvang).toMatchObject({ payrollReady: false, effectiveFrom: '2026-09-01', completenessPercent: expect.any(Number) })
    expect(kinderopvang?.fields.find((field) => field.key === 'pension_mapping')).toMatchObject({ status: 'RECORDED', source: 'CORE' })
    expect(kinderopvang?.fields.find((field) => field.key === 'pension_components')).toMatchObject({ status: 'RECORDED', source: 'CORE' })
    expect(kinderopvang?.fields.find((field) => field.key === 'catalog_source_validation')).toMatchObject({ status: 'REVIEW_REQUIRED', source: 'CATALOG' })
    expect(kinderopvang?.integrityHash).toHaveLength(64)
  })

  it('inventories unmatched company conditions and stored pension arrangements separately', () => {
    const marsCondition = { ...condition, id: 'condition-mars', name: 'Mars BV bedrijfseigen voorwaarden', code: 'MARS_EIGEN_2026' }
    const marsPension = { ...pension, id: 'pension-mars', code: 'MARS-PENSION-2026', name: 'Mars pensioen 2026' }
    const records = buildCaoSetupCompleteness({
      catalog: [],
      laborConditionTimelines: [{ id: marsCondition.id, name: marsCondition.name, code: marsCondition.code, versions: [marsCondition] }],
      salaryStructureCatalog: null,
      pensions: [marsPension],
      pensionMappings: [],
    })
    expect(records.map((record) => record.kind)).toEqual(['COMPANY_POLICY', 'PENSION_ARRANGEMENT'])
  })
})
