import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { redirect } from 'next/navigation'
import { EmployeeCreateWizard } from '@/components/employees/employee-create-wizard'
import type { EmploymentContractWizardWorkerType } from '@/components/employment/employment-contract-create-form'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { createEmployeeCreateWizardLabels } from '@/lib/employees/employee-create-wizard-labels'
import { getEmploymentDetail } from '@/lib/employment/employment-detail-service'
import { getLocale, getTranslator } from '@/lib/i18n/server'

export default async function NewEmploymentContractPage({ params }: { params: Promise<{ employeeId: string; employmentId: string }> }) {
  const { employeeId, employmentId } = await params
  await requireContractCreation(employeeId)
  const [detail, tEmployees, tErrors, tValidation, tEmployment, locale] = await Promise.all([
    getEmploymentDetail(employeeId, employmentId, 'overview'),
    getTranslator('employees'),
    getTranslator('errors'),
    getTranslator('validation'),
    getTranslator('employment'),
    getLocale(),
  ])
  if (!detail.capabilities.canWriteContract) redirect(`/employees/${employeeId}/employments/${employmentId}?tab=overview`)

  const latest = [...detail.contracts].sort((left, right) => left.starts_on.localeCompare(right.starts_on)).at(-1)
  if (!latest?.ends_on) redirect(`/employees/${employeeId}/employments/${employmentId}?tab=overview`)

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
      <Link href={`/employees/${employeeId}/employments/${employmentId}?tab=overview`} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />{tEmployment('contractsTitle')}
      </Link>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{tEmployment('contractAdd')} - {detail.employee.first_name} {detail.employee.birth_name}</h1>
      <div className="mt-5 min-w-0 max-w-full">
        <EmployeeCreateWizard
          locale={locale}
          initialContractEmployeeId={employeeId}
          initialContractEmploymentId={employmentId}
          initialContractOptions={{
            laborConditionSets: detail.options.laborConditionSets.map((item) => ({ id: item.id, name: item.name, standardHoursPerWeek: item.standard_hours_per_week })),
            flexPhases: detail.options.flexPhases.map((item) => ({ id: item.id, name: item.name })),
          }}
          initialContractEmploymentStartsOn={detail.employment.starts_on}
          initialContractIsFirst={detail.contracts.length === 0}
          initialContractDraft={{
            workerType: contractWorkerType(latest.worker_type),
            flexPhaseId: latest.flex_phase_id ?? '',
            laborConditionSetId: latest.labor_condition_set_id,
            durationType: 'INDEFINITE',
            startsOn: addDay(latest.ends_on),
            endsOn: '',
            probationApplies: false,
            probationEndsOn: '',
          }}
          initialContractSubmitLabel={tEmployment('contractAdd')}
          labels={createEmployeeCreateWizardLabels(tEmployees, tErrors, tValidation, tEmployment)}
        />
      </div>
    </main>
  )
}

function addDay(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + 1))
  return date.toISOString().slice(0, 10)
}

function contractWorkerType(value: string): EmploymentContractWizardWorkerType {
  if (value === 'STUDENT_INTERN' || value === 'TEMPORARY_AGENCY' || value === 'EXTERNAL_NO_PAYROLL') return value
  return 'EMPLOYEE'
}

async function requireContractCreation(employeeId: string): Promise<void> {
  try {
    await requirePermission('contract:write', employeeId)
  } catch (error) {
    if (error instanceof AuthorizationError) redirect(`/employees/${employeeId}?tab=employments`)
    throw error
  }
}
