export type PayrollImportIncomeSourceRefInput = {
  sourcePersonRef: string
  payrollTaxNumber: string
  ikvNumber: number
  startsOn?: string | null
  endsOn?: string | null
}

/**
 * Identifies an imported income relationship without depending on XML array order
 * or the generated database row ID.
 */
export function payrollImportIncomeSourceRef(input: PayrollImportIncomeSourceRefInput): string {
  return input.sourcePersonRef + ':income:' + input.payrollTaxNumber + ':' + input.ikvNumber
    + ':' + (input.startsOn ?? '') + ':' + (input.endsOn ?? '')
}