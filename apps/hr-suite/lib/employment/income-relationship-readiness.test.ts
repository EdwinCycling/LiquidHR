import { describe, expect, it } from 'vitest'
import { evaluateIncomeRelationshipReadiness, type IncomeRelationshipReadinessInput } from './income-relationship-readiness'

const validInput: IncomeRelationshipReadinessInput = {
  reportingStatus: 'DRAFT',
  ikvNumber: 1,
  relationshipType: 'EMPLOYMENT',
  startsOn: '2026-01-01',
  endsOn: null,
  payrollTaxSubnumber: 'L01',
  payrollTaxNumber: '123456789L01',
  payrollTaxBindingId: 'tax-number-1',
  payrollTaxBindingHrGroupId: 'hr-group-1',
  administrationId: 'admin-1',
  hrGroupId: 'hr-group-1',
  hasVerifiedBsn: true,
  links: [{
    validFrom: '2026-01-01',
    validUntil: null,
    employment: {
      startsOn: '2026-01-01',
      endsOn: null,
      recordStatus: 'CONFIRMED',
      contracts: [{ startsOn: '2026-01-01', endsOn: null }],
    },
  }],
  payrollTaxNumbers: [{
    id: 'tax-number-1',
    hrGroupId: 'hr-group-1',
    administrationId: 'admin-1',
    payrollTaxNumber: '123456789L01',
    validFrom: '2026-01-01',
    validUntil: null,
  }],
  payrollTaxNumberSourceAvailable: true,
}

describe('evaluateIncomeRelationshipReadiness', () => {
  it('allows a validated existing IKV to move from DRAFT to READY', () => {
    expect(evaluateIncomeRelationshipReadiness(validInput)).toEqual({ blockers: [], canMarkReady: true })
  })

  it('blocks when no administration payroll tax number is registered', () => {
    const result = evaluateIncomeRelationshipReadiness({ ...validInput, payrollTaxNumbers: [] })
    expect(result.canMarkReady).toBe(false)
    expect(result.blockers).toContain('employer_tax_number_missing')
  })

  it('does not infer an IKV binding from a matching registered subnumber', () => {
    const result = evaluateIncomeRelationshipReadiness({ ...validInput, payrollTaxBindingId: null })
    expect(result.canMarkReady).toBe(false)
    expect(result.blockers).toContain('employer_tax_number_missing')
  })

  it('accepts the exact registered employer subnumber including its L prefix', () => {
    expect(evaluateIncomeRelationshipReadiness({ ...validInput, payrollTaxSubnumber: 'L01' }).canMarkReady).toBe(true)
  })

  it('does not confuse an employer subnumber with the employee IKV number', () => {
    const result = evaluateIncomeRelationshipReadiness({ ...validInput, payrollTaxSubnumber: '01' })
    expect(result.canMarkReady).toBe(false)
    expect(result.blockers).toContain('employer_tax_number_mismatch')
  })

  it('requires a verified BSN fingerprint even when an employee number exists', () => {
    const result = evaluateIncomeRelationshipReadiness({ ...validInput, hasVerifiedBsn: false })
    expect(result.canMarkReady).toBe(false)
    expect(result.blockers).toContain('employee_identifier_missing')
  })

  it('validates the IKV number independently from the employer subnumber', () => {
    const result = evaluateIncomeRelationshipReadiness({ ...validInput, ikvNumber: 0 })
    expect(result.canMarkReady).toBe(false)
    expect(result.blockers).toContain('income_relationship_number_invalid')
  })

  it('blocks an invalid tax subnumber without normalizing source data', () => {
    const result = evaluateIncomeRelationshipReadiness({ ...validInput, payrollTaxSubnumber: '0001' })
    expect(result.canMarkReady).toBe(false)
    expect(result.blockers).toContain('employer_tax_subnumber_invalid')
  })

  it('requires the exact registered tax-number binding instead of a matching subnumber alone', () => {
    const result = evaluateIncomeRelationshipReadiness({
      ...validInput,
      payrollTaxBindingId: 'unbound-tax-number',
      payrollTaxNumbers: [
        validInput.payrollTaxNumbers[0],
        { ...validInput.payrollTaxNumbers[0], id: 'unbound-tax-number', payrollTaxNumber: '999999999L01' },
      ],
    })
    expect(result.canMarkReady).toBe(false)
    expect(result.blockers).toContain('employer_tax_number_mismatch')
  })

  it('blocks a tax number that is bound from another administration or HR group', () => {
    const result = evaluateIncomeRelationshipReadiness({
      ...validInput,
      payrollTaxNumbers: [{ ...validInput.payrollTaxNumbers[0], administrationId: 'other-admin' }],
    })
    expect(result.canMarkReady).toBe(false)
    expect(result.blockers).toContain('employer_tax_number_mismatch')
  })

  it('blocks a registration that does not cover the complete IKV period', () => {
    const result = evaluateIncomeRelationshipReadiness({
      ...validInput,
      endsOn: '2026-12-31',
      payrollTaxNumbers: [{ ...validInput.payrollTaxNumbers[0], validUntil: '2026-09-30' }],
    })
    expect(result.canMarkReady).toBe(false)
    expect(result.blockers).toContain('employer_tax_number_period_gap')
  })

  it('checks every linked employment and its contract without changing IKV identity', () => {
    const result = evaluateIncomeRelationshipReadiness({
      ...validInput,
      links: [
        ...validInput.links,
        {
          validFrom: '2026-06-01',
          validUntil: null,
          employment: { ...validInput.links[0].employment!, startsOn: '2026-06-01', contracts: [] },
        },
      ],
    })
    expect(result.canMarkReady).toBe(false)
    expect(result.blockers).toContain('employment_contract_missing')
  })

  it('supports one existing IKV linked across consecutive confirmed employments', () => {
    const result = evaluateIncomeRelationshipReadiness({
      ...validInput,
      endsOn: '2026-12-31',
      links: [
        {
          validFrom: '2026-01-01',
          validUntil: '2026-07-01',
          employment: {
            startsOn: '2026-01-01', endsOn: '2026-06-30', recordStatus: 'CONFIRMED',
            contracts: [{ startsOn: '2026-01-01', endsOn: '2026-06-30' }],
          },
        },
        {
          validFrom: '2026-07-01',
          validUntil: '2027-01-01',
          employment: {
            startsOn: '2026-07-01', endsOn: '2026-12-31', recordStatus: 'CONFIRMED',
            contracts: [{ startsOn: '2026-07-01', endsOn: '2026-12-31' }],
          },
        },
      ],
    })
    expect(result).toEqual({ blockers: [], canMarkReady: true })
  })

  it('supports a single employment link covered by consecutive contracts', () => {
    const result = evaluateIncomeRelationshipReadiness({
      ...validInput,
      endsOn: '2026-12-31',
      links: [{
        validFrom: '2026-01-01',
        validUntil: '2027-01-01',
        employment: {
          startsOn: '2026-01-01',
          endsOn: '2026-12-31',
          recordStatus: 'CONFIRMED',
          contracts: [
            { startsOn: '2026-01-01', endsOn: '2026-06-30' },
            { startsOn: '2026-07-01', endsOn: '2026-12-31' },
          ],
        },
      }],
    })
    expect(result).toEqual({ blockers: [], canMarkReady: true })
  })

  it('blocks a gap between consecutive contracts covering an employment link', () => {
    const result = evaluateIncomeRelationshipReadiness({
      ...validInput,
      endsOn: '2026-12-31',
      links: [{
        validFrom: '2026-01-01',
        validUntil: '2027-01-01',
        employment: {
          startsOn: '2026-01-01',
          endsOn: '2026-12-31',
          recordStatus: 'CONFIRMED',
          contracts: [
            { startsOn: '2026-01-01', endsOn: '2026-06-29' },
            { startsOn: '2026-07-01', endsOn: '2026-12-31' },
          ],
        },
      }],
    })
    expect(result.canMarkReady).toBe(false)
    expect(result.blockers).toContain('employment_contract_missing')
  })

  it('blocks a gap between employment links', () => {
    const result = evaluateIncomeRelationshipReadiness({
      ...validInput,
      endsOn: '2026-12-31',
      links: [
        {
          validFrom: '2026-01-01',
          validUntil: '2026-06-30',
          employment: {
            startsOn: '2026-01-01', endsOn: '2026-06-29', recordStatus: 'CONFIRMED',
            contracts: [{ startsOn: '2026-01-01', endsOn: '2026-06-29' }],
          },
        },
        {
          validFrom: '2026-07-01',
          validUntil: '2027-01-01',
          employment: {
            startsOn: '2026-07-01', endsOn: '2026-12-31', recordStatus: 'CONFIRMED',
            contracts: [{ startsOn: '2026-07-01', endsOn: '2026-12-31' }],
          },
        },
      ],
    })
    expect(result.canMarkReady).toBe(false)
    expect(result.blockers).toContain('income_relationship_link_period_invalid')
  })

  it('does not expose a ready action for a relationship outside DRAFT', () => {
    const result = evaluateIncomeRelationshipReadiness({ ...validInput, reportingStatus: 'READY' })
    expect(result.blockers).toEqual([])
    expect(result.canMarkReady).toBe(false)
  })
})
