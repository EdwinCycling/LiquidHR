import Link from 'next/link'
import { ArrowLeft, ClipboardPlus } from 'lucide-react'
import { AbsenceQuickForm } from '@/components/absence/absence-quick-form'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { resolveEmployeeAbsenceEmployment } from '@/lib/absence/service'
import { requireAnyPermission } from '@/lib/auth/permissions'
import { getEmployeeEmploymentDetail, listEmployeesOverview } from '@/lib/employment/employment-service'
import { getTranslator } from '@/lib/i18n/server'

interface NewAbsencePageProps {
  searchParams: Promise<{ employeeId?: string }>
}

export default async function NewAbsencePage({ searchParams }: NewAbsencePageProps) {
  const auth = await requireAnyPermission(['absence:write'])
  const { employeeId } = await searchParams
  const scope = auth.activeRoles.includes('DIRECT_MANAGER') ? 'team' : 'all'
  const [employees, t] = await Promise.all([listEmployeesOverview('active', scope), getTranslator('employees')])
  const selectedEmployee = employees.find((employee) => employee.id === employeeId) ?? null
  const detail = selectedEmployee ? await getEmployeeEmploymentDetail(selectedEmployee.id, 'employments') : null
  const today = new Date().toISOString().slice(0, 10)
  const employmentSelection = selectedEmployee ? await resolveEmployeeAbsenceEmployment(selectedEmployee.id, undefined, today) : null

  return <main className="mx-auto w-full max-w-4xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
    <Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline" href="/dashboard/start"><ArrowLeft aria-hidden="true" className="size-4" />{t('absenceCreateBack')}</Link>
    <header className="mt-6 rounded-3xl border bg-primary p-6 text-primary-foreground shadow-[0_1.6rem_4rem_color-mix(in_srgb,var(--primary)_18%,transparent)] sm:p-8">
      <span className="grid size-11 place-items-center rounded-2xl bg-primary-foreground/10"><ClipboardPlus aria-hidden="true" className="size-5" /></span>
      <p className="eyebrow mt-5 text-primary-foreground/70">{t('absenceTab')}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t('absenceCreateTitle')}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-primary-foreground/75">{t('absenceCreateSubtitle')}</p>
    </header>

    <section className="mt-6 rounded-3xl border bg-surface p-5 shadow-sm sm:p-6">
      <form className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" method="get">
        <label className="text-sm font-semibold" htmlFor="absence-employee">{t('absenceCreateEmployee')}
          <DropdownSelect className="mt-1" defaultValue={selectedEmployee?.id ?? ''} emptyLabel={t('absenceCreateNoEmployees')} id="absence-employee" name="employeeId" placeholder={t('absenceCreateEmployeePlaceholder')} required searchPlaceholder={t('absenceCreateSearch')} searchable>
            <option disabled value="">{t('absenceCreateEmployeePlaceholder')}</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{[employee.firstName, employee.birthNamePrefix, employee.birthName].filter(Boolean).join(' ')}</option>)}
          </DropdownSelect>
        </label>
        <button className="button-secondary" type="submit">{t('absenceCreateSelect')}</button>
      </form>
    </section>

    {selectedEmployee && detail ? <section className="mt-6 rounded-3xl border bg-surface p-5 shadow-sm sm:p-6">
      <div className="mb-5 border-b pb-5"><p className="eyebrow text-primary">{t('absenceCreateSelected')}</p><h2 className="mt-1 text-xl font-semibold">{[selectedEmployee.firstName, selectedEmployee.birthNamePrefix, selectedEmployee.birthName].filter(Boolean).join(' ')}</h2><p className="mt-1 text-sm text-muted-foreground">{selectedEmployee.departmentName ?? t('notRecorded')}</p></div>
      <AbsenceQuickForm employeeId={selectedEmployee.id} employmentId={employmentSelection?.employment?.id} employmentOptions={employmentSelection?.options} recoveryMode="hidden" labels={{ report: t('absenceReport'), startDate: t('absenceStartDate'), percentage: t('absencePercentage'), expectedRecovery: t('absenceExpectedRecovery'), hasSafetyNet: t('absenceHasSafetyNet'), workAccident: t('absenceWorkAccident'), thirdPartyAccident: t('absenceThirdPartyAccident'), unknown: t('absenceUnknown'), yes: t('absenceYes'), no: t('absenceNo'), submit: t('absenceSubmit'), recover: t('absenceRecover'), partialRecover: t('absencePartialRecover'), recoveredOn: t('absenceRecoveredOn'), capacityEffectiveOn: t('absenceCaseCapacityEffectiveOn'), failed: t('absenceSaveFailed'), close: t('absenceClose'), discardTitle: t('absenceDiscardTitle'), discardDescription: t('absenceDiscardDescription'), discardConfirm: t('absenceDiscardConfirm'), discardCancel: t('absenceDiscardCancel'), employment: t('absenceEmployment'), employmentPlaceholder: t('absenceEmploymentPlaceholder'), employmentSearch: t('absenceEmploymentSearch'), saving: t('saving') }} />
    </section> : <p className="mt-6 rounded-2xl border border-dashed bg-surface/70 px-5 py-8 text-center text-sm text-muted-foreground">{t('absenceCreateEmployeePlaceholder')}</p>}
  </main>
}
