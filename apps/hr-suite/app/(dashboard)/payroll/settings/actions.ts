'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { AuthenticationError, AuthorizationError } from '@/lib/auth/permissions'
import { ContextAuthenticationError } from '@/lib/context/server-context'
import { ContextAccessError } from '@/lib/context/administration-context'
import {
  parsePayrollOpeningCumulativeForm,
  parsePayrollEmployerConfigurationForm,
  savePayrollOpeningCumulativeBalance,
  savePayrollEmployerConfiguration,
  PayrollSetupServiceError,
} from '@/lib/payroll/payroll-setup-service'

export async function savePayrollEmployerConfigurationAction(formData: FormData): Promise<never> {
  let destination = '/payroll/settings?setup=PAYROLL_SETUP_UNAVAILABLE'
  try {
    const fields = Array.from(formData.keys()).filter((key) => !key.startsWith('$ACTION_')).sort()
    const expected = [
      'aofClassification', 'aofRate', 'awfClassification', 'awfRate', 'effectiveFrom', 'effectiveTo',
      'holidayAllowanceRate', 'pensionMethodSourceReference', 'pensionPartialMonthMethod', 'sectorCode',
      'sourceReference', 'status', 'whkDecisionReference', 'whkRate', 'wkoClassification', 'wkoRate',
      'yearEndApplies', 'yearEndRate', 'zvwClassification', 'zvwRate',
    ].sort()
    if (fields.join('|') !== expected.join('|')) throw new PayrollSetupServiceError('PAYROLL_SETUP_INPUT_INVALID')
    await savePayrollEmployerConfiguration(parsePayrollEmployerConfigurationForm(formData))
    revalidatePath('/payroll/settings')
    destination = '/payroll/settings?setup=saved'
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof ContextAuthenticationError) destination = '/login'
    else if (error instanceof AuthorizationError || error instanceof ContextAccessError) destination = '/geen-toegang'
    else if (error instanceof PayrollSetupServiceError) {
      const blockerCodes = error.blockers.map((blocker) => blocker.code).join(',')
      destination = `/payroll/settings?setup=${encodeURIComponent(error.code)}&blockers=${encodeURIComponent(blockerCodes)}`
    }
  }
  redirect(destination)
}

export async function savePayrollOpeningCumulativeAction(formData: FormData): Promise<never> {
  let destination = '/payroll/settings?opening=PAYROLL_OPENING_BALANCE_UNAVAILABLE'
  try {
    const fields = Array.from(formData.keys()).filter((key) => !key.startsWith('$ACTION_')).sort()
    const expected = [
      'asOfDate', 'employeeInsuranceWageBeforePeriod', 'grossWageBeforePeriod', 'holidayReserveBeforePeriod',
      'sourceEmploymentId', 'sourcePeriodFrom', 'sourcePeriodTo', 'sourceReference', 'taxableWageBeforePeriod',
      'wageTaxBeforePeriod', 'yearEndReserveBeforePeriod', 'zvwWageBeforePeriod',
    ].sort()
    if (fields.join('|') !== expected.join('|')) throw new PayrollSetupServiceError('PAYROLL_OPENING_BALANCE_INPUT_INVALID')
    await savePayrollOpeningCumulativeBalance(parsePayrollOpeningCumulativeForm(formData))
    revalidatePath('/payroll/settings')
    destination = '/payroll/settings?opening=saved'
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof ContextAuthenticationError) destination = '/login'
    else if (error instanceof AuthorizationError || error instanceof ContextAccessError) destination = '/geen-toegang'
    else if (error instanceof PayrollSetupServiceError) {
      const blockerCodes = error.blockers.map((blocker) => blocker.code).join(',')
      destination = `/payroll/settings?opening=${encodeURIComponent(error.code)}&openingBlockers=${encodeURIComponent(blockerCodes)}`
    }
  }
  redirect(destination)
}
