import Link from 'next/link'
import { ArrowRight, BarChart3, BellRing, CheckCircle2, ClipboardList, LockKeyhole, Settings2 } from 'lucide-react'
import { redirect } from 'next/navigation'
import { buttonClasses } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { PageHeader } from '@/components/patterns/page-header'
import { SectionHeader } from '@/components/patterns/section-header'
import { PageShell } from '@/components/layout/page-shell'
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
    return <Surface className="group flex h-full flex-col p-5 transition-colors hover:border-primary/30 sm:p-6" key={`${invitation.kind}-${invitation.id}`}>
      <div className="flex items-start justify-between gap-4"><span aria-hidden="true" className="grid size-11 place-items-center rounded-[var(--radius-control)] bg-accent text-primary">{invitation.kind === 'enps' ? <BarChart3 size={20} /> : <ClipboardList size={20} />}</span><Badge tone={isOpen ? 'success' : 'neutral'}>{state === 'completed' ? t('hub.viewCompleted') : state === 'closed' ? t('hub.closed') : state === 'scheduled' ? t('hub.scheduled') : t('status.ACTIVE')}</Badge></div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">{invitation.kind === 'enps' ? t('hub.enps') : t('hub.survey')}</p>
      <h3 className="mt-2 text-xl font-semibold tracking-tight">{invitation.title}</h3>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-muted-foreground"><Badge tone="neutral"><LockKeyhole aria-hidden="true" size={13} />{invitation.anonymous ? t('hub.anonymous') : t('hub.named')}</Badge><Badge tone="neutral">{t('hub.until', { date: dateFormatter.format(new Date(invitation.endsAt)) })}</Badge>{isOpen && invitation.reminderCount > 0 ? <Badge tone="warning"><BellRing aria-hidden="true" size={13} />{t('hub.reminder')}</Badge> : null}</div>
      <div className="mt-auto pt-6">{isOpen ? <Link className={buttonClasses({ className: 'w-full justify-center', variant: 'primary' })} href={`/research/respond/${invitation.kind}/${invitation.id}`}>{t('hub.answer')}<ArrowRight aria-hidden="true" size={16} /></Link> : <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><CheckCircle2 aria-hidden="true" size={17} />{state === 'completed' ? t('hub.viewCompleted') : state === 'closed' ? t('hub.closed') : t('hub.scheduled')}</div>}</div>
    </Surface>
  }

  return <PageShell className="py-8 sm:py-10" width="standard">
    <PageHeader actions={<Badge className="w-fit" tone="info">{t('hub.openCount', { count: open.length })}</Badge>} description={<><p className="eyebrow">{t('eyebrow')}</p><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{t('hub.subtitle')}</p></>} title={t('hub.title')} />
    {access.canManage || access.canMonitor ? <nav aria-label={t('eyebrow')} className="mt-6 flex flex-wrap gap-3">{access.canManage ? <Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/settings/research"><Settings2 aria-hidden="true" size={16} />{t('hub.manage')}</Link> : null}{access.canMonitor ? <Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/research/monitor"><BarChart3 aria-hidden="true" size={16} />{t('hub.monitor')}</Link> : null}</nav> : null}
    <section aria-labelledby="open-research-title" className="mt-10"><SectionHeader title={<span id="open-research-title">{t('hub.openTitle')}</span>} />{open.length ? <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{open.map(card)}</div> : <EmptyState className="mt-4" icon={<CheckCircle2 />} title={t('hub.emptyTitle')} description={t('hub.emptyDescription')} />}</section>
    {history.length ? <section aria-labelledby="research-history-title" className="mt-10"><SectionHeader title={<span id="research-history-title">{t('hub.historyTitle')}</span>} /><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{history.map(card)}</div></section> : null}
  </PageShell>
}
