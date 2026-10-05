/**
 * Machine-readable draft of the shared Core/Payroll decisions. These values
 * make the safety assumptions visible to the planner and executor without
 * treating a draft as an approval. The approved version list stays empty
 * until Core and Payroll record a joint decision.
 */
export const CONTROL02_SHARED_CONTRACT = Object.freeze({
  version: 'CONTROL02-CORE-PAYROLL-DRAFT-1',
  status: 'DRAFT' as const,
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
