'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition, type FormEvent } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { CalendarDays, Compass, Plus, Search, ShieldCheck, Sparkles, Users } from 'lucide-react'
import type { getTeamCompassWorkspace } from '@/lib/team-compass/service'
import { Badge } from '@/components/ui/badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { CollectionToolbar } from '@/components/patterns/collection-toolbar'
import { DataTableShell } from '@/components/patterns/data-table-shell'
import { EntityList } from '@/components/patterns/entity-list'
import { FilterBar } from '@/components/patterns/filter-bar'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { PageHeader } from '@/components/patterns/page-header'
import { RowActions } from '@/components/patterns/row-actions'
import { PageShell } from '@/components/layout/page-shell'
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
  'confirmStart' | 'confirmClose' | 'confirmArchive' | 'discardTitle' | 'discardDescription' | 'discardConfirm' | 'keepEditing', string
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

type TransitionRequest = { campaignId: string; action: 'START' | 'CLOSE' | 'ARCHIVE'; version: number; confirmation: string }
const today = new Date().toISOString().slice(0, 10)

function statusLabel(status: string, labels: TeamCompassLabels): string {
  const map: Record<string, string> = { DRAFT: labels.statusDraft, ACTIVE: labels.statusActive, CLOSED: labels.statusClosed, ARCHIVED: labels.statusArchived, INVITED: labels.statusInvited, IN_PROGRESS: labels.statusInProgress, COMPLETED: labels.statusCompleted, DECLINED: labels.statusDeclined }
  return map[status] ?? status
}

function initialDraft(workspace: Workspace): CampaignDraft {
  return { campaignId: null, expectedVersion: null, questionnaireVersionId: workspace.questionnaireVersions[0]?.id ?? '', name: '', description: '', personalMessage: '', startsOn: today, endsOn: today, anonymityThreshold: 5, departmentIds: [] }
}

export function TeamCompassWorkspace({ initial, labels, selectedCampaignId, managementOnly = false }: { initial: Workspace; labels: TeamCompassLabels; selectedCampaignId?: string; managementOnly?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [message, setMessage] = useState('')
  const [draft, setDraft] = useState<CampaignDraft | null>(null)
  const [transition, setTransition] = useState<TransitionRequest | null>(null)
  const campaigns = useMemo(() => initial.campaigns.filter((campaign) => {
    const query = search.trim().toLocaleLowerCase()
    return (!query || `${campaign.name} ${campaign.status}`.toLocaleLowerCase().includes(query)) && (!status || campaign.status === status)
  }), [initial.campaigns, search, status])
  const selected = initial.campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null
  const targetIds = (campaignId: string): string[] => initial.targets.filter((target) => target.campaign_id === campaignId).map((target) => target.department_id)
  const participantCount = (campaignId: string): number => initial.participations.filter((participation) => participation.campaign_id === campaignId).length
  const completedCount = (campaignId: string): number => initial.participations.filter((participation) => participation.campaign_id === campaignId && participation.status === 'COMPLETED').length

  function openCampaign(campaignId: string): void {
    router.push(`${pathname}?${new URLSearchParams({ campaign: campaignId }).toString()}`)
  }

  function editCampaign(campaignId: string): void {
    const campaign = initial.campaigns.find((item) => item.id === campaignId)
    if (!campaign) return
    setDraft({ campaignId: campaign.id, expectedVersion: campaign.version, questionnaireVersionId: campaign.questionnaire_version_id, name: campaign.name, description: campaign.description ?? '', personalMessage: campaign.personal_message ?? '', startsOn: campaign.starts_on, endsOn: campaign.ends_on, anonymityThreshold: campaign.anonymity_threshold, departmentIds: targetIds(campaign.id) })
  }

  async function request(url: string, body: object): Promise<boolean> {
    setMessage('')
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!response.ok) { setMessage(labels.failed); return false }
    setMessage(labels.saved)
    startTransition(() => router.refresh())
    return true
  }

  async function saveDraft(): Promise<void> {
    if (!draft) return
    if (await request('/api/team-compass/campaigns', draft)) setDraft(null)
  }

  async function confirmTransition(): Promise<void> {
    if (!transition) return
    const current = transition
    setTransition(null)
    await request(`/api/team-compass/campaigns/${current.campaignId}/transition`, { action: current.action, expectedVersion: current.version })
  }

  const subtitle = initial.mode === 'admin' ? labels.subtitleAdmin : initial.mode === 'manager' ? labels.subtitleManager : labels.subtitleEmployee
  if (initial.mode === 'employee') return <EmployeeWorkspace initial={initial} labels={labels} subtitle={subtitle} />

  return <PageShell className="space-y-6 py-8" width="wide">
    <PageHeader actions={initial.mode === 'admin' ? <Button onClick={() => setDraft(initialDraft(initial))} type="button"><Plus aria-hidden="true" size={16} />{labels.newCampaign}</Button> : undefined} description={managementOnly ? labels.managementSubtitle : subtitle} title={managementOnly ? labels.managementTitle : labels.title} />
    <Surface className="flex items-start gap-3 p-4 text-sm" variant="subtle"><ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-primary" size={20} /><div><p className="font-semibold">{labels.privacyTitle}</p><p className="mt-1 text-muted-foreground">{labels.disclaimer} {labels.privacyConsent}</p></div></Surface>
    {message ? <p aria-live="polite" className="border border-border-subtle bg-surface-subtle px-4 py-3 text-sm">{message}</p> : null}
    <section className="space-y-3">
      <CollectionToolbar search={<TextInput aria-label={labels.searchCampaigns} leadingIcon={<Search aria-hidden="true" />} onChange={(event) => setSearch(event.target.value)} placeholder={labels.searchPlaceholder} value={search} />} />
      <FilterBar><FormField className="min-w-48 flex-1" control={<DropdownSelect aria-label={labels.status} onChange={(event) => setStatus(event.target.value)} value={status}><option value="">{labels.allStatuses}</option>{['DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED'].map((value) => <option key={value} value={value}>{statusLabel(value, labels)}</option>)}</DropdownSelect>} label={labels.status} /></FilterBar>
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{labels.campaigns}</h2><p className="text-sm text-muted-foreground">{initial.campaigns.length} {labels.campaigns.toLocaleLowerCase()}</p></div></div>
      <div className="hidden md:block"><DataTableShell caption={labels.campaigns} state={campaigns.length ? 'ready' : 'empty'} stateContent={<p className="text-sm text-muted-foreground">{labels.emptyCampaigns}</p>}>
        <thead className="border-b border-border-subtle bg-surface-subtle text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3">{labels.campaignName}</th><th className="px-4 py-3">{labels.status}</th><th className="px-4 py-3">{labels.deadline}</th><th className="px-4 py-3">{labels.progress}</th><th className="px-5 py-3 text-right">{labels.actions}</th></tr></thead>
        <tbody className="divide-y divide-border-subtle">{campaigns.map((campaign) => { const total = participantCount(campaign.id); const done = completedCount(campaign.id); const campaignTargets = targetIds(campaign.id).map((id) => initial.departments.find((department) => department.id === id)?.name).filter(Boolean).join(', '); const menuItems = [{ id: 'open', label: labels.open, onSelect: () => openCampaign(campaign.id) }]; if (campaign.status === 'DRAFT' && initial.mode === 'admin') { menuItems.push({ id: 'edit', label: labels.editCampaign, onSelect: () => editCampaign(campaign.id) }, { id: 'start', label: labels.start, onSelect: () => setTransition({ campaignId: campaign.id, action: 'START', version: campaign.version, confirmation: labels.confirmStart }) }) } if (campaign.status === 'ACTIVE' && initial.mode === 'admin') menuItems.push({ id: 'close', label: labels.close, onSelect: () => setTransition({ campaignId: campaign.id, action: 'CLOSE', version: campaign.version, confirmation: labels.confirmClose }) }); if (campaign.status === 'CLOSED' && initial.mode === 'admin') menuItems.push({ id: 'archive', label: labels.archive, onSelect: () => setTransition({ campaignId: campaign.id, action: 'ARCHIVE', version: campaign.version, confirmation: labels.confirmArchive }) }); return <tr key={campaign.id}><td className="px-5 py-4"><Button className="justify-start px-0 text-left" onClick={() => openCampaign(campaign.id)} size="sm" type="button" variant="ghost"><span className="block"><span className="block font-semibold">{campaign.name}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{campaignTargets}</span></span></Button></td><td className="px-4 py-4"><Badge tone={campaign.status === 'ACTIVE' ? 'success' : 'neutral'}>{statusLabel(campaign.status, labels)}</Badge></td><td className="px-4 py-4">{campaign.ends_on}</td><td className="px-4 py-4"><div className="flex items-center gap-3"><div aria-hidden="true" className="h-2 w-24 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div><span>{done}/{total}</span></div></td><td className="px-5 py-4"><RowActions menuLabel={labels.actions} menuItems={menuItems} /></td></tr> })}</tbody>
      </DataTableShell></div>
      <div className="md:hidden"><EntityList ariaLabel={labels.campaigns} empty={<p className="border border-dashed border-border-subtle p-8 text-center text-sm text-muted-foreground">{labels.emptyCampaigns}</p>} items={campaigns.map((campaign) => { const total = participantCount(campaign.id); const done = completedCount(campaign.id); const menuItems = [{ id: 'open', label: labels.open, onSelect: () => openCampaign(campaign.id) }]; if (campaign.status === 'DRAFT' && initial.mode === 'admin') menuItems.push({ id: 'edit', label: labels.editCampaign, onSelect: () => editCampaign(campaign.id) }, { id: 'start', label: labels.start, onSelect: () => setTransition({ campaignId: campaign.id, action: 'START', version: campaign.version, confirmation: labels.confirmStart }) }); return { id: campaign.id, primary: <Button className="justify-start px-0 text-left font-semibold" onClick={() => openCampaign(campaign.id)} size="sm" type="button" variant="ghost">{campaign.name}</Button>, secondary: <span>{campaign.ends_on} · {done}/{total} {labels.completed.toLocaleLowerCase()}</span>, badges: <Badge tone={campaign.status === 'ACTIVE' ? 'success' : 'neutral'}>{statusLabel(campaign.status, labels)}</Badge>, actions: <RowActions menuLabel={labels.actions} menuItems={menuItems} /> } })} /></div>
    </section>
    {!managementOnly ? <><TeamProjection campaign={selected} labels={labels} projection={initial.projection} />{selected ? <ParticipantProgress campaignId={selected.id} labels={labels} workspace={initial} /> : null}</> : null}
    {draft ? <CampaignDrawer draft={draft} labels={labels} pending={pending} workspace={initial} onClose={() => setDraft(null)} onSave={() => void saveDraft()} onUpdate={setDraft} /> : null}
    <ConfirmDialog cancelLabel={labels.cancel} confirmLabel={transition?.action === 'START' ? labels.start : transition?.action === 'CLOSE' ? labels.close : labels.archive} description={transition?.confirmation} onConfirm={() => void confirmTransition()} onOpenChange={(open) => { if (!open) setTransition(null) }} open={transition !== null} title={labels.campaigns} pending={pending} />
  </PageShell>
}

function TeamProjection({ campaign, projection, labels }: { campaign: Workspace['campaigns'][number] | null; projection: Workspace['projection']; labels: TeamCompassLabels }) {
  if (!campaign) return <Surface className="border-dashed p-10 text-center text-sm text-muted-foreground" variant="subtle"><Compass aria-hidden="true" className="mx-auto mb-3" size={28} />{labels.selectCampaign}</Surface>
  if (!projection) return null
  const remaining = Math.max(0, projection.threshold - projection.completedCount)
  if (!projection.available || !projection.outerPercentages) return <Surface className="flex gap-3 p-6" variant="subtle"><ShieldCheck aria-hidden="true" className="text-primary" /><div><h2 className="font-semibold">{labels.privacyTitle}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.privacyThreshold.replace('{remaining}', String(remaining))}</p><p className="mt-3 text-xs">{projection.completedCount}/{projection.invitedCount} {labels.completed.toLocaleLowerCase()}</p></div></Surface>
  const coordinates = percentagesToCoordinates(projection.outerPercentages)
  const scores = Object.entries(projection.outerPercentages).sort((left, right) => right[1] - left[1])
  const focused = (scores[0]?.[1] ?? 0) - (scores[3]?.[1] ?? 0) > 20
  const dimensionLabel = (dimension: string): string => dimension === 'ACTION' ? labels.dimensionAction : dimension === 'VISION' ? labels.dimensionVision : dimension === 'HARMONY' ? labels.dimensionHarmony : labels.dimensionLogic
  return <section className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.7fr)]"><Surface className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">{campaign.name}</p><h2 className="mt-1 text-xl font-semibold">{labels.teamCompass}</h2></div><Badge tone="success">{labels.aggregateAvailable}</Badge></div><TeamCompassCompass labels={{ action: labels.dimensionAction, vision: labels.dimensionVision, harmony: labels.dimensionHarmony, logic: labels.dimensionLogic }} points={[{ id: 'team', label: labels.title, kind: 'team', ...coordinates }, ...(projection.namedProfiles ?? []).map((profile) => ({ id: profile.employeeId, label: profile.label, kind: 'outer' as const, ...profile.outer }))]} /></Surface><div className="space-y-5"><Surface className="p-5"><h2 className="text-lg font-semibold">{labels.teamMix}</h2><div className="mt-4 space-y-3">{scores.map(([dimension, score]) => <div key={dimension}><div className="flex justify-between text-sm"><span>{dimensionLabel(dimension)}</span><strong>{Math.round(score)}%</strong></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${score}%` }} /></div></div>)}</div></Surface><Surface className="bg-primary p-5 text-primary-foreground"><Sparkles aria-hidden="true" size={20} /><h2 className="mt-3 text-lg font-semibold">{labels.insight}</h2><p className="mt-2 text-sm leading-6 text-primary-foreground/85">{focused ? labels.focusedInsight : labels.balancedInsight}</p></Surface><Surface className="p-5"><h2 className="font-semibold">{labels.namedProfiles}</h2><p className="mt-2 text-sm text-muted-foreground">{projection.namedProfiles?.length ? `${projection.namedProfiles.length} ${labels.participants.toLocaleLowerCase()}` : labels.noNamedProfiles}</p></Surface></div></section>
}

function EmployeeWorkspace({ initial, labels, subtitle }: { initial: Workspace; labels: TeamCompassLabels; subtitle: string }) {
  const campaignById = new Map(initial.campaigns.map((campaign) => [campaign.id, campaign]))
  const profileByParticipation = new Map(initial.profiles.map((profile) => [profile.participation_id, profile]))
  return <PageShell className="space-y-6 py-8" width="standard"><PageHeader description={subtitle} title={labels.myCompass} /><Surface className="p-4 text-sm text-muted-foreground" variant="subtle"><strong className="text-foreground">{labels.privacyTitle}.</strong> {labels.disclaimer}</Surface><section className="grid gap-4 md:grid-cols-2">{initial.participations.map((participation) => { const campaign = campaignById.get(participation.campaign_id); const profile = profileByParticipation.get(participation.id); return <Surface className="p-5" key={participation.id}><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{campaign?.name ?? labels.title}</h2><p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays aria-hidden="true" size={14} />{campaign?.ends_on}</p></div><Badge>{statusLabel(participation.status, labels)}</Badge></div><p className="mt-4 text-sm text-muted-foreground">{campaign?.personal_message || campaign?.description || labels.disclaimer}</p><div className="mt-5"><Link className={buttonClasses({ variant: 'primary' })} href={profile ? `/team-compass/results/${participation.id}` : `/team-compass/assessment/${participation.id}`}>{profile ? labels.viewResult : labels.continueAssessment}</Link></div></Surface> })}</section>{initial.participations.length === 0 ? <Surface className="border-dashed p-10 text-center text-sm text-muted-foreground" variant="subtle"><Users aria-hidden="true" className="mx-auto mb-3" size={26} />{labels.emptyParticipations}</Surface> : null}</PageShell>
}

function ParticipantProgress({ campaignId, labels, workspace }: { campaignId: string; labels: TeamCompassLabels; workspace: Workspace }) {
  const employees = new Map(workspace.employees.map((employee) => [employee.id, employee]))
  const rows = workspace.participations.filter((participation) => participation.campaign_id === campaignId)
  return <Surface className="overflow-hidden"><div className="border-b border-border-subtle p-5"><h2 className="text-lg font-semibold">{labels.participants}</h2><p className="mt-1 text-sm text-muted-foreground">{rows.filter((row) => row.status === 'COMPLETED').length}/{rows.length} {labels.completed.toLocaleLowerCase()}</p></div><div className="divide-y divide-border-subtle">{rows.map((participation) => { const employee = employees.get(participation.employee_id); const name = [employee?.first_name, employee?.birth_name].filter(Boolean).join(' ') || employee?.employee_number || participation.employee_id; return <div className="flex items-center justify-between gap-4 px-5 py-3 text-sm" key={participation.id}><div className="min-w-0"><p className="truncate font-medium">{name}</p><p className="text-xs text-muted-foreground">{employee?.employee_number}</p></div><Badge>{statusLabel(participation.status, labels)}</Badge></div> })}{rows.length === 0 ? <p className="p-6 text-sm text-muted-foreground">{labels.emptyParticipations}</p> : null}</div></Surface>
}

function CampaignDrawer({ draft, labels, workspace, pending, onUpdate, onSave, onClose }: { draft: CampaignDraft; labels: TeamCompassLabels; workspace: Workspace; pending: boolean; onUpdate(value: CampaignDraft): void; onSave(): void; onClose(): void }) {
  const [originalDraft] = useState(() => draft)
  const [departmentSearch, setDepartmentSearch] = useState('')
  const departments = workspace.departments.filter((department) => department.name.toLocaleLowerCase().includes(departmentSearch.trim().toLocaleLowerCase()))
  const dirty = JSON.stringify(originalDraft) !== JSON.stringify(draft)
  const update = (patch: Partial<CampaignDraft>): void => onUpdate({ ...draft, ...patch })
  function submit(event: FormEvent<HTMLFormElement>): void { event.preventDefault(); onSave() }
  return <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.cancel} description={labels.privacyConsent} dirty={dirty} dirtyProtection={{ title: labels.discardTitle, description: labels.discardDescription, discardLabel: labels.discardConfirm, keepEditingLabel: labels.keepEditing }} onDiscard={onClose} onOpenChange={(open) => { if (!open && !dirty) onClose() }} onSubmit={submit} open saveLabel={pending ? labels.saving : labels.saveDraft} saving={pending} title={draft.campaignId ? labels.editCampaign : labels.newCampaign}>
    <div className="grid gap-4 sm:grid-cols-2"><FormField className="sm:col-span-2" control={<TextInput maxLength={120} minLength={2} onChange={(event) => update({ name: event.target.value })} required value={draft.name} />} label={labels.campaignName} required /><FormField className="sm:col-span-2" control={<Textarea maxLength={600} onChange={(event) => update({ description: event.target.value })} value={draft.description} />} label={labels.description} /><FormField control={<TextInput onChange={(event) => update({ startsOn: event.target.value })} required type="date" value={draft.startsOn} />} label={labels.startsOn} required /><FormField control={<TextInput min={draft.startsOn} onChange={(event) => update({ endsOn: event.target.value })} required type="date" value={draft.endsOn} />} label={labels.endsOn} required /><FormField control={<DropdownSelect onChange={(event) => update({ questionnaireVersionId: event.target.value })} required value={draft.questionnaireVersionId}>{workspace.questionnaireVersions.map((version) => <option key={version.id} value={version.id}>{version.name_nl} · v{version.version}</option>)}</DropdownSelect>} label={labels.questionnaire} required /><FormField control={<TextInput max={50} min={5} onChange={(event) => update({ anonymityThreshold: Number(event.target.value) })} required type="number" value={draft.anonymityThreshold} />} description={labels.thresholdHelp} label={labels.threshold} required /><fieldset className="sm:col-span-2"><legend className="mb-1.5 text-sm font-medium">{labels.chooseDepartments}</legend><TextInput aria-label={labels.departments} leadingIcon={<Search aria-hidden="true" />} onChange={(event) => setDepartmentSearch(event.target.value)} placeholder={labels.searchPlaceholder} value={departmentSearch} /><div className="mt-2 grid max-h-44 gap-1 overflow-y-auto rounded-[var(--radius-control)] border border-border-subtle p-2">{departments.map((department) => <Checkbox checked={draft.departmentIds.includes(department.id)} key={department.id} label={department.name} onChange={(event) => update({ departmentIds: event.target.checked ? [...draft.departmentIds, department.id] : draft.departmentIds.filter((id) => id !== department.id) })} />)}</div></fieldset><FormField className="sm:col-span-2" control={<Textarea maxLength={800} onChange={(event) => update({ personalMessage: event.target.value })} value={draft.personalMessage} />} label={labels.personalMessage} /></div>
  </FormDrawer>
}
