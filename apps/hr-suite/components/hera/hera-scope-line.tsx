import { Database, SlidersHorizontal } from 'lucide-react'
import type { HeRaEvidence } from './hera-response-model'

interface ScopeLabels {
  sourceLiquidHr: string
  visibleRecords: string
  asOfDate: string
  filters: string
  uncertainties: string
}

export function HeRaScopeLine({ evidence, labels }: { evidence: HeRaEvidence; labels: ScopeLabels }) {
  return (
    <details className="mt-3 rounded-xl border border-border/70 bg-surface-raised/70 px-3 py-2 text-xs text-muted-foreground">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus">
        <Database aria-hidden="true" size={13} />
        <span>{labels.sourceLiquidHr}</span>
        <span aria-hidden="true">·</span>
        <span>{labels.visibleRecords}: {evidence.scope.visibleCount}</span>
        <span aria-hidden="true">·</span>
        <span>{labels.asOfDate}: {evidence.asOfDate}</span>
      </summary>
      <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-2">
        <div>
          <p className="font-medium text-foreground">{evidence.scope.population}</p>
          {evidence.filters.length > 0 ? <div className="mt-2 flex items-start gap-2"><SlidersHorizontal aria-hidden="true" className="mt-0.5 shrink-0" size={13} /><div><span className="font-medium text-foreground">{labels.filters}</span><ul className="mt-1 space-y-1">{evidence.filters.map((filter) => <li key={`${filter.field}-${filter.operator}-${filter.value}`}>{filter.field} {filter.operator} {filter.value}</li>)}</ul></div></div> : null}
        </div>
        {evidence.uncertainties.length > 0 ? <div><p className="font-medium text-foreground">{labels.uncertainties}</p><ul className="mt-1 space-y-1">{evidence.uncertainties.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
      </div>
    </details>
  )
}
