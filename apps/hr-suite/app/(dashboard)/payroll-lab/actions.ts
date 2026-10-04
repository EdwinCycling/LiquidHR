'use server'

import { redirect } from 'next/navigation'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { ContextAccessError } from '@/lib/context/administration-context'
import { ContextAuthenticationError } from '@/lib/context/server-context'
import { PayrollLabUnavailableError, resolvePayrollLabAdministration } from '@/lib/payroll/access'
import { isPayrollLabEnabled } from '@/lib/payroll/feature-flag'
import { payrollScopeFromAuthContext } from '@/lib/payroll/scope'
import { isCaoBench02CalculationCase, runCaoBench02Payroll } from '@/lib/payroll/cao-bench02-calculation-service'
import { runSyntheticPayroll, SyntheticPayrollServiceError } from '@/lib/payroll/synthetic-calculation-service'
import { runNl2026Payroll } from '@/lib/payroll/nl-2026-calculation-service'
import { isPayrollLabErrorCode } from './error-codes'

const RUN_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function runPayrollAction(runner: typeof runSyntheticPayroll): Promise<never> {
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
          const run = await runner(scope, payrollAdministration.id, context.userId)
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

export async function runSyntheticPayrollAction(): Promise<never> { return runPayrollAction(runSyntheticPayroll) }
export async function runNl2026PayrollAction(): Promise<never> { return runPayrollAction(runNl2026Payroll) }

export async function runCaoBench02PayrollAction(formData: FormData): Promise<never> {
  const rawCaseKey = formData.get('caseKey')
  if (typeof rawCaseKey !== 'string' || !isCaoBench02CalculationCase(rawCaseKey)) {
    redirect('/payroll-lab/calculations?error=PAYROLL_INPUT_INVALID')
  }

  let destination = `/payroll-lab/calculations?case=${encodeURIComponent(rawCaseKey)}&error=PAYROLL_CALCULATION_FAILED`
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
          const run = await runCaoBench02Payroll(scope, payrollAdministration.id, context.userId, rawCaseKey)
          destination = `/payroll-lab/calculations?case=${encodeURIComponent(rawCaseKey)}&run=${encodeURIComponent(run.runId)}`
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
      destination = `/payroll-lab/calculations?case=${encodeURIComponent(rawCaseKey)}&error=${encodeURIComponent(error.code)}${runReference}`
    } else if (error instanceof PayrollLabUnavailableError) {
      destination = `/payroll-lab/calculations?case=${encodeURIComponent(rawCaseKey)}&error=PAYROLL_ADMINISTRATION_UNAVAILABLE`
    }
  }

  redirect(destination)
}
