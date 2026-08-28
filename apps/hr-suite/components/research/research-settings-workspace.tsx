'use client'

import Link from 'next/link'
import { ArrowRight, BarChart3, BellRing, CheckCircle2, Search, StopCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { TextInput } from '@/components/ui/text-input'
import { CollectionToolbar } from '@/components/patterns/collection-toolbar'
import { EntityList } from '@/components/patterns/entity-list'
import { FilterBar } from '@/components/patterns/filter-bar'
import { FormField } from '@/components/patterns/form-field'
import type { ResearchCampaignSummary } from '@/lib/research/admin-service'

interface SettingsLabels { search: string; searchPlaceholder: string; allTypes: string; allStatuses: string; sortNewest: string; sortStart: string; empty: string; invited: string; responses: string; activate: string; close: string; remind: string; editDraft: string; working: string; actionFailed: string; actionDone: string; openMonitor: string; survey: string; enps: string; statuses: Record<ResearchCampaignSummary['status'], string> }

function formatLabel(template: string, values: Record<string, string | number>): string { return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (placeholder, name: string) => values[name] === undefined ? placeholder : String(values[name])) }

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

  async function act(campaign: ResearchCampaignSummary, action: 'activate' | 'close' | 'remind'): Promise<void> {
    setWorkingId(campaign.id)
    setMessage(null)
    try { const response = await fetch(`/api/research/admin/${campaign.kind}/${campaign.id}/${action}`, { method: 'POST' }); if (!response.ok) throw new Error('action'); setMessage({ type: 'success', text: labels.actionDone }); router.refresh() } catch { setMessage({ type: 'error', text: labels.actionFailed }) } finally { setWorkingId(null) }
  }

  return <div>
    <CollectionToolbar search={<TextInput aria-label={labels.search} leadingIcon={<Search aria-hidden="true" />} onChange={(event) => setSearch(event.target.value)} placeholder={labels.searchPlaceholder} value={search} />} />
    <FilterBar className="mt-3"><FormField className="min-w-40 flex-1" control={<DropdownSelect aria-label={labels.allTypes} onChange={(event) => setKind(event.target.value)} value={kind}><option value="ALL">{labels.allTypes}</option><option value="survey">{labels.survey}</option><option value="enps">{labels.enps}</option></DropdownSelect>} label={labels.allTypes} /><FormField className="min-w-40 flex-1" control={<DropdownSelect aria-label={labels.allStatuses} onChange={(event) => setStatus(event.target.value)} value={status}><option value="ALL">{labels.allStatuses}</option><option value="DRAFT">{labels.statuses.DRAFT}</option><option value="ACTIVE">{labels.statuses.ACTIVE}</option><option value="CLOSED">{labels.statuses.CLOSED}</option></DropdownSelect>} label={labels.allStatuses} /><FormField className="min-w-40 flex-1" control={<DropdownSelect aria-label={labels.sortNewest} onChange={(event) => setSort(event.target.value)} value={sort}><option value="NEWEST">{labels.sortNewest}</option><option value="START">{labels.sortStart}</option></DropdownSelect>} label={labels.sortNewest} /></FilterBar>
    {message ? <p className={`mt-4 border p-4 text-sm font-medium ${message.type === 'success' ? 'border-primary/20 bg-accent text-accent-foreground' : 'border-destructive/30 bg-destructive-surface text-destructive'}`} role="status">{message.type === 'success' ? <CheckCircle2 aria-hidden="true" className="mr-2 inline" size={16} /> : null}{message.text}</p> : null}
    <EntityList ariaLabel={labels.search} className="mt-5" empty={<p className="border border-dashed border-border-subtle p-8 text-center text-sm text-muted-foreground">{labels.empty}</p>} items={visible.map((campaign) => { const percentage = campaign.invited ? Math.round((campaign.submitted / campaign.invited) * 100) : 0; const working = workingId === campaign.id; const editHref = campaign.kind === 'survey' ? `/settings/research/surveys/new?campaignId=${campaign.id}` : `/settings/research/enps/new?campaignId=${campaign.id}`; return { id: `${campaign.kind}-${campaign.id}`, primary: campaign.title, secondary: <><span>{date.format(new Date(campaign.startsAt))} – {date.format(new Date(campaign.endsAt))}</span><div className="mt-3 max-w-xl"><div className="flex justify-between text-xs font-semibold text-muted-foreground"><span>{formatLabel(labels.responses, { submitted: campaign.submitted, invited: campaign.invited })}</span><span>{percentage}%</span></div><div aria-hidden="true" className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percentage}%` }} /></div><p className="mt-2 text-xs text-muted-foreground">{formatLabel(labels.invited, { count: campaign.invited })}</p></div></>, badges: <><Badge tone="info">{campaign.kind === 'enps' ? labels.enps : labels.survey}</Badge><Badge tone={campaign.status === 'ACTIVE' ? 'success' : 'neutral'}>{labels.statuses[campaign.status]}</Badge></>, actions: <div className="flex flex-wrap gap-2 sm:justify-end">{campaign.status === 'DRAFT' ? <Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href={editHref}>{labels.editDraft}<ArrowRight aria-hidden="true" size={15} /></Link> : null}<Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href={`/research/monitor?kind=${campaign.kind}&id=${campaign.id}`}>{labels.openMonitor}<ArrowRight aria-hidden="true" size={15} /></Link>{campaign.status === 'DRAFT' ? <Button disabled={working} loading={working} onClick={() => void act(campaign, 'activate')} size="sm" type="button"><BarChart3 aria-hidden="true" size={15} />{labels.activate}</Button> : null}{campaign.status === 'ACTIVE' ? <><Button disabled={working} loading={working} onClick={() => void act(campaign, 'remind')} size="sm" type="button" variant="secondary"><BellRing aria-hidden="true" size={15} />{labels.remind}</Button><Button disabled={working} onClick={() => void act(campaign, 'close')} size="sm" type="button" variant="secondary"><StopCircle aria-hidden="true" size={15} />{labels.close}</Button></> : null}</div> } })} />
  </div>
}
