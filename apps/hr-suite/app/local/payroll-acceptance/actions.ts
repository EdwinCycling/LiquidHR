'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { AuthenticationError, AuthorizationError } from '@/lib/auth/permissions'
import { createLocalPayrollAcceptanceCalculationService } from '@/lib/payroll/employee-payroll-calculation-service'
import {
  LOCAL_PAYROLL_ACCEPTANCE_PERIOD,
  isLocalPayrollAcceptanceRuntime,
} from '@/lib/payroll/local-payroll-acceptance-runtime'
import {
  runLocalPayrollAcceptanceFlow,
  runLocalPayrollAcceptanceVariableRevisionFlow,
  type LocalPayrollAcceptanceFlowResult,
} from '@/lib/payroll/local-payroll-acceptance-flow'
import { createLocalPayrollAcceptanceCycleService } from '@/lib/payroll/payroll-cycle-service'

export type LocalPayrollAcceptanceOpenState = {
  readonly message: 'idle' | 'opened' | 'accessDenied' | 'unavailable' | 'failed'
}

export type LocalPayrollAcceptanceRunState = {
  readonly message: 'idle' | 'preflightBlocked' | 'saved' | 'partial' | 'accessDenied' | 'unavailable' | 'failed'
  readonly result: LocalPayrollAcceptanceFlowResult | null
  readonly failureCode: string | null
  readonly sourceChecks: readonly string[] | null
}

function failureCode(error: unknown): string | null {
  if (error === null || typeof error !== 'object') return null
  const code = 'code' in error && typeof error.code === 'string' ? error.code : null
  const name = 'name' in error && typeof error.name === 'string' ? error.name : null
  const candidate = code ?? name
  return candidate && /^[A-Z0-9_:-]{2,80}$/.test(candidate) ? candidate : null
}

function sourceChecks(error: unknown): readonly string[] | null {
  if (error === null || typeof error !== 'object' || !('sourceChecks' in error)) return null
  const checks = error.sourceChecks
  const allowed = new Set([
    'source_scope', 'employee_employment', 'period', 'income_relationship', 'fiscal_source', 'salary', 'schedule', 'contract',
    'candidate_DEMO-001', 'candidate_DEMO-002', 'fiscal_profile_source_supported', 'fiscal_confirmed_profile',
    'candidate_DEMO-003',
    'fiscal_admin_confirmation', 'fiscal_profile_gap_free', 'fiscal_regular_profile', 'fiscal_credit_match',
    'fiscal_single_income_relationship', 'awf_high_rate_source_basis',
  ])
  if (!Array.isArray(checks)) return null
  return checks.filter((check): check is string => typeof check === 'string' && allowed.has(check))
}

async function requestHost(): Promise<string | null> {
  return (await headers()).get('host')
}

export async function openLocalPayrollAcceptancePeriod(
  _previousState: LocalPayrollAcceptanceOpenState,
  _formData: FormData,
): Promise<LocalPayrollAcceptanceOpenState> {
  void _previousState
  void _formData
  const host = await requestHost()
  if (!isLocalPayrollAcceptanceRuntime(host)) return { message: 'unavailable' }
  try {
    await createLocalPayrollAcceptanceCycleService(host).openPayrollCycle(LOCAL_PAYROLL_ACCEPTANCE_PERIOD)
    revalidatePath('/local/payroll-acceptance')
    return { message: 'opened' }
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) return { message: 'accessDenied' }
    return { message: 'failed' }
  }
}

export async function runLocalPayrollAcceptance(
  _previousState: LocalPayrollAcceptanceRunState,
  _formData: FormData,
): Promise<LocalPayrollAcceptanceRunState> {
  void _previousState
  void _formData
  const host = await requestHost()
  if (!isLocalPayrollAcceptanceRuntime(host)) return { message: 'unavailable', result: null, failureCode: null, sourceChecks: null }
  try {
    const service = createLocalPayrollAcceptanceCalculationService(host)
    const result = await runLocalPayrollAcceptanceFlow(service)
    revalidatePath('/local/payroll-acceptance')
    return { message: result.message, result, failureCode: null, sourceChecks: null }
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return { message: 'accessDenied', result: null, failureCode: null, sourceChecks: null }
    }
    return { message: 'failed', result: null, failureCode: failureCode(error), sourceChecks: sourceChecks(error) }
  }
}

export async function runLocalPayrollAcceptanceDemo003(
  _previousState: LocalPayrollAcceptanceRunState,
  _formData: FormData,
): Promise<LocalPayrollAcceptanceRunState> {
  void _previousState
  void _formData
  const host = await requestHost()
  if (!isLocalPayrollAcceptanceRuntime(host)) return { message: 'unavailable', result: null, failureCode: null, sourceChecks: null }
  try {
    const service = createLocalPayrollAcceptanceCalculationService(host)
    const result = await runLocalPayrollAcceptanceFlow(service, ['DEMO-003'])
    revalidatePath('/local/payroll-acceptance')
    return { message: result.message, result, failureCode: null, sourceChecks: null }
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return { message: 'accessDenied', result: null, failureCode: null, sourceChecks: null }
    }
    return { message: 'failed', result: null, failureCode: failureCode(error), sourceChecks: sourceChecks(error) }
  }
}

export async function runLocalPayrollAcceptanceVariableRevision(
  _previousState: LocalPayrollAcceptanceRunState,
  _formData: FormData,
): Promise<LocalPayrollAcceptanceRunState> {
  void _previousState
  void _formData
  const host = await requestHost()
  if (!isLocalPayrollAcceptanceRuntime(host)) return { message: 'unavailable', result: null, failureCode: null, sourceChecks: null }
  try {
    const service = createLocalPayrollAcceptanceCalculationService(host)
    const result = await runLocalPayrollAcceptanceVariableRevisionFlow(service)
    revalidatePath('/local/payroll-acceptance')
    return { message: result.message, result, failureCode: null, sourceChecks: null }
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return { message: 'accessDenied', result: null, failureCode: null, sourceChecks: null }
    }
    return { message: 'failed', result: null, failureCode: failureCode(error), sourceChecks: sourceChecks(error) }
  }
}
