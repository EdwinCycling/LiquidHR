import { describe, expect, it } from 'vitest'
import {
  buildCalculationInputs,
  calculatePayroll,
  sha256,
  stableSerialize,
  type PayrollSourceSnapshot,
} from '@liquid-hr/payroll-engine'
import type { ActualWorkPayrollProjection } from '@/lib/actual-work/actual-work-service'
import {
  LiquidHrPayrollSourceProvider,
  type PayrollSourceEmployment,
  type PayrollSourceIncomeRelationship,
  type PayrollSourceProviderDependencies,
  type PayrollSourceSalary,
  type PayrollSourceSchedule,
  type PayrollSourceSetup,
  type PayrollSourceTaxProfileProjection,
  type PayrollSourceTimeline,
} from './source/liquid-hr-source-provider'
import {
  type CaoPayrollCalculation,
  type CaoRetailBusinessScope,
} from './cao-payroll-integration'
import {
  LIQUIDHR_STANDARD_PAYSLIP_TEMPLATE_ID,
  renderPayrun01PayslipHtml,
  renderPayrun01PayslipPdf,
  type Payrun01PayslipPdfInput,
} from './payrun01-payslip-pdf'
import {
  derivePayd2RetailR1IndependentOracle,
  derivePayd2RetailR2IndependentOracle,
} from './payd2-retail-independent-oracle'
import { hashPayrollSourceSnapshot } from './source/snapshot-hash'
import { assertActivePayrollEmployerConfiguration, hashPayrollEmployerConfiguration } from './payroll-setup'
import { getRetailModeRuleBundle } from '@liquid-hr/payroll-rules-cao-bench02'
import {
  createPayfull02RulePackage,
  PAYFULL02_RULE_REGISTRY,
} from '@liquid-hr/payroll-rules-nl-2026'

export const PAYD2_RETAIL_02_OFFICIAL_SOURCE_PINS = {
  cao: {
    version: 'Cao Retail Non-Food, definitieve versie juli 2026',
    appliesFrom: '2026-07-01',
    appliesThrough: '2027-06-30',
    url: 'https://www.inretail.nl/wp-content/uploads/2026/05/260527-Cao-Retail-Non-Food-juli-2026-def.pdf',
    sha256: 'ec6fd7a8ee7c3b1f18f58ac6cc5081d6a72e053405480e346eb8a4c7d1e1d2cc',
  },
  wageTaxTable: {
    version: 'Belastingdienst Witte Maandloon-tabel Nederland Standaard v01, januari 2026',
    appliesFrom: '2026-01-01',
    appliesThrough: '2026-12-31',
    url: 'https://download.belastingdienst.nl/belastingdienst/dl/rekenhulpen/loonheffing/2026/v01/pdf/wit_mnd_nl_std_20260101.pdf',
    sha256: 'c959d65273e18a1a2fdf33562fd34e31d45d3bca0f260ea232815d28e69284dc',
    oracleTableWage: '4567.50',
    oracleWithholdingWithCreditUnderAow: '1107.17',
  },
  wageTaxHandbook: {
    version: 'Belastingdienst Handboek Loonheffingen 2026, versie maart 2026',
    appliesFrom: '2026-01-01',
    appliesThrough: '2026-12-31',
    url: 'https://download.belastingdienst.nl/belastingdienst/docs/handboek-loonheffingen-lh0221t61fd.pdf',
    sha256: '7576eeaab3c4365e768892b343d89bc1ab8018e8f50659c067e4e5fe33c78120',
  },
  wageAndSocialRates: {
    version: 'Belastingdienst Cijferbijlage Nieuwsbrief Loonheffingen 2026, 16 december 2025',
    appliesFrom: '2026-01-01',
    appliesThrough: '2026-12-31',
    url: 'https://odb.belastingdienst.nl/wp-content/uploads/2025/12/Cijferbijlage-2026-bij-Nieuwsbrief-LH-LH-209-1B61FD_TG.pdf',
    sha256: '1d348b84937ac2c62c1c4882f32433b012b55180434a872affd785ec48ba4233',
  },
  bpfDetailhandelRates: {
    version: 'Pensioenfonds Detailhandel Premieoverzicht 2026',
    appliesFrom: '2026-01-01',
    appliesThrough: '2026-12-31',
    url: 'https://pensioenfondsdetailhandel.nl/content/Publicaties/Rekenvoorbeelden/Premieoverzicht-2026.pdf',
    sha256: '494bc0fb3c3136d0048c053339a5e40cfb79d4620d37be791d7f738e95508f3d',
  },
  bpfDetailhandelVcr: {
    version: 'Pensioenfonds Detailhandel Rekenenvoorbeelden 2026, VCR-maandmethode',
    appliesFrom: '2026-01-01',
    appliesThrough: '2026-12-31',
    url: 'https://pensioenfondsdetailhandel.nl/content/Publicaties/Rekenvoorbeelden/Rekenvoorbeelden-2026.pdf',
    sha256: '5a2cb3d329a1aef6c4e521448c70540501dc290e73648f36f6df87143a4cb16f',
  },
  bpfDetailhandelObligation: {
    version: 'Pensioenfonds Detailhandel, verplichtstelling; actuele werkgeversinformatie',
    appliesFrom: '2026-01-01',
    appliesThrough: '2026-12-31',
    url: 'https://pensioenfondsdetailhandel.nl/werkgever-en-administratiekantoor/situaties-en-wijzigingen/verplichtstelling',
    sha256: '76a5a8e8b26aeefddf362262ff72bc576f57a8c38c69fd38df2bb7fcf5de70a9',
  },
} as const

type RetailCase = 'R1' | 'R2'
type SnapshotOptions = {
  readonly businessScope?: CaoRetailBusinessScope | null
  readonly eCommerceNight?: boolean
  readonly omitR1FiscalProfile?: boolean
  readonly nonZeroR1Opening?: boolean
}

const scope = {
  tenantId: '16000000-0000-4000-8000-000000000061',
  hrGroupId: '26000000-0000-4000-8000-000000000062',
  administrationId: '36000000-0000-4000-8000-000000000063',
}

function sourceIds(caseCode: RetailCase) {
  const discriminator = caseCode === 'R1' ? '064' : '065'
  return {
    employee: `46000000-0000-4000-8000-000000000${discriminator}`,
    employment: `56000000-0000-4000-8000-000000000${discriminator}`,
    salary: `66000000-0000-4000-8000-000000000${discriminator}`,
    schedule: `76000000-0000-4000-8000-000000000${discriminator}`,
    contract: `b6000000-0000-4000-8000-000000000${discriminator}`,
    laborCondition: `d6000000-0000-4000-8000-000000000${discriminator}`,
    laborSet: `c6000000-0000-4000-8000-000000000${discriminator}`,
    incomeLink: `86000000-0000-4000-8000-000000000${discriminator}`,
    incomeRelationship: `96000000-0000-4000-8000-000000000${discriminator}`,
    taxProfile: `a6000000-0000-4000-8000-000000000${discriminator}`,
    pensionMapping: `17000000-0000-4000-8000-000000000${discriminator}`,
    pensionVersion: `27000000-0000-4000-8000-000000000${discriminator}`,
    pensionAssignment: `37000000-0000-4000-8000-000000000${discriminator}`,
    employerConfiguration: `47000000-0000-4000-8000-000000000${discriminator}`,
    openingCumulative: `57000000-0000-4000-8000-000000000${discriminator}`,
    actualWorkPeriod: `67000000-0000-4000-8000-000000000${discriminator}`,
    actualWorkTypeNight: `84000000-0000-4000-8000-000000000${discriminator}`,
    actualWorkTypeSunday: `84000000-0000-4000-8000-000000000${caseCode === 'R1' ? '066' : '067'}`,
    actualWorkTypeOvertime: `84000000-0000-4000-8000-000000000${caseCode === 'R1' ? '068' : '069'}`,
  } as const
}

function createSnapshotFixture(caseCode: RetailCase, options: SnapshotOptions = {}) {
  const ids = sourceIds(caseCode)
  const employeeId = ids.employee
  const r1 = caseCode === 'R1'
  const firstEmploymentDate = r1 ? '2026-07-01' : '2026-01-01'
  const employment: PayrollSourceEmployment = {
    id: ids.employment,
    tenant_id: scope.tenantId,
    hr_group_id: scope.hrGroupId,
    administration_id: scope.administrationId,
    employee_id: employeeId,
    starts_on: firstEmploymentDate,
    ends_on: null,
    record_status: 'CONFIRMED' as PayrollSourceEmployment['record_status'],
    employment_type: 'REGULAR' as PayrollSourceEmployment['employment_type'],
    contract_type: 'PERMANENT' as PayrollSourceEmployment['contract_type'],
    original_hire_date: firstEmploymentDate,
    seniority_date: firstEmploymentDate,
    updated_at: `${firstEmploymentDate}T09:00:00.000Z`,
    deleted_at: null,
  }
  const salary: PayrollSourceSalary = {
    id: ids.salary,
    salary_basis: (r1 ? 'MANUAL' : 'CAO_SCALE') as PayrollSourceSalary['salary_basis'],
    salary_route: (r1 ? 'MANUAL' : 'SCALE_WITH_STEPS') as PayrollSourceSalary['salary_route'],
    payment_type: 'PERIODIC_FIXED' as PayrollSourceSalary['payment_type'],
    payment_frequency: 'MONTHLY' as PayrollSourceSalary['payment_frequency'],
    currency_code: 'EUR',
    fulltime_amount: r1 ? 4758.96 : 2542.50,
    parttime_amount: r1 ? 4758.96 : 1605.79,
    hourly_rate: r1 ? 28.90 : null,
    salary_structure_id: null,
    salary_scale_id: null,
    salary_scale_step_id: null,
    salary_step_code: r1 ? '15' : '1',
    cao_scale_name: r1 ? 'I' : 'C',
    cao_step_name: r1 ? '15' : '1',
    salary_band_id: null,
    valid_from: '2026-01-01',
    valid_until: null,
    updated_at: '2026-06-30T09:05:00.000Z',
  }
  const schedule: PayrollSourceSchedule = {
    id: ids.schedule,
    average_days_per_week: r1 ? 5 : 3,
    average_hours_per_week: r1 ? 38 : 24,
    fulltime_hours_per_week: 38,
    part_time_factor: r1 ? 1 : 0.6316,
    schedule_type: 'HOURS_PER_DAY' as PayrollSourceSchedule['schedule_type'],
    is_on_call: false,
    valid_from: '2026-01-01',
    valid_until: null,
    updated_at: '2026-01-01T09:10:00.000Z',
  }
  const incomeRelationship: PayrollSourceIncomeRelationship = {
    id: ids.incomeLink,
    incomeRelationshipId: ids.incomeRelationship,
    validFrom: firstEmploymentDate,
    validUntil: null,
    linkUpdatedAt: '2026-01-01T09:15:00.000Z',
    reportingStatus: 'READY',
    startsOn: firstEmploymentDate,
    endsOn: null,
    incomeRelationshipUpdatedAt: `${firstEmploymentDate}T09:20:00.000Z`,
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
    source_reference: 'SYNTHETIC_FIXTURE:PAYD2-RETAIL-02; fictional NL resident under AOW age with loonheffingskorting on this single IKV',
    effective_from: firstEmploymentDate,
    effective_to: null,
    version_number: 1,
    supersedes_profile_id: null,
    confirmed_by_user_id: ids.employee,
    confirmed_at: `${firstEmploymentDate}T09:30:00.000Z`,
    created_at: `${firstEmploymentDate}T09:30:00.000Z`,
  }
  const taxProfileProjection: PayrollSourceTaxProfileProjection = {
    ageCategory: 'UNDER_AOW',
    ageSourceUpdatedAt: `${firstEmploymentDate}T09:25:00.000Z`,
    activeIncomeRelationshipCount: 1,
    incomeRelationshipLinkGap: false,
    incomeRelationships: [{
      id: ids.incomeRelationship,
      updatedAt: incomeRelationship.incomeRelationshipUpdatedAt,
      reportingStatus: 'READY',
      ikvNumber: 1,
      startsOn: firstEmploymentDate,
      endsOn: null,
    }],
    taxProfiles: [taxProfile],
  }
  const pensionMapping = {
    id: ids.pensionMapping,
    labor_condition_set_id: ids.laborSet,
    pension_arrangement_id: ids.pensionVersion,
    participant_group: 'NEW_ENTRANT',
    effective_from: '2026-01-01',
    effective_to: '2026-12-31',
    provenance_json: { status: 'USER_RECORDED', sourceClassification: 'SYNTHETIC_FIXTURE', fixtureId: 'PAYD2-RETAIL-02' },
    version_number: 1,
    supersedes_mapping_id: null,
    arrangement: null,
    arrangement_resolution_reason: null,
    arrangement_resolution_change_version_ids: [],
  } satisfies NonNullable<PayrollSourceTimeline['laborConditionPensionArrangements']>[number]
  const pensionAssignment = {
    id: ids.pensionAssignment,
    pension_arrangement_id: pensionMapping.pension_arrangement_id,
    effective_from: firstEmploymentDate,
    effective_to: '2026-12-31',
    participation_start_date: firstEmploymentDate,
    assignment_reason: 'SYNTHETIC_TEST_FIXTURE',
    provenance_json: {
      status: 'USER_RECORDED',
      sourceClassification: 'SYNTHETIC_FIXTURE',
      fixtureId: 'PAYD2-RETAIL-02',
      laborConditionMappingId: pensionMapping.id,
      laborConditionMappingVersion: pensionMapping.version_number,
      obligationAssumption: 'Fictional clothing retailer meets the Retail Non-Food scope and is not exempt; legal applicability for a real employer is not established.',
    },
    updated_at: `${firstEmploymentDate}T09:35:00.000Z`,
    version_number: 1,
    supersedes_assignment_id: null,
    age_for_tier: null,
    arrangement_resolution_reason: null,
    arrangement_resolution_change_version_ids: [],
    arrangement: {
      id: ids.pensionVersion,
      code: 'BPF_DETAILHANDEL_2026',
      name: 'Pensioenfonds Detailhandel verplichte regeling 2026 — synthetische bron',
      arrangement_type: 'FLAT_PREMIUM',
      effective_from: '2026-01-01',
      arrangement_established_from: '2026-01-01',
      effective_to: '2026-12-31',
      transition_date: null,
      grandfathering_mode: 'NONE',
      flat_total_rate: 24.75,
      employer_share_pct: 75,
      employee_share_pct: 25,
      annual_franchise: 18680,
      annual_pensionable_salary_cap: 79409,
      pensionable_salary_definition: {
        method: 'BPF_DETAILHANDEL_2026_VCR',
        annualization: '12_X_REGULAR_MONTHLY_PENSIONABLE_SALARY',
        basis: 'ANNUAL_PENSIONABLE_SALARY_MINUS_FRANCHISE',
        floorAtZero: true,
        firstPeriodOnly: true,
        vcrSource: PAYD2_RETAIL_02_OFFICIAL_SOURCE_PINS.bpfDetailhandelVcr,
        premiumSource: PAYD2_RETAIL_02_OFFICIAL_SOURCE_PINS.bpfDetailhandelRates,
      },
      eligibility_rule: { participantGroup: 'NEW_ENTRANT', employmentOrParticipationStartOnOrAfter: '2026-01-01' },
      contract_classification: 'UNKNOWN' as const,
      contract_classification_provenance: { status: 'NOT_USED_FOR_FLAT_PREMIUM_FIRST_PERIOD' },
      provenance_json: {
        status: 'SYNTHETIC_FIXTURE',
        fixtureId: 'PAYD2-RETAIL-02',
        officialSources: {
          premium: PAYD2_RETAIL_02_OFFICIAL_SOURCE_PINS.bpfDetailhandelRates,
          vcr: PAYD2_RETAIL_02_OFFICIAL_SOURCE_PINS.bpfDetailhandelVcr,
          obligation: PAYD2_RETAIL_02_OFFICIAL_SOURCE_PINS.bpfDetailhandelObligation,
          cao: PAYD2_RETAIL_02_OFFICIAL_SOURCE_PINS.cao,
        },
        selectedContributionSplit: 'Official 2026 maximum employee share 6.1875%; fictional employer allocates remaining 18.5625% to itself.',
        calculationScope: 'One full first monthly period with zero opening cumulative; annual multi-period VCR reconciliation is not asserted.',
      },
      is_active: true,
      version_id: ids.pensionVersion,
      version_number: 1,
      version_created_at: '2026-01-01T00:00:00.000Z',
      source_updated_at: '2026-01-01T00:00:00.000Z',
      tiers: [],
    },
  } satisfies NonNullable<PayrollSourceTimeline['pensionAssignments']>[number]

  const retailFullPackage = createPayfull02RulePackage('CUSTOMER_STANDARD', {
    supportPartialPeriods: true,
    supportCaoExactGross: true,
    ...(r1 ? { allocatePensionRoundingRemainderToEmployer: true } : {}),
  })
  const configuration = r1 ? assertActivePayrollEmployerConfiguration({
    schemaVersion: 'payroll-employer-configuration-v1',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    status: 'ACTIVE',
    sourceReference: 'SYNTHETIC_FIXTURE:PAYD2-RETAIL-02; fictitious small clothing retailer, permanent written contract, sector 17 and assumed no employer exemption',
    employer: {
      sectorCode: '17',
      whkDecisionReference: 'SYNTHETIC-WHK-2026-RETAIL-17-SMALL',
      awfClassification: 'LOW',
      aofClassification: 'AOF-01',
      wkoClassification: 'WKO-01',
      zvwClassification: 'EMPLOYER_LEVY',
    },
    employerRates: { awf: '2.74', aof: '6.27', wko: '0.50', whk: '1.93', zvw: '6.10' },
    reserves: { holidayAllowanceRate: '8.00', yearEndApplies: false, yearEndRate: '0.00' },
    componentSet: {
      compositionId: retailFullPackage.compositionId,
      packageVersion: retailFullPackage.metadata?.version ?? '2026.1',
      packageHash: retailFullPackage.metadata?.packageHash ?? '',
    },
    pension: {
      partialMonthMethod: 'CALENDAR_DAYS_PRO_RATA',
      methodSourceReference: 'SYNTHETIC_FIXTURE:PAYD2-RETAIL-02; full July period, new employment starts on 2026-07-01',
    },
  }) : null
  const configurationRow = configuration ? {
    id: ids.employerConfiguration,
    payroll_administration_id: scope.administrationId,
    source_tenant_id: scope.tenantId,
    source_hr_group_id: scope.hrGroupId,
    source_administration_id: scope.administrationId,
    configuration_version: 1,
    effective_from: configuration.effectiveFrom,
    effective_to: configuration.effectiveTo,
    configuration_json: configuration,
    configuration_hash: hashPayrollEmployerConfiguration(configuration),
    status: 'ACTIVE' as const,
    source_reference: configuration.sourceReference,
    created_at: '2026-01-01T00:00:00.000Z',
    created_by_user_id: ids.employee,
  } satisfies NonNullable<PayrollSourceSetup['configurationRow']> : null
  const openingCumulative = {
    schemaVersion: 'payroll-opening-cumulative-v1',
    sourcePeriodFrom: '2026-06-29',
    sourcePeriodTo: '2026-06-29',
    asOfDate: '2026-06-30',
    meaning: {
      grossWageBeforePeriod: options.nonZeroR1Opening ? '1.00' : '0.00',
      taxableWageBeforePeriod: '0.00',
      wageTaxBeforePeriod: '0.00',
      employeeInsuranceWageBeforePeriod: '0.00',
      zvwWageBeforePeriod: '0.00',
      holidayReserveBeforePeriod: '0.00',
      yearEndReserveBeforePeriod: '0.00',
    },
    sourceReference: 'SYNTHETIC_FIXTURE:PAYD2-RETAIL-02; zero opening cumulative before fictional first employment/IKV on 2026-07-01',
  }
  const openingBalance = r1 ? {
    id: ids.openingCumulative,
    payroll_administration_id: scope.administrationId,
    source_tenant_id: scope.tenantId,
    source_hr_group_id: scope.hrGroupId,
    source_administration_id: scope.administrationId,
    source_employment_id: ids.employment,
    snapshot_version: 1,
    as_of_date: openingCumulative.asOfDate,
    opening_balance_json: openingCumulative,
    snapshot_hash: sha256(stableSerialize(openingCumulative)),
    provenance_status: 'CUSTOMER_OPENING_BALANCE' as const,
    provenance_source: openingCumulative.sourceReference,
    created_at: '2026-06-30T23:00:00.000Z',
    created_by_user_id: ids.employee,
  } satisfies NonNullable<PayrollSourceSetup['openingBalance']> : null
  const payrollSetup: PayrollSourceSetup = {
    configurationRows: configurationRow ? [configurationRow] : [],
    configurationRow,
    configuration,
    openingBalance,
  }
  const defaultBusinessScope = options.eCommerceNight ? {
    value: 'ECOMMERCE',
    sourceClassification: 'SYNTHETIC_FIXTURE',
    sourceReference: 'SYNTHETIC_FIXTURE:PAYD2-RETAIL-01; case stipulates an e-commerce activity scope',
    sourceVersion: 'PAYD2-RETAIL-01-ECOMMERCE-v1',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
  } as const satisfies CaoRetailBusinessScope : {
    value: 'IN_STORE',
    sourceClassification: 'SYNTHETIC_FIXTURE',
    sourceReference: caseCode === 'R1'
      ? 'SYNTHETIC_FIXTURE:PAYD2-RETAIL-02; case stipulates 100% Retail Non-Food in-store activity; not an employer-confirmed CAO/PFD applicability finding'
      : 'SYNTHETIC_FIXTURE:PAYD2-RETAIL-01; case stipulates an in-store Mode employer, not an employer-confirmed fact',
    sourceVersion: caseCode === 'R1' ? 'PAYD2-RETAIL-02-IN-STORE-v1' : 'PAYD2-RETAIL-01-IN-STORE-v1',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
  } as const satisfies CaoRetailBusinessScope
  const businessScope = options.businessScope === null ? undefined : options.businessScope ?? defaultBusinessScope
  const timeline: PayrollSourceTimeline = {
    employment,
    salaries: [salary],
    schedules: [schedule],
    contracts: [{
      id: ids.contract,
      labor_condition_set_id: ids.laborSet,
      fulltime_hours_per_week: 38,
      starts_on: '2026-01-01',
      ends_on: null,
      updated_at: '2026-01-01T09:02:00.000Z',
    }],
    laborConditions: [{
      id: ids.laborCondition,
      condition_group: 'CAO',
      labor_condition_set_id: ids.laborSet,
      valid_from: '2026-01-01',
      valid_until: null,
      updated_at: '2026-01-01T09:03:00.000Z',
      set: {
        id: ids.laborSet,
        code: 'CAO_RETAIL_NON_FOOD_2026_2027',
        name: 'Cao Retail Non-Food / Mode 2026–2027 (synthetic fixture)',
        standard_hours_per_week: 38,
        is_active: true,
        valid_from: '2026-01-01',
        updated_at: '2026-01-01T09:03:00.000Z',
      },
    }],
    incomeRelationships: [incomeRelationship],
    ...(r1 ? {
      ...(!options.omitR1FiscalProfile ? { taxProfileProjection } : {}),
      pensionAssignments: [pensionAssignment],
      laborConditionPensionArrangements: [pensionMapping],
    } : {}),
    ...(businessScope ? { retailBusinessScope: businessScope } : {}),
  }

  const period = {
    id: ids.actualWorkPeriod,
    period_start: '2026-07-01',
    period_end: '2026-08-01',
    status: 'CLOSED' as const,
    updated_at: '2026-08-01T09:00:00.000Z',
  }
  const workTypes: ActualWorkPayrollProjection['types'] = r1 ? [] : [
    {
      id: ids.actualWorkTypeNight,
      family: 'WORK',
      code: 'WEEKDAY_NIGHT',
      name: 'Werk op maandag tot en met zaterdag van 22.00 tot 24.00 uur',
      valid_from: '2026-01-01',
      valid_until: null,
      approval_required: true,
      updated_at: '2026-01-01T09:30:00.000Z',
    },
    {
      id: ids.actualWorkTypeSunday,
      family: 'WORK',
      code: 'SUNDAY',
      name: 'Zondagwerk',
      valid_from: '2026-01-01',
      valid_until: null,
      approval_required: true,
      updated_at: '2026-01-01T09:31:00.000Z',
    },
    {
      id: ids.actualWorkTypeOvertime,
      family: 'OVERTIME',
      code: 'DAILY_OVERTIME',
      name: 'Dagelijks overwerk',
      valid_from: '2026-01-01',
      valid_until: null,
      approval_required: true,
      updated_at: '2026-01-01T09:32:00.000Z',
    },
  ]
  const makeWorkEntry = (input: {
    readonly id: string
    readonly typeId: string
    readonly date: string
    readonly hours: number
  }): ActualWorkPayrollProjection['entries'][number] => ({
    id: input.id,
    employment_id: ids.employment,
    work_hour_type_id: input.typeId,
    work_date: input.date,
    entry_granularity: 'DAY',
    subject_period_start: input.date,
    subject_period_end: new Date(Date.parse(`${input.date}T00:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10),
    posting_period_start: '2026-07-01',
    hours: input.hours,
    status: 'APPROVED',
    approved_at: `${input.date}T12:00:00.000Z`,
    updated_at: `${input.date}T12:00:00.000Z`,
  })
  const entries: ActualWorkPayrollProjection['entries'] = r1 ? [] : [
    makeWorkEntry({ id: '85000000-0000-4000-8000-000000000071', typeId: ids.actualWorkTypeSunday, date: '2026-07-12', hours: 1 }),
    makeWorkEntry({ id: '85000000-0000-4000-8000-000000000072', typeId: ids.actualWorkTypeNight, date: '2026-07-13', hours: 1 }),
    makeWorkEntry({ id: '85000000-0000-4000-8000-000000000073', typeId: ids.actualWorkTypeOvertime, date: '2026-07-12', hours: 1 }),
    makeWorkEntry({ id: '85000000-0000-4000-8000-000000000074', typeId: ids.actualWorkTypeOvertime, date: '2026-07-13', hours: 1 }),
  ]
  const actualWork: ActualWorkPayrollProjection = { period, entries, types: workTypes }
  const dependencies: PayrollSourceProviderDependencies = {
    authorize: async () => scope,
    listEmployments: async () => [employment],
    loadTimeline: async () => timeline,
    loadActualWork: async () => actualWork,
    loadPayrollSetup: async () => payrollSetup,
    isEnabled: () => true,
    now: () => new Date('2026-10-23T08:00:00.000Z'),
    createId: () => `98000000-0000-4000-8000-000000000${caseCode === 'R1' ? '081' : '082'}`,
    createCorrelationId: () => `PAYD2-RETAIL-01-${caseCode}-CORRELATION`,
  }

  return { ids, employeeId, employment, salary, schedule, actualWork, dependencies }
}

async function createRetailSourceSnapshot(
  caseCode: RetailCase,
  options: SnapshotOptions = {},
): Promise<PayrollSourceSnapshot> {
  const fixture = createSnapshotFixture(caseCode, options)
  const source = await new LiquidHrPayrollSourceProvider(fixture.dependencies).getPayrollSourceSnapshot({
    ...scope,
    employeeId: fixture.employeeId,
    employmentId: fixture.employment.id,
    payrollPeriod: { year: 2026, month: 7 },
  })
  const sourceCanonical = source.canonicalSource as Record<string, unknown>
  const canonicalSource = {
    ...sourceCanonical,
    caseProvenance: {
      fixtureId: `PAYD2-RETAIL-${caseCode === 'R1' ? '02' : '01'}-${caseCode}`,
      dataClass: 'SYNTHETIC_FIXTURE',
      sourcePurpose: 'In-memory source-provider dependency; no Core or Payroll database access or write',
      employerScope: caseCode === 'R1'
        ? 'Fictional Retail Mode case; selected employer inputs do not confirm real employer or CAO/BPF applicability'
        : 'Fictional Retail Mode case; not employer-confirmed or a CAO applicability finding',
      ...(caseCode === 'R1' ? {
        officialRuleSources: PAYD2_RETAIL_02_OFFICIAL_SOURCE_PINS,
        syntheticPayrollInputs: {
          sourceClassification: 'SYNTHETIC_FIXTURE',
          employmentAndIkvStart: '2026-07-01',
          retailNonFoodInStoreActivityShare: '100%',
          pfdExemptionAssumption: 'none',
          realEmployerCaoAndPfdApplicability: 'SOURCE_GAP; fictional inputs do not establish legal scope or exemption',
          realEmployeeFiscalProfile: 'SOURCE_GAP; fictional age, residence, and tax-credit declarations do not establish a real IKV profile',
          residentCountry: 'NL',
          ageCategory: 'UNDER_AOW',
          payrollTaxCreditAppliesToSingleIkv: true,
          employerSector: '17',
          employerSize: 'SMALL',
          whkRate: '1.93',
          employerExemptionFromPfd: false,
          openingCumulativeIsZero: !options.nonZeroR1Opening,
          holidayAllowancePaidInJuly: false,
        },
      } : {}),
      ...(caseCode === 'R2' ? {
        premiumOverlap: {
          sourceClassification: 'SYNTHETIC_FIXTURE',
          weekdayNightHours: '1.0000',
          sundayHours: '1.0000',
          dailyOvertimeHours: '2.0000',
          explicitOvertimeOverlapHours: '2.0000',
          stipulation: 'One overtime hour overlaps the night hour and one overlaps the Sunday hour.',
        },
      } : {}),
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
    canonicalSource,
    sourceVersionVector: source.sourceVersionVector,
    sourceGaps: source.sourceGaps,
  }
  return {
    ...source,
    canonicalSource: canonicalSource as typeof source.canonicalSource,
    sourceHash: hashPayrollSourceSnapshot(hashInput),
  }
}

function canonical(snapshot: PayrollSourceSnapshot): Record<string, unknown> {
  return snapshot.canonicalSource as Record<string, unknown>
}

function calculateRetailR1(snapshot: PayrollSourceSnapshot) {
  const rulePackage = createPayfull02RulePackage('CUSTOMER_STANDARD', {
    pensionCalculation: 'INCLUDED',
    pensionCompliance: 'VERIFIED',
    supportPartialPeriods: true,
    supportCaoExactGross: true,
    allocatePensionRoundingRemainderToEmployer: true,
  })
  const inputs = buildCalculationInputs(snapshot, rulePackage, {
    effectiveDate: '2026-07-01',
    scopeInstanceIds: {
      EMPLOYEE: snapshot.sourceEmployeeId,
      EMPLOYMENT: snapshot.sourceEmploymentId,
      INCOME_RELATIONSHIP: snapshot.sourceIncomeRelationshipId ?? '',
    },
    calculationContextHash: sha256(stableSerialize({
      fixtureId: 'PAYD2-RETAIL-02-R1',
      sourceHash: snapshot.sourceHash,
    })),
  })
  return calculatePayroll(inputs, PAYFULL02_RULE_REGISTRY)
}

function resultAmount(result: ReturnType<typeof calculateRetailR1>, key: string): string {
  const row = result.resultRows.find((candidate) => candidate.key === key)
  if (!row || typeof row.value !== 'string') throw new Error(`PAYD2_RETAIL_R1_RESULT_MISSING:${key}`)
  return row.value
}

function retailCalculation(snapshot: PayrollSourceSnapshot): CaoPayrollCalculation {
  return canonical(snapshot).caoCalculation as CaoPayrollCalculation
}

function sourceContract(snapshot: PayrollSourceSnapshot): {
  readonly schemaVersion: string
  readonly scope: Record<string, string | null>
  readonly periodStart: string
  readonly periodEndExclusive: string
  readonly references: readonly {
    readonly field: string
    readonly sourceType: string
    readonly sourceRowId: string
    readonly version: string
    readonly status: string
  }[]
  readonly versionVector: Record<string, string>
} {
  return canonical(snapshot).sourceContract as ReturnType<typeof sourceContract>
}

describe('PAYD2 Retail in-memory source cases', () => {
  it('binds R1 to the July wage/version source and preserves the complete indexation-cap trace', async () => {
    const snapshot = await createRetailSourceSnapshot('R1')
    const repeat = await createRetailSourceSnapshot('R1')
    const source = canonical(snapshot)
    const contract = sourceContract(snapshot)
    const cao = retailCalculation(snapshot)
    const oracle = derivePayd2RetailR1IndependentOracle()
    const engineTrace = cao.componentTrace?.find((step) => step.componentCode === 'RETAIL_MODE_GROSS')
    const indexTrace = engineTrace?.registeredRuleTrace?.find((step) => step.code === 'RETAIL_R1_JULY_ACTUAL_RATE_INDEXATION_CAP')
    const metadata = getRetailModeRuleBundle('2026-07-01').rulePackage.metadata?.sourceMetadata

    expect(snapshot.sourceHash).toBe(repeat.sourceHash)
    expect(cao.resultHash).toBe(retailCalculation(repeat).resultHash)
    expect(contract).toMatchObject({
      schemaVersion: 'payroll-source-contract-v1',
      scope: {
        tenantId: scope.tenantId,
        hrGroupId: scope.hrGroupId,
        administrationId: scope.administrationId,
        employeeId: snapshot.sourceEmployeeId,
        employmentId: snapshot.sourceEmploymentId,
        incomeRelationshipId: snapshot.sourceIncomeRelationshipId,
      },
      periodStart: '2026-07-01',
      periodEndExclusive: '2026-08-01',
    })
    expect(contract.references.every((reference) => reference.status === 'BOUND'
      && reference.sourceRowId.length > 0 && reference.version.length > 0)).toBe(true)
    expect(contract.references.map((reference) => reference.sourceType)).toEqual(expect.arrayContaining([
      'employments', 'employment_salaries', 'employment_schedules', 'employment_contracts',
      'employment_labor_conditions', 'labor_condition_sets', 'synthetic_fixture',
      'employment_income_relationships', 'income_relationships',
    ]))
    expect(contract.versionVector).toEqual(snapshot.sourceVersionVector)
    expect(snapshot.sourceVersionVector).toMatchObject({
      'cao:rule-package:CAO-RETAIL-NON-FOOD-2026:2026.7': `${cao.packageVersion}:${cao.packageHash}`,
      [`cao:input:${snapshot.sourceEmploymentId}`]: `${cao.inputHash}:${cao.sourceHash}`,
    })
    expect(metadata).toMatchObject({
      activeTableEffectiveFrom: '2026-07-01',
      activeTableEffectiveTo: '2026-12-31',
      activeTableSourceSha256: 'ec6fd7a8ee7c3b1f18f58ac6cc5081d6a72e053405480e346eb8a4c7d1e1d2cc',
      grossScopeNotice: expect.stringContaining('8% vacation allowance'),
    })
    expect(cao).toMatchObject({
      status: 'CALCULATED',
      family: 'RETAIL_MODE',
      packageVersion: '2026.7',
      effectiveFrom: '2026-07-01',
      effectiveTo: '2026-12-31',
      hourlyBaseRate: oracle.appliedHourlyRate,
      baseAmount: oracle.baseMonthlyGross,
      premiumAmount: '0.00',
      grossAmount: oracle.gross,
    })
    expect(indexTrace?.values).toMatchObject({
      previousHourlyRate: { valueType: 'MONEY', value: oracle.previousHourlyRate },
      indexationRate: { valueType: 'PERCENTAGE', value: oracle.indexationRate },
      indexedHourlyRateBeforeRounding: { valueType: 'MONEY', value: oracle.indexedHourlyRateBeforeRounding },
      indexedHourlyRateBeforeCap: { valueType: 'MONEY', value: oracle.indexedHourlyRateBeforeCap },
      tableMaximumHourlyRate: { valueType: 'MONEY', value: oracle.maximumHourlyRate },
      hourlyRateAfterCap: { valueType: 'MONEY', value: oracle.appliedHourlyRate },
    })
    expect(cao.packageHash).toMatch(/^[a-f0-9]{64}$/)
    expect(cao.sourceHash).toMatch(/^[a-f0-9]{64}$/)
    expect(cao.inputHash).toMatch(/^[a-f0-9]{64}$/)
    expect(cao.resultHash).toMatch(/^[a-f0-9]{64}$/)
    expect(snapshot.sourceHash).toMatch(/^[a-f0-9]{64}$/)
    expect(source.caseProvenance).toMatchObject({ dataClass: 'SYNTHETIC_FIXTURE' })
    expect(source.caseProvenance).toMatchObject({ fixtureId: 'PAYD2-RETAIL-02-R1' })
    expect(source.caseProvenance).toHaveProperty('officialRuleSources', PAYD2_RETAIL_02_OFFICIAL_SOURCE_PINS)
    expect(source.caseProvenance).toMatchObject({
      syntheticPayrollInputs: {
        retailNonFoodInStoreActivityShare: '100%',
        pfdExemptionAssumption: 'none',
        realEmployerCaoAndPfdApplicability: expect.stringContaining('SOURCE_GAP'),
        realEmployeeFiscalProfile: expect.stringContaining('SOURCE_GAP'),
      },
    })
    expect(source.retailBusinessScope).toMatchObject({ sourceClassification: 'SYNTHETIC_FIXTURE' })
    expect(snapshot.sourceGaps).toEqual([])
    expect(source.fiscalProfile).toMatchObject({ status: 'CONFIRMED', ageCategory: 'UNDER_AOW' })
    expect(source.payrollOwned).toMatchObject({
      pension: { planCode: 'BPF_DETAILHANDEL_2026', annualFranchise: '18680', totalPremiumRate: '24.75' },
      employerRates: { awf: '2.7400', aof: '6.2700', wko: '0.5000', whk: '1.9300', zvw: '6.1000' },
      reserveRates: { holidayAllowance: '8.0000', yearEnd: '0.00' },
    })
  })

  it('calculates complete R1 gross-to-net, reconciles each component to the independent oracle, and renders only an in-memory CONCEPT PDF', async () => {
    const snapshot = await createRetailSourceSnapshot('R1')
    const source = canonical(snapshot)
    const payrollOwned = source.payrollOwned as Record<string, unknown>
    const pension = payrollOwned.pension as Record<string, unknown>
    const oracle = derivePayd2RetailR1IndependentOracle()
    const result = calculateRetailR1(snapshot)
    const componentResults = {
      gross: resultAmount(result, 'gross_salary'),
      pensionableBase: resultAmount(result, 'pensionable_wage'),
      employeePension: resultAmount(result, 'employee_pension'),
      employerPension: resultAmount(result, 'employer_pension'),
      taxableWage: resultAmount(result, 'taxable_wage'),
      employeeInsuranceBase: resultAmount(result, 'employee_insurance_base'),
      zvwBase: resultAmount(result, 'zvw_base'),
      wageTax: resultAmount(result, 'wage_tax'),
      net: resultAmount(result, 'net_salary'),
      awf: resultAmount(result, 'employer_awf'),
      aof: resultAmount(result, 'employer_aof'),
      wko: resultAmount(result, 'employer_wko'),
      whk: resultAmount(result, 'employer_whk'),
      zvw: resultAmount(result, 'employer_zvw'),
      employerInsurance: resultAmount(result, 'employer_insurance'),
      holidayReserve: resultAmount(result, 'holiday_allowance_reserve'),
      totalEmployerCost: resultAmount(result, 'total_employer_cost'),
    }
    const htmlInput: Payrun01PayslipPdfInput = {
      data: {
        period: { year: 2026, month: 7, startsOn: '2026-07-01', endsOn: '2026-07-31' },
        lifecycle: 'CONCEPT',
        profile: {
          status: 'SYNTHETIC_TEST_PROFILE',
          employerName: 'Retail Mode TEST',
          employeeName: 'PAYD2 Retail R1 Testmedewerker',
          writtenContract: true,
          contractType: 'INDEFINITE',
          isOnCall: false,
          contractHoursPerWeek: 38,
          fulltimeHoursPerWeek: 38,
        },
        components: result.resultRows.map((row) => {
          if (typeof row.value !== 'string') throw new Error(`NON_MONEY_PAYSLIP_RESULT:${row.key}`)
          return { key: row.key, amount: row.value }
        }),
        sourceWarnings: ['Synthetische R1-proef; conceptbedragen niet voor uitbetaling. 8% vakantietoeslag is alleen als reserve opgenomen.'],
      },
      branding: { liquidHrLogoDataUrl: null },
      presentation: { templateId: LIQUIDHR_STANDARD_PAYSLIP_TEMPLATE_ID },
    }
    const html = renderPayrun01PayslipHtml(htmlInput)
    const pdf = await renderPayrun01PayslipPdf(htmlInput)

    expect(snapshot.sourceGaps).toEqual([])
    expect(sourceContract(snapshot).references.every((reference) => reference.status === 'BOUND')).toBe(true)
    expect(result.status).toBe('CALCULATED')
    expect(result.controls.filter((control) => control.status === 'FAIL')).toEqual([])
    expect(componentResults).toEqual({
      gross: oracle.gross,
      pensionableBase: oracle.monthlyPensionableBase,
      employeePension: oracle.employeePension,
      employerPension: oracle.employerPension,
      taxableWage: oracle.taxableWage,
      employeeInsuranceBase: oracle.taxableWage,
      zvwBase: oracle.taxableWage,
      wageTax: oracle.wageTax,
      net: oracle.net,
      awf: oracle.employerRates.awf,
      aof: oracle.employerRates.aof,
      wko: oracle.employerRates.wko,
      whk: oracle.employerRates.whk,
      zvw: oracle.employerRates.zvw,
      employerInsurance: oracle.employerRates.total,
      holidayReserve: oracle.holidayReserve,
      totalEmployerCost: oracle.totalEmployerCost,
    })
    expect(componentResults).toEqual({
      gross: '4767.20',
      pensionableBase: '3210.53',
      employeePension: '198.65',
      employerPension: '595.96',
      taxableWage: '4568.55',
      employeeInsuranceBase: '4568.55',
      zvwBase: '4568.55',
      wageTax: '1107.17',
      net: '3461.38',
      awf: '125.18',
      aof: '286.45',
      wko: '22.84',
      whk: '88.17',
      zvw: '278.68',
      employerInsurance: '801.32',
      holidayReserve: '381.38',
      totalEmployerCost: '6545.86',
    })
    expect(pension).toMatchObject({
      annualFranchise: '18680',
      totalPremiumRate: '24.75',
      employeeRate: '6.1875',
      employerRate: '18.5625',
      calculationStatus: 'CALCULATED',
    })
    expect((pension.calculationTrace as readonly { componentCode: string; result: string | null }[])
      .find((step) => step.componentCode === 'PENSION_PENSIONABLE_BASE')?.result).toBe(oracle.annualPensionableBase)
    expect(result.trace.find((step) => step.componentCode === 'NL_WAGE_TAX')?.registeredRuleTrace)
      .toContainEqual(expect.objectContaining({
        code: 'result.period-values',
        values: expect.objectContaining({
          tablePeriodWage: { valueType: 'MONEY', value: PAYD2_RETAIL_02_OFFICIAL_SOURCE_PINS.wageTaxTable.oracleTableWage },
          wageTax: { valueType: 'MONEY', value: oracle.wageTax },
        }),
      }))
    expect(resultAmount(result, 'cumulative_gross_wage')).toBe(oracle.gross)
    expect(payrollOwned.amounts).toMatchObject({ variableRegularWage: '0.00' })
    expect(componentResults.gross).toBe('4767.20')
    expect(componentResults.employeePension).toBe('198.65')
    expect(componentResults.employerPension).toBe('595.96')
    expect(oracle.pensionAllocationDifference).toBe('0.00')
    expect(componentResults.holidayReserve).toBe('381.38')
    expect(componentResults.taxableWage).toBe('4568.55')
    expect(componentResults.aof).toBe('286.45')
    expect(componentResults.totalEmployerCost).toBe(oracle.totalEmployerCost)
    expect(componentResults.totalEmployerCost).toBe('6545.86')
    expect(html).toContain('CONCEPT — NIET DEFINITIEF')
    expect(html).toContain('Lokale CONCEPT-proef op basis van synthetische TEST-invoer')
    expect(Buffer.from(pdf).subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(pdf.byteLength).toBeGreaterThan(1000)
    expect(result.sourceHash).toMatch(/^[a-f0-9]{64}$/)
    expect(result.inputHash).toMatch(/^[a-f0-9]{64}$/)
    expect(result.resultHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('binds R2 part-time pay, overlap-safe premiums, and actual-work source versions', async () => {
    const snapshot = await createRetailSourceSnapshot('R2')
    const source = canonical(snapshot)
    const contract = sourceContract(snapshot)
    const cao = retailCalculation(snapshot)
    const oracle = derivePayd2RetailR2IndependentOracle()
    const engineTrace = cao.componentTrace?.find((step) => step.componentCode === 'RETAIL_MODE_GROSS')
    const premiumTrace = engineTrace?.registeredRuleTrace?.find((step) => step.code === 'RETAIL_R2_BEST_OF_PREMIUMS_NO_DOUBLE_PAY')
    const actualWork = source.actualWork as { readonly entries: readonly Record<string, unknown>[] }

    expect(contract.references.every((reference) => reference.status === 'BOUND')).toBe(true)
    expect(contract.references.map((reference) => reference.sourceType)).toEqual(expect.arrayContaining([
      'actual_work_periods', 'work_hour_types', 'employment_work_hour_entries', 'synthetic_fixture',
    ]))
    expect(snapshot.sourceVersionVector).toMatchObject({
      [`actual_work_period:${sourceIds('R2').actualWorkPeriod}`]: '2026-08-01T09:00:00.000Z',
      [`retail_business_scope:${snapshot.sourceEmploymentId}`]: 'SYNTHETIC_FIXTURE:PAYD2-RETAIL-01-IN-STORE-v1',
    })
    expect(actualWork.entries).toHaveLength(4)
    expect(snapshot.sourceGaps).not.toContainEqual(expect.objectContaining({
      field: 'actualWork', reasonCode: 'OVERTIME_RULE_NOT_CONFIGURED',
    }))
    expect(cao).toMatchObject({
      status: 'CALCULATED',
      packageVersion: '2026.7',
      hourlyBaseRate: oracle.hourlyBaseRate,
      baseAmount: oracle.baseMonthlyGross,
      premiumAmount: oracle.selectedPremiumGross,
      grossAmount: oracle.gross,
      inputs: {
        scenarioCode: 'R2',
        functionGroup: 'C',
        experienceRow: '1',
        contractHoursPerWeek: '24',
        fullTimeHoursPerWeek: '38',
        weekdayNightHours: oracle.weekdayNightHours,
        sundayHours: oracle.sundayHours,
        dailyOvertimeHours: oracle.dailyOvertimeHours,
        isEcommerce: false,
      },
    })
    expect(premiumTrace?.values).toMatchObject({
      weekdayNightHours: { value: oracle.weekdayNightHours },
      sundayHours: { value: oracle.sundayHours },
      dailyOvertimeHours: { value: oracle.dailyOvertimeHours },
      dailyOvertimeOverlapHours: { value: oracle.overlappingOvertimeHours },
      dailyOvertimeOnlyHours: { value: oracle.overtimeOnlyHours },
      selectedPremiumGross: { value: oracle.selectedPremiumGross },
    })
    expect(source.caseProvenance).toMatchObject({
      premiumOverlap: {
        sourceClassification: 'SYNTHETIC_FIXTURE',
        explicitOvertimeOverlapHours: '2.0000',
      },
    })
    expect(source.fiscalProfile).toMatchObject({ status: 'SOURCE_GAP' })
    expect(source).not.toHaveProperty('payrollOwned')
  })

  it('blocks night-hour cases when retail business scope is missing or is e-commerce without time-band detail', async () => {
    const missingScope = await createRetailSourceSnapshot('R2', { businessScope: null })
    const eCommerce = await createRetailSourceSnapshot('R2', { eCommerceNight: true })
    const missingCalculation = retailCalculation(missingScope)
    const eCommerceCalculation = retailCalculation(eCommerce)

    expect(missingCalculation).toMatchObject({
      status: 'BLOCKED',
      blockingStatus: 'SOURCE_GAP',
      reasonCode: 'CAO_RETAIL_BUSINESS_SCOPE_UNVERIFIED',
    })
    expect(missingScope.sourceGaps).toContainEqual(expect.objectContaining({
      field: 'cao', status: 'SOURCE_GAP', reasonCode: 'CAO_RETAIL_BUSINESS_SCOPE_UNVERIFIED',
    }))
    expect(sourceContract(missingScope).references.map((reference) => reference.field)).not.toContain('retailBusinessScope')
    expect(eCommerceCalculation).toMatchObject({
      status: 'BLOCKED',
      blockingStatus: 'UNSUPPORTED',
      reasonCode: 'CAO_RETAIL_ECOMMERCE_NIGHT_BAND_UNSUPPORTED',
    })
    expect(eCommerce.sourceGaps).toContainEqual(expect.objectContaining({
      field: 'cao', status: 'UNSUPPORTED', reasonCode: 'CAO_RETAIL_ECOMMERCE_NIGHT_BAND_UNSUPPORTED',
    }))
    expect(eCommerceCalculation.grossAmount).toBeUndefined()
  })

  it('keeps R1 tax applicability and nonzero-opening VCR inputs fail-closed', async () => {
    const missingTaxProfile = await createRetailSourceSnapshot('R1', { omitR1FiscalProfile: true })
    const priorVcrOpening = await createRetailSourceSnapshot('R1', { nonZeroR1Opening: true })

    expect(missingTaxProfile.sourceGaps).toContainEqual(expect.objectContaining({
      field: 'taxProfile', status: 'SOURCE_GAP', reasonCode: 'CORE_FISCAL_PROFILE_SOURCE_UNAVAILABLE',
    }))
    expect(canonical(missingTaxProfile).fiscalProfile).toMatchObject({ status: 'SOURCE_GAP' })
    expect(priorVcrOpening.sourceGaps).toContainEqual(expect.objectContaining({
      field: 'pension', status: 'SOURCE_GAP', reasonCode: 'BPF_DETAILHANDEL_VCR_REQUIRES_ZERO_OPENING_FIRST_FULL_PERIOD',
    }))
  })

  it('does not render a payslip from the gross-only source gaps', async () => {
    const snapshot = await createRetailSourceSnapshot('R2')
    const cao = retailCalculation(snapshot)

    expect(() => renderPayrun01PayslipHtml({
      data: {
        period: { year: 2026, month: 7, startsOn: '2026-07-01', endsOn: '2026-07-31' },
        lifecycle: 'CONCEPT',
        profile: {
          status: 'SYNTHETIC_TEST_PROFILE',
          employerName: 'Retail Mode TEST',
          employeeName: 'PAYD2 Retail Testmedewerker',
          writtenContract: true,
          contractType: 'INDEFINITE',
          isOnCall: false,
          contractHoursPerWeek: 24,
          fulltimeHoursPerWeek: 38,
        },
        components: [{ key: 'gross_salary', amount: cao.grossAmount ?? '0.00' }],
        sourceWarnings: ['SOURCE_GAP: fiscal, employer, pension and cumulative inputs are not bound.'],
      },
      presentation: { templateId: LIQUIDHR_STANDARD_PAYSLIP_TEMPLATE_ID },
    })).toThrow('PAYRUN01_PAYSLIP_RESULT_INCOMPLETE')
  })
})
