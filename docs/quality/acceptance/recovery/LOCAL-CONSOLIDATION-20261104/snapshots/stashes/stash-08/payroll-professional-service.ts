import 'server-only'

import { AuthorizationError, requireAuthContext, requirePermission } from '@/lib/auth/permissions'
import { createPayrollCalculationRepository, type PayrollCalculationArtifacts, type PayrollRunSummary } from './calculation-repository'
import { requireComponentLibraryAccess } from './component-library-access'
import { createPayrollRepository, type PayrollRepository } from './repository'
import { createPayrun01Repository } from './payrun01-repository'
import { isPayrollLabEnabled } from './feature-flag'
import { payrollScopeFromAuthContext } from './scope'

export type PayrollProfessionalRun = PayrollCalculationArtifacts & {
  readonly lifecycleEvents: Awaited<ReturnType<ReturnType<typeof createPayrun01Repository>['listLifecycleEvents']>>
}

export async function listPayrollProfessionalRuns(): Promise<readonly PayrollRunSummary[]> {
  const access = await requireComponentLibraryAccess(false)
  const repository = createPayrollCalculationRepository()
  return repository.listPayrollRunSummaries(access.scope, access.administration.id, {
    runType: 'INDIVIDUAL_PAYROLL',
    limit: 100,
  })
}

export async function getPayrollProfessionalRun(runId: string): Promise<PayrollProfessionalRun | null> {
  const access = await requireComponentLibraryAccess(false)
  const calculations = createPayrollCalculationRepository()
  const artifacts = await calculations.getLatestSyntheticArtifacts(
    access.scope,
    access.administration.id,
    undefined,
    runId,
    undefined,
    'INDIVIDUAL_PAYROLL',
  )
  if (!artifacts) return null
  const lifecycleEvents = await createPayrun01Repository().listLifecycleEvents(
    access.scope,
    access.administration.id,
    artifacts.payrollPeriod.id,
    artifacts.sourceSnapshot.source_employment_id,
  )
  return { ...artifacts, lifecycleEvents }
}

export type EmployeePayrollStatement = {
  readonly periodYear: number
  readonly periodMonth: number
  readonly components: readonly EmployeePayrollComponent[]
  readonly pension: EmployeePensionSummary | null
  readonly pensionReadiness: 'CALCULATED' | 'REVIEW_REQUIRED' | 'SOURCE_VERIFICATION_REQUIRED'
}

export type EmployeePayrollComponent = {
  readonly key: string
  readonly amount: number | null
}

export type EmployeePensionSummary = {
  readonly arrangementName: string | null
  readonly pensionableBase: string | null
  readonly rate: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function projectEmployeeComponents(artifacts: PayrollCalculationArtifacts): readonly EmployeePayrollComponent[] {
  return artifacts.componentResults.map((row) => {
    const payload = asRecord(row.result_payload)
    const value = typeof row.amount === 'number' ? row.amount : payload?.amount
    const amount = typeof value === 'number' && Number.isFinite(value)
      ? value
      : typeof value === 'string' && /^-?\d{1,12}(?:\.\d{1,4})?$/.test(value)
        ? Number(value)
        : null
    return { key: row.component_key, amount: amount !== null && Number.isFinite(amount) ? amount : null }
  })
}

function projectEmployeePensionSummary(artifacts: PayrollCalculationArtifacts): EmployeePensionSummary | null {
  const payload = asRecord(artifacts.sourceSnapshot.source_payload)
  const payrollOwned = asRecord(payload?.payrollOwned)
  const summary = asRecord(payrollOwned?.pensionCalculationSummary)
  if (!summary) return null

  const arrangementId = asString(summary.arrangementId)
  const canonicalPension = asRecord(payload?.pension)
  const assignments = Array.isArray(canonicalPension?.assignments) ? canonicalPension.assignments : []
  const matchingNames = assignments.flatMap((value) => {
    const assignment = asRecord(value)
    const arrangement = asRecord(assignment?.arrangement)
    return arrangement && arrangement.id === arrangementId ? [asString(arrangement.name)] : []
  }).filter((name): name is string => name !== null)

  const arrangementName = matchingNames.length === 1 ? matchingNames[0]! : null
  const pensionableBase = asString(summary.pensionableBase)
  const rate = asString(summary.rate)
  return arrangementName || pensionableBase || rate ? { arrangementName, pensionableBase, rate } : null
}

function projectEmployeePensionReadiness(
  artifacts: PayrollCalculationArtifacts,
  pension: EmployeePensionSummary | null,
): EmployeePayrollStatement['pensionReadiness'] {
  if (!pension || !artifacts.componentResults.some((row) => row.component_key === 'employee_pension')) {
    return 'SOURCE_VERIFICATION_REQUIRED'
  }
  if (artifacts.controls.some((control) => control.status === 'WARN' && /PENSION-RULE-READY/i.test(control.control_key))) {
    return 'REVIEW_REQUIRED'
  }
  return 'CALCULATED'
}

export type EmployeePayrollDependencies = {
  readonly requireAuthContext: typeof requireAuthContext
  readonly requirePermission: typeof requirePermission
  readonly isEnabled: typeof isPayrollLabEnabled
  readonly createPayrollRepository: () => Pick<PayrollRepository, 'getPayrollAdministration'>
  readonly createCalculationRepository: typeof createPayrollCalculationRepository
  readonly createPayrunRepository: typeof createPayrun01Repository
}

const defaultEmployeePayrollDependencies: EmployeePayrollDependencies = {
  requireAuthContext,
  requirePermission,
  isEnabled: isPayrollLabEnabled,
  createPayrollRepository,
  createCalculationRepository: createPayrollCalculationRepository,
  createPayrunRepository: createPayrun01Repository,
}

export async function getMySalaryStatement(
  dependencies: EmployeePayrollDependencies = defaultEmployeePayrollDependencies,
): Promise<EmployeePayrollStatement | null> {
  const initialContext = await dependencies.requireAuthContext()
  const employeeId = initialContext.employeeId
  if (!employeeId) throw new AuthorizationError('Persoonlijke salarisgegevens zijn niet beschikbaar.')

  const context = await dependencies.requirePermission('salary:read', employeeId)
  if (context.employeeId !== employeeId || context.tenantId !== initialContext.tenantId
    || context.hrGroupId !== initialContext.hrGroupId || context.administrationId !== initialContext.administrationId) {
    throw new AuthorizationError('Persoonlijke salarisgegevens zijn niet beschikbaar.')
  }
  const scope = payrollScopeFromAuthContext(context)
  if (!scope || !dependencies.isEnabled()) return null

  const administration = await dependencies.createPayrollRepository().getPayrollAdministration(scope)
  if (!administration || administration.status !== 'ACTIVE' || !administration.capabilityEnabled) return null

  const calculations = dependencies.createCalculationRepository()
  const summaries = await calculations.listPayrollRunSummaries(scope, administration.id, {
    employeeId,
    runType: 'INDIVIDUAL_PAYROLL',
    limit: 100,
  })
  const payrun = dependencies.createPayrunRepository()

  for (const summary of summaries) {
    if (summary.run.status !== 'SUCCEEDED') continue
    const artifacts = await calculations.getLatestSyntheticArtifacts(
      scope,
      administration.id,
      undefined,
      summary.run.id,
      undefined,
      'INDIVIDUAL_PAYROLL',
    )
    if (!artifacts || artifacts.sourceSnapshot.source_employee_id !== employeeId) continue
    const events = await payrun.listLifecycleEvents(
      scope,
      administration.id,
      artifacts.payrollPeriod.id,
      artifacts.sourceSnapshot.source_employment_id,
    )
    if (!events.some((event) => event.calculation_run_id === summary.run.id && event.event_type === 'FINALIZED')) continue
    const pension = projectEmployeePensionSummary(artifacts)
    return {
      periodYear: artifacts.payrollPeriod.period_year,
      periodMonth: artifacts.payrollPeriod.period_month,
      components: projectEmployeeComponents(artifacts),
      pension,
      pensionReadiness: projectEmployeePensionReadiness(artifacts, pension),
    }
  }
  return null
}
