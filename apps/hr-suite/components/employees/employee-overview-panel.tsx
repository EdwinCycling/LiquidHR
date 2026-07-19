import { BriefcaseBusiness, CalendarDays, CreditCard, HeartHandshake, Home, LockKeyhole, Mail, UserRound } from 'lucide-react'
import type { EmployeeDetailViewModel } from './types'
import { EmailLink } from '@/components/shared/email-link'
import { formatDate } from '@/lib/preferences/formatters'
import type { DateFormat } from '@/lib/preferences/user-preferences'

export interface EmployeeOverviewPanelLabels {
  title: string
  employmentCount: string
  employmentSummaryTitle: string
  summaryDate: string
  laborCondition: string
  hoursPerWeek: string
  hoursSuffix: string
  salary: string
  department: string
  jobTitle: string
  salaryRevealHelp: string
  salaryHourlySuffix: string
  salaryMonthlySuffix: string
  notRecorded: string
  contactTitle: string
  noContact: string
  currentAddress: string
  noAddress: string
  primaryBank: string
  noBankAccount: string
  emergencyContacts: string
  noEmergencyContact: string
}

interface EmployeeOverviewPanelProps {
  detail: EmployeeDetailViewModel
  locale: string
  dateFormat: DateFormat
  labels: EmployeeOverviewPanelLabels
}

export function EmployeeOverviewPanel({ detail, locale, dateFormat, labels }: EmployeeOverviewPanelProps) {
  const currentAddress = (detail.addresses ?? []).find((address) => !address.validUntil) ?? detail.addresses?.[0]
  const primaryBank = (detail.bankAccounts ?? []).find((account) => account.isPrimary) ?? detail.bankAccounts?.[0]
  const emergencyContacts = (detail.relations ?? []).filter((relation) => relation.isEmergencyContact)
  const employee = detail.employee
  const summary = detail.currentEmploymentSummary
  const formattedSalary = summary.salary
    ? new Intl.NumberFormat(locale, { style: 'currency', currency: summary.salary.currencyCode }).format(summary.salary.amount)
    : null

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border bg-surface shadow-sm">
      <div className="p-4 sm:p-6">
        <header className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground"><UserRound aria-hidden="true" className="h-5 w-5" /></span>
          <div><h2 className="text-lg font-semibold">{labels.title}</h2><p className="text-sm text-muted-foreground">{labels.employmentCount}</p></div>
        </header>

        <section className="mt-6 rounded-xl border bg-surface-raised p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2"><BriefcaseBusiness aria-hidden="true" className="h-4 w-4 text-primary" /><h3 className="font-semibold">{labels.employmentSummaryTitle}</h3></div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />{labels.summaryDate}: {formatDate(summary.asOf, { locale, dateFormat })}</span>
          </div>
          <dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryItem label={labels.laborCondition} value={summary.laborCondition ?? labels.notRecorded} />
            <SummaryItem label={labels.hoursPerWeek} value={summary.hoursPerWeek === null ? labels.notRecorded : `${summary.hoursPerWeek} ${labels.hoursSuffix}`} />
            <SummaryItem label={labels.salary} value={formattedSalary ? <SalaryValue value={formattedSalary} suffix={summary.salary?.paymentType === 'HOURLY_VARIABLE' ? labels.salaryHourlySuffix : labels.salaryMonthlySuffix} help={labels.salaryRevealHelp} /> : labels.notRecorded} />
            <SummaryItem label={labels.department} value={summary.departmentName ?? labels.notRecorded} />
            <SummaryItem label={labels.jobTitle} value={summary.jobTitle ?? labels.notRecorded} />
          </dl>
        </section>

        <div className="mt-6 grid gap-0 overflow-hidden rounded-xl border md:grid-cols-2 xl:grid-cols-4">
          <StoryCell icon={<Mail className="h-4 w-4" />} title={labels.contactTitle}>
            {(employee.workEmail ?? employee.privateEmail) ? <p><EmailLink email={employee.workEmail ?? employee.privateEmail ?? ''} /></p> : <p>{labels.noContact}</p>}
            <p>{employee.workMobile ?? employee.privateMobile ?? employee.workPhone ?? employee.privatePhone ?? ''}</p>
          </StoryCell>
          <StoryCell icon={<Home className="h-4 w-4" />} title={labels.currentAddress}>
            {currentAddress ? <><p>{currentAddress.street} {currentAddress.houseNumber}{currentAddress.addition ? ` ${currentAddress.addition}` : ''}</p><p>{currentAddress.postalCode} {currentAddress.city}</p></> : <p>{labels.noAddress}</p>}
          </StoryCell>
          <StoryCell icon={<CreditCard className="h-4 w-4" />} title={labels.primaryBank}>
            <p>{primaryBank?.maskedIban ?? labels.noBankAccount}</p>{primaryBank?.accountHolder && <p>{primaryBank.accountHolder}</p>}
          </StoryCell>
          <StoryCell icon={<HeartHandshake className="h-4 w-4" />} title={labels.emergencyContacts}>
            {emergencyContacts.length ? emergencyContacts.slice(0, 2).map((relation) => <p key={relation.id}>{relation.firstName} {relation.lastName}</p>) : <p>{labels.noEmergencyContact}</p>}
          </StoryCell>
        </div>
      </div>
    </section>
  )
}

function SummaryItem({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-semibold">{value}</dd></div>
}

function SalaryValue({ value, suffix, help }: { value: string; suffix: string; help: string }) {
  return <span aria-label={help} className="group inline-flex cursor-help items-center gap-1.5" tabIndex={0} title={help}><LockKeyhole aria-hidden="true" className="h-4 w-4 text-muted-foreground" /><span className="select-none blur-[5px] transition-[filter] duration-200 group-hover:blur-0 group-focus:blur-0">{value}</span><span className="text-xs font-normal text-muted-foreground">{suffix}</span></span>
}

function StoryCell({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <article className="min-h-36 border-b p-4 last:border-b-0 md:border-r md:[&:nth-child(2n)]:border-r-0 xl:border-b-0 xl:[&:nth-child(2n)]:border-r xl:last:border-r-0"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{icon}{title}</div><div className="mt-4 space-y-1 text-sm font-medium leading-6 [&>p+p]:font-normal [&>p+p]:text-muted-foreground">{children}</div></article>
}
