'use client'

import { ChevronDown, Plus } from 'lucide-react'
import type { PersonalDashboard } from '@/lib/dashboard/service'

interface DashboardSwitcherProps {
  dashboards: PersonalDashboard[]
  activeId: string
  labels: { title: string; new: string }
  onCreate: () => void
  onSelect: (id: string) => void
}

export function DashboardSwitcher({ dashboards, activeId, labels, onCreate, onSelect }: DashboardSwitcherProps) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <label className="sr-only" htmlFor="dashboard-switcher">{labels.title}</label>
      <div className="relative min-w-0">
        <select
          className="h-10 max-w-[14rem] appearance-none rounded-lg border bg-surface py-2 pl-3 pr-9 text-sm font-semibold text-foreground shadow-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-focus"
          id="dashboard-switcher"
          onChange={(event) => onSelect(event.target.value)}
          value={activeId}
        >
          {dashboards.map((dashboard) => <option key={dashboard.id} value={dashboard.id}>{dashboard.name}</option>)}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
      </div>
      <button aria-label={labels.new} className="grid size-10 shrink-0 place-items-center rounded-lg border bg-surface text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-focus" onClick={onCreate} type="button">
        <Plus aria-hidden="true" size={18} />
      </button>
    </div>
  )
}
