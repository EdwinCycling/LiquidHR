'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  calculatePayrollProfessionalBatch,
  type PayrollProfessionalBatchResult,
} from '@/lib/payroll/payroll-professional-run-service'
import { openPayrollCycle } from '@/lib/payroll/payroll-cycle-service'

export type PayrollProfessionalBatchActionState = {
  readonly message: PayrollProfessionalBatchResult['message'] | null
  readonly items: PayrollProfessionalBatchResult['items']
}

export async function calculateSelectedPayroll(
  _previousState: PayrollProfessionalBatchActionState,
  formData: FormData,
): Promise<PayrollProfessionalBatchActionState> {
  const periodKeyValue = formData.get('periodKey')
  const employmentIds = formData.getAll('employmentId')
    .filter((value): value is string => typeof value === 'string')

  const result = await calculatePayrollProfessionalBatch({
    periodKey: typeof periodKeyValue === 'string' ? periodKeyValue : '',
    employmentIds,
  })
  revalidatePath('/payroll/runs')
  revalidatePath('/payroll')
  return result
}

export type PayrollPeriodActionState = {
  readonly message: 'invalid' | 'closed' | 'accessDenied' | 'failed' | null
}

function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null
  return typeof error.code === 'string' ? error.code : null
}

export async function openSelectedPayrollPeriod(
  _previousState: PayrollPeriodActionState,
  formData: FormData,
): Promise<PayrollPeriodActionState> {
  const value = formData.get('period')
  const match = typeof value === 'string' ? /^(20\d{2}|21\d{2}|2200)-(0[1-9]|1[0-2])$/.exec(value) : null
  if (!match) return { message: 'invalid' }

  const year = Number(match[1])
  const month = Number(match[2])
  try {
    await openPayrollCycle({ year, month })
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError') return { message: 'accessDenied' }
    if (errorCode(error) === 'PAYROLL_CYCLE_CLOSED') return { message: 'closed' }
    return { message: 'failed' }
  }

  const periodKey = `${year}-${String(month).padStart(2, '0')}`
  revalidatePath('/payroll/runs')
  revalidatePath('/payroll')
  redirect(`/payroll/runs?period=${encodeURIComponent(periodKey)}`)
}
