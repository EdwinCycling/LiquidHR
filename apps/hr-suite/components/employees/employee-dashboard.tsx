import Link from 'next/link'
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  CarFront,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  ExternalLink,
  FileText,
  GraduationCap,
  Hand,
  HeartPulse,
  Laptop2,
  Package,
  Pencil,
  Plus,
  Sparkles,
  Workflow,
} from 'lucide-react'
import type { Json } from '@scope/db'
import { EmployeeActivityFeed } from '@/components/employees/employee-activity-feed'
import { EmployeeDashboardSummary, type EmployeeDashboardSummaryLabels } from '@/components/employees/employee-dashboard-summary'
import { ProfileLinkForm } from '@/components/employment/profile-link-form'
import { EmployeeDashboardLayout } from '@/components/employees/employee-dashboard-layout'
import { EmploymentDashboardSummary } from '@/components/employees/employment-dashboard-summary'
import type { EmployeeActivityItem } from '@/lib/employees/employee-activity-service'
import type { EmployeeDashboardLayout as DashboardLayout } from '@/lib/preferences/employee-dashboard'
import { formatDate, formatDateTime } from '@/lib/preferences/formatters'
import type { DateFormat, TimeFormat } from '@/lib/preferences/user-preferences'
import type { EmployeeCustomField } from '@/lib/custom-fields/service'
import type { ReminderItem } from '@/lib/reminders/reminder-service'
import type { AbsenceCaseSummary } from '@/lib/absence/service'
import type { LeaveEmploymentOption } from '@/lib/leave/employment-resolver'
import { AbsenceQuickForm } from '@/components/absence/absence-quick-form'
import { getEmploymentCardStatus, hasActiveEmployment } from '@/lib/employment/employment-card-state'
import type { EmployeeDetailViewModel } from './types'

export interface EmployeeDashboardDocument { id: string; title: string; expiresOn: string | null; createdAt: string }

export interface EmployeeDashboardLabels extends EmployeeDashboardSummaryLabels {
  title: string; subtitle: string; openDetails: string; workContact: string; privateContact: string; birthDate: string; nationality: string; birthPlace: string; gender: string; customFields: string; customFieldsEmpty: string; employment: string; employmentEmpty: string; department: string; jobTitle: string; manager: string; hoursPerWeek: string; salary: string; salaryHidden: string; salaryNotAvailable: string; salaryMonthly: string; salaryHourly: string; salaryLoading: string; salaryFailed: string; leave: string; leaveDescription: string; absence: string; budgets: string; budgetsDescription: string; contracts: string; contractsDescription: string; contractCount: string; employmentNumber: string; employmentPeriod: string; employmentActive: string; employmentFuture: string; employmentEnded: string; employmentNoActive: string; employmentAdd: string; laborConditions: string; workerType: string; workerEmployee: string; workerStudentIntern: string; workerTemporaryAgency: string; workerExternal: string; workerFreelancer: string; workerVolunteer: string; workerNoPayroll: string; activity: string; activityDescription: string; activityEmpty: string; activityAdd: string; activityPlaceholder: string; activitySave: string; activitySaving: string; activityFailed: string; reminders: string; remindersEmpty: string; workflows: string; workflowsDescription: string; assets: string; assetsDescription: string; vehicles: string; vehiclesDescription: string; software: string; softwareDescription: string; education: string; educationDescription: string; documents: string; documentsEmpty: string; performance: string; performanceDescription: string; futureModule: string; futureModuleDescription: string; viewContracts: string; viewDocuments: string; viewReminders: string; moveUp: string; moveDown: string; drag: string; layoutSaving: string; layoutSaved: string; layoutFailed: string; profileLinks: string; noProfileLinks: string; addProfileLink: string; linkLabel: string; linkUrl: string; saveLink: string; linkFailed: string; absenceReport: string; absenceStartDate: string; absencePercentage: string; absenceExpectedRecovery: string; absenceHasSafetyNet: string; absenceWorkAccident: string; absenceThirdPartyAccident: string; absenceUnknown: string; absenceYes: string; absenceNo: string; absenceSubmit: string; absenceRecover: string; absenceRecoveredOn: string; absenceSaveFailed: string; absenceNowSick: string; absenceNowNotSick: string; absenceLastReport: string; absenceNoHistory: string; absenceActiveSince: string; absenceRecoveryWindow: string; absenceClose: string
  absenceOpenCase: string
}

interface EmployeeDashboardProps {
  detail: EmployeeDetailViewModel
  customFields: EmployeeCustomField[]
  documents: EmployeeDashboardDocument[]
  reminders: ReminderItem[]
  activity: EmployeeActivityItem[]
  canWriteActivity: boolean
  initialLayout: DashboardLayout
  locale: string
  dateFormat: DateFormat
  timeFormat: TimeFormat
  labels: EmployeeDashboardLabels
  canManageEmployments: boolean
  absence?: AbsenceCaseSummary | null
  absenceEmploymentOptions?: LeaveEmploymentOption[]
  selfReportAbsence?: boolean
}

export function EmployeeDashboard({ detail, customFields, documents, reminders, activity, canWriteActivity, initialLayout, locale, dateFormat, timeFormat, labels, canManageEmployments, absence, absenceEmploymentOptions = [], selfReportAbsence = false }: EmployeeDashboardProps) {
  const employee = detail.employee
  const summary = detail.currentEmploymentSummary
  const visibleFields = customFields.filter((field) => field.value !== undefined && field.value !== null && field.value !== '')
  const wide = [
    { id: 'personal' as const, node: <EmployeeDashboardSummary detail={detail} labels={labels} /> },
    { id: 'customFields' as const, node: <DashboardCard icon={<Sparkles className="h-4 w-4" />} title={labels.customFields} actionHref="?tab=personal" actionLabel={labels.edit}>{visibleFields.length > 0 ? <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">{visibleFields.slice(0, 9).map((field) => <DataPoint key={field.id} label={locale === 'en' ? field.labelEn : field.labelNl} value={formatCustomValue(field.value, labels.notRecorded)} />)}</dl> : <EmptyInline>{labels.customFieldsEmpty}</EmptyInline>}</DashboardCard> },
    { id: 'leave' as const, node: <DashboardCard icon={<CalendarDays className="h-4 w-4" />} title={labels.leave}><EmptyModule title={labels.leaveDescription} labels={labels} /></DashboardCard> },
    { id: 'absence' as const, node: <DashboardCard icon={<HeartPulse className="h-4 w-4" />} title={labels.absence}><div className="space-y-4">{absence ? <AbsenceStatusCard employeeId={employee.id} absence={absence} labels={labels} /> : <div className="rounded-xl border border-success/25 bg-success-surface/60 p-4 text-sm text-success"><div className="flex items-center gap-2 font-semibold"><CheckCircle2 aria-hidden="true" className="h-5 w-5" />{labels.absenceNowNotSick}</div><p className="mt-1 text-sm text-success/80">{labels.absenceNoHistory}</p></div>}<AbsenceQuickForm employeeId={employee.id} employmentId={detail.employments[0]?.id} employmentOptions={absenceEmploymentOptions} currentCase={absence} selfService={selfReportAbsence} recoveryMode="link" labels={{ report: labels.absenceReport, startDate: labels.absenceStartDate, percentage: labels.absencePercentage, expectedRecovery: labels.absenceExpectedRecovery, hasSafetyNet: labels.absenceHasSafetyNet, workAccident: labels.absenceWorkAccident, thirdPartyAccident: labels.absenceThirdPartyAccident, unknown: labels.absenceUnknown, yes: labels.absenceYes, no: labels.absenceNo, submit: labels.absenceSubmit, recover: labels.absenceRecover, recoveredOn: labels.absenceRecoveredOn, failed: labels.absenceSaveFailed, close: labels.absenceClose, selfServiceIntro: labels.absenceNoHistory }} /></div></DashboardCard> },
    { id: 'budgets' as const, node: <DashboardCard icon={<CircleDollarSign className="h-4 w-4" />} title={labels.budgets}><EmptyModule title={labels.budgetsDescription} labels={labels} /></DashboardCard> },
    { id: 'contracts' as const, node: <DashboardCard icon={<BriefcaseBusiness className="h-4 w-4" />} title={labels.contracts} actionHref="?tab=employments" actionLabel={labels.viewContracts}><EmploymentSummaryList employeeId={employee.id} employments={detail.employments} summaries={detail.employmentCards} locale={locale} dateFormat={dateFormat} labels={labels} canManageEmployments={canManageEmployments} /></DashboardCard> },
    { id: 'activity' as const, node: <DashboardCard icon={<ClipboardList className="h-4 w-4" />} title={labels.activity}><EmployeeActivityFeed employeeId={employee.id} items={activity} locale={locale} dateFormat={dateFormat} timeFormat={timeFormat} canWrite={canWriteActivity} labels={{ placeholder: labels.activityPlaceholder, add: labels.activityAdd, save: labels.activitySave, saving: labels.activitySaving, empty: labels.activityEmpty, failed: labels.activityFailed }} /></DashboardCard> },
  ]
  const narrow = [
    { id: 'employment' as const, node: <DashboardCard icon={<CircleDollarSign className="h-4 w-4" />} title={labels.employment} actionHref="?tab=employments" actionLabel={labels.viewContracts} compact><EmploymentDashboardSummary employeeId={employee.id} employments={detail.employments} cards={detail.employmentCards} currentSummary={summary} canReadSalary={detail.capabilities?.canReadSalary === true} labels={labels} locale={locale} /></DashboardCard> },
    { id: 'profileLinks' as const, node: <DashboardCard icon={<ExternalLink className="h-4 w-4" />} title={labels.profileLinks} compact>{detail.profileLinks?.length ? <ul className="space-y-2">{detail.profileLinks.map((link) => <li key={link.id}><a className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline" href={link.url} target="_blank" rel="noreferrer">{link.label}<ExternalLink aria-hidden="true" size={14} /></a></li>)}</ul> : <EmptyInline>{labels.noProfileLinks}</EmptyInline>}{detail.capabilities?.canEditEmployee && <ProfileLinkForm employeeId={employee.id} labels={{ add: labels.addProfileLink, label: labels.linkLabel, url: labels.linkUrl, save: labels.saveLink, failed: labels.linkFailed }} />}</DashboardCard> },
    { id: 'reminders' as const, node: <DashboardCard icon={<CalendarDays className="h-4 w-4" />} title={labels.reminders} actionHref="?tab=reminders" actionLabel={labels.viewReminders} compact>{reminders.length ? <ul className="divide-y divide-border/70">{reminders.slice(0, 4).map((item) => <li className="py-3 first:pt-0 last:pb-0" key={item.recipientId}><p className="text-sm font-medium">{item.title}</p><time className="mt-1 block text-xs text-muted-foreground" dateTime={item.remindAt}>{formatDateTime(item.remindAt, { locale, dateFormat, timeFormat })}</time></li>)}</ul> : <EmptyInline>{labels.remindersEmpty}</EmptyInline>}</DashboardCard> },
    { id: 'workflows' as const, node: <PlaceholderCard icon={<Workflow className="h-4 w-4" />} title={labels.workflows} description={labels.workflowsDescription} labels={labels} /> },
    { id: 'assets' as const, node: <PlaceholderCard icon={<Package className="h-4 w-4" />} title={labels.assets} description={labels.assetsDescription} labels={labels} /> },
    { id: 'vehicles' as const, node: <PlaceholderCard icon={<CarFront className="h-4 w-4" />} title={labels.vehicles} description={labels.vehiclesDescription} labels={labels} /> },
    { id: 'software' as const, node: <PlaceholderCard icon={<Laptop2 className="h-4 w-4" />} title={labels.software} description={labels.softwareDescription} labels={labels} /> },
    { id: 'education' as const, node: <PlaceholderCard icon={<GraduationCap className="h-4 w-4" />} title={labels.education} description={labels.educationDescription} labels={labels} /> },
    { id: 'documents' as const, node: <DashboardCard icon={<FileText className="h-4 w-4" />} title={labels.documents} actionHref="?tab=documents" actionLabel={labels.viewDocuments} compact>{documents.length > 0 ? <ul className="divide-y divide-border/70">{documents.slice(0, 3).map((document) => <li key={document.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="min-w-0 truncate font-medium">{document.title}</span><CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-success" /></li>)}</ul> : <EmptyInline>{labels.documentsEmpty}</EmptyInline>}</DashboardCard> },
    { id: 'performance' as const, node: <PlaceholderCard icon={<Sparkles className="h-4 w-4" />} title={labels.performance} description={labels.performanceDescription} labels={labels} /> },
  ]

  return <section aria-labelledby="employee-dashboard-title" className="mt-8 space-y-5"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow text-primary">{labels.title}</p><h2 id="employee-dashboard-title" className="mt-1 text-2xl font-semibold tracking-tight">{labels.subtitle}</h2></div><Link prefetch={false} href={`/employees/${employee.id}?tab=personal&edit=1`} className="button-secondary inline-flex items-center gap-2"><Pencil aria-hidden="true" className="h-4 w-4" />{labels.openDetails}</Link></header><EmployeeDashboardLayout wide={wide} narrow={narrow} initialLayout={initialLayout} labels={{ moveUp: labels.moveUp, moveDown: labels.moveDown, drag: labels.drag, saving: labels.layoutSaving, saved: labels.layoutSaved, failed: labels.layoutFailed }} /></section>
}

function EmploymentSummaryList({
  employeeId,
  employments,
  summaries,
  locale,
  dateFormat,
  labels,
  canManageEmployments,
}: {
  employeeId: string
  employments: EmployeeDetailViewModel['employments']
  summaries: EmployeeDetailViewModel['employmentCards']
  locale: string
  dateFormat: DateFormat
  labels: EmployeeDashboardLabels
  canManageEmployments: boolean
}) {
  const today = new Date().toISOString().slice(0, 10)
  const active = hasActiveEmployment(employments.map((employment) => ({ startsOn: employment.starts_on, endsOn: employment.ends_on, recordStatus: employment.record_status })), today)
  const workerTypeLabel = (workerType: string | null) => workerType === 'EMPLOYEE'
    ? labels.workerEmployee
    : workerType === 'INTERN'
      ? labels.workerStudentIntern
      : workerType === 'TEMPORARY_AGENCY'
        ? labels.workerTemporaryAgency
        : workerType === 'FREELANCER'
          ? labels.workerFreelancer
          : workerType === 'VOLUNTEER'
            ? labels.workerVolunteer
            : workerType === 'NO_PAYROLL'
              ? labels.workerNoPayroll
              : labels.notRecorded
  const statusLabel = (status: ReturnType<typeof getEmploymentCardStatus>) => status === 'ACTIVE'
    ? labels.employmentActive
    : status === 'FUTURE'
      ? labels.employmentFuture
      : labels.employmentEnded

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm font-semibold">{labels.contractCount.replace('{count}', String(employments.length))}</p>
      {!active && <span className="status-chip bg-warning-surface text-warning">{labels.employmentNoActive}</span>}
    </div>
    {employments.length === 0 ? <div className="rounded-xl border border-dashed border-primary/25 bg-accent/20 p-4"><p className="text-sm text-muted-foreground">{labels.employmentEmpty}</p>{canManageEmployments && <Link href={`/employees/${employeeId}/employments/new`} className="button-primary mt-4 inline-flex items-center gap-2"><Plus aria-hidden="true" className="h-4 w-4" />{labels.employmentAdd}</Link>}</div> : <div className="space-y-3">
      {!active && <div className="rounded-xl bg-warning-surface/60 p-4 text-sm text-warning">{labels.employmentNoActive}{canManageEmployments && <Link href={`/employees/${employeeId}/employments/new`} className="ml-2 font-semibold underline underline-offset-2">{labels.employmentAdd}</Link>}</div>}
      {employments.map((employment) => {
        const summary = summaries.find((item) => item.employmentId === employment.id)
        const status = getEmploymentCardStatus({ startsOn: employment.starts_on, endsOn: employment.ends_on, recordStatus: employment.record_status }, today)
        const period = `${formatDate(employment.starts_on, { locale, dateFormat })} – ${employment.ends_on ? formatDate(employment.ends_on, { locale, dateFormat }) : '…'}`
        return <Link key={employment.id} prefetch={false} href={`/employees/${employeeId}/employments/${employment.id}?fromTab=overview`} className="group block rounded-xl border border-border/70 bg-background p-4 transition-colors hover:border-primary/45 hover:bg-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{labels.employmentNumber}: {employment.employment_number}</p>
              <p className="mt-1 text-xs text-muted-foreground">{labels.employmentPeriod}: {period}</p>
            </div>
            <span className={`status-chip ${status === 'ACTIVE' ? 'bg-success-surface text-success' : status === 'FUTURE' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>{statusLabel(status)}</span>
          </div>
          <dl className="mt-4 grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
            <DataPoint label={labels.jobTitle} value={summary?.jobTitle ?? labels.notRecorded} />
            <DataPoint label={labels.department} value={summary?.departmentName ?? labels.notRecorded} />
            <DataPoint label={labels.workerType} value={workerTypeLabel(summary?.employmentType ?? null)} />
            <DataPoint label={labels.hoursPerWeek} value={summary?.hoursPerWeek === null || summary?.hoursPerWeek === undefined ? labels.notRecorded : `${summary.hoursPerWeek}u`} />
            <DataPoint label={labels.laborConditions} value={summary?.laborConditionName ?? labels.notRecorded} />
          </dl>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary opacity-80 transition-opacity group-hover:opacity-100"><ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />{labels.viewContracts}</span>
        </Link>
      })}
    </div>}
  </div>
}

function DashboardCard({ icon, title, actionHref, actionLabel, compact = false, children }: { icon: React.ReactNode; title: string; actionHref?: string; actionLabel?: string; compact?: boolean; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-sm"><header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5"><div className="flex min-w-0 items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-accent-foreground">{icon}</span><h3 className="truncate text-sm font-semibold">{title}</h3></div>{actionHref && actionLabel ? <Link href={actionHref} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"><ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />{actionLabel}</Link> : null}</header><div className={`p-4 sm:p-5 ${compact ? 'sm:p-4' : ''}`}>{children}</div></section>
}

function PlaceholderCard({ icon, title, description, labels }: { icon: React.ReactNode; title: string; description: string; labels: EmployeeDashboardLabels }) {
  return <section className="overflow-hidden rounded-2xl border border-dashed border-primary/30 bg-accent/20 shadow-sm"><header className="flex items-center justify-between gap-3 border-b border-dashed border-primary/20 px-4 py-3.5"><div className="flex min-w-0 items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span><h3 className="truncate text-sm font-semibold">{title}</h3></div><Plus aria-hidden="true" className="h-4 w-4 text-success" /></header><div className="p-4"><p className="text-sm leading-6 text-muted-foreground">{description}</p><p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-primary">{labels.futureModule}</p><p className="mt-1 text-xs text-muted-foreground">{labels.futureModuleDescription}</p></div></section>
}

function EmptyModule({ title, labels }: { title: string; labels: EmployeeDashboardLabels }) { return <div className="rounded-xl border border-dashed border-primary/25 bg-accent/20 p-4"><p className="text-sm leading-6 text-muted-foreground">{title}</p><p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-primary">{labels.futureModule}</p><p className="mt-1 text-xs text-muted-foreground">{labels.futureModuleDescription}</p></div> }
function EmptyInline({ children }: { children: React.ReactNode }) { return <p className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">{children}</p> }
function DataPoint({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-[0.11em] text-muted-foreground">{label}</dt><dd className="mt-1 truncate text-sm font-semibold">{value}</dd></div> }
function formatCustomValue(value: Json | undefined, fallback: string): string { if (value === undefined || value === null) return fallback; if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value); if (Array.isArray(value)) return value.map((item) => formatCustomValue(item, fallback)).join(', '); return Object.entries(value).map(([key, item]) => `${key}: ${formatCustomValue(item, fallback)}`).join(', ') }

function AbsenceStatusCard({ employeeId, absence, labels }: { employeeId: string; absence: AbsenceCaseSummary; labels: EmployeeDashboardLabels }) {
  const isCurrentlySick = absence.status === 'ACTIVE'
  const spell = absence.spells[0]
  return <Link prefetch={false} href={`/employees/${employeeId}?tab=absence&view=expanded&caseId=${absence.id}`} aria-label={labels.absenceOpenCase} title={labels.absenceOpenCase} className={`group block cursor-pointer rounded-xl border p-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${isCurrentlySick ? 'border-destructive/30 bg-destructive-surface/70 text-destructive hover:border-destructive/60' : 'border-success/25 bg-success-surface/60 text-success hover:border-success/60'}`}>
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 font-semibold">{isCurrentlySick ? <HeartPulse aria-hidden="true" className="h-5 w-5" /> : <CheckCircle2 aria-hidden="true" className="h-5 w-5" />}{isCurrentlySick ? labels.absenceNowSick : labels.absenceNowNotSick}</div><Hand aria-hidden="true" className="h-5 w-5 shrink-0 opacity-80 transition-transform group-hover:-rotate-6" /></div>
    <p className="mt-2 text-sm">{isCurrentlySick ? labels.absenceActiveSince.replace('{date}', absence.firstAbsenceOn) : `${labels.absenceLastReport}: ${absence.firstAbsenceOn}`}</p>
    {spell?.absencePercentage !== null && spell?.absencePercentage !== undefined ? <p className="mt-1 text-xs opacity-80">{spell.absencePercentage}%</p> : null}
    {!isCurrentlySick && absence.status === 'RECOVERY_WINDOW' && absence.recoveryWindowEndsOn ? <p className="mt-1 text-xs opacity-80">{labels.absenceRecoveryWindow.replace('{date}', absence.recoveryWindowEndsOn)}</p> : null}
  </Link>
}
