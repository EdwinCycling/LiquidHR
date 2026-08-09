'use client'

/* eslint-disable @next/next/no-img-element -- administration branding is served by an authenticated route. */
import Link from 'next/link'
import { ArrowDown, ArrowRight, ArrowUp, BriefcaseBusiness, CalendarDays, CircleDashed, ClipboardPlus, FileText, Gift, GripVertical, Grid2X2, HeartPulse, LayoutDashboard, ListTodo, LoaderCircle, Maximize2, MessageSquareText, Minimize2, PartyPopper, Sparkles, Star, Tags, UserPlus, UserRound, Users, UsersRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type DragEvent, type ReactNode } from 'react'
import { formatDateTime } from '@/lib/preferences/formatters'
import type { DateFormat, TimeFormat } from '@/lib/preferences/user-preferences'
import type { StartPagePreferences } from '@/lib/preferences/start-page'
import type { StartPageNarrowWindow, StartPageWideWindow } from '@/lib/preferences/start-page-layout'
import type { Locale } from '@/lib/i18n/config'
import type { StartPageData, StartPageLeavePerson, StartPageScope, StartPageWorkforceLink, StartPageWorkforceLinkId } from '@/lib/startpage/service'
import type { StartPageTeamAvailability, StartPageTeamAvailabilityCell } from '@/lib/startpage/team-availability-service'
import { employeeListMyTeamHref } from '@/lib/preferences/employee-list-state'
import { WeatherInstrument } from './weather-instrument'
import type { WeatherLabels } from './weather-instrument'

interface StartPageAppraisalLabels { continuousAppraisalTitle: string; continuousAppraisalDescription: string; openContinuousAppraisal: string; openManagerAppraisal: string; appraisalLatest: string; appraisalOpenActions: string; appraisalNoItems: string }

interface StartPageLabels extends WeatherLabels, StartPageAppraisalLabels {
  nextLeave: string; nextHoliday: string; eyebrow: string; headline: string; subtitle: string; activeScope: string; administration: string; tenant: string; peopleInScope: string; operationalTitle: string; operationalTitleTeam: string; operationalTitleCompany: string; scopeSwitchLabel: string; scopeTeam: string; scopeCompany: string; openTeamEmployees: string; liveSource: string; documentsTitle: string; documentsDescription: string; openDocuments: string; notAvailable: string; yourPriorities: string; prioritiesBody: string; remindersTitle: string; remindersDescription: string; openReminders: string; noReminders: string; moreReminders: string; workInProgress: string; workInProgressBody: string; futureDeclarations: string; futureContracts: string; futureAssets: string; futureTasks: string; futureSource: string; processWorkTitle: string; processWorkDescription: string; processWorkOverdue: string; processWorkDueToday: string; processWorkNoItems: string; processWorkOpen: string; processWorkSubject: string; openDashboard: string; quickLinks: string; workforceDescription: string; openWorkforce: string; workforceOpenItem: string; workforceNineGrid: string; workforceNineGridDescription: string; workforceContinuousAppraisal: string; workforceContinuousAppraisalDescription: string; workforceTalentProfiles: string; workforceTalentProfilesDescription: string; workforceStarPerformers: string; workforceStarPerformersDescription: string; workforceStarPerformerTags: string; workforceStarPerformerTagsDescription: string; quickActionsTitle: string; myData: string; myDataDescription: string; myTeam: string; myTeamDescription: string; newAbsence: string; newAbsenceDescription: string; calendar: string; insights: string; updated: string; fallbackName: string; absenceCasesTitle: string; absenceCasesDescription: string; absenceSince: string; absenceDays: string; openAbsenceDossier: string; noActiveAbsences: string; absenceRecovery: string; absenceMore: string; openAbsenceOverview: string; leaveTitle: string; leaveToday: string; leaveTomorrow: string; leavePersons: string; leavePerson: string; leaveNoAbsences: string; openCalendar: string; eventsTitle: string; eventsToday: string; eventsTomorrow: string; eventsNoEvents: string; openAllEvents: string; eventBirthday: string; eventAnniversary: string; eventStarter: string; eventYears: string; kpiEmployees: string; kpiRecurringAbsence: string; kpiLongTermSick: string; openEmployees: string; teamAvailabilityTitle: string; teamAvailabilityDescription: string; teamAvailabilityPeople: string; teamAvailabilityPresence: string; teamAvailabilityHours: string; teamAvailabilityModeLabel: string; teamAvailabilityAvailable: string; teamAvailabilityNotAvailable: string; teamAvailabilityOff: string; teamAvailabilityLeave: string; teamAvailabilityAbsent: string; teamAvailabilityNoMembers: string; teamAvailabilityHoursUnit: string; layoutLabel: string; full: string; compact: string; fullDescription: string; compactDescription: string; layoutSaving: string; layoutSaved: string; layoutFailed: string; moveUp: string; moveDown: string; drag: string
}

interface StartPageProps { data: StartPageData; locale: Locale; dateFormat: DateFormat; timeFormat: TimeFormat; logoUrl?: string | null; greeting: string; labels: StartPageLabels; initialPreferences: StartPagePreferences }

type StartPageWindowId = StartPageWideWindow | StartPageNarrowWindow

function StartPageWindowFrame({ id, index, count, viewMode, labels, onMove, onDragStart, onDragEnd, onDragOver, onDrop, children }: { id: StartPageWindowId; index: number; count: number; viewMode: 'full' | 'compact'; labels: Pick<StartPageLabels, 'moveUp' | 'moveDown' | 'drag'>; onMove: (id: StartPageWindowId, offset: -1 | 1) => void; onDragStart: (id: StartPageWindowId) => void; onDragEnd: () => void; onDragOver: (event: DragEvent<HTMLDivElement>) => void; onDrop: (id: StartPageWindowId) => void; children: ReactNode }) {
  return <div className="group" draggable={viewMode === 'full'} onDragEnd={onDragEnd} onDragOver={onDragOver} onDrop={() => onDrop(id)} onDragStart={() => onDragStart(id)} style={{ order: index }}>{viewMode === 'full' ? <div className="mb-2 flex min-h-9 items-center justify-end gap-1 rounded-lg border border-dashed border-border/70 bg-surface/80 p-1 opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-within:opacity-100"><span aria-label={labels.drag} className="px-1 text-muted-foreground" title={labels.drag}><GripVertical aria-hidden="true" size={15} /></span><button aria-label={labels.moveUp} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30" disabled={index === 0} onClick={() => onMove(id, -1)} type="button"><ArrowUp aria-hidden="true" size={14} /></button><button aria-label={labels.moveDown} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30" disabled={index === count - 1} onClick={() => onMove(id, 1)} type="button"><ArrowDown aria-hidden="true" size={14} /></button></div> : null}{children}</div>
}

function AvatarCircle({ person }: { person: StartPageLeavePerson }) {
  const initials = person.employeeName.split(' ').filter(Boolean).map((part) => part.slice(0, 1)).slice(0, 2).join('').toUpperCase()
  return <Link className="shrink-0" href={`/employees/${person.employeeId}`} title={person.employeeName}>
    {person.avatarUrl ? <img alt={person.employeeName} className="size-8 rounded-full object-cover ring-2 ring-surface" src={person.avatarUrl} /> : <span className="grid size-8 place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground ring-2 ring-surface">{initials}</span>}
  </Link>
}

function QuickAction({ href, icon: Icon, label, description }: { href: string; icon: typeof UserRound; label: string; description: string }) {
  return <Link aria-label={label} className="group flex min-w-12 shrink-0 items-center justify-center gap-3 rounded-2xl border border-primary/15 bg-surface/90 p-2.5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:min-w-52 sm:flex-1 sm:justify-start sm:p-3.5" href={href}>
    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground transition group-hover:bg-primary group-hover:text-primary-foreground"><Icon aria-hidden="true" className="size-5" /></span>
    <span className="hidden min-w-0 sm:block"><span className="block truncate text-sm font-semibold text-foreground">{label}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{description}</span></span>
  </Link>
}

function WorkforceLink({ link, labels }: { link: StartPageWorkforceLink; labels: StartPageLabels }) {
  const content: Record<StartPageWorkforceLinkId, { icon: typeof Grid2X2; title: string; description: string }> = {
    nineGrid: { icon: Grid2X2, title: labels.workforceNineGrid, description: labels.workforceNineGridDescription },
    continuousAppraisal: { icon: MessageSquareText, title: labels.workforceContinuousAppraisal, description: labels.workforceContinuousAppraisalDescription },
    talentProfiles: { icon: Sparkles, title: labels.workforceTalentProfiles, description: labels.workforceTalentProfilesDescription },
    starPerformers: { icon: Star, title: labels.workforceStarPerformers, description: labels.workforceStarPerformersDescription },
    starPerformerTags: { icon: Tags, title: labels.workforceStarPerformerTags, description: labels.workforceStarPerformerTagsDescription },
  }
  const item = content[link.id]
  const Icon = item.icon
  return <Link className="group flex min-w-0 items-start gap-3 rounded-2xl border border-primary/10 bg-background p-4 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={link.href}>
    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground transition group-hover:bg-primary group-hover:text-primary-foreground"><Icon aria-hidden="true" size={18} /></span>
    <span className="min-w-0"><span className="block truncate text-sm font-semibold text-foreground">{item.title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.description}</span><span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent-foreground">{labels.workforceOpenItem}<ArrowRight aria-hidden="true" size={13} /></span></span>
  </Link>
}

function ProcessWorkWindow({ data, dateLocale, labels }: { data: StartPageData['processWork']; dateLocale: string; labels: StartPageLabels }) {
  if (!data) return null
  const formatDeadline = (value: string | null): string => value ? new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium' }).format(new Date(value)) : ''
  return <article className="overflow-hidden rounded-[1.5rem] border bg-surface shadow-sm" data-testid="startpage-process-work">
    <header className="border-b bg-accent/45 p-5"><div className="flex items-start justify-between gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground"><ListTodo aria-hidden="true" size={20} /></span><span className="rounded-full bg-surface px-2.5 py-1 text-xs font-bold tabular-nums text-accent-foreground">{data.total}</span></div><h3 className="mt-5 text-lg font-semibold">{labels.processWorkTitle}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.processWorkDescription}</p></header>
    <div className="p-5">
      {data.overdueCount || data.dueTodayCount ? <div className="flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-destructive-surface px-2.5 py-1 text-destructive">{data.overdueCount} · {labels.processWorkOverdue}</span><span className="rounded-full bg-warning-surface px-2.5 py-1 text-warning">{data.dueTodayCount} · {labels.processWorkDueToday}</span></div> : null}
      {data.items.length ? <ul className="mt-4 divide-y divide-border/70">{data.items.map((item) => <li className="py-3 first:pt-0 last:pb-0" key={item.workItemId}><Link className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={`/work/${item.workItemId}`}><span className="block font-semibold leading-5">{item.processTitle}</span><span className="mt-1 block text-xs text-muted-foreground">{item.subjectName ?? labels.processWorkSubject} · {item.stepTitle}{item.deadlineAt ? ` · ${formatDeadline(item.deadlineAt)}` : ''}</span></Link></li>)}</ul> : <p className="mt-4 rounded-xl border border-dashed bg-background p-4 text-sm leading-6 text-muted-foreground">{labels.processWorkNoItems}</p>}
      <Link className="button-primary mt-5 flex w-full gap-2" href="/work">{labels.processWorkOpen}<ArrowRight aria-hidden="true" size={15} /></Link>
    </div>
  </article>
}

function teamAvailabilityStatusLabel(cell: StartPageTeamAvailabilityCell, labels: StartPageLabels): string {
  if (cell.status === 'AVAILABLE') return labels.teamAvailabilityAvailable
  if (cell.status === 'LEAVE') return labels.teamAvailabilityLeave
  if (cell.status === 'ABSENT') return labels.teamAvailabilityAbsent
  return labels.teamAvailabilityOff
}

function TeamAvailabilityWindow({ data, dateLocale, labels }: { data: StartPageTeamAvailability; dateLocale: string; labels: StartPageLabels }) {
  const [mode, setMode] = useState<'presence' | 'hours'>('presence')
  const dayFormatter = new Intl.DateTimeFormat(dateLocale, { weekday: 'short', day: 'numeric', month: 'short' })
  const formatHours = (minutes: number): string => `${(minutes / 60).toLocaleString(dateLocale, { maximumFractionDigits: 2 })} ${labels.teamAvailabilityHoursUnit}`
  const endDate = data.dates[data.dates.length - 1]
  const endDateLabel = endDate ? dayFormatter.format(new Date(`${endDate}T00:00:00Z`)) : ''

  return <section className="overflow-hidden rounded-[1.5rem] border bg-surface shadow-sm" data-testid="team-availability-window">
    <header className="flex flex-col gap-4 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground"><CalendarDays aria-hidden="true" size={20} /></span><div><h3 className="font-semibold">{labels.teamAvailabilityTitle}</h3><p className="mt-1 text-sm text-muted-foreground">{labels.teamAvailabilityDescription.replace('{date}', endDateLabel)}</p></div></div>
      <div aria-label={labels.teamAvailabilityModeLabel} className="flex shrink-0 self-start rounded-full border bg-background p-0.5" role="group"><button aria-pressed={mode === 'presence'} className={`rounded-full px-2.5 py-1.5 text-xs font-semibold transition ${mode === 'presence' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`} onClick={() => setMode('presence')} type="button">{labels.teamAvailabilityPresence}</button><button aria-pressed={mode === 'hours'} className={`rounded-full px-2.5 py-1.5 text-xs font-semibold transition ${mode === 'hours' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`} onClick={() => setMode('hours')} type="button">{labels.teamAvailabilityHours}</button></div>
    </header>
    {data.members.length ? <div className="overflow-x-auto p-4 sm:p-5"><div className="min-w-[48rem]" style={{ display: 'grid', gridTemplateColumns: `minmax(10rem, 1.3fr) repeat(${data.dates.length}, minmax(4.5rem, 1fr))`, gap: '0.25rem' }}>
      <div className="flex items-end px-2 pb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{labels.teamAvailabilityPeople}</div>
      {data.dates.map((date) => <time className="flex min-h-12 flex-col items-center justify-end rounded-xl bg-muted/40 px-1 py-2 text-center text-[0.68rem] font-semibold leading-4 text-muted-foreground" dateTime={date} key={date}>{dayFormatter.format(new Date(`${date}T00:00:00Z`))}</time>)}
      {data.members.map((member) => <div className="contents" key={member.employeeId}>
        <Link className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/50 hover:text-primary" href={`/employees/${member.employeeId}`} title={member.employeeName}>
          {member.avatarUrl ? <img alt="" className="size-8 shrink-0 rounded-full object-cover" src={member.avatarUrl} /> : <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">{member.employeeName.split(' ').filter(Boolean).map((part) => part.slice(0, 1)).slice(0, 2).join('').toUpperCase()}</span>}
          <span className="min-w-0 truncate">{member.employeeName}</span>
        </Link>
        {member.cells.map((cell, index) => {
          const statusLabel = teamAvailabilityStatusLabel(cell, labels)
          const available = cell.status === 'AVAILABLE'
          const symbol = cell.status === 'AVAILABLE' ? '✓' : cell.status === 'LEAVE' ? 'V' : cell.status === 'ABSENT' ? 'Z' : '—'
          const cellLabel = mode === 'hours' && available ? formatHours(cell.scheduledMinutes) : statusLabel
          const availabilityLabel = available ? labels.teamAvailabilityAvailable : labels.teamAvailabilityNotAvailable
          return <div aria-label={`${availabilityLabel} · ${statusLabel} · ${cellLabel}`} className={`flex min-h-12 items-center justify-center rounded-xl px-1 text-center text-xs font-semibold ${available ? 'bg-success-surface text-success' : cell.status === 'LEAVE' ? 'bg-warning-surface text-warning' : cell.status === 'ABSENT' ? 'bg-destructive-surface text-destructive' : 'bg-muted/45 text-muted-foreground'}`} key={`${member.employeeId}-${data.dates[index]}`} title={`${availabilityLabel} · ${statusLabel} · ${cellLabel}`}>
            {mode === 'presence' ? <span aria-hidden="true" className="text-sm">{symbol}</span> : <span>{available ? formatHours(cell.scheduledMinutes) : cell.status === 'OFF' ? '—' : `0 ${labels.teamAvailabilityHoursUnit}`}</span>}
          </div>
        })}
      </div>)}
    </div><div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t pt-3 text-xs text-muted-foreground"><span><i className="mr-1.5 inline-block size-2 rounded-full bg-success" />{labels.teamAvailabilityAvailable}</span><span><i className="mr-1.5 inline-block size-2 rounded-full bg-muted-foreground" />{labels.teamAvailabilityOff}</span><span><i className="mr-1.5 inline-block size-2 rounded-full bg-warning" />{labels.teamAvailabilityLeave}</span><span><i className="mr-1.5 inline-block size-2 rounded-full bg-destructive" />{labels.teamAvailabilityAbsent}</span></div></div> : <p className="p-6 text-center text-sm text-muted-foreground">{labels.teamAvailabilityNoMembers}</p>}
  </section>
}

export function StartPage({ data, locale, dateFormat, timeFormat, logoUrl, greeting, labels, initialPreferences }: StartPageProps) {
  const router = useRouter()
  const name = data.firstName ?? labels.fallbackName
  const dateLocale = locale === 'nl' ? 'nl-NL' : 'en-GB'
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayEvents = data.upcomingEvents.filter((event) => event.date === todayStr)
  const tomorrowEvents = data.upcomingEvents.filter((event) => event.date !== todayStr)
  const eventIcon = { BIRTHDAY: PartyPopper, ANNIVERSARY: Gift, STARTER: UserPlus } as const
  const eventLabel = { BIRTHDAY: labels.eventBirthday, ANNIVERSARY: labels.eventAnniversary, STARTER: labels.eventStarter } as const
  const [viewMode, setViewMode] = useState<'full' | 'compact'>(initialPreferences.viewMode)
  const [windowLayout, setWindowLayout] = useState(initialPreferences.layout)
  const [dragged, setDragged] = useState<{ column: 'wide' | 'narrow'; id: string } | null>(null)
  const [layoutStatus, setLayoutStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')

  async function saveViewMode(nextMode: 'full' | 'compact'): Promise<void> {
    setViewMode(nextMode)
    setLayoutStatus('saving')
    const response = await fetch('/api/preferences/start-page', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ viewMode: nextMode }) })
    setLayoutStatus(response.ok ? 'saved' : 'failed')
  }

  async function saveWindowLayout(nextLayout: typeof windowLayout): Promise<void> {
    setLayoutStatus('saving')
    const response = await fetch('/api/preferences/start-page', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ layout: nextLayout }) })
    setLayoutStatus(response.ok ? 'saved' : 'failed')
  }

  function moveWindow(column: 'wide' | 'narrow', id: string, offset: -1 | 1): void {
    const current = [...windowLayout[column]]
    const index = current.indexOf(id as never)
    const target = index + offset
    if (index < 0 || target < 0 || target >= current.length) return
    ;[current[index], current[target]] = [current[target], current[index]]
    const nextLayout = { ...windowLayout, [column]: current }
    setWindowLayout(nextLayout)
    void saveWindowLayout(nextLayout)
  }

  function dropWindow(column: 'wide' | 'narrow', targetId: string): void {
    if (!dragged || dragged.column !== column || dragged.id === targetId) return
    const current = [...windowLayout[column]]
    const from = current.indexOf(dragged.id as never)
    const to = current.indexOf(targetId as never)
    if (from < 0 || to < 0) return
    const [item] = current.splice(from, 1)
    current.splice(to, 0, item)
    const nextLayout = { ...windowLayout, [column]: current }
    setWindowLayout(nextLayout)
    setDragged(null)
    void saveWindowLayout(nextLayout)
  }

  function windowFrame(column: 'wide' | 'narrow', id: StartPageWindowId, children: ReactNode): ReactNode {
    const items = windowLayout[column]
    const index = items.indexOf(id as never)
    return <StartPageWindowFrame count={items.length} id={id} index={index} key={id} labels={labels} onDragEnd={() => setDragged(null)} onDragOver={(event) => { if (viewMode === 'full') event.preventDefault() }} onDragStart={(windowId) => { if (viewMode === 'full') setDragged({ column, id: windowId }) }} onDrop={(windowId) => dropWindow(column, windowId)} onMove={(windowId, offset) => moveWindow(column, windowId, offset)} viewMode={viewMode}>{children}</StartPageWindowFrame>
  }

  function changeScope(scope: StartPageScope): void {
    router.push(`/dashboard/start?scope=${scope}`)
  }

  return <div className="relative min-h-full overflow-hidden bg-background"><div aria-hidden="true" className="pointer-events-none absolute -right-36 -top-36 size-[28rem] rounded-full bg-accent/55 blur-3xl" /><div aria-hidden="true" className="pointer-events-none absolute -bottom-48 left-1/4 size-[24rem] rounded-full bg-success-surface/60 blur-3xl" />
    <main className="relative mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-8 sm:py-9 lg:px-10">
      {logoUrl ? <div className="mb-4 flex justify-end"><img alt="" className="max-h-12 max-w-48 object-contain" src={logoUrl} /></div> : null}
      <section className={`relative overflow-hidden rounded-[2rem] border border-primary/15 bg-primary text-primary-foreground shadow-[0_1.6rem_4rem_color-mix(in_srgb,var(--primary)_24%,transparent)] ${viewMode === 'full' ? 'p-4 sm:p-5 lg:p-6' : 'p-3 sm:p-4'}`}><div aria-hidden="true" className="absolute -right-16 -top-24 size-72 rounded-full border border-primary-foreground/10 bg-primary-foreground/5 blur-2xl" /><div aria-hidden="true" className="absolute -bottom-28 right-1/3 size-56 rounded-full bg-primary-foreground/10 blur-3xl" /><div className={`relative flex items-center justify-between ${viewMode === 'full' ? 'gap-6' : 'gap-3'}`}><div className="min-w-0"><h1 className={`min-w-0 max-w-3xl font-semibold tracking-[-0.04em] ${viewMode === 'full' ? 'text-2xl sm:text-3xl lg:text-3xl' : 'text-xl sm:text-2xl'}`}>{greeting}, {name}</h1>{viewMode === 'full' && (data.nextLeaveInDays !== null || data.nextHolidayInDays !== null) ? <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.68rem] leading-4 text-primary-foreground/70">{data.nextLeaveInDays !== null ? <span>{labels.nextLeave.replace('{days}', String(data.nextLeaveInDays))}</span> : null}{data.nextHolidayInDays !== null ? <span>{labels.nextHoliday.replace('{days}', String(data.nextHolidayInDays))}</span> : null}</div> : null}</div><div className="flex shrink-0 items-center gap-3">{viewMode === 'full' ? <WeatherInstrument workWeather={data.workWeather} homeWeather={data.homeWeather} labels={labels} /> : null}<div aria-label={labels.layoutLabel} className="flex items-center rounded-full border border-primary-foreground/20 bg-primary-foreground/10 p-0.5" role="group"><button aria-pressed={viewMode === 'full'} className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition ${viewMode === 'full' ? 'bg-primary-foreground text-primary shadow-sm' : 'text-primary-foreground/75 hover:bg-primary-foreground/10'}`} onClick={() => void saveViewMode('full')} title={labels.fullDescription} type="button"><Maximize2 aria-hidden="true" size={13} /><span className="hidden sm:inline">{labels.full}</span></button><button aria-pressed={viewMode === 'compact'} className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition ${viewMode === 'compact' ? 'bg-primary-foreground text-primary shadow-sm' : 'text-primary-foreground/75 hover:bg-primary-foreground/10'}`} onClick={() => void saveViewMode('compact')} title={labels.compactDescription} type="button"><Minimize2 aria-hidden="true" size={13} /><span className="hidden sm:inline">{labels.compact}</span></button></div></div></div><p aria-live="polite" className="sr-only">{layoutStatus === 'saving' ? labels.layoutSaving : layoutStatus === 'saved' ? labels.layoutSaved : layoutStatus === 'failed' ? labels.layoutFailed : ''}{layoutStatus === 'saving' ? <LoaderCircle aria-hidden="true" /> : null}</p></section>

      {!data.isEmployeeOnly ? <section aria-label={labels.quickActionsTitle} className="mt-5"><p className="sr-only">{labels.quickActionsTitle}</p><div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
        {data.employeeId ? <QuickAction description={labels.myDataDescription} href={`/employees/${data.employeeId}`} icon={UserRound} label={labels.myData} /> : null}
        {data.isManager ? <QuickAction description={labels.myTeamDescription} href={employeeListMyTeamHref()} icon={UsersRound} label={labels.myTeam} /> : null}
        {data.canReportAbsence ? <QuickAction description={labels.newAbsenceDescription} href="/absence/new" icon={ClipboardPlus} label={labels.newAbsence} /> : null}
      </div></section> : null}

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.38fr)_minmax(19rem,.62fr)]"><section>
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-x-3 gap-y-2"><span className="text-sm font-medium text-muted-foreground">{data.scope === 'team' ? labels.operationalTitleTeam : labels.operationalTitleCompany}</span>{data.isManager ? <Link className="inline-flex items-center gap-1 text-xs font-semibold text-accent-foreground hover:underline" href={employeeListMyTeamHref()}><UsersRound aria-hidden="true" size={14} />{labels.openTeamEmployees}</Link> : null}</div><div className="flex flex-wrap items-center justify-end gap-3"><span className="text-sm text-muted-foreground">{new Intl.DateTimeFormat(dateLocale, { dateStyle: 'full' }).format(new Date())}</span>{data.canSwitchScope ? <div aria-label={labels.scopeSwitchLabel} className="flex items-center rounded-full border bg-surface p-0.5" role="group"><button aria-pressed={data.scope === 'team'} className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${data.scope === 'team' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`} onClick={() => changeScope('team')} type="button">{labels.scopeTeam}</button><button aria-pressed={data.scope === 'company'} className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${data.scope === 'company' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`} onClick={() => changeScope('company')} type="button">{labels.scopeCompany}</button></div> : null}</div></header>

        <div className="flex flex-col">
        {data.isManager && data.teamAvailability ? windowFrame('wide', 'teamAvailability', <TeamAvailabilityWindow data={data.teamAvailability} dateLocale={dateLocale} labels={labels} />) : null}
        {/* Bedrijfsdocumenten - breed */}
        {windowFrame('wide', 'documents', <article className="group flex min-h-36 flex-col justify-between rounded-[1.35rem] border bg-surface p-5 shadow-[0_1rem_2.5rem_color-mix(in_srgb,var(--primary)_7%,transparent)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_1.5rem_3rem_color-mix(in_srgb,var(--primary)_13%,transparent)] sm:p-6">
          <div className="flex items-start justify-between gap-4"><span className="grid size-11 place-items-center rounded-2xl bg-warning-surface text-warning"><FileText aria-hidden="true" size={20} /></span><span className="inline-flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-muted-foreground"><span className="size-1.5 rounded-full bg-success" />{labels.liveSource}</span></div>
          <div className="mt-5"><p className="text-sm font-semibold text-foreground">{labels.documentsTitle}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{labels.documentsDescription}</p><p className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-foreground">{data.companyDocuments ?? '—'}</p></div>
          <Link className="mt-5 inline-flex w-fit items-center gap-2 text-sm font-semibold text-accent-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href="/company-documents">{data.companyDocuments === null ? labels.notAvailable : labels.openDocuments}<ArrowRight aria-hidden="true" size={15} /></Link>
        </article>)}

        {data.continuousAppraisal ? windowFrame('wide', 'continuousAppraisal', <article className="mt-6 overflow-hidden rounded-[1.35rem] border bg-surface shadow-[0_1rem_2.5rem_color-mix(in_srgb,var(--primary)_7%,transparent)]"><div className="flex items-start justify-between gap-4 border-b p-5 sm:p-6"><div className="flex items-start gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-accent text-primary"><MessageSquareText aria-hidden="true" size={20} /></span><div><p className="text-sm font-semibold">{labels.continuousAppraisalTitle}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{labels.continuousAppraisalDescription}</p></div></div><span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">{data.continuousAppraisal.itemCount}</span></div><div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{labels.appraisalOpenActions}</p><p className="mt-2 text-3xl font-semibold tabular-nums">{data.continuousAppraisal.openActionCount}</p></div><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{labels.appraisalLatest}</p><p className="mt-2 truncate text-sm font-semibold">{data.continuousAppraisal.latestItem?.title ?? labels.appraisalNoItems}</p>{data.continuousAppraisal.latestItem ? <time className="mt-1 block text-xs text-muted-foreground" dateTime={data.continuousAppraisal.latestItem.occurred_on}>{new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium' }).format(new Date(`${data.continuousAppraisal.latestItem.occurred_on}T00:00:00Z`))}</time> : null}</div></div><div className="flex flex-wrap gap-3 border-t px-5 py-4 sm:px-6"><Link className="button-primary gap-2" href={data.continuousAppraisal.href}>{labels.openContinuousAppraisal}<ArrowRight aria-hidden="true" size={15} /></Link>{data.continuousAppraisal.workforceHref ? <Link className="button-secondary gap-2" href={data.continuousAppraisal.workforceHref}>{labels.openManagerAppraisal}<ArrowRight aria-hidden="true" size={15} /></Link> : null}</div></article>) : null}

        {/* Afwezigheden */}
        {windowFrame('wide', 'leave', <section className="mt-6 overflow-hidden rounded-[1.5rem] border bg-surface shadow-sm">
          <header className="border-b px-5 py-4"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{labels.leaveTitle}</h3><Link className="inline-flex items-center gap-1 text-sm font-semibold text-accent-foreground hover:underline" href="/hr-calendar">{labels.openCalendar}<ArrowRight aria-hidden="true" size={15} /></Link></div></header>
          <div className="grid gap-px sm:grid-cols-2">
            <div className="p-5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{labels.leaveToday}</p>
              {data.leaveAbsences.today.length > 0 ? <div className="mt-3 flex items-center gap-3"><span className="text-2xl font-semibold tabular-nums text-foreground">{data.leaveAbsences.today.length}</span><span className="text-sm text-muted-foreground">{data.leaveAbsences.today.length === 1 ? labels.leavePerson : labels.leavePersons}</span><div className="ml-auto flex -space-x-2">{data.leaveAbsences.today.slice(0, 6).map((person) => <AvatarCircle key={person.employeeId} person={person} />)}</div></div> : <p className="mt-3 text-sm text-muted-foreground">{labels.leaveNoAbsences}</p>}
            </div>
            <div className="border-t p-5 sm:border-l sm:border-t-0">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{labels.leaveTomorrow}</p>
              {data.leaveAbsences.tomorrow.length > 0 ? <div className="mt-3 flex items-center gap-3"><span className="text-2xl font-semibold tabular-nums text-foreground">{data.leaveAbsences.tomorrow.length}</span><span className="text-sm text-muted-foreground">{data.leaveAbsences.tomorrow.length === 1 ? labels.leavePerson : labels.leavePersons}</span><div className="ml-auto flex -space-x-2">{data.leaveAbsences.tomorrow.slice(0, 6).map((person) => <AvatarCircle key={person.employeeId} person={person} />)}</div></div> : <p className="mt-3 text-sm text-muted-foreground">{labels.leaveNoAbsences}</p>}
            </div>
          </div>
        </section>)}

        {/* Lopende verzuimgevallen */}
        {windowFrame('wide', 'absenceCases', <section className="mt-6 overflow-hidden rounded-[1.5rem] border bg-surface shadow-sm">
          <header className="border-b px-5 py-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{labels.absenceCasesTitle}</p><h3 className="mt-1 font-semibold">{labels.absenceCasesDescription}</h3></div><Link className="inline-flex items-center gap-1 text-sm font-semibold text-accent-foreground hover:underline" href="/insights?report=absence">{labels.openAbsenceOverview}<ArrowRight aria-hidden="true" size={15} /></Link></div></header>
          {data.activeAbsenceItems.length ? <ul className="divide-y divide-border/70">{data.activeAbsenceItems.map((item) => {
            const initials = item.employeeName.split(' ').filter(Boolean).map((part) => part.slice(0, 1)).slice(0, 2).join('').toUpperCase()
            return <li key={item.caseId}><Link className="flex items-center gap-3 px-5 py-4 transition hover:bg-muted/35" href={`/employees/${item.employeeId}?tab=absence`}>
              {item.avatarUrl ? <img alt="" className="size-10 shrink-0 rounded-full object-cover" src={item.avatarUrl} /> : <span className="grid size-10 shrink-0 place-items-center rounded-full bg-destructive-surface text-xs font-bold text-destructive">{initials}</span>}
              <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-foreground">{item.employeeName}</span><span className="mt-0.5 block text-sm text-muted-foreground">{labels.absenceSince} {new Intl.DateTimeFormat(dateLocale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${item.firstAbsenceOn}T00:00:00Z`))}{item.status === 'RECOVERY_WINDOW' ? ` · ${labels.absenceRecovery}` : ''}</span></span>
              <span className="shrink-0 text-right"><span className="block text-lg font-semibold tabular-nums text-foreground">{item.days}</span><span className="text-xs text-muted-foreground">{labels.absenceDays}</span></span>
            </Link></li>
          })}</ul> : <p className="p-6 text-center text-sm text-muted-foreground">{labels.noActiveAbsences}</p>}
          {data.activeAbsenceTotal > 5 ? <div className="border-t px-5 py-3"><Link className="inline-flex items-center gap-1 text-sm font-semibold text-accent-foreground hover:underline" href="/insights?report=absence">+{data.activeAbsenceTotal - 5} {labels.absenceMore}<ArrowRight aria-hidden="true" size={14} /></Link></div> : null}
        </section>)}

        {/* Gebeurtenissen */}
        {windowFrame('wide', 'events', <section className="mt-6 overflow-hidden rounded-[1.5rem] border bg-surface shadow-sm">
          <header className="border-b px-5 py-4"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{labels.eventsTitle}</h3><Link className="inline-flex items-center gap-1 text-sm font-semibold text-accent-foreground hover:underline" href="/insights/upcoming-events">{labels.openAllEvents}<ArrowRight aria-hidden="true" size={15} /></Link></div></header>
          {data.upcomingEvents.length ? <div className="divide-y divide-border/70">
            {todayEvents.length ? <div className="p-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{labels.eventsToday}</p><ul className="mt-3 space-y-2.5">{todayEvents.map((event) => { const Icon = eventIcon[event.type]; return <li className="flex items-center gap-3" key={event.id}><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground"><Icon aria-hidden="true" size={15} /></span><Link className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:text-primary hover:underline" href={`/employees/${event.employeeId}`}>{event.employeeName}</Link><span className="shrink-0 text-xs text-muted-foreground">{eventLabel[event.type]}{event.years ? ` · ${event.years} ${labels.eventYears}` : ''}</span></li> })}</ul></div> : null}
            {tomorrowEvents.length ? <div className="p-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{labels.eventsTomorrow}</p><ul className="mt-3 space-y-2.5">{tomorrowEvents.map((event) => { const Icon = eventIcon[event.type]; return <li className="flex items-center gap-3" key={event.id}><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground"><Icon aria-hidden="true" size={15} /></span><Link className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:text-primary hover:underline" href={`/employees/${event.employeeId}`}>{event.employeeName}</Link><span className="shrink-0 text-xs text-muted-foreground">{eventLabel[event.type]}{event.years ? ` · ${event.years} ${labels.eventYears}` : ''}</span></li> })}</ul></div> : null}
          </div> : <p className="p-6 text-center text-sm text-muted-foreground">{labels.eventsNoEvents}</p>}
        </section>)}

        {/* KPI-kaarten */}
        {windowFrame('wide', 'kpis', <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Link className="group flex flex-col rounded-[1.35rem] border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" href="/employees">
            <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground"><Users aria-hidden="true" size={18} /></span>
            <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">{data.employeeCount ?? '—'}</p>
            <p className="mt-1 text-sm text-muted-foreground">{labels.kpiEmployees}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent-foreground group-hover:underline">{labels.openEmployees}<ArrowRight aria-hidden="true" size={13} /></span>
          </Link>
          <div className="flex flex-col rounded-[1.35rem] border bg-surface p-5 shadow-sm">
            <span className="grid size-10 place-items-center rounded-xl bg-warning-surface text-warning"><HeartPulse aria-hidden="true" size={18} /></span>
            <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">{data.recurringAbsenceCount ?? '—'}</p>
            <p className="mt-1 text-sm text-muted-foreground">{labels.kpiRecurringAbsence}</p>
          </div>
          <Link className="group flex flex-col rounded-[1.35rem] border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" href="/insights?report=absence">
            <span className="grid size-10 place-items-center rounded-xl bg-destructive-surface text-destructive"><HeartPulse aria-hidden="true" size={18} /></span>
            <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">{data.longTermSickCount ?? '—'}</p>
            <p className="mt-1 text-sm text-muted-foreground">{labels.kpiLongTermSick}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent-foreground group-hover:underline">{labels.openAbsenceOverview}<ArrowRight aria-hidden="true" size={13} /></span>
          </Link>
        </div>)}
        </div>
      </section>

        <aside className="space-y-4"><header><p className="eyebrow">{labels.yourPriorities}</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">{labels.prioritiesBody}</h2></header>{windowFrame('narrow', 'reminders', <article className="overflow-hidden rounded-[1.5rem] border bg-surface shadow-[0_1rem_2.5rem_color-mix(in_srgb,var(--primary)_8%,transparent)]"><div className="border-b bg-accent/45 p-5"><div className="flex items-start justify-between gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground"><CalendarDays aria-hidden="true" size={20} /></span><span className="rounded-full bg-surface px-2.5 py-1 text-xs font-bold tabular-nums text-accent-foreground">{data.reminders.length}</span></div><h3 className="mt-5 text-lg font-semibold">{labels.remindersTitle}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.remindersDescription}</p></div><div className="p-5">{data.reminders.length > 0 ? <ul className="divide-y divide-border/70">{data.reminders.slice(0, 4).map((reminder) => <li className="py-3 first:pt-0 last:pb-0" key={reminder.recipientId}><p className="font-semibold leading-5">{reminder.title}</p><time className="mt-1 block text-xs text-muted-foreground" dateTime={reminder.remindAt}>{formatDateTime(reminder.remindAt, { locale: dateLocale, dateFormat, timeFormat })}</time></li>)}</ul> : <div className="rounded-xl border border-dashed bg-background p-4 text-sm leading-6 text-muted-foreground"><CircleDashed aria-hidden="true" className="mb-2 text-success" size={20} />{labels.noReminders}</div>}<div className="mt-5 flex flex-wrap gap-3"><Link className="button-primary flex-1 gap-2" href="/reminders">{labels.openReminders}<ArrowRight aria-hidden="true" size={15} /></Link>{data.reminders.length > 4 ? <Link className="button-secondary" href="/reminders">{labels.moreReminders}</Link> : null}</div></div></article>)}

          {windowFrame('narrow', 'workInProgress', <ProcessWorkWindow data={data.processWork} dateLocale={dateLocale} labels={labels} />)}</aside>
      </div>

      <section className="mt-8 rounded-[1.5rem] border bg-surface/80 p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-sm font-semibold">{labels.quickLinks}</p><p className="mt-1 text-sm text-muted-foreground">{labels.workforceDescription}</p></div><div className="flex flex-wrap gap-2">{data.canReadWorkforce ? <Link className="button-secondary gap-2" href="/workforce"><BriefcaseBusiness aria-hidden="true" size={16} />{labels.openWorkforce}</Link> : null}<Link className="button-secondary gap-2" href="/dashboard"><LayoutDashboard aria-hidden="true" size={16} />{labels.openDashboard}</Link><Link className="button-secondary gap-2" href="/hr-calendar"><CalendarDays aria-hidden="true" size={16} />{labels.calendar}</Link><Link className="button-secondary gap-2" href="/insights"><BriefcaseBusiness aria-hidden="true" size={16} />{labels.insights}</Link></div></div>{data.canReadWorkforce && data.workforceLinks.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.workforceLinks.map((link) => <WorkforceLink key={link.id} link={link} labels={labels} />)}</div> : null}</section>
    </main></div>
}
