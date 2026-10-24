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
import type { CaoPayrollCalculation, CaoRetailBusinessScope } from './cao-payroll-integration'
import { hashPayrollSourceSnapshot } from './source/snapshot-hash'
import { assertActivePayrollEmployerConfiguration, hashPayrollEmployerConfiguration } from './payroll-setup'
import { createPayfull02RulePackage, PAYFULL02_RULE_REGISTRY } from '@liquid-hr/payroll-rules-nl-2026'
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

export const PAYW02B_R2_OFFICIAL_SOURCE_PINS = {
  cao: {
    version: 'Cao Retail Non-Food, definitieve versie juli 2026',
    appliesFrom: '2026-07-01',
    appliesThrough: '2027-06-30',
    url: 'https://www.inretail.nl/wp-content/uploads/2026/05/260527-Cao-Retail-Non-Food-juli-2026-def.pdf',
    sha256: 'ec6fd7a8ee7c3b1f18f58ac6cc5081d6a72e053405480e346eb8a4c7d1e1d2cc',
  },
  taxRules: {
    version: 'Belastingdienst Rekenvoorschriften loonadministratie 2026 januari v2',
    appliesFrom: '2026-01-01',
    appliesThrough: '2026-12-31',
    url: 'https://download.belastingdienst.nl/belastingdienst/docs/rekenvoorschriften_voor_geautomatiseerde_loonadministratie_lh991z62fd.pdf',
    sha256: '283c1857d923e8cc9ed7d0a33ae6f6c0c8f35db6c886d67ee2289324cfe58a03',
  },
  taxParameters: {
    version: 'Belastingdienst parameterbijlage loonadministratie 2026 januari',
    appliesFrom: '2026-01-01',
    appliesThrough: '2026-12-31',
    url: 'https://download.belastingdienst.nl/belastingdienst/docs/bijlage_rekenvoorschr_voor_geauto_loonadm_pdf_lh991b61fd.pdf',
    sha256: 'fb64f97320f4e7241a2d8c8cf13540579282e5f34156be986f540eb8dbd5ab48',
  },
  whiteMonthlyTable: {
    version: 'Belastingdienst Witte Maandloon-tabel Nederland Standaard v01, januari 2026',
    appliesFrom: '2026-01-01',
    appliesThrough: '2026-12-31',
    url: 'https://download.belastingdienst.nl/belastingdienst/dl/rekenhulpen/loonheffing/2026/v01/pdf/wit_mnd_nl_std_20260101.pdf',
    sha256: 'c959d65273e18a1a2fdf33562fd34e31d45d3bca0f260ea232815d28e69284dc',
  },
  pensionPremium: {
    version: 'Pensioenfonds Detailhandel Premieoverzicht 2026',
    appliesFrom: '2026-01-01',
    appliesThrough: '2026-12-31',
    url: 'https://pensioenfondsdetailhandel.nl/content/Publicaties/Rekenvoorbeelden/Premieoverzicht-2026.pdf',
    sha256: '494bc0fb3c3136d0048c053339a5e40cfb79d4620d37be791d7f738e95508f3d',
  },
  pensionVcr: {
    version: 'Pensioenfonds Detailhandel Rekenvoorbeelden 2026 VCR-maandmethode',
    appliesFrom: '2026-01-01',
    appliesThrough: '2026-12-31',
    url: 'https://pensioenfondsdetailhandel.nl/content/Publicaties/Rekenvoorbeelden/Rekenvoorbeelden-2026.pdf',
    sha256: '5a2cb3d329a1aef6c4e521448c70540501dc290e73648f36f6df87143a4cb16f',
  },
  pensionObligation: {
    version: 'Pensioenfonds Detailhandel verplichtstelling; werkgeversinformatie',
    appliesFrom: '2026-01-01',
    appliesThrough: '2026-12-31',
    url: 'https://pensioenfondsdetailhandel.nl/werkgever-en-administratiekantoor/situaties-en-wijzigingen/verplichtstelling',
    sha256: '76a5a8e8b26aeefddf362262ff72bc576f57a8c38c69fd38df2bb7fcf5de70a9',
  },
} as const

const PAYW02B_R2_PENSION_TERMS = {
  version: 'BPF-DETAILHANDEL-2026-v1',
  totalRate: 24.75,
  maximumEmployeeSharePercent: 25,
  employerSharePercent: 75,
  annualFranchise: 18_680,
  annualPensionableSalaryCap: 79_409,
  employeeRate: '6.1875',
  employerRate: '18.5625',
} as const

const PAYW02B_R2_EMPLOYER_PARAMETERS = {
  version: 'SYNTHETIC-R2-EMPLOYER-2026-v1',
  rates: { awf: '2.74', aof: '6.27', wko: '0.50', whk: '1.93', zvw: '6.10' },
  holidayAllowanceRate: '8.00',
  yearEndRate: '0.00',
} as const

export type RetailCase = 'R1' | 'R2'
export type SnapshotOptions = {
  readonly businessScope?: CaoRetailBusinessScope | null
  readonly eCommerceNight?: boolean
  readonly omitR1FiscalProfile?: boolean
  readonly nonZeroR1Opening?: boolean
  readonly completeR2PayrollSource?: boolean
  readonly omitR2FiscalProfile?: boolean
  readonly omitR2PensionSource?: boolean
  readonly omitR2EmployerConfiguration?: boolean
  readonly omitR2OpeningCumulative?: boolean
  readonly nonZeroR2OpeningCumulative?: boolean
  readonly invalidR2TaxProfileEffectiveDate?: boolean
  readonly invalidR2TaxProfileVersion?: boolean
}
export const scope = {
  tenantId: '16000000-0000-4000-8000-000000000061',
  hrGroupId: '26000000-0000-4000-8000-000000000062',
  administrationId: '36000000-0000-4000-8000-000000000063',
}

export function sourceIds(caseCode: RetailCase) {
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
  const completeR2 = !r1 && options.completeR2PayrollSource === true
  const firstEmploymentDate = r1 || completeR2 ? '2026-07-01' : '2026-01-01'
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
    source_reference: completeR2
      ? 'SYNTHETIC_FIXTURE:PAY-W02B-R2-NET-ORACLE-01; fictional NL resident under AOW age with loonheffingskorting on this single IKV'
      : 'SYNTHETIC_FIXTURE:PAYD2-RETAIL-02; fictional NL resident under AOW age with loonheffingskorting on this single IKV',
    effective_from: completeR2 && options.invalidR2TaxProfileEffectiveDate ? '2026-02-30' : firstEmploymentDate,
    effective_to: null,
    version_number: completeR2 && options.invalidR2TaxProfileVersion ? 0 : 1,
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
    provenance_json: {
      status: 'USER_RECORDED',
      sourceClassification: 'SYNTHETIC_FIXTURE',
      fixtureId: completeR2 ? 'PAY-W02B-R2-NET-ORACLE-01' : 'PAYD2-RETAIL-02',
    },
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
      fixtureId: completeR2 ? 'PAY-W02B-R2-NET-ORACLE-01' : 'PAYD2-RETAIL-02',
      laborConditionMappingId: pensionMapping.id,
      laborConditionMappingVersion: pensionMapping.version_number,
      obligationAssumption: completeR2
        ? 'Synthetic test stipulates pension participation for calculation only; real employer or employee applicability remains SOURCE_GAP.'
        : 'Fictional clothing retailer meets the Retail Non-Food scope and is not exempt; legal applicability for a real employer is not established.',
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
      flat_total_rate: completeR2 ? PAYW02B_R2_PENSION_TERMS.totalRate : 24.75,
      employer_share_pct: completeR2 ? PAYW02B_R2_PENSION_TERMS.employerSharePercent : 75,
      employee_share_pct: completeR2 ? PAYW02B_R2_PENSION_TERMS.maximumEmployeeSharePercent : 25,
      annual_franchise: completeR2 ? PAYW02B_R2_PENSION_TERMS.annualFranchise : 18680,
      annual_pensionable_salary_cap: completeR2 ? PAYW02B_R2_PENSION_TERMS.annualPensionableSalaryCap : 79409,
      pensionable_salary_definition: {
        method: 'BPF_DETAILHANDEL_2026_VCR',
        annualization: '12_X_REGULAR_MONTHLY_PENSIONABLE_SALARY',
        basis: 'ANNUAL_PENSIONABLE_SALARY_MINUS_FRANCHISE',
        floorAtZero: true,
        firstPeriodOnly: true,
        vcrSource: completeR2 ? PAYW02B_R2_OFFICIAL_SOURCE_PINS.pensionVcr : PAYD2_RETAIL_02_OFFICIAL_SOURCE_PINS.bpfDetailhandelVcr,
        premiumSource: completeR2 ? PAYW02B_R2_OFFICIAL_SOURCE_PINS.pensionPremium : PAYD2_RETAIL_02_OFFICIAL_SOURCE_PINS.bpfDetailhandelRates,
      },
      eligibility_rule: { participantGroup: 'NEW_ENTRANT', employmentOrParticipationStartOnOrAfter: '2026-01-01' },
      contract_classification: 'UNKNOWN' as const,
      contract_classification_provenance: { status: 'NOT_USED_FOR_FLAT_PREMIUM_FIRST_PERIOD' },
      provenance_json: {
        status: 'SYNTHETIC_FIXTURE',
        fixtureId: completeR2 ? 'PAY-W02B-R2-NET-ORACLE-01' : 'PAYD2-RETAIL-02',
        officialSources: {
          premium: completeR2 ? PAYW02B_R2_OFFICIAL_SOURCE_PINS.pensionPremium : PAYD2_RETAIL_02_OFFICIAL_SOURCE_PINS.bpfDetailhandelRates,
          vcr: completeR2 ? PAYW02B_R2_OFFICIAL_SOURCE_PINS.pensionVcr : PAYD2_RETAIL_02_OFFICIAL_SOURCE_PINS.bpfDetailhandelVcr,
          obligation: completeR2 ? PAYW02B_R2_OFFICIAL_SOURCE_PINS.pensionObligation : PAYD2_RETAIL_02_OFFICIAL_SOURCE_PINS.bpfDetailhandelObligation,
          cao: completeR2 ? PAYW02B_R2_OFFICIAL_SOURCE_PINS.cao : PAYD2_RETAIL_02_OFFICIAL_SOURCE_PINS.cao,
        },
        selectedContributionSplit: completeR2
          ? 'BPF Detailhandel 2026 total rate and maximum employee share are source-pinned; this synthetic scenario allocates the remaining share to the employer.'
          : 'Official 2026 maximum employee share 6.1875%; fictional employer allocates remaining 18.5625% to itself.',
        calculationScope: completeR2
          ? 'One full July 2026 first period for a synthetic 2026-07-01 employment with an explicit zero opening cumulative; no real applicability is asserted.'
          : 'One full first monthly period with zero opening cumulative; annual multi-period VCR reconciliation is not asserted.',
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
    ...(r1 || completeR2 ? { allocatePensionRoundingRemainderToEmployer: true } : {}),
  })
  const hasPayrollConfiguration = (r1 || completeR2)
    && !(completeR2 && options.omitR2EmployerConfiguration)
  const configuration = hasPayrollConfiguration ? assertActivePayrollEmployerConfiguration({
    schemaVersion: 'payroll-employer-configuration-v1',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    status: 'ACTIVE',
    sourceReference: completeR2
      ? 'SYNTHETIC_FIXTURE:PAY-W02B-R2-NET-ORACLE-01; fictional small Retail Non-Food employer with stipulated classifications and employer rates; not a real employer decision'
      : 'SYNTHETIC_FIXTURE:PAYD2-RETAIL-02; fictitious small clothing retailer, permanent written contract, sector 17 and assumed no employer exemption',
    employer: {
      sectorCode: '17',
      whkDecisionReference: completeR2 ? 'SYNTHETIC-WHK-PAY-W02B-R2-2026-v1' : 'SYNTHETIC-WHK-2026-RETAIL-17-SMALL',
      awfClassification: 'LOW',
      aofClassification: 'AOF-01',
      wkoClassification: 'WKO-01',
      zvwClassification: 'EMPLOYER_LEVY',
    },
    employerRates: completeR2
      ? PAYW02B_R2_EMPLOYER_PARAMETERS.rates
      : { awf: '2.74', aof: '6.27', wko: '0.50', whk: '1.93', zvw: '6.10' },
    reserves: {
      holidayAllowanceRate: completeR2 ? PAYW02B_R2_EMPLOYER_PARAMETERS.holidayAllowanceRate : '8.00',
      yearEndApplies: false,
      yearEndRate: completeR2 ? PAYW02B_R2_EMPLOYER_PARAMETERS.yearEndRate : '0.00',
    },
    componentSet: {
      compositionId: retailFullPackage.compositionId,
      packageVersion: retailFullPackage.metadata?.version ?? '2026.1',
      packageHash: retailFullPackage.metadata?.packageHash ?? '',
    },
    pension: {
      partialMonthMethod: 'CALENDAR_DAYS_PRO_RATA',
      methodSourceReference: completeR2
        ? 'SYNTHETIC_FIXTURE:PAY-W02B-R2-NET-ORACLE-01; full July period and synthetic employment starts on 2026-07-01'
        : 'SYNTHETIC_FIXTURE:PAYD2-RETAIL-02; full July period, new employment starts on 2026-07-01',
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
      grossWageBeforePeriod: options.nonZeroR1Opening || options.nonZeroR2OpeningCumulative ? '1.00' : '0.00',
      taxableWageBeforePeriod: '0.00',
      wageTaxBeforePeriod: '0.00',
      employeeInsuranceWageBeforePeriod: '0.00',
      zvwWageBeforePeriod: '0.00',
      holidayReserveBeforePeriod: '0.00',
      yearEndReserveBeforePeriod: '0.00',
    },
    sourceReference: completeR2
      ? 'SYNTHETIC_FIXTURE:PAY-W02B-R2-NET-ORACLE-01; explicitly zero opening cumulative before the first July 2026 payroll period'
      : 'SYNTHETIC_FIXTURE:PAYD2-RETAIL-02; zero opening cumulative before fictional first employment/IKV on 2026-07-01',
  }
  const openingBalance = (r1 || completeR2) && !(completeR2 && options.omitR2OpeningCumulative) ? {
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
    ...(r1 || completeR2 ? {
      ...(!options.omitR1FiscalProfile && !(completeR2 && options.omitR2FiscalProfile) ? { taxProfileProjection } : {}),
      ...(!completeR2 || !options.omitR2PensionSource ? {
        pensionAssignments: [pensionAssignment],
        laborConditionPensionArrangements: [pensionMapping],
      } : {}),
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

export async function createRetailSourceSnapshot(
  caseCode: RetailCase,
  options: SnapshotOptions = {},
): Promise<PayrollSourceSnapshot> {
  const fixture = createSnapshotFixture(caseCode, options)
  const completeR2 = caseCode === 'R2' && options.completeR2PayrollSource === true
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
      ...(completeR2 ? {
        officialRuleSources: PAYW02B_R2_OFFICIAL_SOURCE_PINS,
        syntheticPayrollInputs: {
          fixtureId: 'PAY-W02B-R2-NET-ORACLE-01',
          sourceClassification: 'SYNTHETIC_FIXTURE',
          legalConformityClaim: false,
          employmentStartsOn: '2026-07-01',
          period: '2026-07',
          wageTaxRuleVersion: 'NL-2026-01',
          pensionRuleVersion: 'BPF-DETAILHANDEL-2026-v1',
          employerRuleVersion: 'SYNTHETIC-R2-EMPLOYER-2026-v1',
          realEmployerAndPensionApplicability: 'SOURCE_GAP',
          realEmployeeFiscalDeclarations: 'SOURCE_GAP',
          openingCumulatives: options.omitR2OpeningCumulative
            ? 'MISSING'
            : options.nonZeroR2OpeningCumulative ? 'AMBIGUOUS' : 'EXPLICIT_ZERO_FIRST_PERIOD',
          dependencyMatrix: [
            { field: 'employment-period-hours', status: 'AVAILABLE', version: 'SYNTHETIC-R2-EMPLOYMENT-2026-07-v1' },
            { field: 'fulltime-parttime-salary', status: 'AVAILABLE', version: 'SYNTHETIC-R2-SALARY-2026-07-v1' },
            { field: 'cao-salary-premium-rules', status: 'AVAILABLE', version: 'CAO-RETAIL-NON-FOOD-2026.7' },
            { field: 'fiscal-parameters', status: 'AVAILABLE', version: 'NL-2026-01' },
            { field: 'employee-tax-declarations', status: options.omitR2FiscalProfile
              || options.invalidR2TaxProfileEffectiveDate || options.invalidR2TaxProfileVersion ? 'MISSING' : 'AVAILABLE', version: 'SYNTHETIC-R2-FISCAL-PROFILE-v1' },
            { field: 'pension-arrangement-base-franchise-rates', status: options.omitR2PensionSource ? 'MISSING' : 'AVAILABLE', version: 'BPF-DETAILHANDEL-2026-v1' },
            { field: 'employer-contributions-and-reserves', status: options.omitR2EmployerConfiguration ? 'MISSING' : 'AVAILABLE', version: 'SYNTHETIC-R2-EMPLOYER-2026-v1' },
            { field: 'opening-cumulative-values', status: options.omitR2OpeningCumulative
              ? 'MISSING'
              : options.nonZeroR2OpeningCumulative ? 'AMBIGUOUS' : 'AVAILABLE', version: 'SYNTHETIC-R2-OPENING-2026-07-v1' },
            { field: 'net-reimbursements-and-deductions', status: 'AVAILABLE', version: 'SYNTHETIC-R2-NET-ITEMS-2026-07-v1' },
            { field: 'real-employer-and-pension-applicability', status: 'MISSING', version: 'NOT_BOUND' },
          ],
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

export function canonical(snapshot: PayrollSourceSnapshot): Record<string, unknown> {
  return snapshot.canonicalSource as Record<string, unknown>
}

export function calculateRetailR1(snapshot: PayrollSourceSnapshot) {
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

export function resultAmount(result: ReturnType<typeof calculateRetailR1>, key: string): string {
  const row = result.resultRows.find((candidate) => candidate.key === key)
  if (!row || typeof row.value !== 'string') throw new Error(`PAYD2_RETAIL_R1_RESULT_MISSING:${key}`)
  return row.value
}

export function retailCalculation(snapshot: PayrollSourceSnapshot): CaoPayrollCalculation {
  return canonical(snapshot).caoCalculation as CaoPayrollCalculation
}

export function sourceContract(snapshot: PayrollSourceSnapshot): {
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
