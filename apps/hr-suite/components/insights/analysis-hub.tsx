import { Compass, FileText, FolderOpen } from 'lucide-react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { Surface } from '@/components/ui/surface'

export interface AnalysisHubLabels {
  eyebrow: string
  title: string
  intro: string
  exploreTitle: string
  exploreDescription: string
  myAnalysesTitle: string
  myAnalysesDescription: string
  reportsTitle: string
  reportsDescription: string
  openExplore: string
  openMyAnalyses: string
  openReports: string
}

type AnalysisHubTile = {
  id: 'explore' | 'my-analyses' | 'reports'
  title: string
  description: string
  icon: LucideIcon
  href: string
  actionLabel: string
}

export function AnalysisHub({ labels }: { labels: AnalysisHubLabels }) {
  const tiles: readonly AnalysisHubTile[] = [
    { id: 'explore', title: labels.exploreTitle, description: labels.exploreDescription, icon: Compass, href: '/insights/analysis/explore', actionLabel: labels.openExplore },
    { id: 'my-analyses', title: labels.myAnalysesTitle, description: labels.myAnalysesDescription, icon: FolderOpen, href: '/insights/analysis/my-analyses', actionLabel: labels.openMyAnalyses },
    { id: 'reports', title: labels.reportsTitle, description: labels.reportsDescription, icon: FileText, href: '/insights', actionLabel: labels.openReports },
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
              <span className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-control)] bg-accent text-primary">
                <Icon aria-hidden="true" size={21} />
              </span>
              <h2 className="mt-5 text-lg font-semibold">{tile.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{tile.description}</p>
              <span className="mt-5 inline-flex text-sm font-semibold text-primary">{tile.actionLabel}</span>
            </>
          )

          return (
            <Surface className="h-full p-5" data-analysis-tile={tile.id} key={tile.id}>
              <Link className="block h-full rounded-[var(--radius-control)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus" href={tile.href}>
                {content}
              </Link>
            </Surface>
          )
        })}
      </div>
    </PageShell>
  )
}
