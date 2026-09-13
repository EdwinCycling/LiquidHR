import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { LeaveYearOverview } from '@/components/leave/leave-year-overview'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { buttonClasses } from '@/components/ui/button'
import { AuthorizationError } from '@/lib/auth/permissions'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { LeaveServiceError } from '@/lib/leave/leave-service'
import { getLeaveYearOverview } from '@/lib/leave/overview-service'

type Props = {
  params: Promise<{ employeeId: string }>
  searchParams: Promise<{ employmentId?: string; year?: string }>
}

export default async function EmployeeLeaveOverviewPage({ params, searchParams }: Props) {
  const [{ employeeId }, query] = await Promise.all([params, searchParams])
  const requestedYear = Number(query.year)
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2200 ? requestedYear : new Date().getUTCFullYear()
  let data: Awaited<ReturnType<typeof getLeaveYearOverview>>
  try {
    data = await getLeaveYearOverview({ employmentId: query.employmentId ?? '', year })
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    if (error instanceof LeaveServiceError && error.status === 404) notFound()
    throw error
  }
  const [locale, t] = await Promise.all([getLocale(), getTranslator('employees')])
  const labels = {
    title: t('leaveOverviewTitle'), description: t('leaveOverviewDescription'), back: t('leaveOverviewBack'), year: t('leaveOverviewYear'), previous: t('leaveOverviewPrevious'), next: t('leaveOverviewNext'), legend: t('leaveOverviewLegend'), past: t('leaveOverviewPast'), today: t('leaveOverviewToday'), future: t('leaveOverviewFuture'), approved: t('leaveOverviewApproved'), hours: t('leaveOverviewHours'), details: t('leaveOverviewDetails'), noLeave: t('leaveOverviewNoLeave'), requestMode: t('leaveOverviewRequestMode'), direct: t('leaveOverviewDirect'), priority: t('leaveOverviewPriority'), timeMode: t('leaveOverviewTimeMode'), fullDay: t('leaveOverviewFullDay'), morning: t('leaveOverviewMorning'), afternoon: t('leaveOverviewAfternoon'), specificHours: t('leaveOverviewSpecificHours'), from: t('leaveOverviewFrom'), until: t('leaveOverviewUntil'), beginningBalance: t('leaveOverviewBeginningBalance'), currentBalance: t('leaveOverviewCurrentBalance'), taken: t('leaveOverviewTaken'), planned: t('leaveOverviewPlanned'), projectedEnd: t('leaveOverviewProjectedEnd'), openingBalance: t('leaveOverviewOpeningBalance'), accrual: t('leaveOverviewAccrual'), contractEnd: t('leaveOverviewContractEnd'), employment: t('leaveOverviewEmployment'), notRecorded: t('notRecorded'), unlimited: t('dashboardLeaveHistoryUnlimited'),
  }
  return <PageShell className="py-6 sm:py-8" width="wide"><PageHeader title={`${labels.title} · ${year}`} description={labels.description} actions={<div className="flex flex-wrap gap-2"><Link className={buttonClasses({ variant: 'secondary' })} href={`/employees/${employeeId}`}>{labels.back}</Link><Link aria-label={labels.previous} className={buttonClasses({ variant: 'ghost' })} href={`/employees/${employeeId}/leave?employmentId=${data.employmentSelection.selectedEmploymentId}&year=${year - 1}`}>← {year - 1}</Link><Link aria-label={labels.next} className={buttonClasses({ variant: 'ghost' })} href={`/employees/${employeeId}/leave?employmentId=${data.employmentSelection.selectedEmploymentId}&year=${year + 1}`}>{year + 1} →</Link></div>} /><div className="mt-6"><LeaveYearOverview days={data.days} employment={data.employment} labels={labels} locale={locale} report={data.report} /></div></PageShell>
}
