import Link from 'next/link'
import { ArrowRight, BriefcaseBusiness, CalendarDays, CheckCircle2, ChevronRight, ClipboardList, FileText, Route, ShieldCheck, UserRound, UsersRound, type LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/patterns/page-header'
import { SectionHeader } from '@/components/patterns/section-header'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { daysUntil } from '@/lib/focus/access-state'
import type { FocusActionKey } from '@/lib/focus/service'
import { journeyProgressPercent, localizedValue } from '@/lib/journeys/projection-domain'
import { focusDate, isPreboardingFocus, visibleFocusActions } from './focus-view'
import type { FocusPageData } from './load-focus-page'
import { FocusPresentation } from './focus-presentation'
import { FocusShell } from './focus-shell'

const actionIcons: Record<FocusActionKey, LucideIcon> = {
  journey: Route, profile: UserRound, documents: FileText, leave: CalendarDays,
  requests: ClipboardList, work: BriefcaseBusiness, team: UsersRound,
}

export function FocusJourneyCard({ data, locale, t, journeyTitle, journeyActionHref }: FocusPageData) {
  const journey = data.journey
  if (!journey) return null
  const nextAction = journey.nextAction
  const available = nextAction?.availability === 'AVAILABLE'
  const progress = journeyProgressPercent(journey.progress)

  return (
    <Surface className="space-y-4 p-4 sm:p-6">
      <SectionHeader
        title={journeyTitle || t('journey.title')}
        description={t('journey.description')}
        actions={<Badge tone={journey.status === 'ACTIVE' ? 'info' : 'neutral'}>{t(`journey.status.${journey.status}`)}</Badge>}
      />
      <div className="space-y-2">
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <span id="focus-journey-progress">{t('journey.progress')}</span>
          <span className="tabular-nums text-muted-foreground">{t('journey.completed', journey.progress)}</span>
        </div>
        <progress aria-labelledby="focus-journey-progress" className="block h-2 w-full accent-primary" max={100} value={progress} />
      </div>
      {nextAction ? (
        <div className="space-y-2 border-t border-subtle pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">{t('journey.nextAction')}</span>
            <Badge tone={available ? 'success' : 'neutral'}>{t(available ? 'journey.available' : 'journey.upcoming')}</Badge>
          </div>
          <h3 className="font-semibold text-foreground">{localizedValue(nextAction.title, locale)}</h3>
          {available ? null : <p className="text-sm text-muted-foreground">{t('journey.availableOn', { date: focusDate(nextAction.availableOn, locale) })}</p>}
        </div>
      ) : (
        <p className="flex items-start gap-2 text-sm text-muted-foreground"><CheckCircle2 aria-hidden="true" className="size-5 shrink-0" />{t('journey.noNextAction')}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {journeyActionHref ? <Link className={buttonClasses({ className: 'whitespace-normal text-left' })} href={journeyActionHref} prefetch={false}>{t('journey.openAction')}<ArrowRight aria-hidden="true" /></Link> : null}
        <Link className={buttonClasses({ variant: journeyActionHref ? 'secondary' : 'primary', className: 'whitespace-normal text-left' })} href={`/journeys/${journey.id}`} prefetch={false}>{t('journey.openJourney')}<ChevronRight aria-hidden="true" /></Link>
      </div>
    </Surface>
  )
}

export function FocusHome(props: FocusPageData) {
  const { data, locale, t, today } = props
  const preboarding = isPreboardingFocus(data)
  const actions = visibleFocusActions(data)
  const startDate = data.employee?.effectiveEmploymentStartDate
  const dayOne = !preboarding && data.experience !== 'NO_EMPLOYMENT' && startDate === today
  const hasJourney = data.journey && actions.some((action) => action.key === 'journey')

  return (
    <FocusShell actions={actions} labels={{ product: t('nav.product'), home: t('nav.home'), menu: t('nav.menu'), actions: {
      journey: t('actions.journey.title'), profile: t('actions.profile.title'), documents: t('actions.documents.title'), leave: t('actions.leave.title'), requests: t('actions.requests.title'), work: t('actions.work.title'), team: t('actions.team.title'),
    } }}>
        <PageHeader
          title={data.employee ? t(preboarding ? 'home.welcome' : 'home.hello', { name: data.employee.name }) : t('home.title')}
          description={<time dateTime={today}>{focusDate(today, locale)}</time>}
          actions={<FocusPresentation canOpenFull={data.canOpenFull} isPreboarding={preboarding} presentation={data.presentation} labels={{ label: t('presentation.label'), focus: t('presentation.focus'), full: t('presentation.full') }} />}
        />

        {data.experience === 'NO_EMPLOYMENT' ? (
          <EmptyState icon={<UserRound />} title={t('home.noEmploymentTitle')} description={t('home.noEmploymentDescription')} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={preboarding ? 'info' : 'neutral'}>{t(`experience.${data.experience}`)}</Badge>
              <p className="text-sm text-muted-foreground">{t(preboarding ? 'home.preboardingDescription' : data.experience === 'MANAGER' ? 'home.managerDescription' : 'home.employeeDescription')}</p>
            </div>

            {preboarding || dayOne ? (
              <Surface className="flex items-start gap-3 p-4 sm:p-6" variant="subtle">
                <CalendarDays aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-primary" />
                <div className="min-w-0 space-y-2">
                  <h2 className="text-lg font-semibold">{dayOne ? t('start.dayOneTitle') : startDate ? t('start.futureTitle', { date: focusDate(startDate, locale) }) : t('start.unknownTitle')}</h2>
                  <p className="text-sm text-muted-foreground">{dayOne ? t('start.dayOneDescription') : startDate ? t(daysUntil(startDate, today) === 1 ? 'start.oneDay' : 'start.countdown', { days: daysUntil(startDate, today) }) : t('start.unknownDescription')}</p>
                  {preboarding ? <p className="flex items-start gap-2 text-sm text-muted-foreground"><ShieldCheck aria-hidden="true" className="size-5 shrink-0" />{t('start.limitedAccess')}</p> : null}
                </div>
              </Surface>
            ) : null}

            <div className="grid min-w-0 gap-6 lg:grid-cols-2">
              <section aria-label={t('home.nextUp')} className="min-w-0 space-y-4">
                <SectionHeader title={t('home.nextUp')} />
                {hasJourney ? <FocusJourneyCard {...props} /> : <EmptyState icon={<Route />} title={t('journey.emptyTitle')} description={t(preboarding ? 'journey.preboardingEmptyDescription' : 'journey.emptyDescription')} />}
              </section>
              <section aria-label={t('home.quickActions')} className="min-w-0 space-y-4">
                <SectionHeader title={t('home.quickActions')} />
                {actions.length ? (
                  <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {actions.map((action) => {
                      const Icon = actionIcons[action.key]
                      return <li className="min-w-0" key={action.key}><Link className="block h-full rounded-[var(--radius-surface)] transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={action.href} prefetch={false}><Surface className="h-full space-y-3 p-4"><Icon aria-hidden="true" className="size-5 text-primary" /><div className="flex items-start justify-between gap-2"><div className="min-w-0"><span className="block font-semibold text-foreground">{t(`actions.${action.key}.title`)}</span><span className="mt-1 block text-sm text-muted-foreground">{t(`actions.${action.key}.description`)}</span></div><ChevronRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" /></div></Surface></Link></li>
                    })}
                  </ul>
                ) : <EmptyState title={t('home.noActionsTitle')} description={t('home.noActionsDescription')} />}
              </section>
            </div>
          </>
        )}
    </FocusShell>
  )
}
