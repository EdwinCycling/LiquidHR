'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { applySalaryApplicationChange, SalaryApplicationError } from '@/lib/salary-application/service'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MONEY_PATTERN = /^\d{1,12}\.\d{2}$/

function scalar(formData: FormData, name: string): string {
  const values = formData.getAll(name)
  if (values.length !== 1 || typeof values[0] !== 'string') throw new Error('INVALID_INPUT')
  return values[0]
}

export async function repairFulltimeSalarySourceAction(formData: FormData): Promise<never> {
  let employeeId = ''
  let employmentId = ''
  let result: 'source-corrected' | 'source-correction-blocked' | 'source-correction-unavailable' = 'source-correction-unavailable'
  try {
    const fields = Array.from(formData.keys()).filter((key) => !key.startsWith('$ACTION_')).sort()
    if (fields.join('|') !== ['effectiveOn', 'employeeId', 'employmentId', 'parttimeAmount'].sort().join('|')) throw new Error('INVALID_INPUT')

    employeeId = scalar(formData, 'employeeId')
    employmentId = scalar(formData, 'employmentId')
    const effectiveOn = scalar(formData, 'effectiveOn')
    const parttimeAmount = scalar(formData, 'parttimeAmount')
    if (!UUID_PATTERN.test(employeeId) || !UUID_PATTERN.test(employmentId)
      || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveOn) || !MONEY_PATTERN.test(parttimeAmount)) {
      throw new Error('INVALID_INPUT')
    }

    await applySalaryApplicationChange({
      employmentId,
      effectiveOn,
      reason: 'PAYDATA-02 broncorrectie: FTE 1,00 voltijds- en deeltijdloon gelijkgesteld',
      warningCodes: [],
      acknowledgements: { confirmed: true, retroactive: false },
      payload: {
        paymentType: 'PERIODIC_FIXED',
        paymentFrequency: 'MONTHLY',
        fulltimeAmount: parttimeAmount,
        parttimeAmount,
        currencyCode: 'EUR',
        salaryRoute: 'MANUAL',
      },
    })
    revalidatePath(`/employees/${employeeId}/employments/${employmentId}`)
    result = 'source-corrected'
  } catch (error) {
    if (error instanceof SalaryApplicationError || error instanceof Error && error.message === 'INVALID_INPUT') result = 'source-correction-blocked'
  }
  redirect(`/employees/${employeeId}/employments/${employmentId}?tab=salary&view=expanded&salary=${result}`)
}
