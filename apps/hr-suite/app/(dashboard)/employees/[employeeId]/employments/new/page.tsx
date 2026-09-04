import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { redirect } from 'next/navigation'
import { EmployeeCreateWizard } from '@/components/employees/employee-create-wizard'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { createEmployeeCreateWizardLabels } from '@/lib/employees/employee-create-wizard-labels'
import { getEmployeeEmploymentDetail, getEmploymentCreationOptions } from '@/lib/employment/employment-service'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { getUserPreferences } from '@/lib/preferences/server'

export default async function NewEmploymentPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params
  await requireEmploymentCreation(employeeId)
  const [options, detail, tEmployees, tErrors, tValidation, tEmployment, locale, preferences] = await Promise.all([
    getEmploymentCreationOptions(employeeId),
    getEmployeeEmploymentDetail(employeeId, 'employments', { includeSalary: false }),
    getTranslator('employees'),
    getTranslator('errors'),
    getTranslator('validation'),
    getTranslator('employment'),
    getLocale(),
    getUserPreferences(),
  ])

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
      <Link href={`/employees/${employeeId}?tab=employments`} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />{tEmployment('title')}
      </Link>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{tEmployment('newWizardTitle')} - {composeEmployeeName(detail.employee)}</h1>
      <div className="mt-5 min-w-0 max-w-full">
        <EmployeeCreateWizard
          locale={locale}
          dateFormat={preferences.dateFormat}
           initialEmploymentEmployeeId={employeeId}
           initialEmploymentOptions={options}
           initialEmployeeSummary={{ name: composeEmployeeName(detail.employee), birthDate: detail.employee.birthDate, gender: detail.employee.gender }}
           labels={createEmployeeCreateWizardLabels(tEmployees, tErrors, tValidation, tEmployment)}
        />
      </div>
    </main>
  )
}

function composeEmployeeName(employee: {
  firstName: string
  birthName: string
  birthNamePrefix: string | null
  partnerName: string | null
  partnerNamePrefix: string | null
  nameUsage: 'BIRTH_NAME' | 'PARTNER_NAME' | 'PARTNER_BEFORE_BIRTH_NAME' | 'BIRTH_NAME_BEFORE_PARTNER_NAME'
}): string {
  const birthName = [employee.birthNamePrefix, employee.birthName].filter(Boolean).join(' ').trim()
  const partnerName = [employee.partnerNamePrefix, employee.partnerName].filter(Boolean).join(' ').trim()
  const surname = employee.nameUsage === 'PARTNER_NAME'
    ? partnerName
    : employee.nameUsage === 'PARTNER_BEFORE_BIRTH_NAME'
      ? [partnerName, birthName].filter(Boolean).join(' ')
      : employee.nameUsage === 'BIRTH_NAME_BEFORE_PARTNER_NAME'
        ? [birthName, partnerName].filter(Boolean).join(' ')
        : birthName
  return [employee.firstName, surname].filter(Boolean).join(' ')
}

async function requireEmploymentCreation(employeeId: string): Promise<void> {
  try {
    await requirePermission('contract:write', employeeId)
  } catch (error) {
    if (error instanceof AuthorizationError) redirect(`/employees/${employeeId}?tab=employments`)
    throw error
  }
}
