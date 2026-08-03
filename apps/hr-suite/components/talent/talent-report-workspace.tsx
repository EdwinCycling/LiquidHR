'use client'

import { useState } from 'react'
import type { TalentReportWorkspace } from '@/lib/talent/report-service'
import type { TalentReportMode } from '@/lib/talent/report-schemas'

type ReportLabels = {
  title: string
  subtitle: string
  export: string
  exportFailed: string
  goals: string
  capabilities: string
  empty: string
  employee: string
  goalOrCapability: string
  status: string
  progress: string
  period: string
  validity: string
  type: string
  source: string
  evidence: string
  level: string
  all: string
  loading: string
  current: string
  history: string
  periodFrom: string
  periodTo: string
  applyFilters: string
  population: string
}

function queryString(mode: TalentReportMode, goalStatus: string, recordStatus: string, periodFrom: string, periodTo: string): string {
  const params = new URLSearchParams({ mode })
  if (goalStatus) params.set('goalStatus', goalStatus)
  if (recordStatus) params.set('recordStatus', recordStatus)
  if (periodFrom) params.set('periodFrom', periodFrom)
  if (periodTo) params.set('periodTo', periodTo)
  return params.toString()
}

export function TalentReportWorkspace({ mode, initial, labels }: { mode: TalentReportMode; initial: TalentReportWorkspace; labels: ReportLabels }) {
  const [workspace, setWorkspace] = useState(initial)
  const [goalStatus, setGoalStatus] = useState('')
  const [recordStatus, setRecordStatus] = useState('')
  const [periodFrom, setPeriodFrom] = useState('')
  const [periodTo, setPeriodTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function filterReports(nextGoalStatus: string, nextRecordStatus: string, nextPeriodFrom: string, nextPeriodTo: string) {
    setLoading(true)
    setMessage(null)
    const response = await fetch(`/api/talent/reports?${queryString(mode, nextGoalStatus, nextRecordStatus, nextPeriodFrom, nextPeriodTo)}`, { cache: 'no-store' })
    if (!response.ok) { setMessage(labels.exportFailed); setLoading(false); return }
    const payload = await response.json() as { data: TalentReportWorkspace }
    setWorkspace(payload.data)
    setLoading(false)
  }

  async function exportReport() {
    setMessage(null)
    const response = await fetch(`/api/talent/reports/export?${queryString(mode, goalStatus, recordStatus, periodFrom, periodTo)}`, { cache: 'no-store' })
    if (!response.ok) { setMessage(labels.exportFailed); return }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'talent-report.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return <section className="mt-6 space-y-5">
    <header className="rounded-2xl border bg-surface p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{labels.title}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.subtitle}</p></div><button className="button-primary" onClick={() => void exportReport()} type="button">{labels.export}</button></div>{message ? <p className="mt-3 text-sm text-destructive" role="status">{message}</p> : null}</header>
    <form className="rounded-2xl border bg-surface p-5 shadow-sm" onSubmit={(event) => { event.preventDefault(); void filterReports(goalStatus, recordStatus, periodFrom, periodTo) }}><div className="flex flex-wrap items-end gap-3"><label className="text-sm"><span className="mb-1 block">{labels.goals} · {labels.status}</span><select className="form-field" value={goalStatus} onChange={(event) => setGoalStatus(event.target.value)}><option value="">{labels.all}</option><option value="DRAFT">DRAFT</option><option value="ACTIVE">ACTIVE</option><option value="COMPLETED">COMPLETED</option><option value="CANCELLED">CANCELLED</option><option value="ARCHIVED">ARCHIVED</option></select></label><label className="text-sm"><span className="mb-1 block">{labels.capabilities} · {labels.status}</span><select className="form-field" value={recordStatus} onChange={(event) => setRecordStatus(event.target.value)}><option value="">{labels.all}</option><option value="DRAFT">DRAFT</option><option value="RELEASED">RELEASED</option><option value="EXPIRED">EXPIRED</option><option value="ARCHIVED">ARCHIVED</option></select></label><label className="text-sm"><span className="mb-1 block">{labels.periodFrom}</span><input className="form-field" type="date" value={periodFrom} onChange={(event) => setPeriodFrom(event.target.value)} /></label><label className="text-sm"><span className="mb-1 block">{labels.periodTo}</span><input className="form-field" type="date" value={periodTo} onChange={(event) => setPeriodTo(event.target.value)} /></label><button className="button-secondary min-h-11" type="submit">{labels.applyFilters}</button>{loading ? <p className="self-end text-sm text-muted-foreground" role="status">{labels.loading}</p> : null}</div></form>
    <div className="rounded-2xl border bg-surface p-5 shadow-sm"><h3 className="text-base font-semibold">{labels.goals}</h3>{workspace.goals.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{labels.empty}</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wide text-muted-foreground"><th className="px-3 py-2">{labels.employee}</th><th className="px-3 py-2">{labels.goalOrCapability}</th><th className="px-3 py-2">{labels.status}</th><th className="px-3 py-2">{labels.progress}</th><th className="px-3 py-2">{labels.period}</th></tr></thead><tbody>{workspace.goals.map((goal, index) => <tr className="border-b last:border-0" key={`${goal.title}-${goal.periodStart}-${index}`}><td className="px-3 py-3">{goal.employeeLabel ?? '—'}</td><td className="px-3 py-3"><span className="font-medium">{goal.title}</span><span className="block text-xs text-muted-foreground">{goal.capabilityLabel ?? '—'}</span></td><td className="px-3 py-3">{goal.status}</td><td className="px-3 py-3">{goal.progressPercent}%</td><td className="px-3 py-3">{goal.periodStart} – {goal.periodEnd ?? '—'}</td></tr>)}</tbody></table></div>}</div>
    <div className="rounded-2xl border bg-surface p-5 shadow-sm"><h3 className="text-base font-semibold">{labels.capabilities}</h3>{workspace.capabilities.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{labels.empty}</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wide text-muted-foreground"><th className="px-3 py-2">{labels.employee}</th><th className="px-3 py-2">{labels.goalOrCapability}</th><th className="px-3 py-2">{labels.status}</th><th className="px-3 py-2">{labels.validity}</th><th className="px-3 py-2">{labels.type}</th><th className="px-3 py-2">{labels.source}</th><th className="px-3 py-2">{labels.evidence}</th><th className="px-3 py-2">{labels.level}</th></tr></thead><tbody>{workspace.capabilities.map((record) => <tr className="border-b last:border-0" key={`${record.employeeLabel}-${record.capabilityCode}-${record.validFrom}`}><td className="px-3 py-3">{record.employeeLabel}</td><td className="px-3 py-3"><span className="font-medium">{record.capabilityName}</span><span className="block text-xs text-muted-foreground">{record.capabilityCode}</span></td><td className="px-3 py-3">{record.status}</td><td className="px-3 py-3">{record.validFrom} – {record.validUntil ?? '—'}</td><td className="px-3 py-3">{record.capabilityType}</td><td className="px-3 py-3">{record.sourceType}</td><td className="px-3 py-3">{record.evidenceStatus ?? '—'}</td><td className="px-3 py-3">{record.talentLevelName ?? '—'}</td></tr>)}</tbody></table></div>}</div>
    <p className="text-xs text-muted-foreground">{labels.population}: {workspace.goals.length} {labels.goals.toLocaleLowerCase()} en {workspace.capabilities.length} {labels.capabilities.toLocaleLowerCase()}. {labels.current} / {labels.history}: {labels.subtitle}</p>
  </section>
}
