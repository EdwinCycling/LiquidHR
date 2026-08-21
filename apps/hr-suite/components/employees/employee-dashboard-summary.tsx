import Link from 'next/link'
import { ArrowUpRight, ShieldAlert, UserRound, WalletCards } from 'lucide-react'
import { EmailLink } from '@/components/shared/email-link'
import { Surface } from '@/components/ui/surface'
import type { EmployeeDetailViewModel } from './types'

export interface EmployeeDashboardSummaryLabels {
  personal: string
  name: string
  age: string
  daysUntilBirthday: string
  workEmail: string
  privateEmail: string
  workPhone: string
  privatePhone: string
  noContact: string
  address: string
  noAddress: string
  contact: string
  privateContact: string
  notRecorded: string
  edit: string
}

export function EmployeeDashboardSummary({ detail, labels }: { detail: EmployeeDetailViewModel; labels: EmployeeDashboardSummaryLabels }) {
  const employee = detail.employee
  const currentAddress = (detail.addresses ?? []).find((address) => !address.validUntil) ?? detail.addresses?.[0]
  const primaryBank = (detail.bankAccounts ?? []).find((account) => account.isPrimary) ?? detail.bankAccounts?.[0]
  const emergencyContacts = (detail.relations ?? []).filter((relation) => relation.isEmergencyContact)

  return <Surface className="overflow-hidden">
    <header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5">
      <div className="flex min-w-0 items-start gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-accent text-accent-foreground"><UserRound aria-hidden="true" className="h-4 w-4" /></span><h3 className="min-w-0 break-words text-sm font-semibold">{labels.personal}</h3></div>
      <Link href="?tab=personal" className="inline-flex max-w-full items-start gap-1 text-left text-xs font-semibold text-primary whitespace-normal break-words hover:underline"><ArrowUpRight aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />{labels.edit}</Link>
    </header>
    <div className="p-4 sm:p-5">
      <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryDataPoint label={labels.name} value={`${employee.firstName} ${employee.birthName}`} />
        <SummaryDataPoint label={labels.age} value={getAgeLabel(employee.birthDate, labels.notRecorded)} />
        <SummaryDataPoint label={labels.daysUntilBirthday} value={getDaysUntilBirthdayLabel(employee.birthDate, labels.notRecorded)} />
        <SummaryDataPoint label={labels.workEmail} value={employee.workEmail ?? labels.noContact} isEmail={Boolean(employee.workEmail)} />
        <SummaryDataPoint label={labels.privateEmail} value={employee.privateEmail ?? labels.noContact} isEmail={Boolean(employee.privateEmail)} />
        <SummaryDataPoint label={labels.workPhone} value={employee.workPhone ?? employee.workMobile ?? labels.noContact} />
        <SummaryDataPoint label={labels.privatePhone} value={employee.privatePhone ?? employee.privateMobile ?? labels.noContact} />
        <SummaryDataPoint label={labels.address} value={currentAddress ? `${currentAddress.addressLine1}, ${currentAddress.postalCode ?? ''} ${currentAddress.city}` : labels.noAddress} />
      </dl>
      {primaryBank || emergencyContacts.length > 0 ? <div className="mt-6 grid gap-3 border-t border-border/70 pt-5 sm:grid-cols-2">
        {primaryBank ? <SummaryFact icon={<WalletCards aria-hidden="true" className="h-4 w-4" />} label={labels.contact} value={`${primaryBank.maskedIban} · ${primaryBank.accountHolder}`} /> : null}
        {emergencyContacts.length > 0 ? <SummaryFact icon={<ShieldAlert aria-hidden="true" className="h-4 w-4" />} label={labels.privateContact} value={emergencyContacts.slice(0, 2).map((contact) => `${contact.firstName ?? ''} ${contact.lastName}`).join(', ')} /> : null}
      </div> : null}
    </div>
  </Surface>
}

function SummaryDataPoint({ label, value, isEmail }: { label: string; value: string; isEmail?: boolean }) {
  return <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-[0.11em] text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-semibold">{isEmail ? <EmailLink email={value} /> : value}</dd></div>
}

function SummaryFact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex min-w-0 items-start gap-2.5"><span className="mt-0.5 shrink-0 text-primary">{icon}</span><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.11em] text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-medium">{value}</p></div></div>
}

function getAgeLabel(birthDate: string | null | undefined, fallback: string): string {
  if (!birthDate) return fallback
  const birth = new Date(`${birthDate}T00:00:00`)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const birthdayThisYear = new Date(today.getFullYear(), birth.getMonth(), Math.min(birth.getDate(), new Date(today.getFullYear(), birth.getMonth() + 1, 0).getDate()))
  if (today < birthdayThisYear) age -= 1
  return `${age}`
}

function getDaysUntilBirthdayLabel(birthDate: string | null | undefined, fallback: string): string {
  if (!birthDate) return fallback
  const birth = new Date(`${birthDate}T00:00:00`)
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const daysInMonth = new Date(today.getFullYear(), birth.getMonth() + 1, 0).getDate()
  let birthday = new Date(today.getFullYear(), birth.getMonth(), Math.min(birth.getDate(), daysInMonth))
  if (birthday < startOfToday) {
    const nextYearDays = new Date(today.getFullYear() + 1, birth.getMonth() + 1, 0).getDate()
    birthday = new Date(today.getFullYear() + 1, birth.getMonth(), Math.min(birth.getDate(), nextYearDays))
  }
  return `${Math.ceil((birthday.getTime() - startOfToday.getTime()) / 86400000)}`
}
