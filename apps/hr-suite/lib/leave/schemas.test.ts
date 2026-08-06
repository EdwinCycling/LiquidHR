import { describe, expect, it } from 'vitest'
import { balanceReportQuerySchema, leaveCatalogMutationSchema, leaveConfigurationMutationSchema, overtimeConfigurationMutationSchema, workHourConfigurationMutationSchema } from './schemas'

describe('leave api schemas', () => {
  it('accepteert een rapportdatum en optioneel dienstverband', () => {
    expect(balanceReportQuerySchema.parse({ employmentId: 'employment-1', asOfDate: '2026-06-30' })).toEqual({
      employmentId: 'employment-1',
      asOfDate: '2026-06-30',
    })
  })

  it('weigert onbekende queryvelden', () => {
    expect(balanceReportQuerySchema.safeParse({ year: '2026' }).success).toBe(false)
  })

  it('dwingt de juiste limietconfiguratie per verlofrechtvorm af', () => {
    expect(leaveCatalogMutationSchema.safeParse({
      action: 'LEAVE_TYPE',
      name: 'Zorgverlof',
      colorCode: '#10b981',
      scope: 'OTHER',
      entitlementMode: 'ANNUAL_HOURS_CAP',
    }).success).toBe(false)
    const parsed = leaveCatalogMutationSchema.parse({
      action: 'LEAVE_TYPE',
      name: 'Zorgverlof',
      colorCode: '#10b981',
      scope: 'OTHER',
      entitlementMode: 'UNLIMITED',
    })
    expect(parsed.action === 'LEAVE_TYPE' && parsed.isSelfService).toBe(true)
  })

  it('vereist gekoppelde werkurentypen voor opbouw per gewerkt uur', () => {
    const result = leaveConfigurationMutationSchema.safeParse({
      action: 'ACCRUAL_RULE',
      leaveProfileId: 'profile-1',
      leaveTypeId: 'leave-1',
      validFrom: '2026-01-01',
      accrualBasis: 'WORKED_HOURS',
      accrualFrequency: 'YEARLY',
      accrualTiming: 'ARREARS',
      accrualRate: 0.083333,
      expirationMonths: 6,
      workHourTypeIds: [],
      pauseLeaveTypeIds: [],
    })
    expect(result.success).toBe(false)
  })

  it('ondersteunt leeftijd/anciënniteit zonder hoeveelheid of werkurentypen', () => {
    const result = leaveConfigurationMutationSchema.safeParse({
      action: 'BONUS_RULE',
      leaveProfileId: 'profile-1',
      leaveTypeId: 'leave-1',
      name: 'Seniorendagen',
      triggerType: 'AGE',
      awardTiming: 'START_OF_YEAR',
      tiers: [{ thresholdYears: 55, bonusAmount: 8 }],
    })
    expect(result.success).toBe(true)
  })

  it('accepteert een verlofuitzondering voor meerdere medewerkers', () => {
    const result = leaveConfigurationMutationSchema.safeParse({
      action: 'ACCRUAL_EXCEPTION',
      employmentSelections: [{ employeeId: 'employee-1', employmentId: 'employment-1' }, { employeeId: 'employee-2', employmentId: 'employment-2' }],
      leaveTypeId: 'leave-1',
      validFrom: '2026-01-01',
      noAccrual: false,
      accrualAmount: 12,
      expirationMonths: 6,
      reason: 'Collectieve afspraak',
    })
    expect(result.success).toBe(true)
  })

  it('accepteert groepsbrede medewerkersets en arbeidsverbandleden', () => {
    expect(leaveConfigurationMutationSchema.safeParse({
      action: 'EMPLOYEE_SET',
      name: 'Parttimers',
      leaveProfileId: 'profile-1',
      priority: 10,
    }).success).toBe(true)
    expect(leaveConfigurationMutationSchema.safeParse({
      action: 'EMPLOYEE_SET_MEMBER',
      employeeSetId: 'set-1',
      employeeId: 'employee-1',
      validFrom: '2026-01-01',
    }).success).toBe(true)
  })

  it('valideert de vier overwerklimieten en de invoerblokkade voor uitzonderingen', () => {
    expect(overtimeConfigurationMutationSchema.safeParse({
      action: 'OVERTIME_SETTINGS',
      workHourTypeId: 'overtime-1',
      notifyManagerOnEntry: true,
      isSelfService: true,
      limitMode: 'MONTHLY_HOURS',
      limitHours: 24,
    }).success).toBe(true)
    expect(overtimeConfigurationMutationSchema.safeParse({
      action: 'OVERTIME_EXCEPTION',
      workHourTypeId: 'overtime-1',
      employeeIds: ['employee-1'],
      allowOvertimeEntry: false,
      isSelfService: false,
      limitMode: 'UNLIMITED',
    }).success).toBe(true)
    expect(overtimeConfigurationMutationSchema.safeParse({
      action: 'OVERTIME_SETTINGS',
      workHourTypeId: 'overtime-1',
      notifyManagerOnEntry: false,
      isSelfService: true,
      limitMode: 'CONTRACT_HOURS_FACTOR',
    }).success).toBe(false)
  })

  it('hergebruikt de vier beperkingstypen voor werkuren en ondersteunt uitzonderingen', () => {
    expect(workHourConfigurationMutationSchema.safeParse({
      action: 'WORK_HOUR_SETTINGS',
      workHourTypeId: 'work-1',
      isActive: true,
      isSelfService: false,
      pinInCalendar: true,
      notifyManagerOnEntry: false,
      limitMode: 'UNLIMITED',
    }).success).toBe(true)
    expect(workHourConfigurationMutationSchema.safeParse({
      action: 'WORK_HOUR_EXCEPTION',
      workHourTypeId: 'work-1',
      employeeIds: ['employee-1', 'employee-2'],
      isSelfService: true,
      limitMode: 'CONTRACT_HOURS_FACTOR',
      contractHoursFactor: 1.25,
    }).success).toBe(true)
    expect(workHourConfigurationMutationSchema.safeParse({
      action: 'WORK_HOUR_EXCEPTION',
      workHourTypeId: 'work-1',
      employeeIds: ['employee-1'],
      isSelfService: true,
      limitMode: 'MONTHLY_HOURS',
    }).success).toBe(false)
  })

  it('accepteert een bonusregel met ten minste een trede', () => {
    const result = leaveConfigurationMutationSchema.safeParse({
      action: 'BONUS_RULE',
      leaveProfileId: 'profile-1',
      leaveTypeId: 'leave-1',
      name: 'Leeftijdsbonus',
      triggerType: 'AGE',
      awardTiming: 'START_OF_YEAR',
      proRateFirstYear: true,
      isActive: true,
      tiers: [{ thresholdYears: 50, bonusAmount: 8 }],
    })
    expect(result.success).toBe(true)
  })

  it('bewaakt een unieke, aaneengesloten afboekvolgorde', () => {
    const valid = leaveConfigurationMutationSchema.safeParse({
      action: 'PRIORITY_RULE',
      leaveProfileId: 'profile-1',
      name: 'Vakantie',
      validFrom: '2026-01-01',
      items: [
        { leaveTypeId: 'statutory', sortOrder: 1 },
        { leaveTypeId: 'adv', sortOrder: 2 },
      ],
    })
    expect(valid.success).toBe(true)

    const invalid = leaveConfigurationMutationSchema.safeParse({
      action: 'UPDATE_PRIORITY_RULE',
      id: 'priority-1',
      leaveProfileId: 'profile-1',
      name: 'Vakantie',
      validFrom: '2026-01-01',
      items: [
        { leaveTypeId: 'statutory', sortOrder: 1 },
        { leaveTypeId: 'statutory', sortOrder: 3 },
      ],
    })
    expect(invalid.success).toBe(false)

    const invalidPeriod = leaveConfigurationMutationSchema.safeParse({
      action: 'PRIORITY_RULE',
      leaveProfileId: 'profile-1',
      name: 'Vakantie',
      validFrom: '2026-06-01',
      validUntil: '2026-05-31',
      items: [{ leaveTypeId: 'statutory', sortOrder: 1 }],
    })
    expect(invalidPeriod.success).toBe(false)
  })
})
