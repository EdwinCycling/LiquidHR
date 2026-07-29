import { describe, expect, it } from 'vitest'
import { employmentContractMutationSchema } from './contract-schemas'

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
})
