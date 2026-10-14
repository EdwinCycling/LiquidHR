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
  type LocalPayrollAcceptanceFlowResult,
} from '@/lib/payroll/local-payroll-acceptance-flow'
import { createLocalPayrollAcceptanceCycleService } from '@/lib/payroll/payroll-cycle-service'

export type LocalPayrollAcceptanceOpenState = {
  readonly message: 'idle' | 'opened' | 'accessDenied' | 'unavailable' | 'failed'
}

export type LocalPayrollAcceptanceRunState = {
  readonly message: 'idle' | 'preflightBlocked' | 'saved' | 'partial' | 'accessDenied' | 'unavailable' | 'failed'
  readonly result: LocalPayrollAcceptanceFlowResult | null
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
  if (!isLocalPayrollAcceptanceRuntime(host)) return { message: 'unavailable', result: null }
  try {
    const service = createLocalPayrollAcceptanceCalculationService(host)
    const result = await runLocalPayrollAcceptanceFlow(service)
    revalidatePath('/local/payroll-acceptance')
    return { message: result.message, result }
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return { message: 'accessDenied', result: null }
    }
    return { message: 'failed', result: null }
  }
}
