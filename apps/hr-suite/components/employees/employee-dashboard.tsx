import Link from 'next/link'
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  CarFront,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  FileText,
  GraduationCap,
  HeartPulse,
  Laptop2,
  Package,
  Pencil,
  Plus,
  ShieldAlert,
  Sparkles,
  UserRound,
  WalletCards,
  Workflow,
} from 'lucide-react'
import type { Json } from '@scope/db'
import { EmployeeActivityFeed } from '@/components/employees/employee-activity-feed'
import { EmployeeDashboardLayout } from '@/components/employees/employee-dashboard-layout'
import { SalaryReveal } from '@/components/employees/salary-reveal'
import { EmailLink } from '@/components/shared/email-link'
import type { EmployeeActivityItem } from '@/lib/employees/employee-activity-service'
import type { EmployeeDashboardLayout as DashboardLayout } from '@/lib/preferences/employee-dashboard'
import { formatDate, formatDateTime } from '@/lib/preferences/formatters'
import type { DateFormat, TimeFormat } from '@/lib/preferences/user-preferences'
import type { EmployeeCustomField } from '@/lib/custom-fields/service'
import type { ReminderItem } from '@/lib/reminders/reminder-service'
import type { EmployeeDetailViewModel } from './types'

export interface EmployeeDashboardDocument { id: string; title: string; expiresOn: string | null; createdAt: string }

export interface EmployeeDashboardLabels {
  title: string; subtitle: string; openDetails: string; edit: string; personal: string; contact: string; workContact: string; privateContact: string; noContact: string; address: string; noAddress: string; birthDate: string; nationality: string; birthPlace: string; gender: string; notRecorded: string; customFields: string; customFieldsEmpty: string; employment: string; employmentEmpty: string; department: string; jobTitle: string; hoursPerWeek: string; salary: string; salaryHidden: string; salaryNotAvailable: string; salaryMonthly: string; salaryHourly: string; salaryLoading: string; salaryFailed: string; leave: string; leaveDescription: string; absence: string; absenceDescription: string; budgets: string; budgetsDescription: string; contracts: string; contractsDescription: string; contractCount: string; activity: string; activityDescription: string; activityEmpty: string; activityAdd: string; activityPlaceholder: string; activitySave: string; activitySaving: string; activityFailed: string; reminders: string; remindersEmpty: string; workflows: string; workflowsDescription: string; assets: string; assetsDescription: string; vehicles: string; vehiclesDescription: string; software: string; softwareDescription: string; education: string; educationDescription: string; documents: string; documentsEmpty: string; performance: string; performanceDescription: string; futureModule: string; futureModuleDescription: string; viewContracts: string; viewDocuments: string; viewReminders: string; moveUp: string; moveDown: string; drag: string; layoutSaving: string; layoutSaved: string; layoutFailed: string
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
}

export function EmployeeDashboard({ detail, customFields, documents, reminders, activity, canWriteActivity, initialLayout, locale, dateFormat, timeFormat, labels }: EmployeeDashboardProps) {
  const employee = detail.employee
  const summary = detail.currentEmploymentSummary
  const currentAddress = (detail.addresses ?? []).find((address) => !address.validUntil) ?? detail.addresses?.[0]
  const primaryBank = (detail.bankAccounts ?? []).find((account) => account.isPrimary) ?? detail.bankAccounts?.[0]
  const emergencyContacts = (detail.relations ?? []).filter((relation) => relation.isEmergencyContact)
  const visibleFields = customFields.filter((field) => field.value !== undefined && field.value !== null && field.value !== '')
  const wide = [
    { id: 'personal' as const, node: <DashboardCard icon={<UserRound className="h-4 w-4" />} title={labels.personal} actionHref="?tab=personal" actionLabel={labels.edit}><dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3"><DataPoint label={labels.birthDate} value={employee.birthDate ? formatDate(employee.birthDate, { locale, dateFormat }) : labels.notRecorded} /><DataPoint label={labels.nationality} value={employee.nationality ?? labels.notRecorded} /><DataPoint label={labels.birthPlace} value={employee.birthPlace ?? labels.notRecorded} /><DataPoint label={labels.gender} value={employee.gender ?? labels.notRecorded} /><DataPoint label={labels.address} value={currentAddress ? `${currentAddress.addressLine1}, ${currentAddress.postalCode ?? ''} ${currentAddress.city}` : labels.noAddress} /><DataPoint label={labels.contact} value={employee.workEmail ?? employee.privateEmail ?? labels.noContact} isEmail={Boolean(employee.workEmail ?? employee.privateEmail)} /></dl>{primaryBank || emergencyContacts.length > 0 ? <div className="mt-6 grid gap-3 border-t border-border/70 pt-5 sm:grid-cols-2">{primaryBank ? <SmallFact icon={<WalletCards className="h-4 w-4" />} label={labels.contact} value={`${primaryBank.maskedIban} · ${primaryBank.accountHolder}`} /> : null}{emergencyContacts.length > 0 ? <SmallFact icon={<ShieldAlert className="h-4 w-4" />} label={labels.privateContact} value={emergencyContacts.slice(0, 2).map((contact) => `${contact.firstName ?? ''} ${contact.lastName}`).join(', ')} /> : null}</div> : null}</DashboardCard> },
    { id: 'customFields' as const, node: <DashboardCard icon={<Sparkles className="h-4 w-4" />} title={labels.customFields} actionHref="?tab=personal" actionLabel={labels.edit}>{visibleFields.length > 0 ? <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">{visibleFields.slice(0, 9).map((field) => <DataPoint key={field.id} label={locale === 'en' ? field.labelEn : field.labelNl} value={formatCustomValue(field.value, labels.notRecorded)} />)}</dl> : <EmptyInline>{labels.customFieldsEmpty}</EmptyInline>}</DashboardCard> },
    { id: 'leave' as const, node: <DashboardCard icon={<CalendarDays className="h-4 w-4" />} title={labels.leave}><EmptyModule title={labels.leaveDescription} labels={labels} /></DashboardCard> },
    { id: 'absence' as const, node: <DashboardCard icon={<HeartPulse className="h-4 w-4" />} title={labels.absence}><EmptyModule title={labels.absenceDescription} labels={labels} /></DashboardCard> },
    { id: 'budgets' as const, node: <DashboardCard icon={<CircleDollarSign className="h-4 w-4" />} title={labels.budgets}><EmptyModule title={labels.budgetsDescription} labels={labels} /></DashboardCard> },
    { id: 'contracts' as const, node: <DashboardCard icon={<BriefcaseBusiness className="h-4 w-4" />} title={labels.contracts} actionHref="?tab=employments" actionLabel={labels.viewContracts}><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent/50 p-4"><div><p className="text-sm font-semibold">{labels.contractCount.replace('{count}', String(detail.employments.length))}</p><p className="mt-1 text-sm text-muted-foreground">{labels.contractsDescription}</p></div><ArrowUpRight aria-hidden="true" className="h-5 w-5 text-primary" /></div></DashboardCard> },
    { id: 'activity' as const, node: <DashboardCard icon={<ClipboardList className="h-4 w-4" />} title={labels.activity}><EmployeeActivityFeed employeeId={employee.id} items={activity} locale={locale} dateFormat={dateFormat} timeFormat={timeFormat} canWrite={canWriteActivity} labels={{ placeholder: labels.activityPlaceholder, add: labels.activityAdd, save: labels.activitySave, saving: labels.activitySaving, empty: labels.activityEmpty, failed: labels.activityFailed }} /></DashboardCard> },
  ]
  const narrow = [
    { id: 'employment' as const, node: <DashboardCard icon={<CircleDollarSign className="h-4 w-4" />} title={labels.employment} actionHref="?tab=employments" actionLabel={labels.viewContracts} compact><dl className="space-y-4"><DataPoint label={labels.department} value={summary.departmentName ?? labels.notRecorded} /><DataPoint label={labels.jobTitle} value={summary.jobTitle ?? labels.notRecorded} /><DataPoint label={labels.hoursPerWeek} value={summary.hoursPerWeek === null ? labels.notRecorded : `${summary.hoursPerWeek}u`} /><div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-[0.11em] text-muted-foreground">{labels.salary}</dt><dd className="mt-1"><SalaryReveal employeeId={employee.id} locale={locale} canRead={detail.capabilities?.canReadSalary === true} labels={{ hidden: labels.salaryHidden, loading: labels.salaryLoading, failed: labels.salaryFailed, monthly: labels.salaryMonthly, hourly: labels.salaryHourly, notAvailable: labels.salaryNotAvailable }} /></dd></div></dl></DashboardCard> },
    { id: 'reminders' as const, node: <DashboardCard icon={<CalendarDays className="h-4 w-4" />} title={labels.reminders} actionHref="?tab=reminders" actionLabel={labels.viewReminders} compact>{reminders.length ? <ul className="divide-y divide-border/70">{reminders.slice(0, 4).map((item) => <li className="py-3 first:pt-0 last:pb-0" key={item.recipientId}><p className="text-sm font-medium">{item.title}</p><time className="mt-1 block text-xs text-muted-foreground" dateTime={item.remindAt}>{formatDateTime(item.remindAt, { locale, dateFormat, timeFormat })}</time></li>)}</ul> : <EmptyInline>{labels.remindersEmpty}</EmptyInline>}</DashboardCard> },
    { id: 'workflows' as const, node: <PlaceholderCard icon={<Workflow className="h-4 w-4" />} title={labels.workflows} description={labels.workflowsDescription} labels={labels} /> },
    { id: 'assets' as const, node: <PlaceholderCard icon={<Package className="h-4 w-4" />} title={labels.assets} description={labels.assetsDescription} labels={labels} /> },
    { id: 'vehicles' as const, node: <PlaceholderCard icon={<CarFront className="h-4 w-4" />} title={labels.vehicles} description={labels.vehiclesDescription} labels={labels} /> },
    { id: 'software' as const, node: <PlaceholderCard icon={<Laptop2 className="h-4 w-4" />} title={labels.software} description={labels.softwareDescription} labels={labels} /> },
    { id: 'education' as const, node: <PlaceholderCard icon={<GraduationCap className="h-4 w-4" />} title={labels.education} description={labels.educationDescription} labels={labels} /> },
    { id: 'documents' as const, node: <DashboardCard icon={<FileText className="h-4 w-4" />} title={labels.documents} actionHref="?tab=documents" actionLabel={labels.viewDocuments} compact>{documents.length > 0 ? <ul className="divide-y divide-border/70">{documents.slice(0, 3).map((document) => <li key={document.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="min-w-0 truncate font-medium">{document.title}</span><CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-success" /></li>)}</ul> : <EmptyInline>{labels.documentsEmpty}</EmptyInline>}</DashboardCard> },
    { id: 'performance' as const, node: <PlaceholderCard icon={<Sparkles className="h-4 w-4" />} title={labels.performance} description={labels.performanceDescription} labels={labels} /> },
  ]

  return <section aria-labelledby="employee-dashboard-title" className="mt-8 space-y-5"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow text-primary">{labels.title}</p><h2 id="employee-dashboard-title" className="mt-1 text-2xl font-semibold tracking-tight">{labels.subtitle}</h2></div><Link href="?tab=personal" className="button-secondary inline-flex items-center gap-2"><Pencil aria-hidden="true" className="h-4 w-4" />{labels.openDetails}</Link></header><EmployeeDashboardLayout wide={wide} narrow={narrow} initialLayout={initialLayout} labels={{ moveUp: labels.moveUp, moveDown: labels.moveDown, drag: labels.drag, saving: labels.layoutSaving, saved: labels.layoutSaved, failed: labels.layoutFailed }} /></section>
}

function DashboardCard({ icon, title, actionHref, actionLabel, compact = false, children }: { icon: React.ReactNode; title: string; actionHref?: string; actionLabel?: string; compact?: boolean; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-sm"><header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5"><div className="flex min-w-0 items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-accent-foreground">{icon}</span><h3 className="truncate text-sm font-semibold">{title}</h3></div>{actionHref && actionLabel ? <Link href={actionHref} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"><ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />{actionLabel}</Link> : null}</header><div className={`p-4 sm:p-5 ${compact ? 'sm:p-4' : ''}`}>{children}</div></section>
}

function PlaceholderCard({ icon, title, description, labels }: { icon: React.ReactNode; title: string; description: string; labels: EmployeeDashboardLabels }) {
  return <section className="overflow-hidden rounded-2xl border border-dashed border-primary/30 bg-accent/20 shadow-sm"><header className="flex items-center justify-between gap-3 border-b border-dashed border-primary/20 px-4 py-3.5"><div className="flex min-w-0 items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span><h3 className="truncate text-sm font-semibold">{title}</h3></div><Plus aria-hidden="true" className="h-4 w-4 text-success" /></header><div className="p-4"><p className="text-sm leading-6 text-muted-foreground">{description}</p><p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-primary">{labels.futureModule}</p><p className="mt-1 text-xs text-muted-foreground">{labels.futureModuleDescription}</p></div></section>
}

function EmptyModule({ title, labels }: { title: string; labels: EmployeeDashboardLabels }) { return <div className="rounded-xl border border-dashed border-primary/25 bg-accent/20 p-4"><p className="text-sm leading-6 text-muted-foreground">{title}</p><p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-primary">{labels.futureModule}</p><p className="mt-1 text-xs text-muted-foreground">{labels.futureModuleDescription}</p></div> }
function EmptyInline({ children }: { children: React.ReactNode }) { return <p className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">{children}</p> }
function DataPoint({ label, value, isEmail }: { label: string; value: string; isEmail?: boolean }) { return <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-[0.11em] text-muted-foreground">{label}</dt><dd className="mt-1 truncate text-sm font-semibold">{isEmail ? <EmailLink email={value} /> : value}</dd></div> }
function SmallFact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="flex min-w-0 items-start gap-2.5"><span className="mt-0.5 text-primary">{icon}</span><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.11em] text-muted-foreground">{label}</p><p className="mt-1 truncate text-sm font-medium">{value}</p></div></div> }
function formatCustomValue(value: Json | undefined, fallback: string): string { if (value === undefined || value === null) return fallback; if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value); if (Array.isArray(value)) return value.map((item) => formatCustomValue(item, fallback)).join(', '); return Object.entries(value).map(([key, item]) => `${key}: ${formatCustomValue(item, fallback)}`).join(', ') }
