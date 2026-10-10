'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Payrun01CompositionKind } from '@liquid-hr/payroll-rules-nl-2026'
import { AuthenticationError, AuthorizationError } from '@/lib/auth/permissions'
import { ContextAccessError } from '@/lib/context/administration-context'
import { ContextAuthenticationError } from '@/lib/context/server-context'
import { requireComponentLibraryAccess } from '@/lib/payroll/component-library-access'
import { SyntheticPayrollServiceError } from '@/lib/payroll/synthetic-calculation-service'
import {
  createPayrun01PayslipPdfArtifact,
  createPayrun01TechnicalJsonArtifact,
  finalizePayrun01Payroll,
  payrun01PeriodFromKey,
  payrun01PeriodKey,
  payrun01ScenarioForTestPersona,
  reviewPayrun01Payroll,
  runPayrun01Payroll,
} from '@/lib/payroll/payrun01-service'

const PAGE_PATH = '/payroll-lab/salarisverwerking'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SCENARIO_KINDS = new Set<Payrun01CompositionKind>(['KINDEROPVANG_TEST', 'DEMO_COMPANY_TEST', 'LEGACY_COMPANY_TEST'])

class InvalidPayrun01FormError extends Error {}

type Payrun01FormInput = {
  readonly employeeId: string
  readonly kind: Payrun01CompositionKind
  readonly period: { readonly year: number; readonly month: number }
  readonly runId?: string
}

function matchesExactFields(formData: FormData, expected: readonly string[]): boolean {
  const fields = Array.from(formData.keys()).filter((key) => !key.startsWith('$ACTION_')).sort()
  const sortedExpected = [...expected].sort()
  return fields.length === sortedExpected.length && fields.every((field, index) => field === sortedExpected[index])
}

function scalarField(formData: FormData, name: string, maximumLength: number): string {
  const values = formData.getAll(name)
  const value = values[0]
  if (values.length !== 1 || typeof value !== 'string' || value.length === 0 || value.length > maximumLength) {
    throw new InvalidPayrun01FormError()
  }
  return value
}

function parseForm(formData: FormData, includeRunId: boolean): Payrun01FormInput {
  const expected = includeRunId ? ['employeeId', 'scenarioKind', 'period', 'runId'] : ['employeeId', 'scenarioKind', 'period']
  if (!matchesExactFields(formData, expected)) throw new InvalidPayrun01FormError()

  const employeeId = scalarField(formData, 'employeeId', 36)
  const kind = scalarField(formData, 'scenarioKind', 32)
  const periodKey = scalarField(formData, 'period', 7)
  const period = SCENARIO_KINDS.has(kind as Payrun01CompositionKind)
    ? payrun01PeriodFromKey(periodKey, kind as Payrun01CompositionKind)
    : null
  const runId = includeRunId ? scalarField(formData, 'runId', 36) : undefined
  if (!UUID_PATTERN.test(employeeId)
    || !SCENARIO_KINDS.has(kind as Payrun01CompositionKind)
    || payrun01ScenarioForTestPersona(employeeId) !== kind
    || !period
    || (runId !== undefined && !UUID_PATTERN.test(runId))) {
    throw new InvalidPayrun01FormError()
  }

  return {
    employeeId,
    kind: kind as Payrun01CompositionKind,
    period,
    ...(runId ? { runId } : {}),
  }
}

function safeErrorDestination(error: unknown): string {
  if (error instanceof AuthenticationError || error instanceof ContextAuthenticationError) return '/login'
  if (error instanceof AuthorizationError || error instanceof ContextAccessError) return '/geen-toegang'
  if (error instanceof InvalidPayrun01FormError) return `${PAGE_PATH}?error=invalid-input`
  if (error instanceof SyntheticPayrollServiceError) {
    if (error.code === 'PAYROLL_INPUT_INVALID') return `${PAGE_PATH}?error=invalid-input`
    if (error.code === 'PAYROLL_CALCULATION_BLOCKED') return `${PAGE_PATH}?error=blocked`
    if (error.code === 'PAYROLL_UNSUPPORTED') return `${PAGE_PATH}?error=unsupported`
    if (error.code === 'PAYROLL_SYNTHETIC_MODE_DISABLED'
      || error.code === 'PAYROLL_PERSISTENCE_FAILED'
      || error.code === 'PAYROLL_ADMINISTRATION_UNAVAILABLE'
      || error.code === 'PAYROLL_CAPABILITY_DISABLED') return `${PAGE_PATH}?error=unavailable`
  }
  return `${PAGE_PATH}?error=failed`
}

function resultDestination(
  input: Payrun01FormInput,
  event: 'run' | 'reviewed' | 'finalized' | 'artifact',
  runId: string,
  artifactType?: 'TECHNICAL_JSON' | 'PAYSLIP_PDF',
): string {
  if (!UUID_PATTERN.test(runId)) return `${PAGE_PATH}?error=failed`
  const query = new URLSearchParams({ employee: input.employeeId, event, run: runId, period: payrun01PeriodKey(input.period) })
  if (artifactType) query.set('artifact', artifactType)
  return `${PAGE_PATH}?${query.toString()}`
}

export async function runPayrun01Action(formData: FormData): Promise<never> {
  let destination = `${PAGE_PATH}?error=failed`
  let parsedInput: Payrun01FormInput | null = null
  try {
    const input = parseForm(formData, false)
    parsedInput = input
    const access = await requireComponentLibraryAccess(true)
    const result = await runPayrun01Payroll({
      scope: access.scope,
      payrollAdministrationId: access.administration.id,
      actorUserId: access.actorUserId,
      employeeId: input.employeeId,
      kind: input.kind,
      period: input.period,
    })
    revalidatePath(PAGE_PATH)
    destination = resultDestination(input, 'run', result.runId)
  } catch (error) {
    destination = safeErrorDestination(error)
    if (parsedInput && error instanceof SyntheticPayrollServiceError) {
      const status = error.code === 'PAYROLL_CALCULATION_BLOCKED' ? 'blocked' : 'failed'
      const reasonCandidate = error.reasonCode ?? error.code
      const reason = /^(?:PAYROLL_SOURCE|PAYRUN01|PAYROLL)_[A-Z0-9_]+$/.test(reasonCandidate)
        ? reasonCandidate
        : null
      if (error.runId && UUID_PATTERN.test(error.runId)) {
        destination = `${resultDestination(parsedInput, 'run', error.runId)}&error=${status}${reason ? `&reason=${encodeURIComponent(reason)}` : ''}`
      } else if (reason) {
        const query = new URLSearchParams({
          period: payrun01PeriodKey(parsedInput.period),
          error: status,
          reason,
        })
        destination = `${PAGE_PATH}?${query.toString()}`
      }
    }
  }
  redirect(destination)
}

async function recordLifecycleAction(
  formData: FormData,
  event: 'reviewed' | 'finalized',
): Promise<never> {
  let destination = `${PAGE_PATH}?error=failed`
  try {
    const input = parseForm(formData, true)
    if (!input.runId) throw new InvalidPayrun01FormError()
    const access = await requireComponentLibraryAccess(true)
    const lifecycleInput = {
      scope: access.scope,
      payrollAdministrationId: access.administration.id,
      actorUserId: access.actorUserId,
      employeeId: input.employeeId,
      kind: input.kind,
      runId: input.runId,
    }
    if (event === 'reviewed') await reviewPayrun01Payroll(lifecycleInput)
    else await finalizePayrun01Payroll(lifecycleInput)
    revalidatePath(PAGE_PATH)
    destination = resultDestination(input, event, input.runId)
  } catch (error) {
    destination = safeErrorDestination(error)
  }
  redirect(destination)
}

export async function reviewPayrun01Action(formData: FormData): Promise<never> {
  return await recordLifecycleAction(formData, 'reviewed')
}

export async function finalizePayrun01Action(formData: FormData): Promise<never> {
  return await recordLifecycleAction(formData, 'finalized')
}

export async function generatePayrun01TechnicalJsonAction(formData: FormData): Promise<never> {
  let destination = `${PAGE_PATH}?error=failed`
  try {
    const input = parseForm(formData, true)
    if (!input.runId) throw new InvalidPayrun01FormError()
    const access = await requireComponentLibraryAccess(true)
    await createPayrun01TechnicalJsonArtifact({
      scope: access.scope,
      payrollAdministrationId: access.administration.id,
      actorUserId: access.actorUserId,
      employeeId: input.employeeId,
      kind: input.kind,
      runId: input.runId,
    })
    revalidatePath(PAGE_PATH)
    destination = resultDestination(input, 'artifact', input.runId, 'TECHNICAL_JSON')
  } catch (error) {
    destination = safeErrorDestination(error)
  }
  redirect(destination)
}

export async function generatePayrun01PayslipPdfAction(formData: FormData): Promise<never> {
  let destination = `${PAGE_PATH}?error=failed`
  try {
    const input = parseForm(formData, true)
    if (!input.runId) throw new InvalidPayrun01FormError()
    const access = await requireComponentLibraryAccess(true)
    await createPayrun01PayslipPdfArtifact({
      scope: access.scope,
      payrollAdministrationId: access.administration.id,
      actorUserId: access.actorUserId,
      employeeId: input.employeeId,
      kind: input.kind,
      runId: input.runId,
    })
    revalidatePath(PAGE_PATH)
    destination = resultDestination(input, 'artifact', input.runId, 'PAYSLIP_PDF')
  } catch (error) {
    destination = safeErrorDestination(error)
  }
  redirect(destination)
}
