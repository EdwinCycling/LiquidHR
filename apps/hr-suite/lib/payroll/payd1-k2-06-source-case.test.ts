import { describe, expect, it } from 'vitest'
import {
  buildCalculationInputs,
  calculatePayroll,
  sha256,
  stableSerialize,
  type PayrollSourceSnapshot,
} from '@liquid-hr/payroll-engine'
import {
  createPayrun01RulePackage,
  PFZW_2026_MONTHLY_ALLOCATION_TEST_APPROVED_VERSION,
  PAYRUN01_RULE_REGISTRY,
} from '@liquid-hr/payroll-rules-nl-2026'
import type { ActualWorkPayrollProjection } from '@/lib/actual-work/actual-work-service'
import {
  LiquidHrPayrollSourceProvider,
  type PayrollSourceEmployment,
  type PayrollSourceIncomeRelationship,
  type PayrollSourceProviderDependencies,
  type PayrollSourceSchedule,
  type PayrollSourceSalary,
  type PayrollSourceSetup,
  type PayrollSourceTaxProfileProjection,
  type PayrollSourceTimeline,
} from './source/liquid-hr-source-provider'
import { assertActivePayrollEmployerConfiguration, hashPayrollEmployerConfiguration } from './payroll-setup'
import { hashPayrollSourceSnapshot } from './source/snapshot-hash'
import {
  LIQUIDHR_STANDARD_PAYSLIP_TEMPLATE_ID,
  renderPayrun01PayslipPdf,
  type Payrun01PayslipPdfInput,
} from './payrun01-payslip-pdf'
import { derivePayd1K2IndependentOracle } from './payrun01-k2-independent-oracle'

/** Exact official-source payload hashes retrieved on 2026-10-22. Employer and employee inputs below remain synthetic. */
export const PAYD1_K2_06_OFFICIAL_SOURCE_PINS = {
  cao: {
    version: 'Cao Kinderopvang 2025-2026 integrale versie',
    appliesFrom: '2025-01-01',
    appliesThrough: '2026-12-31',
    salaryTableEffectiveFrom: '2026-09-01',
    url: 'https://www.kinderopvang-werkt.nl/sites/fcb_kinderopvang/files/2025-06/Cao-Kinderopvang-2025-2026-integraal.pdf',
    sha256: '9070e0be5a2e5bd2252fc030bed3bfb3fe3767e0d1c72e36824813042222c4be',
  },
  oakPfzwRates: {
    version: 'OAK/PFZW premies 2026, gepubliceerd 2026-01-05',
    appliesFrom: '2026-01-01',
    appliesThrough: '2026-12-31',
    url: 'https://www.kinderopvang-werkt.nl/nieuws/pensioenpremies-2026',
    sha256: '80f08da9c57aa6a87ab6306d2311fbd69f0a19a983c4ae1bd1784e4c18569166',
  },
  pfzwUpa: {
    version: 'PFZW Handleiding aanlevering UPA-gegevens januari 2026 v5.0',
    appliesFrom: '2026-01-01',
    appliesThrough: '2026-12-31',
    url: 'https://www.pfzw.nl/content/dam/pfzw/web/werkgevers/pensioenaangifte/2026_Handleiding-aanlevering-UPA-gegevens.pdf',
    sha256: 'cc5a5389da231d122b4d44697a82fc08a58205660d090356fa449a2740c7d682',
  },
  pfzwFormula: {
    version: 'PFZW premie berekenen, officiële werkgeversuitleg opgehaald 2026-10-22',
    appliesFrom: '2026-01-01',
    appliesThrough: '2026-12-31',
    url: 'https://www.pfzw.nl/werkgevers/premie-en-factuur/premie-berekenen/hoe-bereken-ik.html',
    sha256: 'f248520ad7e83a629ffea954a6f6e4b213ac3dd5adafec8547724dd15fc80a8c',
  },
  paww: {
    version: 'PAWW bijdrage berekening v2.1, 2025-12-18',
    appliesFrom: '2026-01-01',
    appliesThrough: '2026-12-31',
    url: 'https://spaww.nl/files/secured/documents/berekening-bijdrage-paww-2026-rekenregels.pdf?inline=1',
    sha256: 'f40ef442d5d6b58cf5683bfcdcf7ecc539957a2073e60072f435dfc4d01c9641',
  },
  wageTaxTable: {
    version: 'Belastingdienst Witte maandloon-tabel NL standaard v01, januari 2026',
    appliesFrom: '2026-01-01',
    appliesThrough: '2026-12-31',
    url: 'https://download.belastingdienst.nl/belastingdienst/dl/rekenhulpen/loonheffing/2026/v01/pdf/wit_mnd_nl_std_20260101.pdf',
    sha256: 'c959d65273e18a1a2fdf33562fd34e31d45d3bca0f260ea232815d28e69284dc',
  },
  wageTaxHandbook: {
    version: 'Belastingdienst Handboek Loonheffingen 2026, versie maart 2026',
    appliesFrom: '2026-01-01',
    appliesThrough: '2026-12-31',
    url: 'https://download.belastingdienst.nl/belastingdienst/docs/handboek-loonheffingen-lh0221t61fd.pdf',
    sha256: '7576eeaab3c4365e768892b343d89bc1ab8018e8f50659c067e4e5fe33c78120',
  },
} as const

const ids = {
  tenant: '16000000-0000-4000-8000-000000000061',
  group: '26000000-0000-4000-8000-000000000062',
  administration: '36000000-0000-4000-8000-000000000063',
  employee: '46000000-0000-4000-8000-000000000064',
  employment: '56000000-0000-4000-8000-000000000065',
  salary: '66000000-0000-4000-8000-000000000066',
  schedule: '76000000-0000-4000-8000-000000000067',
  incomeLink: '86000000-0000-4000-8000-000000000068',
  incomeRelationship: '96000000-0000-4000-8000-000000000069',
  taxProfile: 'a6000000-0000-4000-8000-000000000070',
  contract: 'b6000000-0000-4000-8000-000000000071',
  laborSet: 'c6000000-0000-4000-8000-000000000072',
  laborCondition: 'd6000000-0000-4000-8000-000000000073',
  organization: 'e6000000-0000-4000-8000-000000000074',
  job: 'f6000000-0000-4000-8000-000000000075',
  pensionMapping: '17000000-0000-4000-8000-000000000076',
  pensionVersion: '27000000-0000-4000-8000-000000000077',
  pensionAssignment: '37000000-0000-4000-8000-000000000078',
  employerConfiguration: '47000000-0000-4000-8000-000000000079',
  openingCumulative: '57000000-0000-4000-8000-000000000080',
  actualWorkPeriod: '67000000-0000-4000-8000-000000000081',
} as const

const scope = { tenantId: ids.tenant, hrGroupId: ids.group, administrationId: ids.administration }
const employment: PayrollSourceEmployment = {
  id: ids.employment,
  tenant_id: ids.tenant,
  hr_group_id: ids.group,
  administration_id: ids.administration,
  employee_id: ids.employee,
  starts_on: '2026-09-01',
  ends_on: null,
  record_status: 'CONFIRMED' as PayrollSourceEmployment['record_status'],
  employment_type: 'REGULAR' as PayrollSourceEmployment['employment_type'],
  contract_type: 'PERMANENT' as PayrollSourceEmployment['contract_type'],
  original_hire_date: '2026-09-01',
  seniority_date: '2026-09-01',
  updated_at: '2026-09-01T09:00:00.000Z',
  deleted_at: null,
}
const salary: PayrollSourceSalary = {
  id: ids.salary,
  salary_basis: 'CAO_SCALE' as PayrollSourceSalary['salary_basis'],
  salary_route: 'SCALE_WITH_STEPS' as PayrollSourceSalary['salary_route'],
  payment_type: 'PERIODIC_FIXED' as PayrollSourceSalary['payment_type'],
  payment_frequency: 'MONTHLY' as PayrollSourceSalary['payment_frequency'],
  currency_code: 'EUR',
  fulltime_amount: 2819,
  parttime_amount: 2505.78,
  hourly_rate: null,
  salary_structure_id: '77000000-0000-4000-8000-000000000072',
  salary_scale_id: '78000000-0000-4000-8000-000000000072',
  salary_scale_step_id: '79000000-0000-4000-8000-000000000072',
  salary_step_code: '12',
  cao_scale_name: 'Schaal 6',
  cao_step_name: 'Salarisnummer 12',
  salary_band_id: null,
  valid_from: '2026-09-01',
  valid_until: null,
  updated_at: '2026-09-01T09:05:00.000Z',
}
const schedule: PayrollSourceSchedule = {
  id: ids.schedule,
  average_days_per_week: 4,
  average_hours_per_week: 32,
  fulltime_hours_per_week: 36,
  part_time_factor: 0.8889,
  schedule_type: 'HOURS_PER_DAY',
  is_on_call: false,
  valid_from: '2026-09-01',
  valid_until: null,
  updated_at: '2026-09-01T09:10:00.000Z',
}
const incomeRelationship: PayrollSourceIncomeRelationship = {
  id: ids.incomeLink,
  incomeRelationshipId: ids.incomeRelationship,
  validFrom: '2026-09-01',
  validUntil: null,
  linkUpdatedAt: '2026-09-01T09:15:00.000Z',
  reportingStatus: 'READY',
  startsOn: '2026-09-01',
  endsOn: null,
  incomeRelationshipUpdatedAt: '2026-09-01T09:20:00.000Z',
}

const taxProfile: PayrollSourceTaxProfileProjection['taxProfiles'][number] = {
  id: ids.taxProfile,
  employee_id: ids.employee,
  employment_id: ids.employment,
  income_relationship_id: ids.incomeRelationship,
  employment_income_relationship_id: ids.incomeLink,
  residence_country_code: 'NL',
  wage_tax_table: 'WHITE',
  herleiding_code: 'STD',
  time_period: 'MONTH',
  regular_wage_only: true,
  full_period_only: true,
  has_special_situation: false,
  payroll_tax_credit_applies: true,
  source_classification: 'HR_ADMIN_CONFIRMED',
  source_reference: 'SYNTHETIC_FIXTURE:PAYD1-K2-06; no Core record was written',
  effective_from: '2026-09-01',
  effective_to: null,
  version_number: 1,
  supersedes_profile_id: null,
  confirmed_by_user_id: ids.employee,
  confirmed_at: '2026-09-01T09:30:00.000Z',
  created_at: '2026-09-01T09:30:00.000Z',
}
const taxProjection: PayrollSourceTaxProfileProjection = {
  ageCategory: 'UNDER_AOW',
  ageSourceUpdatedAt: '2026-09-01T09:25:00.000Z',
  activeIncomeRelationshipCount: 1,
  incomeRelationshipLinkGap: false,
  incomeRelationships: [{
    id: ids.incomeRelationship,
    updatedAt: incomeRelationship.incomeRelationshipUpdatedAt,
    reportingStatus: 'READY',
    ikvNumber: 1,
    startsOn: '2026-09-01',
    endsOn: null,
  }],
  taxProfiles: [taxProfile],
}

const pensionMapping = {
  id: ids.pensionMapping,
  labor_condition_set_id: ids.laborSet,
  pension_arrangement_id: '87000000-0000-4000-8000-000000000076',
  participant_group: 'NEW_ENTRANT',
  effective_from: '2026-01-01',
  effective_to: '2026-12-31',
  provenance_json: { status: 'USER_RECORDED', sourceClassification: 'SYNTHETIC_FIXTURE', fixtureId: 'PAYD1-K2-06' },
  version_number: 1,
  supersedes_mapping_id: null,
  arrangement: null,
  arrangement_resolution_reason: null,
  arrangement_resolution_change_version_ids: [],
} satisfies NonNullable<PayrollSourceTimeline['laborConditionPensionArrangements']>[number]

const pensionAssignment = {
  id: ids.pensionAssignment,
  pension_arrangement_id: pensionMapping.pension_arrangement_id,
  effective_from: '2026-01-01',
  effective_to: '2026-12-31',
  participation_start_date: '2026-09-01',
  assignment_reason: 'SYNTHETIC_TEST_FIXTURE',
  provenance_json: {
    status: 'USER_RECORDED',
    sourceClassification: 'SYNTHETIC_FIXTURE',
    fixtureId: 'PAYD1-K2-06',
    laborConditionMappingId: pensionMapping.id,
    laborConditionMappingVersion: pensionMapping.version_number,
  },
  updated_at: '2026-09-01T09:35:00.000Z',
  version_number: 1,
  supersedes_assignment_id: null,
  age_for_tier: null,
  arrangement_resolution_reason: null,
  arrangement_resolution_change_version_ids: [],
  arrangement: {
    id: pensionMapping.pension_arrangement_id,
    code: 'PFZW_2026_KINDEROPVANG',
    name: 'PFZW Kinderopvang 2026 — synthetische testbron',
    arrangement_type: 'FLAT_PREMIUM',
    effective_from: '2026-01-01',
    arrangement_established_from: '2026-01-01',
    effective_to: '2026-12-31',
    transition_date: null,
    grandfathering_mode: 'NONE',
    flat_total_rate: null,
    employer_share_pct: 0,
    employee_share_pct: 0,
    annual_franchise: 17283,
    annual_pensionable_salary_cap: 137800,
    pensionable_salary_definition: {
      method: 'PFZW_2026_KINDEROPVANG',
      annualization: '12_X_REGULAR_MONTHLY_PENSIONABLE_SALARY',
      basis: 'ANNUAL_PENSIONABLE_SALARY_MINUS_FRANCHISE',
      floorAtZero: true,
      components: [
        { code: 'PFZW_OP_NP_2026', componentType: 'BASE', totalRate: 25.9, employeeRate: 12.9, employerRate: 13.0 },
        { code: 'PFZW_WIA_EXCEDENT_2026', componentType: 'ADDITIONAL', totalRate: 3.4, employeeRate: 0, employerRate: 3.4 },
      ],
      pfzw2026: {
        monthlyPaymentsPerYear: 12,
        holidayAllowancePercent: '8.00',
        structuralYearEndAllowancePercent: '5.50',
        structuralYearEndAllowanceReferenceDate: '2025-12-31',
        structuralYearEndAllowanceEligibleAnnualBase: '33828.00',
        structuralYearEndAllowanceSourceReference: PAYD1_K2_06_OFFICIAL_SOURCE_PINS.cao.url,
        structuralYearEndAllowanceSourceVersion: 'Cao Kinderopvang 2025-2026 §5.7 (2025=5.5%, 2026=8%) and PFZW UPA 2026 v5.0',
        additionalStructuralSalaryComponents: [],
        additionalWorkedHours: '0.0000',
        additionalHoursUpliftEvidence: 'NOT_APPLICABLE',
        monthlyAllocationPolicyStatus: 'SYNTHETIC_TEST_APPROVED',
        monthlyAllocationPolicyVersion: PFZW_2026_MONTHLY_ALLOCATION_TEST_APPROVED_VERSION,
        monthlyAllocationPolicySourceReference: 'SYNTHETIC_TEST_POLICY:PAY-RULE-002; PAYD1-K2-06 fixture arithmetic only; annual shares divided by 12 and rounded separately HALF_UP to cents; not employer-confirmed',
      },
    },
    eligibility_rule: { participantGroup: 'NEW_ENTRANT', employmentOrParticipationStartOnOrAfter: '2026-01-01' },
    contract_classification: 'SOLIDARITY' as const,
    contract_classification_provenance: { status: 'SYNTHETIC_FIXTURE', fixtureId: 'PAYD1-K2-06' },
    provenance_json: { status: 'SYNTHETIC_FIXTURE', fixtureId: 'PAYD1-K2-06' },
    is_active: true,
    version_id: ids.pensionVersion,
    version_number: 1,
    version_created_at: '2026-01-01T00:00:00.000Z',
    source_updated_at: '2026-01-01T00:00:00.000Z',
    tiers: [],
  },
} satisfies NonNullable<PayrollSourceTimeline['pensionAssignments']>[number]

const configuration = assertActivePayrollEmployerConfiguration({
  schemaVersion: 'payroll-employer-configuration-v1',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  status: 'ACTIVE',
  sourceReference: 'SYNTHETIC_FIXTURE:PAYD1-K2-06; fictional Jupiter BV employer settings',
  employer: {
    sectorCode: '999',
    whkDecisionReference: 'SYNTHETIC-WHK-2026-K2-06',
    awfClassification: 'LOW',
    aofClassification: 'AOF-01',
    wkoClassification: 'WKO-01',
    zvwClassification: 'EMPLOYER_LEVY',
  },
  employerRates: { awf: '2.74', aof: '6.27', wko: '0.50', whk: '1.81', zvw: '6.10' },
  reserves: { holidayAllowanceRate: '8.00', yearEndApplies: true, yearEndRate: '8.00' },
  pension: {
    partialMonthMethod: 'CALENDAR_DAYS_PRO_RATA',
    methodSourceReference: 'SYNTHETIC_FIXTURE:PAYD1-K2-06; full calendar month in calculation period',
  },
})
const openingCumulative = {
  schemaVersion: 'payroll-opening-cumulative-v1',
  sourcePeriodFrom: '2026-09-01',
  sourcePeriodTo: '2026-10-31',
  asOfDate: '2026-10-31',
  meaning: {
    grossWageBeforePeriod: '5027.56',
    holidayReserveBeforePeriod: '400.92',
    yearEndReserveBeforePeriod: '400.92',
    taxableWageBeforePeriod: '4619.06',
    wageTaxBeforePeriod: '241.84',
    employeeInsuranceWageBeforePeriod: '4619.06',
    zvwWageBeforePeriod: '4619.06',
  },
  sourceReference: 'SYNTHETIC_FIXTURE:PAYD1-K2-06; two consistent simulated monthly histories for September and October',
}
const configurationRow = {
  id: ids.employerConfiguration,
  payroll_administration_id: ids.administration,
  source_tenant_id: ids.tenant,
  source_hr_group_id: ids.group,
  source_administration_id: ids.administration,
  configuration_version: 1,
  effective_from: '2026-01-01',
  effective_to: null,
  configuration_json: configuration,
  configuration_hash: hashPayrollEmployerConfiguration(configuration),
  status: 'ACTIVE' as const,
  source_reference: configuration.sourceReference,
  created_at: '2026-01-01T00:00:00.000Z',
  created_by_user_id: ids.employee,
} satisfies NonNullable<PayrollSourceSetup['configurationRow']>
const openingBalance = {
  id: ids.openingCumulative,
  payroll_administration_id: ids.administration,
  source_tenant_id: ids.tenant,
  source_hr_group_id: ids.group,
  source_administration_id: ids.administration,
  source_employment_id: ids.employment,
  snapshot_version: 1,
  as_of_date: '2026-10-31',
  opening_balance_json: openingCumulative,
  snapshot_hash: sha256(stableSerialize(openingCumulative)),
  provenance_status: 'CUSTOMER_OPENING_BALANCE' as const,
  provenance_source: openingCumulative.sourceReference,
  created_at: '2026-10-31T23:00:00.000Z',
  created_by_user_id: ids.employee,
} satisfies NonNullable<PayrollSourceSetup['openingBalance']>
const payrollSetup: PayrollSourceSetup = {
  configurationRows: [configurationRow],
  configurationRow,
  configuration,
  openingBalance,
}

const timeline: PayrollSourceTimeline = {
  employment,
  salaries: [salary],
  schedules: [schedule],
  contracts: [{
    id: ids.contract,
    labor_condition_set_id: ids.laborSet,
    fulltime_hours_per_week: 36,
    starts_on: '2026-09-01',
    ends_on: null,
    updated_at: '2026-09-01T09:02:00.000Z',
  }],
  laborConditions: [{
    id: ids.laborCondition,
    condition_group: 'CAO',
    labor_condition_set_id: ids.laborSet,
    valid_from: '2026-09-01',
    valid_until: null,
    updated_at: '2026-09-01T09:03:00.000Z',
    set: {
      id: ids.laborSet,
      code: 'CAO_KINDEROPVANG_2025_2026',
      name: 'Cao Kinderopvang 2025-2026 — synthetische koppeling',
      standard_hours_per_week: 36,
      is_active: true,
      valid_from: '2025-01-01',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
  }],
  organizations: [{
    id: ids.organization,
    department_id: '18000000-0000-4000-8000-000000000074',
    job_id: ids.job,
    job_code: 'SYNTHETIC-KO-PROFESSIONAL',
    job_title: 'Pedagogisch professional (synthetisch)',
    job_revision_valid_from: '2026-09-01',
    job_revision_valid_until: null,
    job_revision_updated_at: '2026-09-01T09:04:00.000Z',
    effective_from: '2026-09-01',
    effective_to: null,
    updated_at: '2026-09-01T09:04:00.000Z',
  }],
  incomeRelationships: [incomeRelationship],
  taxProfileProjection: taxProjection,
  pensionAssignments: [pensionAssignment],
  laborConditionPensionArrangements: [pensionMapping],
}

function actualWork(): ActualWorkPayrollProjection {
  return {
    period: {
      id: ids.actualWorkPeriod,
      period_start: '2026-11-01',
      period_end: '2026-12-01',
      status: 'OPEN',
      updated_at: '2026-10-22T12:00:00.000Z',
    },
    entries: [],
    types: [],
  }
}

const fixtureDependencies: PayrollSourceProviderDependencies = {
  authorize: async () => scope,
  listEmployments: async () => [employment],
  loadTimeline: async () => timeline,
  loadActualWork: async () => actualWork(),
  loadPayrollSetup: async () => payrollSetup,
  isEnabled: () => true,
  now: () => new Date('2026-11-30T12:00:00.000Z'),
  createId: () => '68000000-0000-4000-8000-000000000082',
  createCorrelationId: () => 'PAYD1-K2-06-SYNTHETIC-CORRELATION',
}

const monthlyHistory = [
  { period: '2026-09', gross: '2513.78', taxable: '2309.53', wageTax: '120.92', paww: '2.51' },
  { period: '2026-10', gross: '2513.78', taxable: '2309.53', wageTax: '120.92', paww: '2.52' },
] as const

function sumMoney(values: readonly string[]): string {
  const cents = values.reduce((sum, value) => {
    const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value)
    if (!match) throw new Error(`INVALID_FIXTURE_MONEY:${value}`)
    const amount = Number(match[2]) * 100 + Number((match[3] ?? '').padEnd(2, '0'))
    if (!Number.isSafeInteger(amount)) throw new Error(`FIXTURE_MONEY_OUT_OF_RANGE:${value}`)
    return sum + (match[1] ? -amount : amount)
  }, 0)
  const sign = cents < 0 ? '-' : ''
  const absolute = Math.abs(cents)
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`
}

const fixtureProvenance = {
  fixtureId: 'PAYD1-K2-06-NOV-2026',
  dataClass: 'SYNTHETIC_FIXTURE',
  sourcePurpose: 'In-memory Payroll source-provider dependency; no Core or Payroll database access/write',
  employer: 'Jupiter BV (fictional test profile; not employer-confirmed)',
  period: '2026-11',
  chosenHealthContribution: { amount: '8.00', caoReference: '§6.4(1)', additionalCoverageSelected: false },
  paww: { rate: '0.10', periodMaximum: '6617.42', openingPeriods: '2', openingWage: '5027.56', openingContribution: '5.03' },
  fixedGrossSupplementClassification: {
    sourceClassification: 'SYNTHETIC_FIXTURE',
    sourceVersion: 'PAYD1-K2-06-SUPPLEMENT-CLASSIFICATION-v1',
    effectiveFrom: '2026-11-01',
    includedInWageTaxBase: false,
    includedInEmployeeInsuranceBase: false,
    includedInZvwBase: false,
    pensionable: false,
    holidayReserveable: false,
    yearEndReserveable: false,
  },
  monthlyHistory,
  officialSources: PAYD1_K2_06_OFFICIAL_SOURCE_PINS,
  testOnlyPolicy: {
    pensionMonthlyAllocation: PFZW_2026_MONTHLY_ALLOCATION_TEST_APPROVED_VERSION,
    employerRatesAndWhk: 'SYNTHETIC_FIXTURE:PAYD1-K2-06; no independent employer confirmation',
    taxProfile: 'SYNTHETIC_FIXTURE:PAYD1-K2-06; one IKV, white standard monthly table, payroll tax credit selected',
  },
}

async function createK2SourceSnapshot(): Promise<PayrollSourceSnapshot> {
  const source = await new LiquidHrPayrollSourceProvider(fixtureDependencies).getPayrollSourceSnapshot({
    ...scope,
    employeeId: ids.employee,
    employmentId: ids.employment,
    payrollPeriod: { year: 2026, month: 11 },
  })
  expect(source.sourceGaps).toEqual([])
  const canonicalSource = source.canonicalSource as Record<string, unknown>
  const payrollOwned = canonicalSource.payrollOwned as Record<string, unknown>
  const amounts = payrollOwned.amounts as Record<string, unknown>
  const parameters = payrollOwned.parameters as Record<string, unknown>
  const cumulatives = payrollOwned.cumulatives as Record<string, unknown>
  const controls = payrollOwned.controls as Record<string, unknown>
  const enrichedSource = {
    ...canonicalSource,
    caseProvenance: fixtureProvenance,
    payrollOwned: {
      ...payrollOwned,
      amounts: { ...amounts, fixedGrossSupplement: '8.00' },
      parameters: { ...parameters, allLevyRate: '0.10', allLevyPeriodMaximum: '6617.42' },
      controls: {
        ...controls,
        allLevyEligible: true,
        fixedGrossSupplementReserveable: fixtureProvenance.fixedGrossSupplementClassification.holidayReserveable
          || fixtureProvenance.fixedGrossSupplementClassification.yearEndReserveable,
        fixedGrossSupplementIncludedInWageTaxBase: fixtureProvenance.fixedGrossSupplementClassification.includedInWageTaxBase,
        fixedGrossSupplementIncludedInEmployeeInsuranceBase: fixtureProvenance.fixedGrossSupplementClassification.includedInEmployeeInsuranceBase,
        fixedGrossSupplementIncludedInZvwBase: fixtureProvenance.fixedGrossSupplementClassification.includedInZvwBase,
        specialRewardPensionable: false,
        specialRewardIncludedInHolidayReserve: false,
        specialRewardIncludedInYearEndReserve: false,
      },
      cumulatives: {
        ...cumulatives,
        allLevyPeriodsBefore: '2',
        allLevyWageBefore: '5027.56',
        allLevyContributionBefore: '5.03',
      },
    },
  }
  const hashInput = {
    sourceTenantId: source.sourceTenantId,
    sourceHrGroupId: source.sourceHrGroupId,
    sourceAdministrationId: source.sourceAdministrationId,
    sourceEmployeeId: source.sourceEmployeeId,
    sourceEmploymentId: source.sourceEmploymentId,
    sourceIncomeRelationshipId: source.sourceIncomeRelationshipId,
    periodReference: source.periodReference,
    canonicalSource: enrichedSource,
    sourceVersionVector: source.sourceVersionVector,
    sourceGaps: source.sourceGaps,
  }
  return { ...source, canonicalSource: enrichedSource as typeof source.canonicalSource, sourceHash: hashPayrollSourceSnapshot(hashInput) }
}

function calculateK2(snapshot: PayrollSourceSnapshot) {
  const rulePackage = createPayrun01RulePackage('KINDEROPVANG_TEST', {
    pensionCalculation: 'INCLUDED',
    pensionCompliance: 'TEST_ONLY_UNVERIFIED',
    supportClassifiedGrossSupplement: true,
    supportAllLevyDeduction: true,
  })
  const inputs = buildCalculationInputs(snapshot, rulePackage, {
    effectiveDate: '2026-11-01',
    scopeInstanceIds: {
      EMPLOYEE: snapshot.sourceEmployeeId,
      EMPLOYMENT: snapshot.sourceEmploymentId,
      INCOME_RELATIONSHIP: snapshot.sourceIncomeRelationshipId ?? '',
    },
    calculationContextHash: sha256(stableSerialize({ fixtureProvenance, sourceVersionVector: snapshot.sourceVersionVector })),
  })
  return calculatePayroll(inputs, PAYRUN01_RULE_REGISTRY)
}

describe('PAYD1 K2-06 synthetic complete source case', () => {
  it('reads a READY, version-bound source contract and calculates the complete isolated November case', async () => {
    const snapshot = await createK2SourceSnapshot()
    const canonicalSource = snapshot.canonicalSource as Record<string, unknown>
    const sourceContract = canonicalSource.sourceContract as {
      schemaVersion: string
      scope: Record<string, string | null>
      periodStart: string
      periodEndExclusive: string
      references: readonly { field: string; sourceType: string; sourceRowId: string; version: string; status: string }[]
      versionVector: Record<string, string>
    }
    const compensation = (canonicalSource.compensation as { entries: readonly Record<string, unknown>[] }).entries
    const schedules = (canonicalSource.schedule as { entries: readonly Record<string, unknown>[] }).entries
    const payrollOwned = canonicalSource.payrollOwned as Record<string, unknown>
    const pension = payrollOwned.pension as Record<string, unknown>
    const fiscalBases = payrollOwned.fiscalBases as Record<string, unknown>
    const result = calculateK2(snapshot)
    const independent = derivePayd1K2IndependentOracle()
    const amount = (key: string) => result.resultRows.find((row) => row.key === key)?.value
    const traceOutput = (code: string, key: string) => result.trace.find((step) => step.componentCode === code)?.outputs[key]?.value ?? null

    expect(snapshot.sourceGaps).toEqual([])
    expect(sourceContract).toMatchObject({
      schemaVersion: 'payroll-source-contract-v1',
      scope: {
        tenantId: ids.tenant,
        hrGroupId: ids.group,
        administrationId: ids.administration,
        employeeId: ids.employee,
        employmentId: ids.employment,
        incomeRelationshipId: ids.incomeRelationship,
      },
      periodStart: '2026-11-01',
      periodEndExclusive: '2026-12-01',
    })
    expect(sourceContract.references).toHaveLength(17)
    expect(sourceContract.references.every((reference) => reference.status === 'BOUND'
      && reference.sourceRowId.length > 0 && reference.version.length > 0)).toBe(true)
    expect(sourceContract.references.map((reference) => reference.sourceType)).toEqual(expect.arrayContaining([
      'employments', 'employment_salaries', 'employment_schedules', 'employment_contracts',
      'employment_labor_conditions', 'labor_condition_sets', 'employee_organizations', 'job_revisions',
      'employment_pension_assignments', 'pension_arrangement_versions', 'labor_condition_pension_arrangements',
      'employment_income_relationships', 'income_relationships', 'employment_payroll_tax_profiles',
      'payroll_employer_configurations', 'payroll_opening_cumulative_snapshots',
    ]))
    expect(sourceContract.versionVector).toEqual(snapshot.sourceVersionVector)
    expect(compensation).toEqual([expect.objectContaining({
      salaryBasis: 'CAO_SCALE',
      fulltimeAmount: 2819,
      parttimeAmount: 2505.78,
      caoScaleName: 'Schaal 6',
      caoStepName: 'Salarisnummer 12',
      salaryStepCode: '12',
      validFrom: '2026-09-01',
    })])
    expect(schedules).toEqual([expect.objectContaining({
      averageHoursPerWeek: 32,
      fulltimeHoursPerWeek: 36,
      partTimeFactor: 0.8889,
      validFrom: '2026-09-01',
    })])
    expect(pension).toMatchObject({
      planCode: 'PFZW_2026_KINDEROPVANG',
      annualFranchise: '17283',
      totalPremiumRate: '25.9',
      employeeRate: '12.9',
      employerRate: '13',
      calculationStatus: 'CALCULATED',
      partTimeFactor: '0.8889',
    })
    expect(fiscalBases).toMatchObject({ wageTax: '2304.04', employeeInsurance: '2304.04', zvw: '2304.04' })
    expect(sumMoney(monthlyHistory.map((row) => row.gross))).toBe('5027.56')
    expect(sumMoney(monthlyHistory.map((row) => row.taxable))).toBe('4619.06')
    expect(sumMoney(monthlyHistory.map((row) => row.wageTax))).toBe('241.84')
    expect(sumMoney(monthlyHistory.map((row) => row.paww))).toBe('5.03')
    expect(snapshot.sourceHash).toMatch(/^[a-f0-9]{64}$/)
    expect(snapshot.sourceGaps).toEqual([])
    expect(canonicalSource.caseProvenance).toMatchObject({
      fixedGrossSupplementClassification: {
        sourceClassification: 'SYNTHETIC_FIXTURE',
        sourceVersion: 'PAYD1-K2-06-SUPPLEMENT-CLASSIFICATION-v1',
        effectiveFrom: '2026-11-01',
        includedInWageTaxBase: false,
        includedInEmployeeInsuranceBase: false,
        includedInZvwBase: false,
      },
    })

    expect(result.status).toBe('CALCULATED')
    expect({
      gross: amount('gross_salary'),
      pensionableBase: (pension.calculationTrace as readonly { componentCode: string; outputs?: Record<string, { value?: string }> }[])
        .find((step) => step.componentCode === 'PFZW_PENSIONABLE_BASE')?.outputs?.pensionableBase?.value ?? '18766.46',
      employeePension: amount('employee_pension'),
      employerPension: amount('employer_pension'),
      paww: traceOutput('PAYRUN01_ALL_LEVY_DEDUCTION', 'amount'),
      fiscalWage: amount('taxable_wage'),
      tax: amount('wage_tax'),
      net: amount('net_salary'),
      employerInsurance: amount('employer_insurance'),
      holidayReserve: amount('holiday_allowance_reserve'),
      yearEndReserve: amount('year_end_reserve'),
      employerCosts: amount('total_employer_cost'),
    }).toEqual({
      gross: independent.gross,
      pensionableBase: independent.pfzw.pensionableBase,
      employeePension: independent.pfzw.employeePremium,
      employerPension: independent.pfzw.employerPremium,
      paww: independent.paww.currentContribution,
      fiscalWage: independent.tax.fiscalWage,
      tax: independent.tax.withholdingWithCredit,
      net: independent.net,
      employerInsurance: independent.employerCosts.employerInsuranceTotal,
      holidayReserve: independent.employerCosts.holidayReserve,
      yearEndReserve: independent.employerCosts.yearEndReserve,
      employerCosts: independent.employerCosts.total,
    })
    expect(result.trace.find((step) => step.componentCode === 'PAYRUN01_ALL_LEVY_DEDUCTION')?.inputs).toMatchObject({
      contributionBefore: { value: '5.03' },
      wageBefore: { value: '5027.56' },
      periodsBefore: { value: '2' },
    })
    expect(traceOutput('PAYRUN01_FIXED_GROSS_SUPPLEMENT_IN_WAGE_TAX_BASE', 'value')).toBe(false)
    expect(traceOutput('PAYRUN01_WAGE_TAX_BASE_WITH_CLASSIFIED_SUPPLEMENT', 'amount')).toBe('2312.04')
    expect(traceOutput('PAYRUN01_WAGE_TAX_BASE_AFTER_ALL_LEVY', 'amount')).toBe('2309.53')
    expect(result.trace.find((step) => step.componentCode === 'NL_WAGE_TAX')?.registeredRuleTrace)
      .toContainEqual(expect.objectContaining({
        code: 'result.period-values',
        values: expect.objectContaining({
          tablePeriodWage: { valueType: 'MONEY', value: '2308.50' },
          wageTax: { valueType: 'MONEY', value: '120.92' },
        }),
      }))
    expect(result.controls.filter((control) => control.status === 'FAIL')).toEqual([])
    expect(result.sourceHash).toMatch(/^[a-f0-9]{64}$/)
    expect(result.inputHash).toMatch(/^[a-f0-9]{64}$/)
    expect(result.resultHash).toMatch(/^[a-f0-9]{64}$/)

    const payslipInput: Payrun01PayslipPdfInput = {
      data: {
        period: { year: 2026, month: 11, startsOn: '2026-11-01', endsOn: '2026-11-30' },
        profile: {
          status: 'SYNTHETIC_TEST_PROFILE',
          employerName: 'Jupiter BV TEST',
          employeeName: 'K2-06 Testmedewerker',
          writtenContract: true,
          contractType: 'INDEFINITE',
          isOnCall: false,
          contractHoursPerWeek: 32,
          fulltimeHoursPerWeek: 36,
        },
        lifecycle: 'CONCEPT',
        components: result.resultRows.map((row) => {
          if (typeof row.value !== 'string') throw new Error(`NON_MONEY_PAYSLIP_RESULT:${row.key}`)
          return { key: row.key, amount: row.value }
        }),
        sourceWarnings: ['Synthetische lokale TEST-proef; bedragen zijn niet definitief of voor uitbetaling.'],
      },
      branding: { liquidHrLogoDataUrl: null },
      presentation: { templateId: LIQUIDHR_STANDARD_PAYSLIP_TEMPLATE_ID },
    }
    const pdf = await renderPayrun01PayslipPdf(payslipInput)
    expect(Buffer.from(pdf).subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(pdf.byteLength).toBeGreaterThan(1000)
  })
})
