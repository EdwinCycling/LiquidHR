'use client'

import Link from 'next/link'
import { ArrowRight, BarChart3, BellRing, CheckCircle2, Search, StopCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import type { ResearchCampaignSummary } from '@/lib/research/admin-service'

interface SettingsLabels { search: string; searchPlaceholder: string; allTypes: string; allStatuses: string; sortNewest: string; sortStart: string; empty: string; invited: (count: number) => string; responses: (submitted: number, invited: number) => string; activate: string; close: string; remind: string; working: string; actionFailed: string; actionDone: string; openMonitor: string; survey: string; enps: string; statuses: Record<ResearchCampaignSummary['status'], string> }

export function ResearchSettingsWorkspace({ campaigns, labels, locale }: { campaigns: ResearchCampaignSummary[]; labels: SettingsLabels; locale: string }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('ALL')
  const [status, setStatus] = useState('ALL')
  const [sort, setSort] = useState('NEWEST')
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const date = useMemo(() => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }), [locale])
  const visible = useMemo(() => campaigns.filter((campaign) => (!search.trim() || campaign.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) && (kind === 'ALL' || campaign.kind === kind) && (status === 'ALL' || campaign.status === status)).sort((left, right) => sort === 'START' ? Date.parse(right.startsAt) - Date.parse(left.startsAt) : Date.parse(right.startsAt) - Date.parse(left.startsAt)), [campaigns, kind, search, sort, status])

  async function act(campaign: ResearchCampaignSummary, action: 'activate' | 'close' | 'remind') {
    setWorkingId(campaign.id); setMessage(null)
    try { const response = await fetch(`/api/research/admin/${campaign.kind}/${campaign.id}/${action}`, { method: 'POST' }); if (!response.ok) throw new Error('action'); setMessage({ type: 'success', text: labels.actionDone }); router.refresh() } catch { setMessage({ type: 'error', text: labels.actionFailed }) } finally { setWorkingId(null) }
  }

  return <div>
    <section className="grid gap-3 rounded-3xl border bg-surface p-4 shadow-sm md:grid-cols-[1fr_12rem_12rem_12rem]">
      <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><input aria-label={labels.search} className="min-h-11 w-full rounded-xl border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-focus/20" onChange={(event) => setSearch(event.target.value)} placeholder={labels.searchPlaceholder} value={search} /></div>
      <DropdownSelect aria-label={labels.allTypes} onChange={(event) => setKind(event.target.value)} value={kind}><option value="ALL">{labels.allTypes}</option><option value="survey">{labels.survey}</option><option value="enps">{labels.enps}</option></DropdownSelect>
      <DropdownSelect aria-label={labels.allStatuses} onChange={(event) => setStatus(event.target.value)} value={status}><option value="ALL">{labels.allStatuses}</option><option value="DRAFT">{labels.statuses.DRAFT}</option><option value="ACTIVE">{labels.statuses.ACTIVE}</option><option value="CLOSED">{labels.statuses.CLOSED}</option></DropdownSelect>
      <DropdownSelect aria-label={labels.sortNewest} onChange={(event) => setSort(event.target.value)} value={sort}><option value="NEWEST">{labels.sortNewest}</option><option value="START">{labels.sortStart}</option></DropdownSelect>
    </section>
    {message ? <p className={`mt-4 rounded-2xl border p-4 text-sm font-medium ${message.type === 'success' ? 'border-primary/20 bg-accent text-accent-foreground' : 'border-destructive/30 bg-destructive/10 text-destructive'}`} role="status">{message.type === 'success' ? <CheckCircle2 aria-hidden="true" className="mr-2 inline" size={16} /> : null}{message.text}</p> : null}
    {visible.length ? <div className="mt-5 space-y-3">{visible.map((campaign) => { const percentage = campaign.invited ? Math.round((campaign.submitted / campaign.invited) * 100) : 0; const working = workingId === campaign.id; return <article className="rounded-3xl border bg-surface p-5 shadow-sm" key={`${campaign.kind}-${campaign.id}`}><div className="grid gap-5 lg:grid-cols-[1fr_16rem_auto] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">{campaign.kind === 'enps' ? labels.enps : labels.survey}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${campaign.status === 'ACTIVE' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{labels.statuses[campaign.status]}</span></div><h2 className="mt-3 text-lg font-semibold">{campaign.title}</h2><p className="mt-1 text-sm text-muted-foreground">{date.format(new Date(campaign.startsAt))} – {date.format(new Date(campaign.endsAt))}</p></div><div><div className="flex justify-between text-xs font-semibold text-muted-foreground"><span>{labels.responses(campaign.submitted, campaign.invited)}</span><span>{percentage}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percentage}%` }} /></div><p className="mt-2 text-xs text-muted-foreground">{labels.invited(campaign.invited)}</p></div><div className="flex flex-wrap gap-2 lg:justify-end"><Link className="button-secondary" href={`/research/monitor?kind=${campaign.kind}&id=${campaign.id}`}>{labels.openMonitor}<ArrowRight aria-hidden="true" size={15} /></Link>{campaign.status === 'DRAFT' ? <button className="button-primary" disabled={working} onClick={() => act(campaign, 'activate')} type="button"><BarChart3 aria-hidden="true" size={15} />{working ? labels.working : labels.activate}</button> : null}{campaign.status === 'ACTIVE' ? <><button className="button-secondary" disabled={working} onClick={() => act(campaign, 'remind')} type="button"><BellRing aria-hidden="true" size={15} />{working ? labels.working : labels.remind}</button><button className="button-secondary" disabled={working} onClick={() => act(campaign, 'close')} type="button"><StopCircle aria-hidden="true" size={15} />{working ? labels.working : labels.close}</button></> : null}</div></div></article> })}</div> : <p className="mt-5 rounded-3xl border border-dashed bg-surface p-8 text-center text-sm text-muted-foreground">{labels.empty}</p>}
  </div>
}
