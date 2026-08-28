import Link from 'next/link'
import { ArrowLeft, BarChart3, CheckCircle2, Download, LockKeyhole, Users } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { AuthorizationError } from '@/lib/auth/permissions'
import { ParticipantReminderButton } from '@/components/research/participant-reminder-button'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { ResearchError } from '@/lib/research/errors'
import { getResearchMonitorDetail, listResearchMonitor } from '@/lib/research/results-service'
import { DataTableShell } from '@/components/patterns/data-table-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { SectionHeader } from '@/components/patterns/section-header'
import { PageShell } from '@/components/layout/page-shell'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { buttonClasses } from '@/components/ui/button'

export default async function ResearchMonitorPage({ searchParams }: { searchParams: Promise<{ kind?: string; id?: string }> }) {
  const query = await searchParams
  const validKind = query.kind === 'survey' || query.kind === 'enps' ? query.kind : null
  let campaigns
  let detail = null
  try {
    campaigns = await listResearchMonitor()
    if (query.id && validKind) detail = await getResearchMonitorDetail(validKind, query.id)
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    if (error instanceof ResearchError && error.status === 404) notFound()
    throw error
  }
  const [t, locale] = await Promise.all([getTranslator('research'), getLocale()])
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' })
  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })

  return <PageShell className="py-8 sm:py-10" width="wide">
    <PageHeader actions={<Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/research"><ArrowLeft aria-hidden="true" size={16} />{t('monitor.back')}</Link>} className="mb-8" description={<><p className="eyebrow">{t('eyebrow')}</p><p className="mt-2 max-w-3xl text-base leading-7 text-muted-foreground">{t('monitor.subtitle')}</p></>} title={t('monitor.title')} />
    <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
      <Surface className="h-fit p-3 xl:sticky xl:top-6">
        <SectionHeader className="px-1 py-1" title={t('monitor.campaigns')} />
        <nav aria-label={t('monitor.campaigns')} className="mt-2 space-y-1">
          {campaigns.map((campaign) => {
            const selected = detail?.campaign.id === campaign.id && detail.campaign.kind === campaign.kind
            const percentage = campaign.invited ? Math.round((campaign.submitted / campaign.invited) * 100) : 0
            return <Link className={`block border border-transparent p-3 transition-colors hover:border-border-subtle hover:bg-surface-raised ${selected ? 'border-accent bg-accent text-accent-foreground' : ''}`} href={`/research/monitor?kind=${campaign.kind}&id=${campaign.id}`} key={`${campaign.kind}-${campaign.id}`}>
              <div className="flex items-center justify-between gap-2"><Badge className={selected ? 'border-accent-foreground/30 bg-accent text-accent-foreground' : ''} tone="info">{campaign.kind === 'enps' ? t('hub.enps') : t('hub.survey')}</Badge><span className="text-xs font-semibold text-muted-foreground">{percentage}%</span></div>
              <p className="mt-2 text-sm font-semibold leading-5">{campaign.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t(`status.${campaign.status}`)} · {date.format(new Date(campaign.startsAt))}</p>
            </Link>
          })}
          {campaigns.length === 0 ? <p className="px-1 py-5 text-sm text-muted-foreground">{t('settings.empty')}</p> : null}
        </nav>
      </Surface>

      {!detail ? <EmptyState className="min-h-80" icon={<BarChart3 />} title={t('monitor.noSelection')} /> : <div className="min-w-0 space-y-6">
        <Surface className="p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0"><div className="flex flex-wrap gap-2"><Badge tone="info">{detail.campaign.kind === 'enps' ? t('hub.enps') : t('hub.survey')}</Badge><Badge tone={detail.campaign.status === 'ACTIVE' ? 'success' : detail.campaign.status === 'CLOSED' ? 'neutral' : 'warning'}>{t(`status.${detail.campaign.status}`)}</Badge>{detail.campaign.anonymous ? <Badge tone="neutral"><LockKeyhole aria-hidden="true" size={12} />{t('hub.anonymous')}</Badge> : null}</div><h2 className="mt-3 text-2xl font-semibold tracking-tight">{detail.campaign.title}</h2><p className="mt-2 text-sm text-muted-foreground">{date.format(new Date(detail.campaign.startsAt))} – {date.format(new Date(detail.campaign.endsAt))}</p></div>
            {detail.campaign.kind === 'survey' && detail.canReadResults ? <a className={buttonClasses({ size: 'sm', variant: 'secondary' })} href={`/api/research/export/survey/${detail.campaign.id}`}><Download aria-hidden="true" size={16} />{t('monitor.download')}</a> : null}
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3"><Metric icon={<Users size={18} />} label={t('settings.invited', { count: detail.campaign.invited })} value={detail.campaign.invited} /><Metric icon={<CheckCircle2 size={18} />} label={t('monitor.submitted')} value={detail.campaign.submitted} /><Metric icon={<BarChart3 size={18} />} label={t('monitor.participation')} value={`${detail.campaign.invited ? Math.round((detail.campaign.submitted / detail.campaign.invited) * 100) : 0}%`} /></div>
        </Surface>

        <Surface className="p-5 sm:p-7">
          <SectionHeader title={t('monitor.participants')} />
          {detail.participants.length ? <DataTableShell caption={t('monitor.participants')} className="mt-5"><thead><tr className="border-b border-border-subtle text-xs uppercase tracking-[0.1em] text-muted-foreground"><th className="px-3 py-3 font-semibold">{t('monitor.name')}</th><th className="px-3 py-3 font-semibold">{t('monitor.department')}</th><th className="px-3 py-3 font-semibold">{t('monitor.jobTitle')}</th><th className="px-3 py-3 font-semibold">{t('monitor.participation')}</th><th className="px-3 py-3 font-semibold">{t('monitor.lastReminder')}</th><th className="px-3 py-3 font-semibold">{t('monitor.action')}</th></tr></thead><tbody>{detail.participants.map((participant) => <tr className="border-b border-border-subtle last:border-0" key={participant.employeeId}><td className="px-3 py-3 font-medium">{participant.name}<span className="ml-2 text-xs text-muted-foreground">{participant.employeeNumber}</span></td><td className="px-3 py-3 text-muted-foreground">{participant.department}</td><td className="px-3 py-3 text-muted-foreground">{participant.jobTitle}</td><td className="px-3 py-3"><Badge tone={participant.submitted ? 'success' : 'neutral'}>{participant.submitted ? t('monitor.submitted') : t('monitor.notSubmitted')}</Badge></td><td className="px-3 py-3 text-muted-foreground">{participant.lastRemindedAt ? dateTime.format(new Date(participant.lastRemindedAt)) : '—'}</td><td className="px-3 py-3">{!participant.submitted && detail.campaign.status === 'ACTIVE' ? <ParticipantReminderButton campaignId={detail.campaign.id} employeeId={participant.employeeId} kind={detail.campaign.kind} labels={{ remind: t('monitor.remindParticipant'), sent: t('monitor.reminderSent'), failed: t('monitor.reminderFailed') }} /> : '—'}</td></tr>)}</tbody></DataTableShell> : <p className="mt-4 text-sm text-muted-foreground">{t('monitor.noParticipants')}</p>}
        </Surface>

        <Surface className="p-5 sm:p-7">
          <SectionHeader title={t('monitor.results')} />
          {!detail.canReadResults ? <EmptyState className="mt-5" icon={<LockKeyhole />} title={t('monitor.resultsRestricted')} /> : detail.campaign.kind === 'enps' ? <EnpsResults detail={detail} t={t} /> : <SurveyResults detail={detail} t={t} />}
        </Surface>
      </div>}
    </div>
  </PageShell>
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) { return <Surface className="p-4" variant="subtle"><span className="text-primary">{icon}</span><p className="mt-3 text-2xl font-semibold">{value}</p><p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p></Surface> }

type Detail = Awaited<ReturnType<typeof getResearchMonitorDetail>>
type Translate = Awaited<ReturnType<typeof getTranslator>>

function EnpsResults({ detail, t }: { detail: Detail; t: Translate }) {
  if (!detail.enpsVisible) return <EmptyState className="mt-5" icon={<LockKeyhole />} title={t('monitor.privacyThresholdTitle')} description={t('monitor.privacyThresholdDescription')} />
  const enps = detail.enps
  const benchmark = enps?.score === null || enps?.score === undefined ? null : enps.score <= 0 ? t('monitor.benchmarkCritical') : enps.score <= 10 ? t('monitor.benchmarkFair') : enps.score <= 30 ? t('monitor.benchmarkGood') : enps.score <= 50 ? t('monitor.benchmarkExcellent') : t('monitor.benchmarkWorldClass')
  return <div className="mt-5 space-y-6">{enps ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Surface className="border-primary/20 bg-accent p-4" variant="subtle"><div className="grid size-20 place-items-center rounded-full border-4 border-primary bg-background text-3xl font-semibold text-primary">{enps.score === null ? '—' : `${enps.score > 0 ? '+' : ''}${enps.score}`}</div><p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-primary">{t('monitor.enpsScore')}</p>{benchmark ? <p className="mt-1 text-sm font-medium">{benchmark}</p> : null}</Surface><Metric icon={<CheckCircle2 size={18} />} label={t('monitor.promoters')} value={`${enps.promoterPercentage}% · ${enps.promoters}`} /><Metric icon={<Users size={18} />} label={t('monitor.passives')} value={`${enps.passivePercentage}% · ${enps.passives}`} /><Metric icon={<Users size={18} />} label={t('monitor.detractors')} value={`${enps.detractorPercentage}% · ${enps.detractors}`} /></div> : null}{detail.driverScores.length ? <div><h3 className="font-semibold">{t('monitor.drivers')}</h3><div className="mt-3 space-y-3">{detail.driverScores.map((driver, index) => { const isBest = index === 0; const isLowest = index === detail.driverScores.length - 1 && detail.driverScores.length > 1; return <Surface className={`${isBest ? 'border-success/30 bg-success-surface' : isLowest ? 'border-warning/30 bg-warning-surface' : 'bg-background'} p-4`} key={driver.category} variant="subtle"><div className="flex justify-between gap-4 text-sm"><span className="font-medium">{driver.category}</span><span className={`font-semibold ${isBest ? 'text-success' : isLowest ? 'text-warning' : 'text-primary'}`}>{driver.average.toFixed(1)} / {driver.maximum}</span></div><div className="mt-2 h-2 rounded-full bg-muted"><div className={`h-full rounded-full ${isBest ? 'bg-success' : isLowest ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${Math.min(100, (driver.average / driver.maximum) * 100)}%` }} /></div><p className="mt-2 text-xs text-muted-foreground">{t('monitor.answers', { count: driver.responseCount })}</p></Surface> })}</div></div> : null}{detail.enpsQuestionResults.length ? <div><h3 className="font-semibold">{t('monitor.questionDetails')}</h3><div className="mt-3 space-y-3">{detail.enpsQuestionResults.map((result) => <details className="group border border-border-subtle bg-background p-4" key={result.questionId}><summary className="cursor-pointer list-none"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">{result.category}</p><p className="mt-1 font-medium leading-6">{result.text}</p></div>{result.average !== null && result.maximum !== null ? <Badge tone="info">{result.average.toFixed(1)} / {result.maximum}</Badge> : null}</div></summary><ResultBars values={result.distribution.map((value) => ({ ...value, label: value.label === 'YES' ? t('response.yes') : value.label === 'NO' ? t('response.no') : value.label }))} /></details>)}</div></div> : null}{detail.comments.length ? <div><h3 className="font-semibold">{t('monitor.comments')}</h3><div className="mt-3 space-y-3">{detail.comments.map((comment, index) => <blockquote className="border-l-4 border-primary bg-muted/40 p-4 text-sm leading-6" key={`${comment.question}-${index}`}><p>{comment.value}</p><footer className="mt-2 text-xs text-muted-foreground">{comment.question}</footer></blockquote>)}</div></div> : null}</div>
}

function SurveyResults({ detail, t }: { detail: Detail; t: Translate }) {
  return <div className="mt-5 space-y-4">{detail.surveyResults.map((result) => <article className="border border-border-subtle bg-background p-5" key={result.questionId}><div className="flex flex-wrap items-start justify-between gap-3"><h3 className="font-semibold leading-6">{result.text}</h3><Badge tone="neutral">{t('monitor.answers', { count: result.totalAnswers })}</Badge></div>{result.numeric ? <div className="mt-4 grid gap-2 sm:grid-cols-4"><NumericMetric label={t('monitor.average', { value: result.numeric.average?.toFixed(1) ?? '—' })} /><NumericMetric label={t('monitor.minimum', { value: result.numeric.minimum ?? '—' })} /><NumericMetric label={t('monitor.maximum', { value: result.numeric.maximum ?? '—' })} /><NumericMetric label={t('monitor.sum', { value: result.numeric.sum ?? '—' })} /></div> : null}{result.options.length ? <div className="mt-4 grid items-center gap-6 lg:grid-cols-[12rem_1fr]"><ResultPie label={t('monitor.distribution')} values={result.options} /><ResultBars values={result.options} /></div> : null}{result.matrix.length ? <div className="mt-4 space-y-5">{result.matrix.map((row) => <div key={row.row}><p className="text-sm font-semibold">{row.row}</p><ResultStackedBar values={row.options} /></div>)}</div> : null}{result.comments.length ? <div className="mt-4 space-y-2">{result.comments.map((comment, index) => <p className="border border-border-subtle bg-muted/50 p-3 text-sm leading-6" key={index}>{comment}</p>)}</div> : null}</article>)}{detail.surveyResults.length === 0 ? <p className="text-sm text-muted-foreground">{t('settings.empty')}</p> : null}</div>
}

function NumericMetric({ label }: { label: string }) { return <Surface className="px-3 py-2 text-sm font-semibold text-primary" variant="subtle">{label}</Surface> }

function ResultBars({ values }: { values: Array<{ label: string; count: number; percentage: number }> }) { return <div className="mt-4 space-y-3">{values.map((value) => <div key={value.label}><div className="flex justify-between gap-3 text-xs font-medium"><span>{value.label}</span><span>{value.count} · {value.percentage}%</span></div><div className="mt-1.5 h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${value.percentage}%` }} /></div></div>)}</div> }

const chartColors = ['var(--primary)', 'var(--success)', 'var(--warning)', 'var(--destructive)', 'var(--muted-foreground)', 'var(--accent-foreground)']

function ResultPie({ label, values }: { label: string; values: Array<{ label: string; count: number; percentage: number }> }) {
  const segments = values.map((value, index) => {
    const start = values.slice(0, index).reduce((total, current) => total + current.percentage, 0)
    const end = start + value.percentage
    return `${chartColors[index % chartColors.length]} ${start}% ${end}%`
  })
  return <div aria-label={`${label}: ${values.map((value) => `${value.label} ${value.percentage}%`).join(', ')}`} className="mx-auto grid size-40 place-items-center rounded-full" role="img" style={{ background: segments.length ? `conic-gradient(${segments.join(', ')})` : 'var(--muted)' }}><div className="size-20 rounded-full bg-background" /></div>
}

function ResultStackedBar({ values }: { values: Array<{ label: string; count: number; percentage: number }> }) {
  return <div className="mt-2"><div className="flex h-3 overflow-hidden rounded-full bg-muted">{values.map((value, index) => <div aria-hidden="true" key={value.label} style={{ background: chartColors[index % chartColors.length], width: `${value.percentage}%` }} />)}</div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">{values.map((value, index) => <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" key={value.label}><span aria-hidden="true" className="size-2 rounded-full" style={{ background: chartColors[index % chartColors.length] }} />{value.label}: {value.count} · {value.percentage}%</span>)}</div></div>
}
