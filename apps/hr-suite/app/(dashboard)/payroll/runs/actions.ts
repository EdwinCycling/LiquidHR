'use server'

import { revalidatePath } from 'next/cache'
import {
  calculatePayrollProfessionalBatch,
  type PayrollProfessionalBatchResult,
} from '@/lib/payroll/payroll-professional-run-service'

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
