/* eslint-disable @next/next/no-img-element -- administration branding is served by an authenticated route. */
import Link from 'next/link'
import { ArrowDown, ArrowRight, ArrowUp, BriefcaseBusiness, CalendarDays, CircleDashed, Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, FileText, Gift, HeartPulse, LayoutDashboard, Minus, PartyPopper, Sun, UserPlus, Users, Wrench } from 'lucide-react'
import { formatDateTime } from '@/lib/preferences/formatters'
import type { DateFormat, TimeFormat } from '@/lib/preferences/user-preferences'
import type { Locale } from '@/lib/i18n/config'
import type { StartPageData, StartPageLeavePerson } from '@/lib/startpage/service'
import type { WeatherCurrent, WeatherDay } from '@/lib/weather/open-meteo'

interface StartPageLabels {
  weatherTitle: string; weatherUnavailable: string; weatherPressureUp: string; weatherPressureDown: string; weatherPressureSteady: string;
  nextLeave: string; nextHoliday: string;
  eyebrow: string; headline: string; subtitle: string; activeScope: string; administration: string; tenant: string; peopleInScope: string; operationalTitle: string; liveSource: string; documentsTitle: string; documentsDescription: string; openDocuments: string; notAvailable: string; yourPriorities: string; prioritiesBody: string; remindersTitle: string; remindersDescription: string; openReminders: string; noReminders: string; moreReminders: string; workInProgress: string; workInProgressBody: string; futureDeclarations: string; futureContracts: string; futureAssets: string; futureTasks: string; futureEvents: string; futureSource: string; dashboardHint: string; openDashboard: string; quickLinks: string; calendar: string; insights: string; updated: string; fallbackName: string; absenceCasesTitle: string; absenceCasesDescription: string; absenceSince: string; absenceDays: string; openAbsenceDossier: string; noActiveAbsences: string; absenceRecovery: string; absenceMore: string; openAbsenceOverview: string; leaveTitle: string; leaveToday: string; leaveTomorrow: string; leavePersons: string; leavePerson: string; leaveNoAbsences: string; openCalendar: string; eventsTitle: string; eventsToday: string; eventsTomorrow: string; eventsNoEvents: string; openAllEvents: string; eventBirthday: string; eventAnniversary: string; eventStarter: string; eventYears: string; kpiEmployees: string; kpiRecurringAbsence: string; kpiLongTermSick: string; openEmployees: string
}

interface StartPageProps { data: StartPageData; locale: Locale; dateFormat: DateFormat; timeFormat: TimeFormat; logoUrl?: string | null; greeting: string; labels: StartPageLabels }

function WeatherGlyph({ code }: { code: number }) {
  const props = { 'aria-hidden': true, className: 'text-warning', size: 18, strokeWidth: 1.8 }
  if (code === 0) return <Sun {...props} />
  if (code === 1 || code === 2) return <CloudSun {...props} />
  if (code === 3) return <Cloud {...props} />
  if (code === 45 || code === 48) return <CloudFog {...props} />
  if (code >= 51 && code <= 67) return <CloudRain {...props} />
  if (code >= 71 && code <= 77) return <CloudSnow {...props} />
  if (code >= 80 && code <= 82) return <CloudRain {...props} />
  if (code >= 95) return <CloudLightning {...props} />
  return <Cloud {...props} />
}

function PressureTrendGlyph({ trend }: { trend: WeatherCurrent['pressureTrend'] }) {
  if (trend === 'up') return <ArrowUp aria-hidden="true" size={14} strokeWidth={2.5} />
  if (trend === 'down') return <ArrowDown aria-hidden="true" size={14} strokeWidth={2.5} />
  return <Minus aria-hidden="true" size={14} strokeWidth={2.5} />
}

function PressureBar({ current, labels }: { current: WeatherCurrent; labels: StartPageLabels }) {
  const position = Math.min(96, Math.max(4, ((current.pressure - 980) / 60) * 100))
  const trendLabel = current.pressureTrend === 'up' ? labels.weatherPressureUp : current.pressureTrend === 'down' ? labels.weatherPressureDown : labels.weatherPressureSteady
  return <div aria-label={`${Math.round(current.pressure)} hPa, ${trendLabel}`} className="mt-0">
    <div className="relative h-3.5 overflow-visible rounded-md border-2 border-foreground/40 bg-muted-foreground/20 shadow-inner">
      <div className="flex h-full overflow-hidden rounded-[0.2rem]"><span className="w-1/3 bg-warning/80" /><span className="w-1/3 bg-success/75" /><span className="w-1/3 bg-accent/80" /></div>
      <span aria-hidden="true" className="absolute -top-3 -translate-x-1/2 text-foreground" style={{ left: `${position}%` }}><PressureTrendGlyph trend={current.pressureTrend} /></span>
    </div>
    <div className="mt-0 flex items-center justify-between font-mono text-[0.5rem] font-semibold tabular-nums text-foreground/70"><span>980</span><span>{Math.round(current.pressure)} hPa</span><span>1040</span></div>
  </div>
}

function compassDirection(degrees: number) {
  const directions = ['N', 'NO', 'O', 'ZO', 'Z', 'ZW', 'W', 'NW'] as const
  return directions[Math.round(degrees / 45) % directions.length]
}

function WindDirection({ degrees, speed }: { degrees: number; speed: number }) {
  const direction = compassDirection(degrees)
  return <div aria-label={`Windrichting ${direction}, ${Math.round(speed)} km/u`} className="flex flex-col items-center gap-0.5 [&>span:last-child]:hidden">
    <span className="grid size-8 place-items-center rounded-full border-2 border-foreground/50 bg-background/25 shadow-inner"><span style={{ transform: `rotate(${degrees}deg)` }}><ArrowUp aria-hidden="true" className="text-foreground" size={18} strokeWidth={2.4} /></span></span>
    <span className="font-mono text-[0.6rem] font-semibold tabular-nums text-foreground/70">{direction}</span>
    <span className="font-mono text-[0.55rem] font-semibold tabular-nums text-foreground/70">{Math.round(degrees)}°</span>
  </div>
}

function WeatherInstrument({ data, labels }: { data: StartPageData['workWeather']; labels: StartPageLabels }) {
  return <aside aria-label={labels.weatherTitle} className="hidden w-[15rem] shrink-0 xl:block">
    {data ? <div className="rounded-[1rem] border-[0.25rem] border-primary-foreground/35 bg-muted px-2 py-1 text-foreground shadow-[inset_0_0.15rem_0.4rem_color-mix(in_srgb,var(--foreground)_18%,transparent),0_0.7rem_1.4rem_color-mix(in_srgb,var(--primary)_25%,transparent)] [&>div:first-child>span:first-child]:text-[1.8rem] [&>div:first-child>span:first-child]:leading-[0.9]">
      <div className="flex items-start justify-between gap-3"><span className="font-mono text-[3.15rem] font-semibold leading-[0.9] tracking-[-0.12em] tabular-nums">{data.current.temperature.toFixed(1)}°</span><WindDirection degrees={data.current.windDirection} speed={data.current.windSpeed} /></div>
      <PressureBar current={data.current} labels={labels} />
      <div className="mt-0 flex items-end justify-between gap-2"><span className="font-mono text-[1.8rem] font-semibold leading-[0.9] tracking-[-0.1em] tabular-nums">{Math.round(data.current.humidity)}%</span><WeatherGlyph code={data.current.weatherCode} /></div>
      <p className="mt-0.5 break-words text-center text-[0.58rem] font-semibold leading-3 text-foreground/75" title={data.location.city ?? data.location.name}>{data.location.city ?? data.location.name}</p>
    </div> : <p className="text-sm text-primary-foreground/65">{labels.weatherUnavailable}</p>}
  </aside>
}

// Retained as a compatible helper for the former forecast-card boundary.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyWeatherDayCard({ day, label }: { day: WeatherDay; label: string }) {
  return <div className="min-w-24 flex-1 rounded-xl bg-primary-foreground/10 px-3 py-2.5 sm:min-w-28">
    <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-primary-foreground/70">{label}</p>
    <div className="mt-1.5 flex items-center gap-2"><WeatherGlyph code={day.weatherCode} /><span className="text-sm font-semibold tabular-nums">{Math.round(day.temperatureMax)}°</span><span className="text-xs tabular-nums text-primary-foreground/60">{Math.round(day.temperatureMin)}°</span></div>
  </div>
}

function WeatherStrip({ data, labels }: { data: StartPageData['workWeather']; labels: StartPageLabels }) {
  return <WeatherInstrument data={data} labels={labels} />
}

function AvatarCircle({ person }: { person: StartPageLeavePerson }) {
  const initials = person.employeeName.split(' ').filter(Boolean).map((part) => part.slice(0, 1)).slice(0, 2).join('').toUpperCase()
  return <Link className="shrink-0" href={`/employees/${person.employeeId}`} title={person.employeeName}>
    {person.avatarUrl ? <img alt={person.employeeName} className="size-8 rounded-full object-cover ring-2 ring-surface" src={person.avatarUrl} /> : <span className="grid size-8 place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground ring-2 ring-surface">{initials}</span>}
  </Link>
}

export function StartPage({ data, locale, dateFormat, timeFormat, logoUrl, greeting, labels }: StartPageProps) {
  const name = data.firstName ?? labels.fallbackName
  const dateLocale = locale === 'nl' ? 'nl-NL' : 'en-GB'
  const futureItems = [labels.futureDeclarations, labels.futureContracts, labels.futureAssets, labels.futureTasks, labels.futureEvents]
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayEvents = data.upcomingEvents.filter((event) => event.date === todayStr)
  const tomorrowEvents = data.upcomingEvents.filter((event) => event.date !== todayStr)
  const eventIcon = { BIRTHDAY: PartyPopper, ANNIVERSARY: Gift, STARTER: UserPlus } as const
  const eventLabel = { BIRTHDAY: labels.eventBirthday, ANNIVERSARY: labels.eventAnniversary, STARTER: labels.eventStarter } as const

  return <div className="relative min-h-full overflow-hidden bg-background"><div aria-hidden="true" className="pointer-events-none absolute -right-36 -top-36 size-[28rem] rounded-full bg-accent/55 blur-3xl" /><div aria-hidden="true" className="pointer-events-none absolute -bottom-48 left-1/4 size-[24rem] rounded-full bg-success-surface/60 blur-3xl" />
    <main className="relative mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-8 sm:py-9 lg:px-10">
      {logoUrl ? <div className="mb-4 flex justify-end"><img alt="" className="max-h-12 max-w-48 object-contain" src={logoUrl} /></div> : null}
      <section className="relative overflow-hidden rounded-[2rem] border border-primary/15 bg-primary p-4 text-primary-foreground shadow-[0_1.6rem_4rem_color-mix(in_srgb,var(--primary)_24%,transparent)] sm:p-5 lg:p-6"><div aria-hidden="true" className="absolute -right-16 -top-24 size-72 rounded-full border border-primary-foreground/10 bg-primary-foreground/5 blur-2xl" /><div aria-hidden="true" className="absolute -bottom-28 right-1/3 size-56 rounded-full bg-primary-foreground/10 blur-3xl" /><div className="relative flex items-center justify-between gap-6"><div className="min-w-0"><h1 className="min-w-0 max-w-3xl text-2xl font-semibold tracking-[-0.04em] sm:text-3xl lg:text-3xl">{greeting}, {name}</h1>{data.nextLeaveInDays !== null || data.nextHolidayInDays !== null ? <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.68rem] leading-4 text-primary-foreground/70">{data.nextLeaveInDays !== null ? <span>{labels.nextLeave.replace('{days}', String(data.nextLeaveInDays))}</span> : null}{data.nextHolidayInDays !== null ? <span>{labels.nextHoliday.replace('{days}', String(data.nextHolidayInDays))}</span> : null}</div> : null}</div><WeatherStrip data={data.workWeather} labels={labels} /></div></section>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.38fr)_minmax(19rem,.62fr)]"><section>
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3"><span className="text-sm font-medium text-muted-foreground">{labels.operationalTitle}</span><span className="text-sm text-muted-foreground">{new Intl.DateTimeFormat(dateLocale, { dateStyle: 'full' }).format(new Date())}</span></header>

        {/* Bedrijfsdocumenten - breed */}
        <article className="group flex min-h-36 flex-col justify-between rounded-[1.35rem] border bg-surface p-5 shadow-[0_1rem_2.5rem_color-mix(in_srgb,var(--primary)_7%,transparent)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_1.5rem_3rem_color-mix(in_srgb,var(--primary)_13%,transparent)] sm:p-6">
          <div className="flex items-start justify-between gap-4"><span className="grid size-11 place-items-center rounded-2xl bg-warning-surface text-warning"><FileText aria-hidden="true" size={20} /></span><span className="inline-flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-muted-foreground"><span className="size-1.5 rounded-full bg-success" />{labels.liveSource}</span></div>
          <div className="mt-5"><p className="text-sm font-semibold text-foreground">{labels.documentsTitle}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{labels.documentsDescription}</p><p className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-foreground">{data.companyDocuments ?? '—'}</p></div>
          <Link className="mt-5 inline-flex w-fit items-center gap-2 text-sm font-semibold text-accent-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href="/company-documents">{data.companyDocuments === null ? labels.notAvailable : labels.openDocuments}<ArrowRight aria-hidden="true" size={15} /></Link>
        </article>

        {/* Afwezigheden */}
        <section className="mt-6 overflow-hidden rounded-[1.5rem] border bg-surface shadow-sm">
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
        </section>

        {/* Lopende verzuimgevallen */}
        <section className="mt-6 overflow-hidden rounded-[1.5rem] border bg-surface shadow-sm">
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
        </section>

        {/* Gebeurtenissen */}
        <section className="mt-6 overflow-hidden rounded-[1.5rem] border bg-surface shadow-sm">
          <header className="border-b px-5 py-4"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{labels.eventsTitle}</h3><Link className="inline-flex items-center gap-1 text-sm font-semibold text-accent-foreground hover:underline" href="/insights/upcoming-events">{labels.openAllEvents}<ArrowRight aria-hidden="true" size={15} /></Link></div></header>
          {data.upcomingEvents.length ? <div className="divide-y divide-border/70">
            {todayEvents.length ? <div className="p-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{labels.eventsToday}</p><ul className="mt-3 space-y-2.5">{todayEvents.map((event) => { const Icon = eventIcon[event.type]; return <li className="flex items-center gap-3" key={event.id}><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground"><Icon aria-hidden="true" size={15} /></span><Link className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:text-primary hover:underline" href={`/employees/${event.employeeId}`}>{event.employeeName}</Link><span className="shrink-0 text-xs text-muted-foreground">{eventLabel[event.type]}{event.years ? ` · ${event.years} ${labels.eventYears}` : ''}</span></li> })}</ul></div> : null}
            {tomorrowEvents.length ? <div className="p-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{labels.eventsTomorrow}</p><ul className="mt-3 space-y-2.5">{tomorrowEvents.map((event) => { const Icon = eventIcon[event.type]; return <li className="flex items-center gap-3" key={event.id}><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground"><Icon aria-hidden="true" size={15} /></span><Link className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:text-primary hover:underline" href={`/employees/${event.employeeId}`}>{event.employeeName}</Link><span className="shrink-0 text-xs text-muted-foreground">{eventLabel[event.type]}{event.years ? ` · ${event.years} ${labels.eventYears}` : ''}</span></li> })}</ul></div> : null}
          </div> : <p className="p-6 text-center text-sm text-muted-foreground">{labels.eventsNoEvents}</p>}
        </section>

        {/* KPI-kaarten */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
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
        </div>
      </section>

        <aside className="space-y-4"><header><p className="eyebrow">{labels.yourPriorities}</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">{labels.prioritiesBody}</h2></header><article className="overflow-hidden rounded-[1.5rem] border bg-surface shadow-[0_1rem_2.5rem_color-mix(in_srgb,var(--primary)_8%,transparent)]"><div className="border-b bg-accent/45 p-5"><div className="flex items-start justify-between gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground"><CalendarDays aria-hidden="true" size={20} /></span><span className="rounded-full bg-surface px-2.5 py-1 text-xs font-bold tabular-nums text-accent-foreground">{data.reminders.length}</span></div><h3 className="mt-5 text-lg font-semibold">{labels.remindersTitle}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.remindersDescription}</p></div><div className="p-5">{data.reminders.length > 0 ? <ul className="divide-y divide-border/70">{data.reminders.slice(0, 4).map((reminder) => <li className="py-3 first:pt-0 last:pb-0" key={reminder.recipientId}><p className="font-semibold leading-5">{reminder.title}</p><time className="mt-1 block text-xs text-muted-foreground" dateTime={reminder.remindAt}>{formatDateTime(reminder.remindAt, { locale: dateLocale, dateFormat, timeFormat })}</time></li>)}</ul> : <div className="rounded-xl border border-dashed bg-background p-4 text-sm leading-6 text-muted-foreground"><CircleDashed aria-hidden="true" className="mb-2 text-success" size={20} />{labels.noReminders}</div>}<div className="mt-5 flex flex-wrap gap-3"><Link className="button-primary flex-1 gap-2" href="/reminders">{labels.openReminders}<ArrowRight aria-hidden="true" size={15} /></Link>{data.reminders.length > 4 ? <Link className="button-secondary" href="/reminders">{labels.moreReminders}</Link> : null}</div></div></article>

          <article className="rounded-[1.5rem] border border-dashed border-primary/25 bg-surface/75 p-5"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-primary"><Wrench aria-hidden="true" size={18} /></span><div><h3 className="font-semibold">{labels.workInProgress}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.workInProgressBody}</p></div></div><ul className="mt-5 grid gap-2">{futureItems.map((item) => <li className="flex items-center justify-between gap-3 rounded-xl bg-background px-3.5 py-3 text-sm" key={item}><span className="flex items-center gap-2.5"><BriefcaseBusiness aria-hidden="true" className="text-muted-foreground" size={15} />{item}</span><span className="text-xs font-medium text-muted-foreground">{labels.futureSource}</span></li>)}</ul></article></aside>
      </div>

      <section className="mt-8 flex flex-col gap-4 rounded-[1.5rem] border bg-surface/80 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><p className="text-sm font-semibold">{labels.quickLinks}</p><p className="mt-1 text-sm text-muted-foreground">{labels.dashboardHint}</p></div><div className="flex flex-wrap gap-2"><Link className="button-secondary gap-2" href="/dashboard"><LayoutDashboard aria-hidden="true" size={16} />{labels.openDashboard}</Link><Link className="button-secondary gap-2" href="/hr-calendar"><CalendarDays aria-hidden="true" size={16} />{labels.calendar}</Link><Link className="button-secondary gap-2" href="/insights"><BriefcaseBusiness aria-hidden="true" size={16} />{labels.insights}</Link></div></section>
    </main></div>
}
