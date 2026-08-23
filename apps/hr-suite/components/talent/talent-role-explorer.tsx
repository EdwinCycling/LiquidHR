import type { BadgeTone } from '@/components/ui/badge'
import { Badge } from '@/components/ui/badge'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import type { TalentRoleExplorerAxis, TalentRoleExplorerMode, TalentRoleExplorerWorkspace } from '@/lib/talent/role-explorer-service'

type Labels = {
  title: string
  subtitle: string
  employee: string
  profile: string
  chooseEmployee: string
  chooseProfile: string
  compare: string
  empty: string
  chooseTarget: string
  asOf: string
  profileVersion: string
  profileValidity: string
  current: string
  target: string
  status: string
  source: string
  validity: string
  radarDescription: string
  radarUnavailable: string
  table: string
  capability: string
  type: string
  reason: string
  nextAction: string
  readOnly: string
  scope: string
  noSource: string
  noCurrentRecord: string
  currentProfile: string
  noCurrentProfile: string
  noEmployees: string
  noProfiles: string
  noRequirements: string
  match: string
  gap: string
  missingEvidence: string
  unknown: string
  actionMatch: string
  actionGap: string
  actionMissingEvidence: string
  actionUnknown: string
  currentJob: string
}

function outcomeLabel(outcome: TalentRoleExplorerAxis['status'], labels: Labels): string {
  if (outcome === 'MATCH') return labels.match
  if (outcome === 'GAP') return labels.gap
  if (outcome === 'MISSING_EVIDENCE') return labels.missingEvidence
  return labels.unknown
}

function outcomeTone(outcome: TalentRoleExplorerAxis['status']): BadgeTone {
  if (outcome === 'MATCH') return 'success'
  if (outcome === 'GAP') return 'danger'
  if (outcome === 'MISSING_EVIDENCE') return 'warning'
  return 'neutral'
}

function outcomeAction(outcome: TalentRoleExplorerAxis['status'], labels: Labels): string {
  if (outcome === 'MATCH') return labels.actionMatch
  if (outcome === 'GAP') return labels.actionGap
  if (outcome === 'MISSING_EVIDENCE') return labels.actionMissingEvidence
  return labels.actionUnknown
}

function polarPoint(value: number, index: number, count: number, maxRank: number, center: number, radius: number): string {
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2
  const distance = radius * (value / maxRank)
  return `${center + Math.cos(angle) * distance},${center + Math.sin(angle) * distance}`
}

function polygonPoints(axes: TalentRoleExplorerAxis[], key: 'targetLevelRank' | 'currentLevelRank', maxRank: number, center: number, radius: number): string {
  if (axes.length === 0) return ''
  return axes.map((axis, index) => polarPoint(axis[key] ?? 0, index, axes.length, maxRank, center, radius)).join(' ')
}

function radarGrid(axes: TalentRoleExplorerAxis[], center: number, radius: number, maxRank: number): Array<{ points: string; level: number }> {
  return [0.25, 0.5, 0.75, 1].map((factor) => ({
    level: Math.max(1, Math.round(maxRank * factor)),
    points: axes.map((_, index) => polarPoint(maxRank * factor, index, axes.length, maxRank, center, radius)).join(' '),
  }))
}

function radarIsSuitable(axes: TalentRoleExplorerAxis[]): boolean {
  return axes.length >= 3 && axes.every((axis) => axis.targetLevelRank !== null && axis.currentLevelRank !== null)
}

function Radar({ axes, labels }: { axes: TalentRoleExplorerAxis[]; labels: Labels }) {
  const center = 150
  const radius = 104
  const maxRank = Math.max(1, ...axes.flatMap((axis) => [axis.targetLevelRank ?? 0, axis.currentLevelRank ?? 0]))
  const grid = radarGrid(axes, center, radius, maxRank)
  return <div className="grid gap-5 lg:grid-cols-[minmax(17rem,24rem)_minmax(0,1fr)] lg:items-center">
    <Surface className="p-3" variant="subtle">
      <svg aria-labelledby="talent-radar-title talent-radar-description" className="mx-auto aspect-square w-full max-w-sm text-primary" role="img" viewBox="0 0 300 300">
        <title id="talent-radar-title">{labels.title}</title>
        <desc id="talent-radar-description">{labels.radarDescription}</desc>
        {grid.map((ring) => <polygon className="fill-none stroke-current/20" key={ring.level} points={ring.points} strokeWidth="1" />)}
        {axes.map((axis, index) => <line className="stroke-current/15" key={axis.requirementId} x1={center} x2={center + Math.cos((Math.PI * 2 * index) / axes.length - Math.PI / 2) * radius} y1={center} y2={center + Math.sin((Math.PI * 2 * index) / axes.length - Math.PI / 2) * radius} strokeWidth="1" />)}
        <polygon className="fill-muted-foreground/10 stroke-muted-foreground" points={polygonPoints(axes, 'targetLevelRank', maxRank, center, radius)} strokeDasharray="4 4" strokeWidth="2" />
        <polygon className="fill-primary/20 stroke-primary" points={polygonPoints(axes, 'currentLevelRank', maxRank, center, radius)} strokeWidth="2" />
      </svg>
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-primary" />{labels.current}</span>
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border border-muted-foreground border-dashed" />{labels.target}</span>
      </div>
    </Surface>
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{labels.radarDescription}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {axes.map((axis) => <div className="rounded-[var(--radius-control)] border border-subtle bg-surface p-3" key={axis.requirementId}><p className="font-medium">{axis.capabilityName}</p><p className="mt-1 text-xs text-muted-foreground">{axis.capabilityCode} · {axis.capabilityType}</p><Badge className="mt-2" tone={outcomeTone(axis.status)}>{outcomeLabel(axis.status, labels)}</Badge></div>)}
      </div>
    </div>
  </div>
}

function axisValue(value: string | number | null, empty = '—'): string {
  return value === null ? empty : String(value)
}

function validity(axis: TalentRoleExplorerAxis, labels: Labels): string {
  if (!axis.validFrom) return labels.noCurrentRecord
  return `${axis.validFrom}${axis.validUntil ? ` → ${axis.validUntil}` : ''}`
}

function currentValue(axis: TalentRoleExplorerAxis, labels: Labels): string {
  return axis.currentLevelCode ?? axis.currentLanguageLevel ?? labels.noCurrentRecord
}

function MobileComparisonList({ axes, labels }: { axes: TalentRoleExplorerAxis[]; labels: Labels }) {
  return <div className="space-y-3 md:hidden">
    {axes.map((axis) => <article className="rounded-[var(--radius-control)] border border-subtle bg-surface p-4" key={axis.requirementId}>
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="font-medium">{axis.capabilityName}</h4><p className="mt-1 text-xs text-muted-foreground">{axis.capabilityCode} · {axis.capabilityType}</p></div><Badge tone={outcomeTone(axis.status)}>{outcomeLabel(axis.status, labels)}</Badge></div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div><dt className="text-xs text-muted-foreground">{labels.target}</dt><dd className="mt-1">{axisValue(axis.targetLevelCode)}{axis.targetLanguageLevel ? ` · ${axis.targetLanguageLevel}` : ''}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{labels.current}</dt><dd className="mt-1">{currentValue(axis, labels)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{labels.source}</dt><dd className="mt-1">{axis.sourceType ?? labels.noSource}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{labels.validity}</dt><dd className="mt-1">{validity(axis, labels)}</dd></div>
        <div className="col-span-2"><dt className="text-xs text-muted-foreground">{labels.nextAction}</dt><dd className="mt-1">{outcomeAction(axis.status, labels)}</dd></div>
        {axis.rationale ? <div className="col-span-2"><dt className="text-xs text-muted-foreground">{labels.reason}</dt><dd className="mt-1 text-muted-foreground">{axis.rationale}</dd></div> : null}
      </dl>
    </article>)}
  </div>
}

export function TalentRoleExplorer({ initial, labels, action, mode }: { initial: TalentRoleExplorerWorkspace; labels: Labels; action: string; mode: TalentRoleExplorerMode }) {
  const comparison = initial.comparison
  const selectedEmployee = initial.employees.find((employee) => employee.employeeId === initial.selectedEmployeeId) ?? initial.employees[0]
  const noEmployees = initial.employees.length === 0
  const noProfiles = initial.profiles.length === 0
  return <section className="mt-6 space-y-5">
    <Surface className="p-4 sm:p-5" variant="subtle">
      <form action={action} method="get" className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        {mode !== 'self' ? <label className="grid gap-1.5 text-sm font-medium" htmlFor="role-explorer-employee">{labels.employee}
          <DropdownSelect aria-label={labels.employee} className="form-field" defaultValue={initial.selectedEmployeeId ?? ''} emptyLabel={labels.noEmployees} id="role-explorer-employee" name="employeeId" searchable searchPlaceholder={labels.chooseEmployee}><option value="">{labels.chooseEmployee}</option>{initial.employees.map((employee) => <option key={employee.employeeId} value={employee.employeeId}>{employee.employeeLabel} · {employee.employeeNumber}</option>)}</DropdownSelect>
        </label> : <div className="rounded-[var(--radius-control)] border border-subtle bg-surface p-3 text-sm"><p className="font-medium">{labels.employee}</p><p className="mt-1">{selectedEmployee?.employeeLabel ?? labels.chooseEmployee}</p><p className="mt-1 text-xs text-muted-foreground">{labels.currentJob}: {selectedEmployee?.currentJobCode ?? selectedEmployee?.jobTitle ?? '—'}</p></div>}
        <label className="grid gap-1.5 text-sm font-medium" htmlFor="role-explorer-profile">{labels.profile}
          <DropdownSelect aria-label={labels.profile} className="form-field" defaultValue={initial.selectedProfileVersionId ?? ''} emptyLabel={labels.noProfiles} id="role-explorer-profile" name="profileVersionId" searchable searchPlaceholder={labels.chooseProfile}><option value="">{labels.chooseProfile}</option>{initial.profiles.map((profile) => <option key={profile.profileVersionId} value={profile.profileVersionId}>{profile.jobCode} · v{profile.profileVersion}{profile.jobGroupName ? ` · ${profile.jobGroupName}` : ''}</option>)}</DropdownSelect>
        </label>
        <button className="button-primary" disabled={noEmployees || noProfiles} type="submit">{labels.compare}</button>
      </form>
    </Surface>
    {selectedEmployee ? <Surface className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5" variant="subtle"><div><p className="text-xs text-muted-foreground">{labels.currentJob}</p><p className="mt-1 font-semibold">{selectedEmployee.currentJobCode ?? selectedEmployee.jobTitle ?? '—'}</p><p className="mt-1 text-sm text-muted-foreground">{selectedEmployee.jobTitle ?? '—'}</p></div><div><p className="text-xs text-muted-foreground">{labels.currentProfile}</p><p className="mt-1 font-semibold">{selectedEmployee.currentProfileVersionId ? `v${selectedEmployee.currentProfileVersion ?? 0}` : labels.noCurrentProfile}</p></div><div><p className="text-xs text-muted-foreground">{labels.scope}</p><p className="mt-1 font-semibold tabular-nums">{initial.employees.length}</p></div></Surface> : null}
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground"><span>{labels.scope}: {initial.employees.length}</span><span>{labels.asOf}: {initial.asOf}</span><span>{labels.readOnly}</span></div>
    {!comparison ? <Surface className="p-8 text-center text-sm text-muted-foreground"><p>{noEmployees && noProfiles ? labels.empty : noEmployees ? labels.noEmployees : noProfiles ? labels.noProfiles : labels.chooseTarget}</p></Surface> : <Surface aria-labelledby="role-explorer-result-title" className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold" id="role-explorer-result-title">{comparison.employee.employeeLabel}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.currentJob}: {comparison.employee.currentJobCode ?? comparison.employee.jobTitle ?? '—'}</p></div><Badge tone="neutral">{labels.readOnly}</Badge></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-[var(--radius-control)] border border-subtle bg-surface-subtle p-3"><p className="text-xs text-muted-foreground">{labels.current}</p><p className="mt-1 font-medium">{comparison.employee.currentJobCode ?? comparison.employee.jobTitle ?? '—'}</p><p className="mt-1 text-sm text-muted-foreground">{comparison.employee.currentProfileVersionId ? `${labels.profileVersion}: v${comparison.employee.currentProfileVersion ?? 0}` : labels.noCurrentProfile}</p></div><div className="rounded-[var(--radius-control)] border border-subtle bg-surface-subtle p-3"><p className="text-xs text-muted-foreground">{labels.target}</p><p className="mt-1 font-medium">{comparison.profile.jobCode} · v{comparison.profile.profileVersion}</p><p className="mt-1 text-sm text-muted-foreground">{comparison.profile.jobGroupName ?? '—'} · {labels.profileValidity}: {axisValue(comparison.profile.validFrom)}{comparison.profile.validUntil ? ` → ${comparison.profile.validUntil}` : ''}</p></div></div>
      {comparison.axes.length === 0 ? <p className="mt-6 rounded-[var(--radius-control)] border border-dashed border-border-subtle p-6 text-center text-sm text-muted-foreground">{labels.noRequirements}</p> : <>
        <div className="mt-7 space-y-3"><h3 className="font-semibold">{labels.table}</h3><MobileComparisonList axes={comparison.axes} labels={labels} /><div className="hidden overflow-x-auto rounded-[var(--radius-control)] border border-subtle md:block"><table className="w-full min-w-[920px] text-left text-sm"><thead className="bg-surface-subtle text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-3 py-3" scope="col">{labels.capability}</th><th className="px-3 py-3" scope="col">{labels.type}</th><th className="px-3 py-3" scope="col">{labels.target}</th><th className="px-3 py-3" scope="col">{labels.current}</th><th className="px-3 py-3" scope="col">{labels.status}</th><th className="px-3 py-3" scope="col">{labels.source}</th><th className="px-3 py-3" scope="col">{labels.validity}</th><th className="px-3 py-3" scope="col">{labels.nextAction}</th></tr></thead><tbody className="divide-y divide-border-subtle">{comparison.axes.map((axis) => <tr key={axis.requirementId}><th className="px-3 py-3 align-top font-medium" scope="row"><span>{axis.capabilityName}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{axis.capabilityCode}</span></th><td className="px-3 py-3 align-top">{axis.capabilityType}</td><td className="px-3 py-3 align-top">{axisValue(axis.targetLevelCode)}{axis.targetLanguageLevel ? ` · ${axis.targetLanguageLevel}` : ''}</td><td className="px-3 py-3 align-top">{currentValue(axis, labels)}</td><td className="px-3 py-3 align-top"><Badge tone={outcomeTone(axis.status)}>{outcomeLabel(axis.status, labels)}</Badge></td><td className="px-3 py-3 align-top">{axis.sourceType ?? labels.noSource}</td><td className="px-3 py-3 align-top">{validity(axis, labels)}</td><td className="px-3 py-3 align-top">{outcomeAction(axis.status, labels)}</td></tr>)}</tbody></table></div></div>
        {radarIsSuitable(comparison.axes) ? <div className="mt-7 space-y-3"><h3 className="font-semibold">{labels.title}</h3><Radar axes={comparison.axes} labels={labels} /></div> : <p className="mt-7 rounded-[var(--radius-control)] border border-dashed border-border-subtle p-4 text-sm text-muted-foreground">{labels.radarUnavailable}</p>}
      </>}
      {comparison.axes.some((axis) => axis.rationale) ? <div className="mt-6 space-y-2"><h3 className="font-semibold">{labels.reason}</h3>{comparison.axes.filter((axis) => axis.rationale).map((axis) => <p className="text-sm text-muted-foreground" key={axis.requirementId}><span className="font-medium text-foreground">{axis.capabilityName}:</span> {axis.rationale}</p>)}</div> : null}
    </Surface>}
  </section>
}
