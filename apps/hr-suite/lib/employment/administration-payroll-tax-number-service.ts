import 'server-only'

import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

export class AdministrationPayrollTaxNumberError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code)
    this.name = 'AdministrationPayrollTaxNumberError'
  }
}

export type RegisterAdministrationPayrollTaxNumberInput = {
  readonly payrollTaxNumber: string
  readonly validFrom: string
  readonly validUntil?: string | null
  readonly isPrimary: boolean
}

const TAX_NUMBER_PATTERN = /^[0-9]{9}L(?:0[1-9]|[1-9][0-9])$/
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export async function registerAdministrationPayrollTaxNumber(
  input: RegisterAdministrationPayrollTaxNumberInput,
): Promise<string> {
  if (!TAX_NUMBER_PATTERN.test(input.payrollTaxNumber)
    || !isValidDate(input.validFrom)
    || (input.validUntil !== undefined && input.validUntil !== null && !isValidDate(input.validUntil))
    || (input.validUntil !== undefined && input.validUntil !== null && input.validUntil < input.validFrom)
    || typeof input.isPrimary !== 'boolean') {
    throw new AdministrationPayrollTaxNumberError('PAYROLL_TAX_NUMBER_INPUT_INVALID', 400)
  }

  const context = await requirePermission('salary:write')
  if (!context.administrationId || !context.hrGroupId
    || (!context.activeRoles.includes('HR_ADMIN') && !context.activeRoles.includes('TENANT_ADMIN'))) {
    throw new AdministrationPayrollTaxNumberError('PAYROLL_TAX_NUMBER_FORBIDDEN', 403)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('register_administration_payroll_tax_number', {
    requested_administration_id: context.administrationId,
    requested_payroll_tax_number: input.payrollTaxNumber,
    requested_valid_from: input.validFrom,
    requested_valid_until: input.validUntil ?? null,
    requested_is_primary: input.isPrimary,
  })
  if (error) {
    const message = error.message
    if (message.includes('PAYROLL_TAX_NUMBER_FORBIDDEN')) {
      throw new AdministrationPayrollTaxNumberError('PAYROLL_TAX_NUMBER_FORBIDDEN', 403)
    }
    if (message.includes('PAYROLL_TAX_NUMBER_CONFLICT')
      || message.includes('PAYROLL_TAX_NUMBER_ALREADY_ACTIVE')) {
      throw new AdministrationPayrollTaxNumberError('PAYROLL_TAX_NUMBER_CONFLICT', 409)
    }
    if (message.includes('PAYROLL_TAX_NUMBER_INPUT_INVALID')) {
      throw new AdministrationPayrollTaxNumberError('PAYROLL_TAX_NUMBER_INPUT_INVALID', 400)
    }
    throw new AdministrationPayrollTaxNumberError('PAYROLL_TAX_NUMBER_UNAVAILABLE', 503)
  }
  if (typeof data !== 'string') {
    throw new AdministrationPayrollTaxNumberError('PAYROLL_TAX_NUMBER_UNAVAILABLE', 503)
  }
  return data
}
