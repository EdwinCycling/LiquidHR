import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import type { StartPageData } from '@/lib/startpage/service'

export interface StartPageTalentInsightsLabels {
  talentInsightsTitle: string
  talentInsightsDescription: string
  talentInsightsOpen: string
  talentInsightsScopeCompany: string
  talentInsightsScopeTeam: string
  talentInsightsEmployees: string
  talentInsightsAssessed: string
  talentInsightsCoverage: string
  talentInsightsHighHigh: string
  talentInsightsHighCritical: string
  talentInsightsHighCriticalThreshold: string
  talentInsightsSkillGaps: string
  talentInsightsDevelopmentActions: string
  talentInsightsNoData: string
  talentInsightsUnavailable: string
  talentInsightsOpenReport: string
}

function stateValue(state: 'ready' | 'unavailable' | 'no-data', value: string, labels: StartPageTalentInsightsLabels): string {
  return state === 'unavailable' ? labels.talentInsightsUnavailable : state === 'no-data' ? labels.talentInsightsNoData : value
}

export function TalentInsightsWindow({ data, labels }: { data: NonNullable<StartPageData['talentInsights']>; labels: StartPageTalentInsightsLabels }) {
  const scopeLabel = data.scope === 'team' ? labels.talentInsightsScopeTeam : labels.talentInsightsScopeCompany
  const coverageLabel = data.gridCoveragePercent === null ? labels.talentInsightsNoData : `${data.gridCoveragePercent}%`
  const skillGapLabel = data.topSkillGap ? `${data.topSkillGap.label} · ${data.topSkillGap.occurrences}` : labels.talentInsightsNoData

  const cards = [
    { label: labels.talentInsightsAssessed, value: `${data.assessedGrid}/${data.employeesInScope}`, href: data.links.topTalent, detail: labels.talentInsightsCoverage + ` · ${coverageLabel}` },
    { label: labels.talentInsightsHighHigh, value: String(data.highHighCount), href: data.links.topTalent, detail: labels.talentInsightsOpenReport },
    { label: labels.talentInsightsHighCritical, value: String(data.highCriticalCount), href: data.links.keyEmployees, detail: `${labels.talentInsightsHighCriticalThreshold} · ${data.highCriticalPercent === null ? labels.talentInsightsNoData : `${data.highCriticalPercent}%`}` },
    { label: labels.talentInsightsSkillGaps, value: stateValue(data.skillState, String(data.skillGapCount), labels), href: data.links.skills, detail: data.skillState === 'ready' ? skillGapLabel : labels.talentInsightsOpenReport },
    { label: labels.talentInsightsDevelopmentActions, value: stateValue(data.developmentState, String(data.openActionCount), labels), href: data.links.development, detail: labels.talentInsightsOpenReport },
  ]

  return <section aria-labelledby="startpage-talent-insights-title" className="mt-6 overflow-hidden rounded-[var(--radius-surface)] border bg-surface" data-testid="startpage-talent-insights">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-accent text-accent-foreground"><Sparkles aria-hidden="true" size={17} /></span><div className="min-w-0"><h2 className="text-base font-semibold" id="startpage-talent-insights-title">{labels.talentInsightsTitle}</h2><p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">{labels.talentInsightsDescription}</p></div></div>
      <Link className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-accent-foreground hover:underline" href={data.links.topTalent}>{labels.talentInsightsOpen}<ArrowRight aria-hidden="true" size={15} /></Link>
    </header>
    <p className="border-b bg-surface-subtle px-4 py-2 text-xs text-muted-foreground sm:px-5">{scopeLabel} · {data.employeesInScope} {labels.talentInsightsEmployees}</p>
    <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-5">
      {cards.map((card) => <Link className="group rounded-[var(--radius-control)] border border-border/80 bg-surface p-3 transition-colors hover:border-primary/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={card.href} key={card.label}>
        <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{card.value}</p>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{card.detail}</p>
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent-foreground group-hover:underline">{labels.talentInsightsOpenReport}<ArrowRight aria-hidden="true" size={13} /></span>
      </Link>)}
    </div>
  </section>
}
