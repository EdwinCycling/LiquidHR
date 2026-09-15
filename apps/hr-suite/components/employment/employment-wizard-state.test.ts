import { describe, expect, it } from 'vitest'
import { applyOnCallToggle, buildEmploymentWizardPayload } from './employment-wizard-state'

const sections = {
  employment: {
    employmentNumber: '100021', employmentType: 'EMPLOYEE' as const, startsOn: '2026-07-01', seniorityDate: '2026-07-01', countryCode: 'NL', isPrimary: true,
  },
  details: {
    incomeRelationship: { ikvNumber: 1, payrollTaxSubnumber: '0001', validFrom: '2026-07-01' },
    contract: { workerType: 'EMPLOYEE' as const, flexPhaseId: null, laborConditionSetId: 'labor', durationType: 'DEFINITE' as const, startsOn: '2026-07-01', endsOn: '2027-06-30', probationApplies: false, probationEndsOn: null },
    schedule: { scheduleType: 'HOURS_AND_AVG_DAYS' as const, startWeek: 1, averageDaysPerWeek: 3, averageHoursPerWeek: 20, partTimeFactor: 0.5, timeForTimeAccrual: 0, mondayHours: null, tuesdayHours: null, wednesdayHours: null, thursdayHours: null, fridayHours: null, saturdayHours: null, sundayHours: null, isOnCall: true, onCallObligation: true, workScope: 'PART_TIME' as const, validFrom: '2026-07-01' },
    salary: { paymentType: 'PERIODIC_FIXED' as const, paymentFrequency: 'MONTHLY' as const, salaryBasis: 'MANUAL' as const, salaryRoute: 'MANUAL' as const, minimumWageScheme: null, fulltimeAmount: 3000, parttimeAmount: 1500, hourlyRate: null, currencyCode: 'EUR', salaryFrequencyId: 'monthly', salaryScaleStepId: null, salaryStructureId: null, salaryScaleId: null, salaryStepCode: null, salaryBandId: null, caoScaleName: null, caoStepName: null, validFrom: '2026-07-01' },
    organization: { departmentId: 'directie', jobId: 'monteur', jobTitle: 'Monteur', managerEmployeeId: 'lisa-test', effectiveFrom: '2026-07-01' },
    costAllocation: { validFrom: '2026-07-01', allocations: [{ costCenterId: 'general', costCarrierId: 'allocation', percentage: 100 }] },
  },
}

describe('employment wizard state', () => {
  it('keeps weekly hours, full-time reference and factor when on-call is enabled', () => {
    const before = { isOnCall: false, onCallObligation: true, weeklyHours: '20', fulltimeReference: '40', partTimeFactor: '0.5' }
    expect(applyOnCallToggle(before, true)).toEqual({ ...before, isOnCall: true })
  })

  it('keeps contract, schedule and organization when payroll details are skipped', () => {
    const payload = buildEmploymentWizardPayload({ showPayrollChoice: true, payrollDetails: false, canWriteSalary: true, sections })

    expect(payload.contract).toEqual(sections.details.contract)
    expect(payload.schedule).toEqual(sections.details.schedule)
    expect(payload.organization).toEqual(sections.details.organization)
    expect(payload.salary).toBeUndefined()
  })

  it('passes the explicitly selected manager through instead of deriving a department default', () => {
    const payload = buildEmploymentWizardPayload({ showPayrollChoice: true, payrollDetails: false, canWriteSalary: true, sections })

    expect(payload.organization?.managerEmployeeId).toBe('lisa-test')
  })
})
