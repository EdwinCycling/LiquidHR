import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Bot, BriefcaseBusiness, CalendarDays, ExternalLink, FileText, HeartPulse, Mail, MapPin, MessageSquareText, Palmtree, Smartphone, Sparkles } from 'lucide-react'
import { EmploymentMutationPanel } from '@/components/employment/employment-mutation-panel'
import { EmploymentTimeMap } from '@/components/employment/employment-time-map'
import { WorkPatternPanel } from '@/components/employment/work-pattern-panel'
import { ProfileLinkForm } from '@/components/employment/profile-link-form'
import { EmploymentDetailError, getEmploymentDetail } from '@/lib/employment/employment-detail-service'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { listEmployeeHrEvents } from '@/lib/hr-events/service'

interface PageProps {
  params: Promise<{ employeeId: string; employmentId: string }>
  searchParams: Promise<{ tab?: string; view?: string; date?: string }>
}

const tabs = ['overview', 'basics', 'labor', 'schedule', 'salary', 'organization', 'costs', 'history'] as const
type Tab = (typeof tabs)[number]

function periodLabel(from: string, until: string | null, locale: string, open: string) {
  const format = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00Z`))
  return `${format(from)} — ${until ? format(until) : open}`
}

function DataCard({ title, value, meta }: { title: string; value: string; meta?: string }) {
  return <article className="rounded-xl border bg-surface p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{title}</p><p className="mt-2 font-semibold">{value}</p>{meta && <p className="mt-1 text-sm text-muted-foreground">{meta}</p>}</article>
}

async function loadPageData(employeeId: string, employmentId: string) {
  try {
    return await Promise.all([getEmploymentDetail(employeeId, employmentId), getLocale(), getTranslator('employment'), listEmployeeHrEvents(employeeId, { employmentId })])
  } catch (error) {
    if (error instanceof EmploymentDetailError && error.status === 404) notFound()
    throw error
  }
}

export default async function EmploymentDetailPage({ params, searchParams }: PageProps) {
  const [{ employeeId, employmentId }, query] = await Promise.all([params, searchParams])
    const [detail, locale, t, events] = await loadPageData(employeeId, employmentId)
    const tab: Tab = tabs.includes(query.tab as Tab) ? query.tab as Tab : 'overview'
    const expanded = query.view !== 'compact'
    const today = new Date().toISOString().slice(0, 10)
    const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(query.date ?? '') ? query.date! : today
    const name = `${detail.employee.first_name} ${detail.employee.birth_name}`
    const mutationLabels = Object.fromEntries([
      'change','rollback','onlyBlockProtected','effectiveOn','conditionGroup','scheduleType','averageHours','averageDays','partTimeFactor','startWeek','timeForTime','hoursAndAverageDays','hoursPerDay','hoursAndSpecificDays','timesPerDay','paymentType','periodicFixed','hourlyVariable','paymentFrequency','monthly','fourWeekly','fulltimeAmount','hourlyRate','costCenter','percentage','addAllocation','allocationTotal','allocationMustBe100','changeReason','continue','changeSaved','changeFailed','rollbackReason','twkTitle','twkWarning','normalConfirmTitle','normalConfirmText','confirm','cancel','rollbackTitle','rollbackWarning','rollbackConfirm','impactTitle','impactDirect','impactLater','impactNotApplicable','impactScheduleSalary','impactScheduleLeave','impactSchedulePension','impactSchedulePayroll','impactSalaryOrganization','impactSalaryLabor','impactSalaryPayroll','impactLaborSchedule','impactLaborSalary','impactLaborLeave'
    ].map((key) => [key, t(key)]))
    const tabLabels: Record<Tab, string> = { overview: t('tabsOverview'), basics: t('tabsBasics'), labor: t('tabsLabor'), schedule: t('tabsSchedule'), salary: t('tabsSalary'), organization: t('tabsOrganization'), costs: t('tabsCosts'), history: t('tabsHistory') }
    const effectiveStatus = detail.employment.starts_on > today ? t('future') : detail.employment.ends_on && detail.employment.ends_on < today ? t('ended') : t('active')
    const currentSchedule = detail.schedules[0]
    const currentSalary = detail.salaries[0]
    const directPayloads = {
      SCHEDULE: currentSchedule ? {
        scheduleType: currentSchedule.schedule_type, startWeek: currentSchedule.start_week,
        averageDaysPerWeek: currentSchedule.average_days_per_week, averageHoursPerWeek: currentSchedule.average_hours_per_week,
        partTimeFactor: currentSchedule.part_time_factor, timeForTimeAccrual: currentSchedule.time_for_time_accrual,
        mondayHours: currentSchedule.monday_hours, tuesdayHours: currentSchedule.tuesday_hours, wednesdayHours: currentSchedule.wednesday_hours,
        thursdayHours: currentSchedule.thursday_hours, fridayHours: currentSchedule.friday_hours, saturdayHours: currentSchedule.saturday_hours, sundayHours: currentSchedule.sunday_hours,
      } : undefined,
      SALARY: currentSalary ? {
        paymentType: currentSalary.payment_type, paymentFrequency: currentSalary.payment_frequency, salaryBasis: currentSalary.salary_basis,
        fulltimeAmount: currentSalary.fulltime_amount, hourlyRate: currentSalary.hourly_rate, currencyCode: currentSalary.currency_code,
        salaryScaleStepId: currentSalary.salary_scale_step_id, caoScaleName: currentSalary.cao_scale_name, caoStepName: currentSalary.cao_step_name,
      } : undefined,
    }

    return <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <Link href={`/employees/${employeeId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"><ArrowLeft className="h-4 w-4" />{t('backToEmployee')}</Link>
      <header className="relative mt-4 overflow-hidden rounded-3xl border bg-surface p-5 shadow-sm sm:p-7">
        <div aria-hidden="true" className="absolute -right-12 -top-20 h-64 w-64 rounded-full bg-accent opacity-80" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            {detail.employee.avatar_url ? <Image src={detail.employee.avatar_url} alt={name} width={80} height={80} className="h-16 w-16 rounded-2xl object-cover ring-4 ring-background sm:h-20 sm:w-20" /> : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground sm:h-20 sm:w-20">{detail.employee.first_name[0]}{detail.employee.birth_name[0]}</span>}
            <div className="min-w-0"><p className="eyebrow">{detail.employee.employee_number} · {detail.employment.employment_number}</p><h1 className="mt-1 truncate text-2xl font-semibold tracking-tight sm:text-3xl">{name}</h1><p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground"><span className="inline-flex items-center gap-1.5"><BriefcaseBusiness className="h-4 w-4" />{detail.employment.contract_type}</span><span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{detail.administration.name}</span></p></div>
          </div>
          <div className="relative flex flex-wrap items-center gap-2"><span className="status-chip bg-accent text-accent-foreground">{effectiveStatus}</span><Link className={expanded ? 'button-secondary' : 'button-primary'} href={`?tab=${tab}&view=expanded`}>{t('expanded')}</Link><Link className={!expanded ? 'button-secondary' : 'button-primary'} href={`?tab=${tab}&view=compact`}>{t('compact')}</Link></div>
        </div>
        {expanded && <div className="relative mt-6 flex flex-wrap gap-3 border-t pt-4 text-sm text-muted-foreground">{detail.employee.work_email && <a href={`mailto:${detail.employee.work_email}`} className="inline-flex items-center gap-2 hover:text-foreground"><Mail className="h-4 w-4" />{detail.employee.work_email}</a>}{detail.employee.work_mobile && <a href={`tel:${detail.employee.work_mobile}`} className="inline-flex items-center gap-2 hover:text-foreground"><Smartphone className="h-4 w-4" />{detail.employee.work_mobile}</a>}{detail.profileLinks.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-foreground"><ExternalLink className="h-4 w-4" />{link.label}</a>)}</div>}
      </header>

      <nav aria-label={t('detailTitle', { number: detail.employment.employment_number })} className="mt-5 overflow-x-auto rounded-2xl border bg-surface p-1.5 shadow-sm"><div className="flex min-w-max gap-1">{tabs.map((item) => <Link key={item} href={`?tab=${item}&view=${expanded ? 'expanded' : 'compact'}`} className={`rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${tab === item ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>{tabLabels[item]}</Link>)}</div></nav>

      <div className="mt-6">
        {tab === 'overview' && <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,.65fr)]">
          <section className="space-y-5"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><DataCard title={t('contractType')} value={detail.employment.contract_type} /><DataCard title={t('startDate')} value={periodLabel(detail.employment.starts_on, detail.employment.ends_on, locale, t('active'))} /><DataCard title={t('administration')} value={detail.administration.name} meta={detail.administration.code} /><DataCard title={t('status')} value={effectiveStatus} /></div>
            <article className="rounded-2xl border bg-surface p-5 shadow-sm"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground"><Sparkles className="h-5 w-5" /></span><h2 className="text-lg font-semibold">{t('aiSummary')}</h2></div><p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">{t('aiSummaryPlaceholder')}</p></article>
            <article className="rounded-2xl border bg-surface p-5 shadow-sm"><h2 className="text-lg font-semibold">{t('futureModules')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('futureModulesText')}</p><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{[[FileText,t('documents')],[Palmtree,t('leave')],[HeartPulse,t('absence')],[MessageSquareText,t('conversations')]].map(([Icon,label]) => { const Component = Icon as typeof FileText; return <div key={String(label)} className="rounded-xl border border-dashed p-4 text-center text-sm font-medium"><Component className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />{String(label)}</div> })}</div></article>
          </section>
          <aside className="space-y-5"><article className="rounded-2xl border bg-surface p-5 shadow-sm"><div className="flex items-center gap-3"><Bot className="h-5 w-5 text-primary" /><h2 className="font-semibold">{t('followUps')}</h2></div>{detail.followUps.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t('noFollowUps')}</p> : <ul className="mt-3 space-y-3">{detail.followUps.map((item) => <li key={item.id} className="rounded-xl bg-muted p-3"><p className="text-sm font-semibold">{item.subject}</p>{item.due_on && <p className="mt-1 text-xs text-muted-foreground">{item.due_on}</p>}</li>)}</ul>}</article>
            <article className="rounded-2xl border bg-surface p-5 shadow-sm"><h2 className="font-semibold">{t('profileLinks')}</h2>{detail.profileLinks.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t('noLinks')}</p> : <ul className="mt-3 space-y-2">{detail.profileLinks.map((link) => <li key={link.id}><a className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline" href={link.url} target="_blank" rel="noreferrer">{link.label}<ExternalLink className="h-3.5 w-3.5" /></a></li>)}</ul>}{detail.capabilities.canWriteEmployee && <ProfileLinkForm employmentId={employmentId} labels={{ add: t('addLink'), label: t('linkLabel'), url: t('linkUrl'), save: t('saveLink'), failed: t('changeFailed') }} />}</article></aside>
        </div>}

        {tab === 'basics' && <div className="grid gap-5 lg:grid-cols-2"><section className="rounded-2xl border bg-surface p-5 shadow-sm"><h2 className="text-lg font-semibold">{t('tabsBasics')}</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs font-semibold text-muted-foreground">{t('employmentNumber')}</dt><dd className="mt-1 font-medium">{detail.employment.employment_number}</dd></div><div><dt className="text-xs font-semibold text-muted-foreground">{t('seniorityDate')}</dt><dd className="mt-1 font-medium">{detail.employment.seniority_date}</dd></div><div><dt className="text-xs font-semibold text-muted-foreground">{t('startDate')}</dt><dd className="mt-1 font-medium">{detail.employment.starts_on}</dd></div><div><dt className="text-xs font-semibold text-muted-foreground">{t('endsOn')}</dt><dd className="mt-1 font-medium">{detail.employment.ends_on ?? t('notRecorded')}</dd></div></dl></section><section className="rounded-2xl border bg-surface p-5 shadow-sm"><h2 className="text-lg font-semibold">{t('incomeRelationship')}</h2>{detail.incomeRelationships.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t('notRecorded')}</p> : <div className="mt-4 space-y-3">{detail.incomeRelationships.map((link) => <article key={link.id} className="rounded-xl bg-muted p-4"><p className="font-semibold">{t('incomeRelationshipNumber')} {link.income_relationships?.ikv_number}</p><p className="mt-1 text-sm text-muted-foreground">{periodLabel(link.valid_from, link.valid_until, locale, t('active'))}</p></article>)}</div>}</section></div>}

        {tab === 'labor' && <div className="grid gap-5 lg:grid-cols-[1fr_.8fr]"><section className="space-y-3">{detail.laborConditions.map((row, index) => <DataCard key={row.id} title={index === 0 ? t('currentValue') : t('historyLabel')} value={row.condition_group} meta={periodLabel(row.valid_from,row.valid_until,locale,t('active'))} />)}</section><EmploymentMutationPanel employmentId={employmentId} timeline="LABOR_CONDITIONS" canWrite={detail.capabilities.canWriteContract} blockCount={detail.laborConditions.length} latestEffectiveOn={detail.laborConditions[0]?.valid_from} directPayloads={directPayloads} labels={mutationLabels} /></div>}
        {tab === 'schedule' && <div className="space-y-6"><WorkPatternPanel employmentId={employmentId} canWrite={detail.capabilities.canWriteWorkSchedule} agreements={detail.schedules.map((row) => ({ validFrom: row.valid_from, validUntil: row.valid_until, averageHours: Number(row.average_hours_per_week), dailyHours: [row.monday_hours,row.tuesday_hours,row.wednesday_hours,row.thursday_hours,row.friday_hours,row.saturday_hours,row.sunday_hours].map((value) => Number(value ?? 0)) }))} labels={{ hoursTimeline:t('workPatternHoursTimeline'), patternTimeline:t('workPatternTimeline'), noPatterns:t('workPatternNoPatterns'), newPattern:t('workPatternNew'), patternName:t('workPatternName'), cycleWeeks:t('workPatternCycleWeeks'), week:t('workPatternWeek'), anchorDate:t('workPatternAnchorDate'), validFrom:t('validFrom'), validUntil:t('validUntil'), workingDay:t('workPatternWorkingDay'), startTime:t('workPatternStartTime'), endTime:t('workPatternEndTime'), breakMinutes:t('workPatternBreakMinutes'), averageHours:t('averageHours'), publishPattern:t('workPatternPublish'), saving:t('saving'), saved:t('workPatternSaved'), failed:t('workPatternFailed'), correlationHelp:t('workPatternCorrelationHelp'), days:[t('dayMonday'),t('dayTuesday'),t('dayWednesday'),t('dayThursday'),t('dayFriday'),t('daySaturday'),t('daySunday')] }} /><EmploymentMutationPanel employmentId={employmentId} timeline="SCHEDULE" canWrite={detail.capabilities.canWriteContract} blockCount={detail.schedules.length} latestEffectiveOn={detail.schedules[0]?.valid_from} labels={mutationLabels} /></div>}
        {tab === 'salary' && !detail.capabilities.canReadSalary && <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">{t('salaryRestricted')}</div>}
        {tab === 'salary' && detail.capabilities.canReadSalary && <div className="grid gap-5 lg:grid-cols-[1fr_.8fr]"><section className="space-y-3">{detail.salaries.map((row, index) => <DataCard key={row.id} title={index === 0 ? t('currentValue') : t('historyLabel')} value={new Intl.NumberFormat(locale,{style:'currency',currency:row.currency_code}).format(row.fulltime_amount ?? row.hourly_rate ?? 0)} meta={periodLabel(row.valid_from,row.valid_until,locale,t('active'))} />)}</section><EmploymentMutationPanel employmentId={employmentId} timeline="SALARY" canWrite={detail.capabilities.canWriteSalary} blockCount={detail.salaries.length} latestEffectiveOn={detail.salaries[0]?.valid_from} labels={mutationLabels} /></div>}
        {tab === 'organization' && <section className="space-y-3">{detail.organizations.map((row,index) => <DataCard key={row.id} title={index === 0 ? t('currentValue') : t('historyLabel')} value={`${row.departments?.code ?? ''} · ${row.departments?.name ?? t('notRecorded')}`} meta={`${row.job_title ?? t('notRecorded')} · ${periodLabel(row.effective_from,row.effective_to,locale,t('active'))}`} />)}</section>}
        {tab === 'costs' && <div className="grid gap-5 lg:grid-cols-[1fr_.8fr]"><section className="space-y-3">{detail.costAllocations.map((row) => <DataCard key={row.id} title={`${row.cost_centers?.code ?? ''} · ${row.cost_centers?.name ?? t('costCenter')}`} value={`${row.percentage}%`} meta={periodLabel(row.valid_from,row.valid_until,locale,t('active'))} />)}</section><EmploymentMutationPanel employmentId={employmentId} timeline="COST_ALLOCATION" canWrite={detail.capabilities.canWriteContract} blockCount={new Set(detail.costAllocations.map((row) => row.valid_from)).size} latestEffectiveOn={detail.costAllocations[0]?.valid_from} costCenters={detail.options.costCenters} labels={mutationLabels} /></div>}
        {tab === 'history' && <div className="space-y-5"><EmploymentTimeMap events={events} selectedDate={selectedDate} labels={{ title:t('timeMapTitle'),subtitle:t('timeMapSubtitle'),empty:t('timeMapEmpty'),asOf:t('timeMapAsOf'),lanes:{contract:t('timeLaneContract'),organization:t('timeLaneOrganization'),conditions:t('timeLaneConditions'),compensation:t('timeLaneCompensation'),dossier:t('timeLaneDossier')},events:{EMPLOYMENT_STARTED:t('eventEmploymentStarted'),EMPLOYMENT_ENDED:t('eventEmploymentEnded'),INCOME_RELATIONSHIP_CHANGED:t('eventIncomeRelationship'),ORGANIZATION_CHANGED:t('eventOrganization'),LABOR_CONDITIONS_CHANGED:t('eventLabor'),SCHEDULE_CHANGED:t('eventSchedule'),SALARY_CHANGED:t('eventSalary'),COST_ALLOCATION_CHANGED:t('eventCost'),DOCUMENT_ADDED:t('eventDocumentAdded'),DOCUMENT_EXPIRES:t('eventDocumentExpires')} }} /><section className="rounded-2xl border bg-surface p-5 shadow-sm"><h2 className="text-lg font-semibold">{t('auditLog')}</h2>{detail.auditLogs.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{t('auditEmpty')}</p> : <ol className="mt-5 space-y-4 border-l pl-5">{detail.auditLogs.map((log) => <li key={log.id} className="relative before:absolute before:-left-[1.6rem] before:top-1 before:h-3 before:w-3 before:rounded-full before:bg-primary"><p className="font-semibold">{log.action} · {log.entity_name}</p><p className="mt-1 text-sm text-muted-foreground"><CalendarDays className="mr-1 inline h-3.5 w-3.5" />{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(log.created_at))}</p></li>)}</ol>}</section></div>}
      </div>
    </main>
}
