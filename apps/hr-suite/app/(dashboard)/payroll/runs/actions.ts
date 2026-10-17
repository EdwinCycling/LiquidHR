'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  calculateEmployeePayroll,
  finalizeEmployeePayroll,
  reviewEmployeePayroll,
} from '@/lib/payroll/employee-payroll-calculation-service'
import {
  calculatePayrollProfessionalBatch,
  type PayrollProfessionalBatchResult,
} from '@/lib/payroll/payroll-professional-run-service'
import { openPayrollCycle } from '@/lib/payroll/payroll-cycle-service'
import { requireComponentLibraryAccess } from '@/lib/payroll/component-library-access'
import { createPayrollProfessionalPayslipPdfArtifactForRun as createPayslipPdfArtifact } from '@/lib/payroll/payroll-professional-service'

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

type PayrollEmployeeRecalculationOutcome =
  | 'invalid'
  | 'calculated'
  | 'incomplete'
  | 'sourceGap'
  | 'unsupported'
  | 'correctionRequired'
  | 'inProgress'
  | 'failed'
  | 'accessDenied'

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function parseEmployeeReference(value: unknown): { readonly employeeId: string; readonly employmentId: string } | null {
  if (typeof value !== 'string') return null
  const [employeeId, employmentId, ...rest] = value.split('|')
  return rest.length === 0 && isUuid(employeeId) && isUuid(employmentId) ? { employeeId, employmentId } : null
}

function recalculationTarget(periodKey: unknown, outcome: PayrollEmployeeRecalculationOutcome): string {
  const period = typeof periodKey === 'string' && /^(20\d{2}|21\d{2}|2200)-(0[1-9]|1[0-2])$/.test(periodKey)
    ? `?period=${encodeURIComponent(periodKey)}`
    : ''
  return `/payroll/runs${period}${period ? '&' : '?'}recalculation=${outcome}`
}

export async function recalculatePayrollEmployee(formData: FormData): Promise<never> {
  const periodKey = formData.get('periodKey')
  const reference = parseEmployeeReference(formData.get('employeeRef'))
    ?? (isUuid(formData.get('employeeId')) && isUuid(formData.get('employmentId'))
      ? { employeeId: formData.get('employeeId') as string, employmentId: formData.get('employmentId') as string }
      : null)
  const periodMatch = typeof periodKey === 'string'
    ? /^(20\d{2}|21\d{2}|2200)-(0[1-9]|1[0-2])$/.exec(periodKey)
    : null
  if (!reference || !periodMatch) redirect(recalculationTarget(periodKey, 'invalid'))

  let outcome: PayrollEmployeeRecalculationOutcome = 'failed'
  try {
    const result = await calculateEmployeePayroll({
      employeeId: reference.employeeId,
      employmentId: reference.employmentId,
      period: { year: Number(periodMatch[1]), month: Number(periodMatch[2]) },
    })
    outcome = result.status === 'CALCULATED' ? 'calculated'
      : result.status === 'INCOMPLETE' ? 'incomplete'
        : result.status === 'SOURCE_GAP' ? 'sourceGap'
          : result.status === 'UNSUPPORTED' ? 'unsupported'
            : result.status === 'CORRECTION_REQUIRED' ? 'correctionRequired'
              : result.status === 'IN_PROGRESS' ? 'inProgress' : 'failed'
  } catch (error) {
    const code = errorCode(error)
    outcome = code === 'PAYROLL_SOURCE_CHANGED_RECALCULATE_REQUIRED'
      ? 'correctionRequired'
      : error instanceof Error && error.name === 'AuthorizationError' ? 'accessDenied' : 'failed'
  }

  revalidatePath('/payroll/runs')
  revalidatePath('/payroll')
  redirect(recalculationTarget(periodKey, outcome))
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

async function transitionPayrollRun(formData: FormData, eventType: 'REVIEWED' | 'FINALIZED'): Promise<never> {
  const runId = formData.get('runId')
  const employeeId = formData.get('employeeId')
  const employmentId = formData.get('employmentId')
  const periodKey = formData.get('period')
  const match = typeof periodKey === 'string' ? /^(20\d{2}|21\d{2}|2200)-(0[1-9]|1[0-2])$/.exec(periodKey) : null
  const target = typeof runId === 'string' && /^[0-9a-f-]{36}$/i.test(runId)
    ? `/payroll/runs/${encodeURIComponent(runId)}`
    : '/payroll/runs'
  if (!match || typeof employeeId !== 'string' || typeof employmentId !== 'string' || typeof runId !== 'string') {
    redirect(`${target}?lifecycle=invalid`)
  }

  let outcome = 'failed'
  try {
    const input = {
      employeeId,
      employmentId,
      runId,
      period: { year: Number(match[1]), month: Number(match[2]) },
    }
    if (eventType === 'REVIEWED') await reviewEmployeePayroll(input)
    else await finalizeEmployeePayroll(input)
    outcome = eventType === 'REVIEWED' ? 'reviewed' : 'finalized'
  } catch (error) {
    const code = errorCode(error)
    outcome = code === 'PAYROLL_REVIEW_INCOMPLETE' || code === 'PAYROLL_FINALIZATION_INCOMPLETE'
      ? 'incomplete'
      : code === 'PAYROLL_SOURCE_CHANGED_RECALCULATE_REQUIRED' ? 'sourceChanged'
        : error instanceof Error && error.name === 'AuthorizationError' ? 'accessDenied'
          : code === 'PAYROLL_LIFECYCLE_TRANSITION_INVALID' ? 'transitionInvalid'
            : 'failed'
  }

  revalidatePath(target)
  revalidatePath('/payroll/runs')
  redirect(`${target}?lifecycle=${outcome}`)
}

export async function reviewPayrollRun(formData: FormData): Promise<never> {
  return await transitionPayrollRun(formData, 'REVIEWED')
}

export async function finalizePayrollRun(formData: FormData): Promise<never> {
  return await transitionPayrollRun(formData, 'FINALIZED')
}

export async function generatePayrollPayslipPdfArtifact(formData: FormData): Promise<never> {
  const runId = formData.get('runId')
  const target = typeof runId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(runId)
    ? `/payroll/runs/${encodeURIComponent(runId)}`
    : '/payroll/runs'
  if (target === '/payroll/runs') redirect(`${target}?artifact=invalid`)

  let outcome: 'created' | 'failed' = 'failed'
  try {
    const access = await requireComponentLibraryAccess(true)
    const artifact = await createPayslipPdfArtifact({
      scope: access.scope,
      payrollAdministrationId: access.administration.id,
      actorUserId: access.actorUserId,
      runId: runId as string,
    })
    if (artifact) outcome = 'created'
  } catch {
    outcome = 'failed'
  }

  revalidatePath(target)
  redirect(`${target}?artifact=${outcome}`)
}
