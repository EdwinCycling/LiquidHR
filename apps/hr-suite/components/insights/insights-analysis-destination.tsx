import { BarChart3, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Surface } from '@/components/ui/surface'
import { ANALYSIS_HUB_ROUTE } from '@/lib/insights/analysis-contract'

export interface InsightsAnalysisDestinationLabels {
  title: string
  description: string
  active: string
  open: string
}

export function InsightsAnalysisDestination({ labels }: { labels: InsightsAnalysisDestinationLabels }) {
  return (
    <Surface className="p-0">
      <Link className="group flex items-start gap-4 rounded-[var(--radius-surface)] p-5 transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" data-insights-destination="analysis" href={ANALYSIS_HUB_ROUTE}>
        <span className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-control)] bg-accent text-primary">
          <BarChart3 aria-hidden="true" size={21} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold">{labels.title}</span>
            <Badge tone="success">{labels.active}</Badge>
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">{labels.description}</span>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">{labels.open}<ChevronRight aria-hidden="true" size={16} /></span>
        </span>
      </Link>
    </Surface>
  )
}
