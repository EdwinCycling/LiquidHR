import Link from 'next/link'
import { AlertTriangle, ArrowUpRight, BriefcaseBusiness, CheckCircle2, CircleX, GitBranch, Plus, Settings2, UsersRound } from 'lucide-react'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { SectionHeader } from '@/components/patterns/section-header'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import type { RecruitmentOverviewAnalytics } from '@/lib/recruitment/overview-service'
import type { VacancySummary } from '@/lib/recruitment/vacancy-service'

export interface RecruitmentOverviewLabels {
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly newVacancy: string
  readonly summaryTitle: string
  readonly vacancies: string
  readonly openVacancies: string
  readonly activeApplications: string
  readonly newApplications: string
  readonly applications: string
  readonly open: string
  readonly draft: string
  readonly closed: string
  readonly archived: string
  readonly vacancyListTitle: string
  readonly vacancyListDescription: string
  readonly pipelineTitle: string
  readonly pipelineDescription: string
  readonly openPipeline: string
  readonly openApplications: string
  readonly noApplications: string
  readonly hiredCount: string
  readonly rejectedCount: string
  readonly settings: string
  readonly assigned: string
  readonly empty: string
  readonly emptyDescription: string
  readonly noCandidateAccess: string
  readonly analyticsUnavailable: string
  readonly loadErrorTitle: string
  readonly loadErrorDescription: string
  readonly retry: string
  readonly notAvailable: string
}

interface RecruitmentOverviewDashboardProps {
  readonly analytics: RecruitmentOverviewAnalytics | null
  readonly analyticsError: boolean
  readonly canCreateVacancy: boolean
  readonly canManageSettings: boolean
  readonly canReadAssigned: boolean
  readonly loadError: boolean
  readonly vacancies: readonly VacancySummary[]
  readonly labels: RecruitmentOverviewLabels
}

function statusLabel(vacancy: VacancySummary, labels: RecruitmentOverviewLabels): { readonly label: string; readonly tone: BadgeTone } {
  if (vacancy.publication?.status === 'OPEN') return { label: labels.open, tone: 'success' }
  if (vacancy.status === 'DRAFT') return { label: labels.draft, tone: 'neutral' }
  if (vacancy.status === 'ARCHIVED') return { label: labels.archived, tone: 'warning' }
  return { label: labels.closed, tone: 'warning' }
}

function formatApplicationCount(count: number, labels: RecruitmentOverviewLabels): string {
  return count === 0 ? labels.noApplications : `${count} ${labels.openApplications}`
}

export function RecruitmentOverviewDashboard({ analytics, analyticsError, canCreateVacancy, canManageSettings, canReadAssigned, loadError, vacancies, labels }: RecruitmentOverviewDashboardProps) {
  const analyticsByVacancy = new Map((analytics?.byVacancy ?? []).map((item) => [item.vacancyId, item]))
  const openVacancies = analytics?.global.openVacancies ?? vacancies.filter((vacancy) => vacancy.status === 'ACTIVE').length
  const activeApplications = analytics?.global.activeApplications ?? vacancies.reduce((total, vacancy) => total + vacancy.activeApplicationCount, 0)
  const summaryMetrics = [
    { label: labels.vacancies, value: vacancies.length, icon: BriefcaseBusiness },
    { label: labels.openVacancies, value: openVacancies, icon: CheckCircle2 },
    { label: labels.activeApplications, value: activeApplications, icon: UsersRound },
    ...(analytics ? [{ label: labels.newApplications, value: analytics.global.newApplications, icon: GitBranch }] : []),
  ]

  return (
    <PageShell width="wide" className="py-6 lg:py-8">
      <div className="space-y-8">
        <PageHeader
          title={labels.title}
          description={labels.description}
          actions={canCreateVacancy ? <Link className={buttonClasses({ className: 'gap-2' })} href="/recruitment/vacancies/new"><Plus aria-hidden="true" />{labels.newVacancy}</Link> : undefined}
        />

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="eyebrow">{labels.eyebrow}</span>
          <span aria-hidden="true">/</span>
          <span>{labels.summaryTitle}</span>
        </div>

        {loadError ? (
          <Surface className="border-destructive/50 bg-destructive-surface p-5" role="alert">
            <div className="flex items-start gap-3">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div className="min-w-0">
                <h2 className="font-semibold text-foreground">{labels.loadErrorTitle}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{labels.loadErrorDescription}</p>
                <Link className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'mt-4' })} href="/recruitment">{labels.retry}</Link>
              </div>
            </div>
          </Surface>
        ) : (
          <>
            <Surface aria-labelledby="recruitment-summary-title" className="overflow-hidden">
              <div className="border-b border-border-subtle px-4 py-4 sm:px-5">
                <h2 className="text-base font-semibold" id="recruitment-summary-title">{labels.summaryTitle}</h2>
              </div>
              <dl className={`grid divide-y divide-border-subtle sm:divide-x sm:divide-y-0 ${summaryMetrics.length === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
                {summaryMetrics.map(({ icon: Icon, label, value }) => (
                  <div className="flex items-center gap-3 px-4 py-4 sm:block sm:px-5" key={label}>
                    <Icon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground sm:mb-3" />
                    <div>
                      <dt className="text-sm text-muted-foreground">{label}</dt>
                      <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </Surface>

            {analyticsError ? (
              <Surface className="border-warning/60 bg-warning-surface p-4" role="status">
                <div className="flex items-start gap-3 text-sm">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
                  <p className="text-muted-foreground">{labels.analyticsUnavailable}</p>
                </div>
              </Surface>
            ) : null}

            {!analytics && !analyticsError ? <p className="text-sm text-muted-foreground">{labels.noCandidateAccess}</p> : null}

            <section aria-labelledby="recruitment-vacancies-title" className="space-y-4">
              <SectionHeader
                description={labels.vacancyListDescription}
                title={<span id="recruitment-vacancies-title">{labels.vacancyListTitle}</span>}
                actions={<div className="flex flex-wrap gap-2">
                  {canReadAssigned ? <Link className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'gap-2' })} href="/recruitment/assigned"><UsersRound aria-hidden="true" />{labels.assigned}</Link> : null}
                  {canManageSettings ? <Link className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'gap-2' })} href="/settings/recruitment"><Settings2 aria-hidden="true" />{labels.settings}</Link> : null}
                </div>}
              />
              {vacancies.length === 0 ? (
                <EmptyState
                  description={labels.emptyDescription}
                  icon={<BriefcaseBusiness />}
                  title={labels.empty}
                  actions={canCreateVacancy ? <Link className={buttonClasses({ size: 'sm' })} href="/recruitment/vacancies/new"><Plus aria-hidden="true" />{labels.newVacancy}</Link> : undefined}
                />
              ) : (
                <Surface className="overflow-hidden">
                  <div className="divide-y divide-border-subtle">
                    {vacancies.map((vacancy) => {
                      const status = statusLabel(vacancy, labels)
                      const summary = analyticsByVacancy.get(vacancy.id)
                      return (
                        <article className="min-w-0 px-4 py-5 sm:px-5" key={vacancy.id}>
                          <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <Link className="min-w-0 break-words text-base font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={`/recruitment/vacancies/${vacancy.id}`}>{vacancy.title}</Link>
                                <Badge tone={status.tone}>{status.label}</Badge>
                              </div>
                              <p className="mt-2 text-sm text-muted-foreground">{vacancy.locationLabel || labels.notAvailable}</p>
                            </div>
                            <div className="grid min-w-0 flex-1 gap-3 text-sm sm:grid-cols-3 lg:max-w-2xl">
                              <div className="min-w-0">
                                <p className="text-muted-foreground">{labels.applications}</p>
                                <p className="mt-1 font-semibold tabular-nums">{summary?.totalApplications ?? vacancy.applicationCount}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{formatApplicationCount(vacancy.activeApplicationCount, labels)}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-muted-foreground">{labels.newApplications}</p>
                                <p className="mt-1 font-semibold tabular-nums">{summary?.newApplications ?? labels.notAvailable}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-muted-foreground">{labels.pipelineTitle}</p>
                                {summary ? <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><CheckCircle2 aria-hidden="true" className="size-3.5 text-success" />{labels.hiredCount.replace('{count}', String(summary.hired))}</span><span className="inline-flex items-center gap-1"><CircleX aria-hidden="true" className="size-3.5 text-destructive" />{labels.rejectedCount.replace('{count}', String(summary.rejected))}</span></p> : <p className="mt-1 text-xs text-muted-foreground">{labels.noCandidateAccess}</p>}
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-2">
                              <Link aria-label={`${labels.openPipeline}: ${vacancy.title}`} className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'gap-2' })} href={`/recruitment/vacancies/${vacancy.id}`}><GitBranch aria-hidden="true" />{labels.openPipeline}<ArrowUpRight aria-hidden="true" /></Link>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </Surface>
              )}
            </section>
          </>
        )}
      </div>
    </PageShell>
  )
}
