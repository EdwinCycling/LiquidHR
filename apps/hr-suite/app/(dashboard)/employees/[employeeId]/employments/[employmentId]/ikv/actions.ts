'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  IncomeRelationshipReadinessError,
  markIncomeRelationshipReady,
} from '@/lib/employment/income-relationship-readiness-service'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function scalar(formData: FormData, name: string): string {
  const values = formData.getAll(name)
  if (values.length !== 1 || typeof values[0] !== 'string') throw new Error('INVALID_INPUT')
  return values[0]
}

function destination(employeeId: string, employmentId: string, result: 'saved' | 'blocked' | 'forbidden' | 'unavailable') {
  const params = new URLSearchParams({ tab: 'overview', ikv: result })
  return `/employees/${encodeURIComponent(employeeId)}/employments/${encodeURIComponent(employmentId)}?${params}`
}

export async function markIncomeRelationshipReadyAction(formData: FormData): Promise<never> {
  let employeeId = ''
  let employmentId = ''
  let result: 'saved' | 'blocked' | 'forbidden' | 'unavailable' = 'unavailable'
  try {
    const fields = Array.from(formData.keys()).filter((key) => !key.startsWith('$ACTION_')).sort()
    if (fields.join('|') !== ['employeeId', 'employmentId', 'incomeRelationshipId'].sort().join('|')) {
      throw new Error('INVALID_INPUT')
    }
    employeeId = scalar(formData, 'employeeId')
    employmentId = scalar(formData, 'employmentId')
    const incomeRelationshipId = scalar(formData, 'incomeRelationshipId')
    if (![employeeId, employmentId, incomeRelationshipId].every((value) => UUID_PATTERN.test(value))) {
      throw new Error('INVALID_INPUT')
    }

    await markIncomeRelationshipReady(employeeId, employmentId, incomeRelationshipId)
    result = 'saved'
    revalidatePath(`/employees/${employeeId}/employments/${employmentId}`)
    revalidatePath(`/employees/${employeeId}/employments/${employmentId}/fiscal`)
  } catch (error) {
    if (error instanceof IncomeRelationshipReadinessError) {
      if (error.code === 'PAYROLL_IKV_FORBIDDEN') result = 'forbidden'
      else if (error.status === 409) result = 'blocked'
    } else if (error instanceof Error && error.message === 'INVALID_INPUT') {
      result = 'blocked'
    }
  }
  redirect(destination(employeeId, employmentId, result))
}
