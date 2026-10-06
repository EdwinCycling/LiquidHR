export type PayrollImportFieldPolicy = {
  category: 'PERSONAL_DATA' | 'EMPLOYMENT' | 'PAYROLL_IDENTITY'
  persistence: 'CREATE_OR_UPDATE_WITH_CONFIRMATION' | 'CREATE_ONLY_WITH_CONFIRMATION' | 'PREVIEW_ONLY' | 'SHARED_CONTRACT_REQUIRED' | 'PROVENANCE_ONLY'
  canCreateEmployee: boolean
  canUpdateEmployee: boolean
  requiresHumanDecision: true
  automaticOverwrite: false
}

const confirmedPersonalData = {
  category: 'PERSONAL_DATA',
  persistence: 'CREATE_OR_UPDATE_WITH_CONFIRMATION',
  canCreateEmployee: true,
  canUpdateEmployee: true,
  requiresHumanDecision: true,
  automaticOverwrite: false,
} as const satisfies PayrollImportFieldPolicy

const createOnlyPersonalData = {
  category: 'PERSONAL_DATA',
  persistence: 'CREATE_ONLY_WITH_CONFIRMATION',
  canCreateEmployee: true,
  canUpdateEmployee: false,
  requiresHumanDecision: true,
  automaticOverwrite: false,
} as const satisfies PayrollImportFieldPolicy

const previewOnly = {
  category: 'PERSONAL_DATA',
  persistence: 'PREVIEW_ONLY',
  canCreateEmployee: false,
  canUpdateEmployee: false,
  requiresHumanDecision: true,
  automaticOverwrite: false,
} as const satisfies PayrollImportFieldPolicy

const sharedContractRequired = {
  category: 'EMPLOYMENT',
  persistence: 'SHARED_CONTRACT_REQUIRED',
  canCreateEmployee: false,
  canUpdateEmployee: false,
  requiresHumanDecision: true,
  automaticOverwrite: false,
} as const satisfies PayrollImportFieldPolicy

const provenanceOnly = {
  category: 'PAYROLL_IDENTITY',
  persistence: 'PROVENANCE_ONLY',
  canCreateEmployee: false,
  canUpdateEmployee: false,
  requiresHumanDecision: true,
  automaticOverwrite: false,
} as const satisfies PayrollImportFieldPolicy

/**
 * One server-authoritative policy for source fields across decision validation
 * and plan construction. A user choosing USE_SOURCE is an explicit decision;
 * it never turns into permission for an automatic overwrite.
 */
export const PAYROLL_IMPORT_FIELD_CONFLICT_POLICY = Object.freeze({
  firstName: confirmedPersonalData,
  birthName: confirmedPersonalData,
  birthDate: createOnlyPersonalData,
  gender: previewOnly,
  nationality: previewOnly,
  address: previewOnly,
  personnelNumber: sharedContractRequired,
  employmentStartDate: sharedContractRequired,
  employmentEndDate: sharedContractRequired,
  ikvNumber: provenanceOnly,
  payrollTaxNumber: provenanceOnly,
  hours: sharedContractRequired,
  contractType: sharedContractRequired,
  salary: sharedContractRequired,
  laborConditionGroup: sharedContractRequired,
} satisfies Record<string, PayrollImportFieldPolicy>)

export type PayrollImportFieldName = keyof typeof PAYROLL_IMPORT_FIELD_CONFLICT_POLICY

export function getPayrollImportFieldPolicy(field: string): PayrollImportFieldPolicy | null {
  return Object.prototype.hasOwnProperty.call(PAYROLL_IMPORT_FIELD_CONFLICT_POLICY, field)
    ? PAYROLL_IMPORT_FIELD_CONFLICT_POLICY[field as PayrollImportFieldName]
    : null
}

export function canUseSourceForEmployee(field: string, mode: 'CREATE' | 'UPDATE'): boolean {
  const policy = getPayrollImportFieldPolicy(field)
  if (!policy) return false
  return mode === 'CREATE' ? policy.canCreateEmployee : policy.canUpdateEmployee
}
