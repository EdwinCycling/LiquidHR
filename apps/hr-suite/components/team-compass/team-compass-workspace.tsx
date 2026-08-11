'use client'

import Link from 'next/link'
import { useEffect, useId, useMemo, useRef, useState, useTransition, type KeyboardEvent } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Archive, CalendarDays, Compass, LockKeyhole, Pencil, Plus, Search, ShieldCheck, Sparkles, Users } from 'lucide-react'
import type { getTeamCompassWorkspace } from '@/lib/team-compass/service'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { percentagesToCoordinates, TeamCompassCompass } from './team-compass-compass'

type Workspace = Awaited<ReturnType<typeof getTeamCompassWorkspace>>

export type TeamCompassLabels = Record<
  'title' | 'eyebrow' | 'subtitleAdmin' | 'subtitleManager' | 'subtitleEmployee' | 'disclaimer' |
  'campaigns' | 'teamOverview' | 'myCompass' | 'newCampaign' | 'editCampaign' | 'searchCampaigns' | 'searchPlaceholder' |
  'allStatuses' | 'campaignName' | 'description' | 'questionnaire' | 'departments' | 'chooseDepartments' | 'startsOn' |
  'endsOn' | 'threshold' | 'thresholdHelp' | 'personalMessage' | 'saveDraft' | 'saving' | 'cancel' | 'saved' | 'failed' |
  'start' | 'close' | 'archive' | 'open' | 'emptyCampaigns' | 'emptyParticipations' | 'participants' | 'completed' |
  'progress' | 'deadline' | 'status' | 'actions' | 'statusDraft' | 'statusActive' | 'statusClosed' | 'statusArchived' |
  'statusInvited' | 'statusInProgress' | 'statusCompleted' | 'statusDeclined' | 'selectCampaign' | 'privacyTitle' |
  'privacyThreshold' | 'privacyConsent' | 'aggregateAvailable' | 'teamCompass' | 'teamMix' | 'namedProfiles' |
  'noNamedProfiles' | 'insight' | 'balancedInsight' | 'focusedInsight' | 'dimensionAction' | 'dimensionVision' |
  'dimensionHarmony' | 'dimensionLogic' | 'continueAssessment' | 'viewResult' | 'managementTitle' | 'managementSubtitle' |
  'confirmStart' | 'confirmClose' | 'confirmArchive', string
>

type CampaignDraft = {
  campaignId: string | null
  expectedVersion: number | null
  questionnaireVersionId: string
  name: string
  description: string
  personalMessage: string
  startsOn: string
  endsOn: string
  anonymityThreshold: number
  departmentIds: string[]
}

const today = new Date().toISOString().slice(0, 10)

function statusLabel(status: string, labels: TeamCompassLabels) {
  const map: Record<string, string> = { DRAFT: labels.statusDraft, ACTIVE: labels.statusActive, CLOSED: labels.statusClosed, ARCHIVED: labels.statusArchived, INVITED: labels.statusInvited, IN_PROGRESS: labels.statusInProgress, COMPLETED: labels.statusCompleted, DECLINED: labels.statusDeclined }
  return map[status] ?? status
}

function initialDraft(workspace: Workspace): CampaignDraft {
  return { campaignId: null, expectedVersion: null, questionnaireVersionId: workspace.questionnaireVersions[0]?.id ?? '', name: '', description: '', personalMessage: '', startsOn: today, endsOn: today, anonymityThreshold: 5, departmentIds: [] }
}

export function TeamCompassWorkspace({ initial, labels, selectedCampaignId, managementOnly = false }: {
  initial: Workspace
  labels: TeamCompassLabels
  selectedCampaignId?: string
  managementOnly?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [message, setMessage] = useState('')
  const [draft, setDraft] = useState<CampaignDraft | null>(null)
  const [departmentSearch, setDepartmentSearch] = useState('')
  const campaigns = useMemo(() => initial.campaigns.filter((campaign) => {
    const query = search.trim().toLocaleLowerCase()
    return (!query || `${campaign.name} ${campaign.status}`.toLocaleLowerCase().includes(query)) && (!status || campaign.status === status)
  }), [initial.campaigns, search, status])
  const selected = initial.campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null
  const targetIds = (campaignId: string) => initial.targets.filter((target) => target.campaign_id === campaignId).map((target) => target.department_id)
  const participantCount = (campaignId: string) => initial.participations.filter((participation) => participation.campaign_id === campaignId).length
  const completedCount = (campaignId: string) => initial.participations.filter((participation) => participation.campaign_id === campaignId && participation.status === 'COMPLETED').length

  function openCampaign(campaignId: string) {
    const query = new URLSearchParams({ campaign: campaignId })
    router.push(`${pathname}?${query.toString()}`)
  }

  function editCampaign(campaignId: string) {
    const campaign = initial.campaigns.find((item) => item.id === campaignId)
    if (!campaign) return
    setDraft({ campaignId: campaign.id, expectedVersion: campaign.version, questionnaireVersionId: campaign.questionnaire_version_id, name: campaign.name, description: campaign.description ?? '', personalMessage: campaign.personal_message ?? '', startsOn: campaign.starts_on, endsOn: campaign.ends_on, anonymityThreshold: campaign.anonymity_threshold, departmentIds: targetIds(campaign.id) })
  }

  async function request(url: string, body: object) {
    setMessage('')
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!response.ok) { setMessage(labels.failed); return false }
    setMessage(labels.saved)
    startTransition(() => router.refresh())
    return true
  }

  async function saveDraft() {
    if (!draft) return
    if (await request('/api/team-compass/campaigns', draft)) setDraft(null)
  }

  async function transitionCampaign(campaignId: string, action: 'START' | 'CLOSE' | 'ARCHIVE', version: number) {
    const confirmation = action === 'START' ? labels.confirmStart : action === 'CLOSE' ? labels.confirmClose : labels.confirmArchive
    if (!window.confirm(confirmation)) return
    await request(`/api/team-compass/campaigns/${campaignId}/transition`, { action, expectedVersion: version })
  }

  const subtitle = initial.mode === 'admin' ? labels.subtitleAdmin : initial.mode === 'manager' ? labels.subtitleManager : labels.subtitleEmployee
  if (initial.mode === 'employee') return <EmployeeWorkspace initial={initial} labels={labels} subtitle={subtitle} />

  return (
    <div className="mx-auto w-full max-w-[90rem] space-y-6 px-5 py-8 sm:px-8 lg:px-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{labels.eyebrow}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{managementOnly ? labels.managementTitle : labels.title}</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">{managementOnly ? labels.managementSubtitle : subtitle}</p></div>{initial.mode === 'admin' ? <button className="button-primary" onClick={() => setDraft(initialDraft(initial))} type="button"><Plus size={16} />{labels.newCampaign}</button> : null}</header>
      <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm"><ShieldCheck className="mt-0.5 shrink-0 text-primary" size={20} /><div><p className="font-semibold">{labels.privacyTitle}</p><p className="mt-1 text-muted-foreground">{labels.disclaimer} {labels.privacyConsent}</p></div></div>
      {message ? <p aria-live="polite" className="rounded-xl bg-muted px-4 py-3 text-sm">{message}</p> : null}

      <section className="rounded-2xl border bg-surface shadow-sm"><div className="flex flex-col gap-3 border-b p-5 md:flex-row md:items-end md:justify-between"><div><h2 className="text-xl font-semibold">{labels.campaigns}</h2><p className="mt-1 text-sm text-muted-foreground">{initial.campaigns.length} {labels.campaigns.toLocaleLowerCase()}</p></div><div className="grid gap-2 sm:grid-cols-2"><label><span className="sr-only">{labels.searchCampaigns}</span><span className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><input className="form-field pl-9" onChange={(event) => setSearch(event.target.value)} placeholder={labels.searchPlaceholder} value={search} /></span></label><DropdownSelect aria-label={labels.status} onChange={(event) => setStatus(event.target.value)} value={status}><option value="">{labels.allStatuses}</option>{['DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED'].map((value) => <option key={value} value={value}>{statusLabel(value, labels)}</option>)}</DropdownSelect></div></div>
        <div aria-label={labels.campaigns} className="overflow-x-auto" role="region" tabIndex={0}><table className="w-full min-w-[48rem] text-left text-sm"><thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3">{labels.campaignName}</th><th className="px-4 py-3">{labels.status}</th><th className="px-4 py-3">{labels.deadline}</th><th className="px-4 py-3">{labels.progress}</th><th className="px-5 py-3 text-right">{labels.actions}</th></tr></thead><tbody className="divide-y">{campaigns.map((campaign) => { const total = participantCount(campaign.id); const done = completedCount(campaign.id); return <tr className="cursor-pointer hover:bg-muted/30" key={campaign.id} onClick={() => openCampaign(campaign.id)}><td className="px-5 py-4"><p className="font-semibold">{campaign.name}</p><p className="mt-1 text-xs text-muted-foreground">{targetIds(campaign.id).map((id) => initial.departments.find((department) => department.id === id)?.name).filter(Boolean).join(', ')}</p></td><td className="px-4 py-4"><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">{statusLabel(campaign.status, labels)}</span></td><td className="px-4 py-4">{campaign.ends_on}</td><td className="px-4 py-4"><div className="flex items-center gap-3"><div className="h-2 w-24 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div><span>{done}/{total}</span></div></td><td className="px-5 py-4"><div className="flex justify-end gap-2" onClick={(event) => event.stopPropagation()}>{campaign.status === 'DRAFT' && initial.mode === 'admin' ? <><button aria-label={labels.editCampaign} className="button-secondary px-3" onClick={() => editCampaign(campaign.id)} type="button"><Pencil size={15} /></button><button className="button-secondary" disabled={pending} onClick={() => void transitionCampaign(campaign.id, 'START', campaign.version)} type="button"><Sparkles size={15} />{labels.start}</button></> : null}{campaign.status === 'ACTIVE' && initial.mode === 'admin' ? <button className="button-secondary" disabled={pending} onClick={() => void transitionCampaign(campaign.id, 'CLOSE', campaign.version)} type="button"><LockKeyhole size={15} />{labels.close}</button> : null}{campaign.status === 'CLOSED' && initial.mode === 'admin' ? <button className="button-secondary" disabled={pending} onClick={() => void transitionCampaign(campaign.id, 'ARCHIVE', campaign.version)} type="button"><Archive size={15} />{labels.archive}</button> : null}<button className="button-secondary" onClick={() => openCampaign(campaign.id)} type="button">{labels.open}</button></div></td></tr> })}</tbody></table></div>{campaigns.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">{labels.emptyCampaigns}</p> : null}</section>

      {!managementOnly ? <><TeamProjection campaign={selected} labels={labels} projection={initial.projection} />{selected ? <ParticipantProgress campaignId={selected.id} labels={labels} workspace={initial} /> : null}</> : null}
      {draft ? <CampaignDialog draft={draft} departmentSearch={departmentSearch} labels={labels} pending={pending} workspace={initial} onClose={() => setDraft(null)} onDepartmentSearch={setDepartmentSearch} onSave={() => void saveDraft()} onUpdate={setDraft} /> : null}
    </div>
  )
}

function TeamProjection({ campaign, projection, labels }: { campaign: Workspace['campaigns'][number] | null; projection: Workspace['projection']; labels: TeamCompassLabels }) {
  if (!campaign) return <section className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground"><Compass className="mx-auto mb-3" size={28} />{labels.selectCampaign}</section>
  if (!projection) return null
  const remaining = Math.max(0, projection.threshold - projection.completedCount)
  if (!projection.available || !projection.outerPercentages) return <section className="rounded-2xl border bg-surface p-6 shadow-sm"><div className="flex gap-3"><ShieldCheck className="text-primary" /><div><h2 className="font-semibold">{labels.privacyTitle}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.privacyThreshold.replace('{remaining}', String(remaining))}</p><p className="mt-3 text-xs">{projection.completedCount}/{projection.invitedCount} {labels.completed.toLocaleLowerCase()}</p></div></div></section>
  const coordinates = percentagesToCoordinates(projection.outerPercentages)
  const scores = Object.entries(projection.outerPercentages).sort((left, right) => right[1] - left[1])
  const focused = (scores[0]?.[1] ?? 0) - (scores[3]?.[1] ?? 0) > 20
  return <section className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.7fr)]"><div className="rounded-2xl border bg-surface p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">{campaign.name}</p><h2 className="mt-1 text-xl font-semibold">{labels.teamCompass}</h2></div><span className="rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">{labels.aggregateAvailable}</span></div><TeamCompassCompass labels={{ action: labels.dimensionAction, vision: labels.dimensionVision, harmony: labels.dimensionHarmony, logic: labels.dimensionLogic }} points={[{ id: 'team', label: labels.title, kind: 'team', ...coordinates }, ...(projection.namedProfiles ?? []).map((profile) => ({ id: profile.employeeId, label: profile.label, kind: 'outer' as const, ...profile.outer }))]} /></div><div className="space-y-5"><div className="rounded-2xl border bg-surface p-5 shadow-sm"><h2 className="text-lg font-semibold">{labels.teamMix}</h2><div className="mt-4 space-y-3">{scores.map(([dimension, score]) => <div key={dimension}><div className="flex justify-between text-sm"><span>{dimension === 'ACTION' ? labels.dimensionAction : dimension === 'VISION' ? labels.dimensionVision : dimension === 'HARMONY' ? labels.dimensionHarmony : labels.dimensionLogic}</span><strong>{Math.round(score)}%</strong></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${score}%` }} /></div></div>)}</div></div><div className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-sm"><Sparkles size={20} /><h2 className="mt-3 text-lg font-semibold">{labels.insight}</h2><p className="mt-2 text-sm leading-6 text-primary-foreground/85">{focused ? labels.focusedInsight : labels.balancedInsight}</p></div><div className="rounded-2xl border bg-surface p-5 shadow-sm"><h2 className="font-semibold">{labels.namedProfiles}</h2><p className="mt-2 text-sm text-muted-foreground">{projection.namedProfiles?.length ? `${projection.namedProfiles.length} ${labels.participants.toLocaleLowerCase()}` : labels.noNamedProfiles}</p></div></div></section>
}

function EmployeeWorkspace({ initial, labels, subtitle }: { initial: Workspace; labels: TeamCompassLabels; subtitle: string }) {
  const campaignById = new Map(initial.campaigns.map((campaign) => [campaign.id, campaign]))
  const profileByParticipation = new Map(initial.profiles.map((profile) => [profile.participation_id, profile]))
  return <div className="mx-auto w-full max-w-6xl space-y-6 px-5 py-8 sm:px-8 lg:px-10"><header><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{labels.eyebrow}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{labels.myCompass}</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">{subtitle}</p></header><div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground"><strong className="text-foreground">{labels.privacyTitle}.</strong> {labels.disclaimer}</div><section className="grid gap-4 md:grid-cols-2">{initial.participations.map((participation) => { const campaign = campaignById.get(participation.campaign_id); const profile = profileByParticipation.get(participation.id); return <article className="rounded-2xl border bg-surface p-5 shadow-sm" key={participation.id}><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{campaign?.name ?? labels.title}</h2><p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays size={14} />{campaign?.ends_on}</p></div><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">{statusLabel(participation.status, labels)}</span></div><p className="mt-4 text-sm text-muted-foreground">{campaign?.personal_message || campaign?.description || labels.disclaimer}</p><div className="mt-5">{profile ? <Link className="button-primary" href={`/team-compass/results/${participation.id}`}>{labels.viewResult}</Link> : <Link className="button-primary" href={`/team-compass/assessment/${participation.id}`}>{labels.continueAssessment}</Link>}</div></article> })}</section>{initial.participations.length === 0 ? <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground"><Users className="mx-auto mb-3" size={26} />{labels.emptyParticipations}</div> : null}</div>
}

function ParticipantProgress({ campaignId, labels, workspace }: { campaignId: string; labels: TeamCompassLabels; workspace: Workspace }) {
  const employees = new Map(workspace.employees.map((employee) => [employee.id, employee]))
  const rows = workspace.participations.filter((participation) => participation.campaign_id === campaignId)
  return <section className="rounded-2xl border bg-surface shadow-sm"><div className="border-b p-5"><h2 className="text-lg font-semibold">{labels.participants}</h2><p className="mt-1 text-sm text-muted-foreground">{rows.filter((row) => row.status === 'COMPLETED').length}/{rows.length} {labels.completed.toLocaleLowerCase()}</p></div><div className="divide-y">{rows.map((participation) => { const employee = employees.get(participation.employee_id); const name = [employee?.first_name, employee?.birth_name].filter(Boolean).join(' ') || employee?.employee_number || participation.employee_id; return <div className="flex items-center justify-between gap-4 px-5 py-3 text-sm" key={participation.id}><div className="min-w-0"><p className="truncate font-medium">{name}</p><p className="text-xs text-muted-foreground">{employee?.employee_number}</p></div><span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">{statusLabel(participation.status, labels)}</span></div>})}{rows.length === 0 ? <p className="p-6 text-sm text-muted-foreground">{labels.emptyParticipations}</p> : null}</div></section>
}

function CampaignDialog({ draft, labels, workspace, pending, departmentSearch, onDepartmentSearch, onUpdate, onSave, onClose }: { draft: CampaignDraft; labels: TeamCompassLabels; workspace: Workspace; pending: boolean; departmentSearch: string; onDepartmentSearch(value: string): void; onUpdate(value: CampaignDraft): void; onSave(): void; onClose(): void }) {
  const departments = workspace.departments.filter((department) => department.name.toLocaleLowerCase().includes(departmentSearch.trim().toLocaleLowerCase()))
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.querySelector<HTMLElement>('[data-initial-focus]')?.focus()
    return () => previouslyFocused?.focus()
  }, [])

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]') ?? [])
      .filter((element) => element.tabIndex >= 0 && element.getAttribute('aria-hidden') !== 'true')
    const first = focusable[0]
    const last = focusable.at(-1)
    if (!first || !last) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}><div aria-labelledby={titleId} aria-modal="true" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border bg-surface p-6 shadow-xl" onKeyDown={handleDialogKeyDown} ref={dialogRef} role="dialog"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">{labels.campaigns}</p><h2 className="mt-1 text-2xl font-semibold" id={titleId}>{draft.campaignId ? labels.editCampaign : labels.newCampaign}</h2></div><button aria-label={labels.cancel} className="button-secondary" onClick={onClose} type="button">×</button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className="form-label">{labels.campaignName}</span><input className="form-field" data-initial-focus maxLength={120} onChange={(event) => onUpdate({ ...draft, name: event.target.value })} value={draft.name} /></label><label className="sm:col-span-2"><span className="form-label">{labels.description}</span><textarea className="form-field min-h-20" maxLength={600} onChange={(event) => onUpdate({ ...draft, description: event.target.value })} value={draft.description} /></label><label><span className="form-label">{labels.startsOn}</span><input className="form-field" onChange={(event) => onUpdate({ ...draft, startsOn: event.target.value })} type="date" value={draft.startsOn} /></label><label><span className="form-label">{labels.endsOn}</span><input className="form-field" onChange={(event) => onUpdate({ ...draft, endsOn: event.target.value })} type="date" value={draft.endsOn} /></label><label><span className="form-label">{labels.questionnaire}</span><DropdownSelect onChange={(event) => onUpdate({ ...draft, questionnaireVersionId: event.target.value })} value={draft.questionnaireVersionId}>{workspace.questionnaireVersions.map((version) => <option key={version.id} value={version.id}>{version.name_nl} · v{version.version}</option>)}</DropdownSelect></label><label><span className="form-label">{labels.threshold}</span><input className="form-field" max={50} min={5} onChange={(event) => onUpdate({ ...draft, anonymityThreshold: Number(event.target.value) })} type="number" value={draft.anonymityThreshold} /><span className="mt-1 block text-xs text-muted-foreground">{labels.thresholdHelp}</span></label><fieldset className="sm:col-span-2"><legend className="form-label">{labels.chooseDepartments}</legend><input aria-label={labels.departments} className="form-field mb-2" onChange={(event) => onDepartmentSearch(event.target.value)} placeholder={labels.searchPlaceholder} value={departmentSearch} /><div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border p-2">{departments.map((department) => <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted" key={department.id}><input checked={draft.departmentIds.includes(department.id)} onChange={(event) => onUpdate({ ...draft, departmentIds: event.target.checked ? [...draft.departmentIds, department.id] : draft.departmentIds.filter((id) => id !== department.id) })} type="checkbox" /><span>{department.name}</span></label>)}</div></fieldset><label className="sm:col-span-2"><span className="form-label">{labels.personalMessage}</span><textarea className="form-field min-h-20" maxLength={800} onChange={(event) => onUpdate({ ...draft, personalMessage: event.target.value })} value={draft.personalMessage} /></label></div><div className="mt-6 flex justify-end gap-2"><button className="button-secondary" onClick={onClose} type="button">{labels.cancel}</button><button className="button-primary" disabled={pending || draft.name.trim().length < 2 || !draft.questionnaireVersionId || draft.departmentIds.length === 0 || draft.endsOn < draft.startsOn} onClick={onSave} type="button">{pending ? labels.saving : labels.saveDraft}</button></div></div></div>
}
