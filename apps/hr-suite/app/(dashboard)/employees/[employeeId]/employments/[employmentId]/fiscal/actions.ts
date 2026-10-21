'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  confirmEmploymentPayrollTaxProfile,
  EmploymentPayrollTaxProfileError,
} from '@/lib/employment/employment-payroll-tax-profile-service'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function scalar(formData: FormData, name: string): string {
  const values = formData.getAll(name)
  if (values.length !== 1 || typeof values[0] !== 'string') throw new Error('INVALID_INPUT')
  return values[0]
}

function destination(employeeId: string, employmentId: string, result: 'saved' | 'invalid' | 'blocked' | 'unavailable') {
  const params = new URLSearchParams({ [result === 'saved' ? 'saved' : 'error']: result })
  params.set('tab', 'taxes')
  return `/employees/${encodeURIComponent(employeeId)}/employments/${encodeURIComponent(employmentId)}/fiscal?${params}`
}

export async function confirmEmploymentPayrollTaxProfileAction(formData: FormData): Promise<never> {
  let employeeId = ''
  let employmentId = ''
  let result: 'saved' | 'invalid' | 'blocked' | 'unavailable' = 'unavailable'
  try {
    const fields = Array.from(formData.keys()).filter((key) => !key.startsWith('$ACTION_')).sort()
    const expectedFields = [
      'effectiveFrom', 'effectiveTo', 'employeeId', 'employmentId', 'idempotencyKey',
      'incomeRelationshipId', 'payrollTaxCreditApplies', 'sourceClassification', 'sourceReference',
    ].sort()
    if (fields.join('|') !== expectedFields.join('|')) throw new Error('INVALID_INPUT')

    employeeId = scalar(formData, 'employeeId')
    employmentId = scalar(formData, 'employmentId')
    const incomeRelationshipId = scalar(formData, 'incomeRelationshipId')
    const effectiveFrom = scalar(formData, 'effectiveFrom')
    const effectiveTo = scalar(formData, 'effectiveTo')
    const payrollTaxCreditApplies = scalar(formData, 'payrollTaxCreditApplies')
    const sourceClassification = scalar(formData, 'sourceClassification')
    const sourceReference = scalar(formData, 'sourceReference')
    const idempotencyKey = scalar(formData, 'idempotencyKey')
    if (![employeeId, employmentId, incomeRelationshipId].every((value) => UUID_PATTERN.test(value))
      || !UUID_PATTERN.test(idempotencyKey)
      || !['true', 'false'].includes(payrollTaxCreditApplies)
      || sourceClassification !== 'HR_ADMIN_CONFIRMED') {
      throw new Error('INVALID_INPUT')
    }

    await confirmEmploymentPayrollTaxProfile({
      employeeId,
      employmentId,
      incomeRelationshipId,
      effectiveFrom,
      effectiveTo: effectiveTo || null,
      payrollTaxCreditApplies: payrollTaxCreditApplies === 'true',
      sourceClassification,
      sourceReference,
      idempotencyKey,
    })
    result = 'saved'
    revalidatePath(`/employees/${employeeId}/employments/${employmentId}/fiscal`)
    revalidatePath('/settings/payroll/fiscal')
  } catch (error) {
    if (error instanceof EmploymentPayrollTaxProfileError) {
      result = error.status === 400 ? 'invalid' : error.status === 403 || error.status === 404 || error.status === 409 ? 'blocked' : 'unavailable'
    } else if (error instanceof Error && error.message === 'INVALID_INPUT') {
      result = 'invalid'
    }
  }
  redirect(destination(employeeId, employmentId, result))
}
