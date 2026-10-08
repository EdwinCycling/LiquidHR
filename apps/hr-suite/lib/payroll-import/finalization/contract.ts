/**
 * TEST-only candidate of the shared Core/Payroll decisions. It is not an
 * approved production contract and is accepted only by the local TEST gate.
 */
export const CONTROL02_SHARED_CONTRACT = Object.freeze({
  version: 'CONTROL02-CORE-PAYROLL-TEST-CANDIDATE-2',
  status: 'TEST_CANDIDATE' as const,
  employeeIdentityBoundary: 'TENANT_AND_HR_GROUP' as const,
  relationships: Object.freeze({
    employmentSeparateFromIncomeRelationship: true,
    multipleIkvsPerEmployee: true,
    employmentSelectionExplicit: true,
  }),
  incomeIdentity: Object.freeze({
    fullPayrollTaxNumberRequired: true,
    ikvNumberRequired: true,
    sourceReferenceRequired: true,
  }),
  dates: Object.freeze({
    sourceIncomeInclusive: true,
    coreEmploymentEndsOnInclusive: true,
    employmentLinkHalfOpen: true,
    plannerEmploymentValidUntilExclusive: true,
  }),
  safeguards: Object.freeze({
    duplicateIncomeRelationship: 'BLOCK' as const,
    noAutomaticEmploymentInference: true,
    noInferredContractType: true,
    noImplicitTerms: true,
  }),
})

/** No contract revision is executable in the current build. */
export const CONTROL02_APPROVED_CONTRACT_VERSIONS: readonly string[] = Object.freeze([])
