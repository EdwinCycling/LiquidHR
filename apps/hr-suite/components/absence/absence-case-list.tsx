import { EntityList } from '@/components/patterns/entity-list'
import { Badge } from '@/components/ui/badge'
import type { AbsenceCaseSummary } from '@/lib/absence/service'

interface AbsenceCaseListProps {
  employeeId: string
  compact: boolean
  cases: readonly AbsenceCaseSummary[]
  labels: {
    title: string
    nowSick: string
    nowNotSick: string
    recoveryWindow: string
    periods: string
    open: string
    empty: string
  }
}

export function AbsenceCaseList({ employeeId, compact, cases, labels }: AbsenceCaseListProps) {
  return <EntityList
    ariaLabel={labels.title}
    empty={<p className="rounded-[var(--radius-surface)] border border-dashed border-border-subtle px-5 py-8 text-center text-sm text-muted-foreground" role="status">{labels.empty}</p>}
    items={cases.map((item) => {
      const statusLabel = item.status === 'ACTIVE'
        ? labels.nowSick
        : item.status === 'RECOVERY_WINDOW' && item.recoveryWindowEndsOn
          ? labels.recoveryWindow.replace('{date}', item.recoveryWindowEndsOn)
          : labels.nowNotSick
      const tone = item.status === 'ACTIVE' ? 'danger' : item.status === 'RECOVERY_WINDOW' ? 'info' : 'success'
      return {
        id: item.id,
        href: `/employees/${employeeId}?tab=absence&view=${compact ? 'compact' : 'expanded'}&caseId=${item.id}`,
        primary: item.firstAbsenceOn,
        secondary: <span className="break-words">{item.spells.length} {labels.periods.toLowerCase()} · {item.spells[0]?.absencePercentage ?? 100}% · <span className="text-primary">{labels.open}</span></span>,
        badges: <Badge tone={tone}>{statusLabel}</Badge>,
      }
    })}
  />
}
