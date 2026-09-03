import { describe, expect, it } from 'vitest'
import { buildEmploymentReviewDetailItems, type EmploymentReviewDetailValues } from './employment-create-form'
import { resolveEffectiveEmploymentSalary } from './employment-salary-resolution'

describe('buildEmploymentReviewDetailItems', () => {
  it('keeps contract, schedule, salary and organization values in the final review', () => {
    const values: EmploymentReviewDetailValues = {
      duration: 'Bepaalde tijd', endsOn: '2026-10-01', probation: 'Ja', probationEnd: '2026-09-01',
      laborCondition: 'Bedrijfseigen regeling', weeklyHours: '32', fulltimeReference: '40 uur per week', employmentScope: 'Parttime', partTimeFactor: '80%',
      roster: 'Week 1 + Week 2', weekOne: 'Maandag: 8 · Dinsdag: 8', weekTwo: 'Maandag: 0 · Dinsdag: 8', rosterAverage: '32.00 uur per week',
      salaryBasis: 'Handmatig', frequency: 'Maand', fulltimeSalary: '€ 2000.00', parttimeSalary: '€ 1600.00',
      department: 'Directie', job: 'Monteur', manager: '100001 · Testmanager', costCarrier: 'Algemeen', costCenter: 'Algemene kostenplaats (100%)', allocation: '100.00%',
    }

    expect(buildEmploymentReviewDetailItems(values)).toEqual([
      { label: 'duration', value: 'Bepaalde tijd' }, { label: 'endsOn', value: '2026-10-01' }, { label: 'probation', value: 'Ja' }, { label: 'probationEnd', value: '2026-09-01' },
      { label: 'laborCondition', value: 'Bedrijfseigen regeling' }, { label: 'weeklyHours', value: '32' }, { label: 'fulltimeReference', value: '40 uur per week' }, { label: 'employmentScope', value: 'Parttime' }, { label: 'partTimeFactor', value: '80%' },
      { label: 'roster', value: 'Week 1 + Week 2' }, { label: 'weekOne', value: 'Maandag: 8 · Dinsdag: 8' }, { label: 'weekTwo', value: 'Maandag: 0 · Dinsdag: 8' }, { label: 'rosterAverage', value: '32.00 uur per week' },
      { label: 'salaryBasis', value: 'Handmatig' }, { label: 'frequency', value: 'Maand' }, { label: 'fulltimeSalary', value: '€ 2000.00' }, { label: 'parttimeSalary', value: '€ 1600.00' },
      { label: 'department', value: 'Directie' }, { label: 'job', value: 'Monteur' }, { label: 'manager', value: '100001 · Testmanager' }, { label: 'costCarrier', value: 'Algemeen' }, { label: 'costCenter', value: 'Algemene kostenplaats (100%)' }, { label: 'allocation', value: '100.00%' },
    ])
  })
})

describe('resolveEffectiveEmploymentSalary', () => {
  it('uses the manual full-time amount and derives the part-time amount from the factor', () => {
    expect(resolveEffectiveEmploymentSalary({
      salaryBasis: 'MANUAL', manualFulltimeAmount: '2000', manualParttimeAmount: '', selectedScaleAmount: 3500, partTimeFactor: 0.8,
    })).toEqual({ fulltimeAmount: 2000, parttimeAmount: 1600 })
  })

  it('does not leak a stale scale amount after switching back to manual salary', () => {
    expect(resolveEffectiveEmploymentSalary({
      salaryBasis: 'MANUAL', manualFulltimeAmount: '2000', manualParttimeAmount: '1600', selectedScaleAmount: 3500, partTimeFactor: 0.8,
    }).fulltimeAmount).toBe(2000)
  })

  it('keeps the selected scale amount authoritative in scale mode', () => {
    expect(resolveEffectiveEmploymentSalary({
      salaryBasis: 'CUSTOM_SCALE', manualFulltimeAmount: '2000', manualParttimeAmount: '1600', selectedScaleAmount: 3500, partTimeFactor: 0.8,
    })).toEqual({ fulltimeAmount: 3500, parttimeAmount: 1600 })
  })

  it('does not let a stale manual amount override the selected scale after switching to scale', () => {
    expect(resolveEffectiveEmploymentSalary({
      salaryBasis: 'CUSTOM_SCALE', manualFulltimeAmount: '2000', manualParttimeAmount: '', selectedScaleAmount: 3500, partTimeFactor: 0.8,
    }).fulltimeAmount).toBe(3500)
  })

  it('returns no effective amount for missing or invalid manual salary input', () => {
    expect(resolveEffectiveEmploymentSalary({
      salaryBasis: 'MANUAL', manualFulltimeAmount: '', manualParttimeAmount: '', selectedScaleAmount: 3500, partTimeFactor: 0.8,
    })).toEqual({ fulltimeAmount: null, parttimeAmount: null })
    expect(resolveEffectiveEmploymentSalary({
      salaryBasis: 'MANUAL', manualFulltimeAmount: 'not-a-number', manualParttimeAmount: '', selectedScaleAmount: 3500, partTimeFactor: 0.8,
    })).toEqual({ fulltimeAmount: null, parttimeAmount: null })
  })
})
