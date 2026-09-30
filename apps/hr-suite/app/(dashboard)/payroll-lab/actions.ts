'use server'

import { redirect } from 'next/navigation'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { ContextAccessError } from '@/lib/context/administration-context'
import { ContextAuthenticationError } from '@/lib/context/server-context'
import { PayrollLabUnavailableError, resolvePayrollLabAdministration } from '@/lib/payroll/access'
import { isPayrollLabEnabled } from '@/lib/payroll/feature-flag'
import { payrollScopeFromAuthContext } from '@/lib/payroll/scope'
import { runSyntheticPayroll, SyntheticPayrollServiceError } from '@/lib/payroll/synthetic-calculation-service'
import { isPayrollLabErrorCode } from './error-codes'

const RUN_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function runSyntheticPayrollAction(): Promise<never> {
  let destination = '/payroll-lab?error=unavailable'

  try {
    if (!isPayrollLabEnabled()) {
      destination = '/geen-toegang'
    } else {
      const context = await requirePermission('salary:write')
      if (!context.permissions.includes('salary:write')) {
        destination = '/geen-toegang'
      } else {
        const scope = payrollScopeFromAuthContext(context)
        const payrollAdministration = scope ? await resolvePayrollLabAdministration(context) : null
        if (!payrollAdministration || !scope) {
          destination = '/geen-toegang'
        } else {
          const run = await runSyntheticPayroll(scope, payrollAdministration.id, context.userId)
          destination = RUN_ID_PATTERN.test(run.runId)
            ? `/payroll-lab?run=${encodeURIComponent(run.runId)}`
            : '/payroll-lab?error=PAYROLL_CALCULATION_FAILED'
        }
      }
    }
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof ContextAuthenticationError) {
      destination = '/login'
    } else if (error instanceof AuthorizationError || error instanceof ContextAccessError) {
      destination = '/geen-toegang'
    } else if (error instanceof SyntheticPayrollServiceError && isPayrollLabErrorCode(error.code)) {
      const runReference = error.runId && RUN_ID_PATTERN.test(error.runId) ? `&run=${encodeURIComponent(error.runId)}` : ''
      destination = `/payroll-lab?error=${encodeURIComponent(error.code)}${runReference}`
    } else if (error instanceof PayrollLabUnavailableError) {
      destination = '/payroll-lab?error=PAYROLL_ADMINISTRATION_UNAVAILABLE'
    } else {
      destination = '/payroll-lab?error=PAYROLL_CALCULATION_FAILED'
    }
  }

  redirect(destination)
}
