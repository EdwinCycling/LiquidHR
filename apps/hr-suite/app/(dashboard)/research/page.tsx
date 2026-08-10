import Link from 'next/link'
import { ArrowRight, BarChart3, BellRing, CheckCircle2, ClipboardList, LockKeyhole, Settings2 } from 'lucide-react'
import { redirect } from 'next/navigation'
import { requireAuthContext } from '@/lib/auth/permissions'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { resolveResearchAccess } from '@/lib/research/access'
import { listMyResearchInvitations, type ResearchInvitationCard } from '@/lib/research/respondent-service'

function invitationState(invitation: ResearchInvitationCard) {
  const now = Date.now()
  if (invitation.submitted) return 'completed'
  if (invitation.status === 'CLOSED' || Date.parse(invitation.endsAt) < now) return 'closed'
  if (invitation.status === 'DRAFT' || Date.parse(invitation.startsAt) > now) return 'scheduled'
  return 'open'
}

export default async function ResearchHubPage() {
  const [context, t, locale] = await Promise.all([requireAuthContext(), getTranslator('research'), getLocale()])
  const access = resolveResearchAccess(context)
  if (!access.canOpenHub) redirect('/geen-toegang')
  const invitations = context.employeeId ? await listMyResearchInvitations() : []
  const open = invitations.filter((invitation) => invitationState(invitation) === 'open')
  const history = invitations.filter((invitation) => invitationState(invitation) !== 'open')
  const dateFormatter = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' })

  function card(invitation: ResearchInvitationCard) {
    const state = invitationState(invitation)
    const isOpen = state === 'open'
    return (
      <article className="group flex h-full flex-col rounded-3xl border bg-surface p-5 shadow-sm transition hover:border-primary/30 hover:shadow-md sm:p-6" key={`${invitation.kind}-${invitation.id}`}>
        <div className="flex items-start justify-between gap-4">
          <span className="grid size-11 place-items-center rounded-2xl bg-accent text-primary">
            {invitation.kind === 'enps' ? <BarChart3 aria-hidden="true" size={20} /> : <ClipboardList aria-hidden="true" size={20} />}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isOpen ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            {state === 'completed' ? t('hub.viewCompleted') : state === 'closed' ? t('hub.closed') : state === 'scheduled' ? t('hub.scheduled') : t('status.ACTIVE')}
          </span>
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">{invitation.kind === 'enps' ? t('hub.enps') : t('hub.survey')}</p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight">{invitation.title}</h3>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1"><LockKeyhole aria-hidden="true" size={13} />{invitation.anonymous ? t('hub.anonymous') : t('hub.named')}</span>
          <span className="rounded-full bg-muted px-2.5 py-1">{t('hub.until', { date: dateFormatter.format(new Date(invitation.endsAt)) })}</span>
          {isOpen && invitation.reminderCount > 0 ? <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-surface px-2.5 py-1 font-semibold text-warning"><BellRing aria-hidden="true" size={13} />{t('hub.reminder')}</span> : null}
        </div>
        <div className="mt-auto pt-6">
          {isOpen ? <Link className="button-primary w-full justify-center" href={`/research/respond/${invitation.kind}/${invitation.id}`}>{t('hub.answer')}<ArrowRight aria-hidden="true" size={16} /></Link> : <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><CheckCircle2 aria-hidden="true" size={17} />{state === 'completed' ? t('hub.viewCompleted') : state === 'closed' ? t('hub.closed') : t('hub.scheduled')}</div>}
        </div>
      </article>
    )
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
      <header className="overflow-hidden rounded-3xl border bg-primary text-primary-foreground shadow-[0_1.5rem_4rem_color-mix(in_srgb,var(--primary)_16%,transparent)]">
        <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-end lg:px-10 lg:py-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/75">{t('eyebrow')}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{t('hub.title')}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-primary-foreground/80 sm:text-base">{t('hub.subtitle')}</p>
          </div>
          <span className="w-fit rounded-2xl bg-primary-foreground/10 px-4 py-3 text-sm font-semibold ring-1 ring-primary-foreground/20">{t('hub.openCount', { count: open.length })}</span>
        </div>
      </header>

      {access.canManage || access.canMonitor ? <nav aria-label={t('eyebrow')} className="mt-6 flex flex-wrap gap-3">
        {access.canManage ? <Link className="button-secondary" href="/settings/research"><Settings2 aria-hidden="true" size={16} />{t('hub.manage')}</Link> : null}
        {access.canMonitor ? <Link className="button-secondary" href="/research/monitor"><BarChart3 aria-hidden="true" size={16} />{t('hub.monitor')}</Link> : null}
      </nav> : null}

      <section className="mt-10" aria-labelledby="open-research-title">
        <h2 className="text-xl font-semibold tracking-tight" id="open-research-title">{t('hub.openTitle')}</h2>
        {open.length ? <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{open.map(card)}</div> : <div className="mt-4 rounded-3xl border border-dashed bg-surface p-8 text-center"><CheckCircle2 aria-hidden="true" className="mx-auto text-primary" size={28} /><h3 className="mt-4 font-semibold">{t('hub.emptyTitle')}</h3><p className="mt-2 text-sm text-muted-foreground">{t('hub.emptyDescription')}</p></div>}
      </section>

      {history.length ? <section className="mt-10" aria-labelledby="research-history-title"><h2 className="text-xl font-semibold tracking-tight" id="research-history-title">{t('hub.historyTitle')}</h2><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{history.map(card)}</div></section> : null}
    </main>
  )
}
