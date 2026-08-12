import { describe, expect, it } from 'vitest'
import { employmentContractMutationSchema, isEmploymentContractEffectiveDateValid, isEmploymentContractStartDateValid } from './contract-schemas'

const valid = {
  workerType: 'EMPLOYEE',
  laborConditionSetId: crypto.randomUUID(),
  durationType: 'DEFINITE',
  startsOn: '2026-08-01',
  endsOn: '2026-12-31',
  probationApplies: false,
}

describe('employmentContractMutationSchema', () => {
  it('accepteert een bepaald contract', () => {
    expect(employmentContractMutationSchema.parse(valid).startsOn).toBe('2026-08-01')
  })

  it('vereist een flexfase voor uitzendkrachten', () => {
    expect(employmentContractMutationSchema.safeParse({
      ...valid,
      workerType: 'TEMPORARY_AGENCY',
    }).success).toBe(false)
  })

  it('weigert een einddatum bij onbepaalde tijd', () => {
    expect(employmentContractMutationSchema.safeParse({
      ...valid,
      durationType: 'INDEFINITE',
    }).success).toBe(false)
  })

  it('laat proeftijdregels als waarschuwing door', () => {
    expect(employmentContractMutationSchema.safeParse({
      ...valid,
      endsOn: '2027-01-31',
      probationApplies: true,
      probationEndsOn: '2026-09-01',
    }).success).toBe(true)
  })

  it('blijft een ontbrekende of ongeldige proeftijd-einddatum blokkeren', () => {
    expect(employmentContractMutationSchema.safeParse({
      ...valid,
      probationApplies: true,
      probationEndsOn: '',
    }).success).toBe(false)
  })

  it('houdt iedere contractstart binnen het dienstverband en vergrendelt het eerste contract op de dienstverbandstart', () => {
    expect(isEmploymentContractStartDateValid('2026-07-31', '2026-08-01', true)).toBe(false)
    expect(isEmploymentContractStartDateValid('2026-08-02', '2026-08-01', true)).toBe(false)
    expect(isEmploymentContractStartDateValid('2026-08-01', '2026-08-01', true)).toBe(true)
    expect(isEmploymentContractStartDateValid('2026-08-01', '2026-08-01', false)).toBe(true)
    expect(isEmploymentContractStartDateValid('2026-08-02', '2026-08-01', false)).toBe(true)
  })

  it('accepteert alleen een wijzigingsdatum binnen het gekozen contract', () => {
    expect(isEmploymentContractEffectiveDateValid('2026-08-15', '2026-08-01', '2026-12-31')).toBe(true)
    expect(isEmploymentContractEffectiveDateValid('2026-07-31', '2026-08-01', '2026-12-31')).toBe(false)
    expect(isEmploymentContractEffectiveDateValid('2027-01-01', '2026-08-01', '2026-12-31')).toBe(false)
    expect(isEmploymentContractEffectiveDateValid('2027-01-01', '2026-08-01', null)).toBe(true)
  })
})
