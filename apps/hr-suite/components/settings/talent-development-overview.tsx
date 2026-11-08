'use client'

import Link from 'next/link'
import { Surface } from '@/components/ui/surface'
import type { StarPerformersInsights } from '@/lib/star-performers/insights-service'

export function TalentDevelopmentOverview({ data, labels }: { data: StarPerformersInsights; labels: Record<string, string> }) {
  return <section aria-labelledby="talent-development-overview" className="my-5 space-y-3">
      <h2 id="talent-development-overview" className="text-lg font-semibold">{labels.title}</h2>
      <p className="text-sm text-muted-foreground">{labels.description}</p>
      <div className="grid gap-3 md:grid-cols-3">
        <Surface className="p-4"><h3 className="font-semibold">{labels.plans}</h3>{data.development.sources.plans ? <><p className="mt-2 text-sm">{labels.activePlans}: {data.development.activePlansCount}</p><p className="text-sm">{labels.averageProgress}: {data.development.averageProgress === null ? '—' : `${data.development.averageProgress}%`}</p><Link className="mt-2 inline-block text-sm text-primary underline" href="/workforce/talent/goals">{labels.openPlans}</Link></> : <p className="mt-2 text-sm">{labels.unavailable}</p>}</Surface>
        <Surface className="p-4"><h3 className="font-semibold">{labels.skills}</h3>{data.skillGaps.state === 'unavailable' ? <p className="mt-2 text-sm">{labels.unavailable}</p> : data.skillGaps.state === 'no-data' ? <p className="mt-2 text-sm">{labels.noSkills}</p> : <><p className="mt-2 text-sm">{labels.assessed}: {data.skillGaps.assessedEmployees}</p><p className="text-sm">{labels.notAssessed}: {data.skillGaps.rows.reduce((sum, row) => sum + row.statusCounts.NOT_ASSESSED, 0)}</p><p className="text-sm">{labels.expiredEvidence}: {data.skillGaps.rows.reduce((sum, row) => sum + row.statusCounts.EXPIRED_EVIDENCE, 0)}</p></>}<Link className="mt-2 inline-block text-sm text-primary underline" href="/workforce/talent/reports/star-performers?report=skill-gaps">{labels.openSkills}</Link></Surface>
        <Surface className="p-4"><h3 className="font-semibold">{labels.conversations}</h3>{data.appraisal.sources.items ? <><p className="mt-2 text-sm">{labels.noConversation}: {data.appraisal.noConversationEmployees}</p><p className="text-sm">{labels.overdueFollowUp}: {data.appraisal.overdueFollowUpCount}</p></> : <p className="mt-2 text-sm">{labels.unavailable}</p>}<Link className="mt-2 inline-block text-sm text-primary underline" href="/workforce/talent/reports/star-performers?report=appraisal">{labels.openConversations}</Link></Surface>
      </div>
      <p className="text-xs text-muted-foreground">{labels.limits}</p>
    </section>
}
