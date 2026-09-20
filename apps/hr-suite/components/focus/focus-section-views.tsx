import Link from 'next/link'
import { ArrowRight, CalendarDays, Mail, Phone, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { SectionHeader } from '@/components/patterns/section-header'
import { Surface } from '@/components/ui/surface'
import { buttonClasses } from '@/components/ui/button'
import type { FocusDirectoryEntry, FocusHoursOverview, FocusLeaveOverview, FocusProfileProjection } from '@/lib/focus/section-service'
import { FocusProfileEditor, type FocusProfileEditorLabels } from './focus-profile-editor'

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
  firstName: string
  save: string
  saving: string
  saved: string
  failed: string
}

const profileLabels: Record<string, keyof FocusProfileLabels> = {
  language: 'language',
  workEmail: 'workEmail',
  workPhone: 'workPhone',
  privateEmail: 'privateEmail',
  privatePhone: 'privatePhone',
  jobTitle: 'jobTitle',
  department: 'department',
  startDate: 'startDate',
  hoursPerWeek: 'hoursPerWeek',
}

export function FocusProfileView({ profile, labels }: { profile: FocusProfileProjection; labels: FocusProfileLabels }) {
  const label = (key: string): string => labels[profileLabels[key] ?? 'empty'] as string
  return <div className="space-y-5">
    <Surface className="flex flex-wrap items-start gap-4 p-4 sm:p-6">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-primary"><UserRound aria-hidden="true" className="size-6" /></div>
      <div className="min-w-0 flex-1"><h2 className="text-xl font-semibold">{profile.name}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.personal}</p></div>
      {profile.canEdit ? <FocusProfileEditor employeeId={profile.employeeId} firstName={profile.firstName} labels={{ editTitle: labels.editTitle, firstName: labels.firstName, save: labels.save, saving: labels.saving, saved: labels.saved, failed: labels.failed } satisfies FocusProfileEditorLabels} updatedAt={profile.updatedAt} /> : null}
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
        {profile.relations.length ? <div className="space-y-3">{profile.relations.map((relation) => <div className="border-b border-border-subtle pb-3 last:border-0 last:pb-0" key={`${relation.name}-${relation.relation}`}><p className="font-medium">{relation.name}</p><p className="text-sm text-muted-foreground">{relation.relation}{relation.contact ? ` · ${relation.contact}` : ''}</p></div>)}</div> : null}
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
  upcoming: string
  request: string
  noBalance: string
  noUpcoming: string
  hours: string
  status: Record<string, string>
}

export function FocusLeaveView({ overview, labels, requestHref }: { overview: FocusLeaveOverview; labels: FocusLeaveLabels; requestHref: string }) {
  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{labels.balance}</h2><p className="mt-1 text-sm text-muted-foreground">{overview.balances.length ? `${overview.balances.length}` : labels.noBalance}</p></div><Link className={buttonClasses()} href={requestHref} prefetch={false}>{labels.request}<ArrowRight aria-hidden="true" /></Link></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{overview.balances.length ? overview.balances.map((balance) => <Surface className="p-4" key={balance.id}><p className="font-semibold">{balance.name}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{balance.unlimited ? '∞' : balance.hours === null ? '—' : balance.hours.toLocaleString('nl-NL', { maximumFractionDigits: 2 })}<span className="ml-1 text-sm font-normal text-muted-foreground">{balance.unlimited ? '' : labels.hours}</span></p></Surface>) : <Surface className="p-4 sm:col-span-2 lg:col-span-3"><p className="text-sm text-muted-foreground">{labels.noBalance}</p></Surface>}</div>
    <section className="space-y-3"><SectionHeader title={labels.upcoming} />{overview.upcoming.length ? overview.upcoming.map((request) => <Surface className="flex items-center gap-3 p-4" key={`${request.startDate}-${request.endDate}-${request.status}`}><CalendarDays aria-hidden="true" className="size-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="font-medium">{request.startDate}{request.endDate !== request.startDate ? ` → ${request.endDate}` : ''}</p><p className="mt-1 text-sm text-muted-foreground">{request.status in labels.status ? labels.status[request.status] : request.status} · {Math.round(request.minutes / 60 * 100) / 100} {labels.hours}</p></div></Surface>) : <Surface className="p-4"><p className="text-sm text-muted-foreground">{labels.noUpcoming}</p></Surface>}</section>
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
}

export function FocusHoursView({ overview, labels, editHref }: { overview: FocusHoursOverview; labels: FocusHoursLabels; editHref?: string }) {
  const expected = overview.days.reduce((total, day) => total + day.expected, 0)
  const recorded = overview.days.reduce((total, day) => total + day.recorded, 0)
  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{labels.expected} / {labels.recorded}</h2><p className="mt-1 text-sm text-muted-foreground">{expected.toLocaleString('nl-NL', { maximumFractionDigits: 2 })} / {recorded.toLocaleString('nl-NL', { maximumFractionDigits: 2 })} {labels.hours}</p></div>{editHref && overview.canEdit ? <Link className={buttonClasses()} href={editHref} prefetch={false}>{labels.fill}<ArrowRight aria-hidden="true" /></Link> : null}</div>
    <div className="space-y-2">{overview.days.map((day) => <Surface className="flex flex-wrap items-center gap-3 p-4" key={day.date}><div className="min-w-28 flex-1"><p className="font-medium">{new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date(`${day.date}T00:00:00.000Z`))}</p><p className="mt-1 text-sm text-muted-foreground">{labels.expected}: {day.expected} {labels.hours}</p></div><p className="text-sm font-semibold tabular-nums">{labels.recorded}: {day.recorded} {labels.hours}</p><span className={`rounded-[var(--radius-control)] px-2 py-1 text-xs font-semibold ${day.needsAction ? 'bg-warning/15 text-warning-foreground' : 'bg-success/10 text-success'}`}>{day.needsAction ? labels.actionNeeded : labels.noAction}</span></Surface>)}</div>
    {overview.days.length === 0 ? <Surface className="p-6"><p className="text-sm text-muted-foreground">{labels.noData}</p></Surface> : null}
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
