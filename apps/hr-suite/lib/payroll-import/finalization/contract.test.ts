import { describe, expect, it } from 'vitest'
import {
  CONTROL02_APPROVED_CONTRACT_VERSIONS,
  CONTROL02_SHARED_CONTRACT,
} from './contract'

describe('CONTROL02 shared Core/Payroll contract descriptor', () => {
  it('keeps identity, relationship, source identity and date semantics explicit', () => {
    expect(CONTROL02_SHARED_CONTRACT).toMatchObject({
      status: 'TEST_CANDIDATE',
      employeeIdentityBoundary: 'TENANT_AND_HR_GROUP',
      relationships: {
        employmentSeparateFromIncomeRelationship: true,
        multipleIkvsPerEmployee: true,
        employmentSelectionExplicit: true,
      },
      incomeIdentity: {
        fullPayrollTaxNumberRequired: true,
        ikvNumberRequired: true,
        sourceReferenceRequired: true,
      },
      dates: {
        sourceIncomeInclusive: true,
        coreEmploymentEndsOnInclusive: true,
        employmentLinkHalfOpen: true,
        plannerEmploymentValidUntilExclusive: true,
      },
      safeguards: {
        duplicateIncomeRelationship: 'BLOCK',
        noAutomaticEmploymentInference: true,
        noInferredContractType: true,
        noImplicitTerms: true,
      },
    })
  })

  it('does not make a draft contract executable', () => {
    expect(CONTROL02_APPROVED_CONTRACT_VERSIONS).toEqual([])
    expect(CONTROL02_APPROVED_CONTRACT_VERSIONS).not.toContain(CONTROL02_SHARED_CONTRACT.version)
  })
})
