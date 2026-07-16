interface EmployeeDetailReadErrors {
  addresses: boolean
  bankAccounts: boolean
  relations: boolean
}

export function employeeDetailReadFailureCode(errors: EmployeeDetailReadErrors): string | null {
  if (errors.addresses) return 'EMPLOYEE_ADDRESSES_READ_FAILED'
  if (errors.bankAccounts) return 'EMPLOYEE_BANK_ACCOUNTS_READ_FAILED'
  if (errors.relations) return 'EMPLOYEE_RELATIONS_READ_FAILED'
  return null
}
