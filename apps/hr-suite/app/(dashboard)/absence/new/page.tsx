import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { AbsenceQuickForm } from '@/components/absence/absence-quick-form'
import { formatAbsenceEmployeeName, formatAbsenceEmployeePickerLabel } from '@/components/absence/absence-presentational'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { resolveEmployeeAbsenceEmployment } from '@/lib/absence/service'
import { AuthorizationError, requireAnyPermission } from '@/lib/auth/permissions'
import { getEmployeeEmploymentDetail, listEmployeesOverview } from '@/lib/employment/employment-service'
import { getTranslator } from '@/lib/i18n/server'

interface NewAbsencePageProps {
  searchParams: Promise<{ employeeId?: string }>
}

export default async function NewAbsencePage({ searchParams }: NewAbsencePageProps) {
  let auth: Awaited<ReturnType<typeof requireAnyPermission>>
  try {
    auth = await requireAnyPermission(['absence:write'])
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }
  const { employeeId } = await searchParams
  const scope = auth.activeRoles.includes('DIRECT_MANAGER') ? 'team' : 'all'
  const [employees, t] = await Promise.all([listEmployeesOverview('active', scope), getTranslator('employees')])
  const selectedEmployee = employees.find((employee) => employee.id === employeeId) ?? null
  const detail = selectedEmployee ? await getEmployeeEmploymentDetail(selectedEmployee.id, 'employments') : null
  const today = new Date().toISOString().slice(0, 10)
  const employmentSelection = selectedEmployee ? await resolveEmployeeAbsenceEmployment(selectedEmployee.id, undefined, today) : null

  return <PageShell width="reading" className="py-7 lg:py-10">
    <Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline" href="/dashboard/start"><ArrowLeft aria-hidden="true" className="size-4" />{t('absenceCreateBack')}</Link>
    <PageHeader className="mt-6" title={t('absenceCreateTitle')} description={t('absenceCreateSubtitle')} />

    <Surface className="mt-6 p-5 sm:p-6">
      <form className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" method="get">
        <FormField label={t('absenceCreateEmployee')} required control={<DropdownSelect defaultValue={selectedEmployee?.id ?? ''} emptyLabel={t('absenceCreateNoEmployees')} id="absence-employee" name="employeeId" placeholder={t('absenceCreateEmployeePlaceholder')} required searchPlaceholder={t('absenceCreateSearch')} searchable>
          <option disabled value="">{t('absenceCreateEmployeePlaceholder')}</option>
          {employees.map((employee) => <option key={employee.id} value={employee.id}>{formatAbsenceEmployeePickerLabel(employee)}</option>)}
        </DropdownSelect>} />
        <Button variant="secondary" type="submit">{t('absenceCreateSelect')}</Button>
      </form>
    </Surface>

    {selectedEmployee && detail ? <AbsenceQuickForm employeeId={selectedEmployee.id} employeeName={formatAbsenceEmployeeName(selectedEmployee)} employeeFunction={selectedEmployee.jobTitle} employeeDepartment={selectedEmployee.departmentName} employmentId={employmentSelection?.employment?.id} employmentOptions={employmentSelection?.options} openOnMount recoveryMode="hidden" showReportAction={false} labels={{ report: t('absenceReport'), startDate: t('absenceStartDate'), percentage: t('absencePercentage'), expectedRecovery: t('absenceExpectedRecovery'), hasSafetyNet: t('absenceHasSafetyNet'), workAccident: t('absenceWorkAccident'), thirdPartyAccident: t('absenceThirdPartyAccident'), unknown: t('absenceUnknown'), yes: t('absenceYes'), no: t('absenceNo'), submit: t('absenceSubmit'), recover: t('absenceRecover'), partialRecover: t('absencePartialRecover'), recoveredOn: t('absenceRecoveredOn'), capacityEffectiveOn: t('absenceCaseCapacityEffectiveOn'), failed: t('absenceSaveFailed'), close: t('absenceClose'), cancel: t('cancel'), discardTitle: t('absenceDiscardTitle'), discardDescription: t('absenceDiscardDescription'), discardConfirm: t('absenceDiscardConfirm'), discardCancel: t('absenceDiscardCancel'), employment: t('absenceEmployment'), employmentPlaceholder: t('absenceEmploymentPlaceholder'), employmentSearch: t('absenceEmploymentSearch'), saving: t('saving'), employeeInfoTitle: t('absenceCreateSelected'), function: t('jobTitle'), department: t('department'), notRecorded: t('notRecorded') }} /> : <p className="mt-6 rounded-[var(--radius-surface)] border border-dashed border-border-subtle px-5 py-8 text-center text-sm text-muted-foreground">{t('absenceCreateEmployeePlaceholder')}</p>}
  </PageShell>
}
