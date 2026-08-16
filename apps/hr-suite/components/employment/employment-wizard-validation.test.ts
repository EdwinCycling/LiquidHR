import { describe, expect, it } from 'vitest'
import { canSubmitEmploymentWizard, hasMissingEmploymentPrerequisites, isEmploymentWizardStepValid, type EmploymentWizardValidationInput, type EmploymentWizardValidationOptions } from './employment-wizard-validation'

const validInput: EmploymentWizardValidationInput = {
  administrationId: 'administration', nationality: 'NL', birthDate: '1990-01-01', gender: 'MALE', employmentNumber: 'EMP-001', startsOn: '2026-08-08', seniorityDate: '2026-08-08', countryCode: 'NL', ikvNumber: '1',
  employmentType: 'EMPLOYEE', flexPhaseId: 'flex', laborConditionSetId: 'labor', durationType: 'INDEFINITE', endsOn: '', probationApplies: false, probationEndsOn: '',
  weeklyHours: '40', days: { monday: '8', tuesday: '8', wednesday: '8', thursday: '8', friday: '8', saturday: '0', sunday: '0' }, secondWeekDays: { monday: '8', tuesday: '8', wednesday: '8', thursday: '8', friday: '8', saturday: '0', sunday: '0' }, twoWeekRoster: false, salaryBasis: 'MANUAL', salaryFrequencyId: 'monthly', fulltimeAmount: '3000', salaryScaleStepId: '', jobGroupId: 'group', jobId: 'job', departmentId: 'department',
  allocations: [{ costCenterId: 'center', costCarrierId: 'carrier' }],
}

const validOptions: EmploymentWizardValidationOptions = {
  optionsLoading: false, payrollDetails: true, canWriteSalary: true, minimumRateAvailable: true, rosterMatches: true, allocationsMatch: true,
}

describe('employment wizard validation', () => {
  it('requires every prerequisite field before the administration flow can continue', () => {
    expect(hasMissingEmploymentPrerequisites({ countryCode: '', nationality: 'NL', birthDate: '2026-01-01', gender: 'MALE' })).toBe(true)
    expect(hasMissingEmploymentPrerequisites({ countryCode: 'NL', nationality: '', birthDate: '2026-01-01', gender: 'MALE' })).toBe(true)
    expect(hasMissingEmploymentPrerequisites({ countryCode: 'NL', nationality: 'NL', birthDate: '', gender: 'MALE' })).toBe(true)
    expect(hasMissingEmploymentPrerequisites({ countryCode: 'NL', nationality: 'NL', birthDate: '2026-01-01', gender: '' })).toBe(true)
    expect(hasMissingEmploymentPrerequisites({ countryCode: 'NL', nationality: 'NL', birthDate: '2026-01-01', gender: 'MALE' })).toBe(false)
  })

  it('rejects a missing required value on every employment wizard tab', () => {
    const missingByStep: Array<[Parameters<typeof isEmploymentWizardStepValid>[0], Partial<EmploymentWizardValidationInput>, Partial<EmploymentWizardValidationOptions>]> = [
      ['administration', { administrationId: '' }, {}],
      ['employment', { employmentNumber: '' }, {}],
      ['contract', { laborConditionSetId: '' }, {}],
      ['schedule', { weeklyHours: '' }, { rosterMatches: false }],
      ['salary', { fulltimeAmount: '' }, {}],
      ['other', { departmentId: '' }, {}],
    ]

    for (const [step, input, options] of missingByStep) {
      expect(isEmploymentWizardStepValid(step, { ...validInput, ...input }, { ...validOptions, ...options })).toBe(false)
    }
  })

  it('requires an explicit worker type before continuing from employment details', () => {
    expect(isEmploymentWizardStepValid('employment', { ...validInput, employmentType: '' }, validOptions)).toBe(false)
  })

  it('requires an explicit payroll choice before continuing', () => {
    expect(isEmploymentWizardStepValid('payrollChoice', validInput, { ...validOptions, payrollDetails: null })).toBe(false)
    expect(isEmploymentWizardStepValid('payrollChoice', validInput, { ...validOptions, payrollDetails: true })).toBe(true)
    expect(isEmploymentWizardStepValid('payrollChoice', validInput, { ...validOptions, payrollDetails: false })).toBe(true)
  })

  it('only allows saving from the review step', () => {
    expect(canSubmitEmploymentWizard('other')).toBe(false)
    expect(canSubmitEmploymentWizard('payrollChoice')).toBe(false)
    expect(canSubmitEmploymentWizard('contract')).toBe(false)
    expect(canSubmitEmploymentWizard('review')).toBe(true)
  })

  it('keeps a two-week roster on the agreed weekly average', () => {
    const twoWeekInput = {
      ...validInput,
      twoWeekRoster: true,
      secondWeekDays: { monday: '8', tuesday: '8', wednesday: '8', thursday: '8', friday: '8', saturday: '0', sunday: '0' },
    }
    expect(isEmploymentWizardStepValid('schedule', twoWeekInput, validOptions)).toBe(true)
    expect(isEmploymentWizardStepValid('schedule', { ...twoWeekInput, secondWeekDays: { ...twoWeekInput.secondWeekDays, monday: '9' } }, validOptions)).toBe(false)
    expect(isEmploymentWizardStepValid('schedule', { ...validInput, days: { ...validInput.days, monday: '-1' } }, validOptions)).toBe(false)
  })

  it('treats roster fractions as minutes instead of decimal hours', () => {
    const minuteRoster = {
      ...validInput,
      weeklyHours: '37.5',
      days: { monday: '7,30', tuesday: '7,30', wednesday: '7,30', thursday: '7,30', friday: '7,30', saturday: '0', sunday: '0' },
    }
    expect(isEmploymentWizardStepValid('schedule', minuteRoster, validOptions)).toBe(true)
  })

  it('keeps probation outside the contract as a warning', () => {
    expect(isEmploymentWizardStepValid('contract', {
      ...validInput,
      durationType: 'DEFINITE',
      startsOn: '2026-08-08',
      endsOn: '2026-09-08',
      probationApplies: true,
      probationEndsOn: '2026-09-09',
    }, validOptions)).toBe(true)
  })

  it('keeps legal probation warnings non-blocking during review', () => {
    expect(isEmploymentWizardStepValid('contract', {
      ...validInput,
      durationType: 'DEFINITE',
      startsOn: '2026-08-08',
      endsOn: '2027-02-07',
      probationApplies: true,
      probationEndsOn: '2026-09-08',
    }, validOptions)).toBe(true)
  })
})
