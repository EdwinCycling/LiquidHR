import { Compass, FileText, FolderOpen, MessageSquareText } from 'lucide-react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { Badge } from '@/components/ui/badge'
import { Surface } from '@/components/ui/surface'

export interface AnalysisHubLabels {
  eyebrow: string
  title: string
  intro: string
  newAnalysisTitle: string
  newAnalysisDescription: string
  exploreTitle: string
  exploreDescription: string
  myAnalysesTitle: string
  myAnalysesDescription: string
  reportsTitle: string
  reportsDescription: string
  planned: string
  active: string
  openExplore: string
  openMyAnalyses: string
  openReports: string
}

type AnalysisHubTile = {
  id: 'new-analysis' | 'explore' | 'my-analyses' | 'reports'
  title: string
  description: string
  status: 'PLANNED' | 'ACTIVE'
  statusLabel: string
  icon: LucideIcon
  href?: string
  actionLabel?: string
}

export function AnalysisHub({ labels }: { labels: AnalysisHubLabels }) {
  const tiles: readonly AnalysisHubTile[] = [
    { id: 'new-analysis', title: labels.newAnalysisTitle, description: labels.newAnalysisDescription, status: 'PLANNED', statusLabel: labels.planned, icon: MessageSquareText },
    { id: 'explore', title: labels.exploreTitle, description: labels.exploreDescription, status: 'ACTIVE', statusLabel: labels.active, icon: Compass, href: '/insights/analysis/explore', actionLabel: labels.openExplore },
    { id: 'my-analyses', title: labels.myAnalysesTitle, description: labels.myAnalysesDescription, status: 'ACTIVE', statusLabel: labels.active, icon: FolderOpen, href: '/insights/analysis/my-analyses', actionLabel: labels.openMyAnalyses },
    { id: 'reports', title: labels.reportsTitle, description: labels.reportsDescription, status: 'ACTIVE', statusLabel: labels.active, icon: FileText, href: '/insights', actionLabel: labels.openReports },
  ]

  return (
    <PageShell className="py-8 lg:py-10">
      <div>
        <p className="eyebrow">{labels.eyebrow}</p>
        <PageHeader className="mt-2" description={labels.intro} title={labels.title} />
      </div>
      <div aria-label={labels.title} className="mt-8 grid gap-4 md:grid-cols-2">
        {tiles.map((tile) => {
          const Icon = tile.icon
          const content = (
            <>
              <div className="flex items-start justify-between gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-control)] bg-accent text-primary">
                  <Icon aria-hidden="true" size={21} />
                </span>
                <Badge data-analysis-status={tile.status} tone={tile.status === 'ACTIVE' ? 'success' : 'neutral'}>{tile.statusLabel}</Badge>
              </div>
              <h2 className="mt-5 text-lg font-semibold">{tile.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{tile.description}</p>
              {tile.actionLabel ? <span className="mt-5 inline-flex text-sm font-semibold text-primary">{tile.actionLabel}</span> : null}
            </>
          )

          return (
            <Surface className="h-full p-5" data-analysis-tile={tile.id} key={tile.id}>
              {tile.href ? <Link className="block h-full rounded-[var(--radius-control)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus" href={tile.href}>
                {content}
              </Link> : <div className="h-full">{content}</div>}
            </Surface>
          )
        })}
      </div>
    </PageShell>
  )
}
