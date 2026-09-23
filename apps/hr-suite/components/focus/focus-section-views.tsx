import Link from 'next/link'
import { ArrowRight, CalendarDays, ChevronDown, Mail, Phone, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { SectionHeader } from '@/components/patterns/section-header'
import { Surface } from '@/components/ui/surface'
import { buttonClasses } from '@/components/ui/button'
import type { FocusDirectoryEntry, FocusHoursOverview, FocusLeaveOverview, FocusProfileProjection } from '@/lib/focus/section-service'
import { FocusTeamCalendarView, type FocusTeamCalendarLabels } from './focus-team-calendar'
import type { FocusTeamCalendar } from '@/lib/focus/team-service'
import { FocusProfileEditor, type FocusProfileEditorLabels } from './focus-profile-editor'
import { FocusRelationManager, type FocusRelationEditorLabels } from './focus-relation-editor'

export interface FocusProfileLabels {
  personal: string
  contact: string
  relations: string
  address: string
  work: string
  bank: string
  empty: string
  language: string
  workEmail: string
  workPhone: string
  privateEmail: string
  privatePhone: string
  privateMobile: string
  jobTitle: string
  department: string
  startDate: string
  hoursPerWeek: string
  hoursUnit: string
  noAddress: string
  noRelations: string
  noBank: string
  masked: string
  bic: string
  accountHolder: string
  editTitle: string
  edit: string
  nameSection: string
  contactSection: string
  title: string
  initials: string
  firstName: string
  birthNamePrefix: string
  birthName: string
  partnerNamePrefix: string
  partnerName: string
  nameUsage: string
  nameUsageBirth: string
  nameUsagePartner: string
  nameUsagePartnerBirth: string
  nameUsageBirthPartner: string
  cancel: string
  close: string
  discardTitle: string
  discardDescription: string
  discardConfirm: string
  discardCancel: string
  save: string
  saving: string
  saved: string
  failed: string
  relationAdd: string
  relationEdit: string
  relationEditTitle: string
  relationAddTitle: string
  relationType: string
  relationFirstName: string
  relationInitials: string
  relationPrefix: string
  relationLastName: string
  relationGender: string
  relationGenderMale: string
  relationGenderFemale: string
  relationGenderOther: string
  relationGenderUndisclosed: string
  relationBirthDate: string
  relationPhone: string
  relationMobile: string
  relationEmail: string
  relationNotes: string
  relationEmergencyContact: string
  relationSave: string
  relationDelete: string
  relationDeleteTitle: string
  relationDeleteDescription: string
  relationDeleteConfirm: string
  relationTypeSearch: string
  relationGenderSearch: string
}

const profileLabels: Record<string, keyof FocusProfileLabels> = {
  language: 'language',
  workEmail: 'workEmail',
  workPhone: 'workPhone',
  privateEmail: 'privateEmail',
  privatePhone: 'privatePhone',
  privateMobile: 'privateMobile',
  jobTitle: 'jobTitle',
  department: 'department',
  startDate: 'startDate',
  hoursPerWeek: 'hoursPerWeek',
}

export function FocusProfileView({ profile, labels, actAsToken, locale }: { profile: FocusProfileProjection; labels: FocusProfileLabels; actAsToken?: string | null; locale: string }) {
  const label = (key: string): string => labels[profileLabels[key] ?? 'empty'] as string
  return <div className="space-y-5">
    <Surface className="flex flex-wrap items-start gap-4 p-4 sm:p-6">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-primary"><UserRound aria-hidden="true" className="size-6" /></div>
      <div className="min-w-0 flex-1"><h2 className="text-xl font-semibold">{profile.name}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.personal}</p></div>
      {profile.canEdit ? <FocusProfileEditor actAsToken={actAsToken} employeeId={profile.employeeId} initialUpdatedAt={profile.updatedAt} initialValues={profile.editable} labels={{ edit: labels.edit, editTitle: labels.editTitle, nameSection: labels.nameSection, contactSection: labels.contactSection, title: labels.title, initials: labels.initials, firstName: labels.firstName, birthNamePrefix: labels.birthNamePrefix, birthName: labels.birthName, partnerNamePrefix: labels.partnerNamePrefix, partnerName: labels.partnerName, nameUsage: labels.nameUsage, nameUsageBirth: labels.nameUsageBirth, nameUsagePartner: labels.nameUsagePartner, nameUsagePartnerBirth: labels.nameUsagePartnerBirth, nameUsageBirthPartner: labels.nameUsageBirthPartner, privateEmail: labels.privateEmail, privatePhone: labels.privatePhone, privateMobile: labels.privateMobile, save: labels.save, cancel: labels.cancel, close: labels.close, saving: labels.saving, saved: labels.saved, failed: labels.failed, discardTitle: labels.discardTitle, discardDescription: labels.discardDescription, discardConfirm: labels.discardConfirm, discardCancel: labels.discardCancel } satisfies FocusProfileEditorLabels} /> : null}
    </Surface>
    <div className="grid gap-5 lg:grid-cols-2">
      <ProfileSection title={labels.personal} empty={labels.empty}>
        {profile.personal.length ? <dl className="space-y-3">{profile.personal.map((item) => <ProfileValue key={item.key} label={label(item.key)} value={item.value} />)}</dl> : null}
      </ProfileSection>
      <ProfileSection title={labels.contact} empty={labels.empty}>
        {profile.contact.length ? <dl className="space-y-3">{profile.contact.map((item) => <ProfileValue key={item.key} label={label(item.key)} value={item.value} href={item.href} />)}</dl> : null}
      </ProfileSection>
      <ProfileSection title={labels.work} empty={labels.empty}>
        {profile.work.length ? <dl className="space-y-3">{profile.work.map((item) => <ProfileValue key={item.key} label={label(item.key)} value={item.key === 'hoursPerWeek' ? `${item.value} ${labels.hoursUnit}` : item.value} />)}</dl> : null}
      </ProfileSection>
      <ProfileSection title={labels.address} empty={labels.noAddress}>
        {profile.address.length ? <address className="not-italic text-sm leading-6">{profile.address.map((line) => <span className="block" key={line}>{line}</span>)}</address> : null}
      </ProfileSection>
      <ProfileSection title={labels.relations} empty={labels.noRelations}>
        <FocusRelationManager actAsToken={actAsToken} canEdit={profile.canEditRelations} employeeId={profile.employeeId} labels={{ noRelations: labels.noRelations, add: labels.relationAdd, edit: labels.relationEdit, editTitle: labels.relationEditTitle, addTitle: labels.relationAddTitle, relationType: labels.relationType, firstName: labels.relationFirstName, initials: labels.relationInitials, prefix: labels.relationPrefix, lastName: labels.relationLastName, gender: labels.relationGender, genderMale: labels.relationGenderMale, genderFemale: labels.relationGenderFemale, genderOther: labels.relationGenderOther, genderUndisclosed: labels.relationGenderUndisclosed, birthDate: labels.relationBirthDate, phone: labels.relationPhone, mobile: labels.relationMobile, email: labels.relationEmail, notes: labels.relationNotes, emergencyContact: labels.relationEmergencyContact, save: labels.relationSave, cancel: labels.cancel, close: labels.close, saving: labels.saving, failed: labels.failed, saved: labels.saved, delete: labels.relationDelete, deleteTitle: labels.relationDeleteTitle, deleteDescription: labels.relationDeleteDescription, deleteConfirm: labels.relationDeleteConfirm, deleteCancel: labels.cancel, discardTitle: labels.discardTitle, discardDescription: labels.discardDescription, discardConfirm: labels.discardConfirm, discardCancel: labels.discardCancel, relationTypeSearch: labels.relationTypeSearch, genderSearch: labels.relationGenderSearch } satisfies FocusRelationEditorLabels} locale={locale} relationTypes={profile.relationTypes ?? []} relations={profile.relations ?? []} />
      </ProfileSection>
      <ProfileSection title={labels.bank} empty={labels.noBank}>
        {profile.bank ? <dl className="space-y-3"><ProfileValue label={labels.masked} value={profile.bank.iban} /><ProfileValue label={labels.bic} value={profile.bank.bic ?? '—'} /><ProfileValue label={labels.accountHolder} value={profile.bank.holder ?? '—'} /></dl> : null}
      </ProfileSection>
    </div>
  </div>
}

function ProfileSection({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const hasChildren = children !== null && children !== undefined
  return <Surface className="space-y-4 p-4 sm:p-6"><SectionHeader title={title} />{hasChildren ? children : <p className="text-sm text-muted-foreground">{empty}</p>}</Surface>
}

function ProfileValue({ label, value, href }: { label: string; value: string; href?: string }) {
  return <div><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{href ? <a className="text-primary hover:underline" href={href}>{value}</a> : value}</dd></div>
}

export interface FocusLeaveLabels {
  balance: string
  total: string
  upcoming: string
  request: string
  noBalance: string
  noUpcoming: string
  hours: string
  status: Record<string, string>
}

export interface FocusLeaveTeamCalendar {
  title: string
  description: string
  calendar: FocusTeamCalendar
  labels: FocusTeamCalendarLabels
  actAsToken?: string | null
  locale?: string
  today?: string
}

export function FocusLeaveView({ overview, labels, requestHref, teamCalendar }: { overview: FocusLeaveOverview; labels: FocusLeaveLabels; requestHref: string; teamCalendar?: FocusLeaveTeamCalendar }) {
  const totalLabel = overview.balances.some((balance) => balance.unlimited)
    ? '∞'
    : overview.balances.some((balance) => balance.hours === null)
      ? '—'
      : `${overview.balances.reduce((total, balance) => total + (balance.hours ?? 0), 0).toLocaleString('nl-NL', { maximumFractionDigits: 2 })} ${labels.hours}`
  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{labels.balance}</h2><p className="mt-1 text-sm text-muted-foreground">{overview.balances.length ? `${labels.total}: ${totalLabel}` : labels.noBalance}</p></div><Link className={buttonClasses()} href={requestHref} prefetch={false}>{labels.request}<ArrowRight aria-hidden="true" /></Link></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{overview.balances.length ? overview.balances.map((balance) => <Surface className="p-4" key={balance.id}><p className="font-semibold">{balance.name}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{balance.unlimited ? '∞' : balance.hours === null ? '—' : balance.hours.toLocaleString('nl-NL', { maximumFractionDigits: 2 })}<span className="ml-1 text-sm font-normal text-muted-foreground">{balance.unlimited ? '' : labels.hours}</span></p></Surface>) : <Surface className="p-4 sm:col-span-2 lg:col-span-3"><p className="text-sm text-muted-foreground">{labels.noBalance}</p></Surface>}</div>
    <section className="space-y-3"><SectionHeader title={labels.upcoming} />{overview.upcoming.length ? overview.upcoming.map((request) => <Surface className="flex items-center gap-3 p-4" key={`${request.startDate}-${request.endDate}-${request.status}`}><CalendarDays aria-hidden="true" className="size-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="font-medium">{request.startDate}{request.endDate !== request.startDate ? ` → ${request.endDate}` : ''}</p><p className="mt-1 text-sm text-muted-foreground">{request.status in labels.status ? labels.status[request.status] : request.status} · {Math.round(request.minutes / 60 * 100) / 100} {labels.hours}</p></div></Surface>) : <Surface className="p-4"><p className="text-sm text-muted-foreground">{labels.noUpcoming}</p></Surface>}</section>
    {teamCalendar ? <details className="group overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 focus-visible:outline-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden"><span className="min-w-0"><span className="block font-semibold">{teamCalendar.title}</span><span className="mt-1 block text-sm font-normal text-muted-foreground">{teamCalendar.description}</span></span><ChevronDown aria-hidden="true" className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" /></summary><div className="border-t border-border p-4 sm:p-6"><FocusTeamCalendarView actAsToken={teamCalendar.actAsToken} basePath="/focus/verlof" calendar={teamCalendar.calendar} futureOnly labels={teamCalendar.labels} locale={teamCalendar.locale} today={teamCalendar.today} /></div></details> : null}
  </div>
}

export interface FocusHoursLabels {
  expected: string
  recorded: string
  actionNeeded: string
  noAction: string
  fill: string
  noData: string
  hours: string
  entries: string
  noEntries: string
  date: string
  type: string
  status: string
  correction: string
  statusLabels: Record<string, string>
}

export function FocusHoursView({ overview, labels, editHref, locale = 'nl-NL' }: { overview: FocusHoursOverview; labels: FocusHoursLabels; editHref?: string; locale?: string }) {
  const expected = overview.days.reduce((total, day) => total + day.expected, 0)
  const recorded = overview.days.reduce((total, day) => total + day.recorded, 0)
  const formatHours = (value: number): string => value.toLocaleString(locale, { maximumFractionDigits: 4 })
  const formatDate = (value: string): string => new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00.000Z`))
  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{labels.expected} / {labels.recorded}</h2><p className="mt-1 text-sm text-muted-foreground">{formatHours(expected)} / {formatHours(recorded)} {labels.hours}</p></div>{editHref && overview.canEdit ? <Link className={buttonClasses()} href={editHref} prefetch={false}>{labels.fill}<ArrowRight aria-hidden="true" /></Link> : null}</div>
    <div className="space-y-2">{overview.days.map((day) => <Surface className="flex flex-wrap items-center gap-3 p-4" key={day.date}><div className="min-w-28 flex-1"><p className="font-medium">{new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date(`${day.date}T00:00:00.000Z`))}</p><p className="mt-1 text-sm text-muted-foreground">{labels.expected}: {day.expected} {labels.hours}</p></div><p className="text-sm font-semibold tabular-nums">{labels.recorded}: {day.recorded} {labels.hours}</p><span className={`rounded-[var(--radius-control)] px-2 py-1 text-xs font-semibold ${day.needsAction ? 'bg-warning/15 text-warning-foreground' : 'bg-success/10 text-success'}`}>{day.needsAction ? labels.actionNeeded : labels.noAction}</span></Surface>)}</div>
    {overview.days.length === 0 ? <Surface className="p-6"><p className="text-sm text-muted-foreground">{labels.noData}</p></Surface> : null}
    <section className="space-y-3"><SectionHeader title={labels.entries} />{overview.entries.length ? <Surface className="divide-y divide-border-subtle overflow-hidden p-0"><ol>{overview.entries.map((entry) => <li className="grid gap-2 p-4 sm:grid-cols-[minmax(9rem,1fr)_minmax(10rem,1.5fr)_auto] sm:items-center" key={entry.id}><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.date}</p><time className="mt-1 block text-sm font-medium" dateTime={entry.date}>{formatDate(entry.date)}</time></div><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.type}</p><p className="mt-1 break-words text-sm">{entry.type}</p></div><div className="sm:text-right"><p className="text-sm font-semibold tabular-nums">{formatHours(entry.hours)} {labels.hours}</p><p className="mt-1 text-xs text-muted-foreground">{labels.status}: {labels.statusLabels[entry.status] ?? entry.status}{entry.corrected ? ` · ${labels.correction}` : ''}</p></div></li>)}</ol></Surface> : <Surface className="p-4"><p className="text-sm text-muted-foreground">{labels.noEntries}</p></Surface>}</section>
  </div>
}

export interface FocusDirectoryLabels {
  search: string
  mail: string
  call: string
  empty: string
  disabled: string
}

export function FocusDirectoryView({ directory, labels, query, actAsToken }: { directory: { enabled: boolean; entries: FocusDirectoryEntry[] }; labels: FocusDirectoryLabels; query?: string; actAsToken?: string | null }) {
  if (!directory.enabled) return <Surface className="p-6"><p className="text-sm text-muted-foreground">{labels.disabled}</p></Surface>
  return <section className="space-y-4"><form className="flex gap-2" method="get"><input name="actAs" type="hidden" value={actAsToken ?? ''} /><label className="sr-only" htmlFor="focus-directory-search">{labels.search}</label><input className="min-h-11 min-w-0 flex-1 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-focus" defaultValue={query} id="focus-directory-search" name="q" placeholder={labels.search} type="search" /><button className={buttonClasses({ variant: 'secondary' })} type="submit">{labels.search}</button></form>{directory.entries.length ? <div className="grid gap-3 sm:grid-cols-2">{directory.entries.map((entry) => <Surface className="space-y-3 p-4" key={entry.employeeId}><div className="flex items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary"><UserRound aria-hidden="true" className="size-5" /></div><div className="min-w-0"><p className="font-semibold">{entry.name}</p>{entry.jobTitle || entry.departmentName ? <p className="text-sm text-muted-foreground">{[entry.jobTitle, entry.departmentName].filter(Boolean).join(' · ')}</p> : null}</div></div><div className="flex flex-wrap gap-2 text-sm">{entry.workEmail ? <a className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] border border-border px-3 text-primary hover:bg-surface-raised" href={`mailto:${entry.workEmail}`}><Mail aria-hidden="true" className="size-4" />{labels.mail}</a> : null}{entry.workPhone ? <a className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] border border-border px-3 text-primary hover:bg-surface-raised" href={`tel:${entry.workPhone}`}><Phone aria-hidden="true" className="size-4" />{labels.call}</a> : null}</div></Surface>)}</div> : <Surface className="p-6"><p className="text-sm text-muted-foreground">{labels.empty}</p></Surface>}</section>
}
