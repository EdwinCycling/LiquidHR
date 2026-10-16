'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  AdministrationPayrollTaxNumberError,
  registerAdministrationPayrollTaxNumber,
} from '@/lib/employment/administration-payroll-tax-number-service'

type RegistrationResult = 'saved' | 'invalid' | 'conflict' | 'forbidden' | 'unavailable'

function scalar(formData: FormData, name: string): string {
  const values = formData.getAll(name)
  if (values.length !== 1 || typeof values[0] !== 'string') throw new Error('INVALID_INPUT')
  return values[0]
}

export async function registerPayrollTaxNumberAction(formData: FormData): Promise<never> {
  let result: RegistrationResult = 'unavailable'
  try {
    const fields = Array.from(formData.keys()).filter((key) => !key.startsWith('$ACTION_')).sort()
    if (fields.join('|') !== ['isPrimary', 'payrollTaxNumber', 'validFrom', 'validUntil'].sort().join('|')) {
      throw new Error('INVALID_INPUT')
    }
    const payrollTaxNumber = scalar(formData, 'payrollTaxNumber').trim()
    const validFrom = scalar(formData, 'validFrom')
    const validUntil = scalar(formData, 'validUntil')
    const isPrimaryValue = scalar(formData, 'isPrimary')
    if (isPrimaryValue !== 'true' && isPrimaryValue !== 'false') throw new Error('INVALID_INPUT')

    await registerAdministrationPayrollTaxNumber({
      payrollTaxNumber,
      validFrom,
      validUntil: validUntil === '' ? null : validUntil,
      isPrimary: isPrimaryValue === 'true',
    })
    result = 'saved'
    revalidatePath('/settings/payroll/fiscal')
  } catch (error) {
    if (error instanceof AdministrationPayrollTaxNumberError) {
      if (error.status === 400) result = 'invalid'
      else if (error.status === 403) result = 'forbidden'
      else if (error.status === 409) result = 'conflict'
    } else if (error instanceof Error && error.message === 'INVALID_INPUT') {
      result = 'invalid'
    }
  }
  redirect(`/settings/payroll/fiscal?registration=${result}`)
}
