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
  current: string
  target: string
  status: string
  source: string
  validity: string
  radarDescription: string
  table: string
  capability: string
  type: string
  reason: string
  readOnly: string
  scope: string
  noSource: string
  noCurrentRecord: string
  match: string
  gap: string
  missingEvidence: string
  unknown: string
  currentJob: string
}

function outcomeLabel(outcome: TalentRoleExplorerAxis['status'], labels: Labels): string {
  if (outcome === 'MATCH') return labels.match
  if (outcome === 'GAP') return labels.gap
  if (outcome === 'MISSING_EVIDENCE') return labels.missingEvidence
  return labels.unknown
}

function outcomeClass(outcome: TalentRoleExplorerAxis['status']): string {
  if (outcome === 'MATCH') return 'bg-success-surface text-success'
  if (outcome === 'GAP') return 'bg-destructive/10 text-destructive'
  if (outcome === 'MISSING_EVIDENCE') return 'bg-warning-surface text-warning'
  return 'bg-muted text-muted-foreground'
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

function Radar({ axes, labels }: { axes: TalentRoleExplorerAxis[]; labels: Labels }) {
  if (axes.length === 0) return null
  const center = 150
  const radius = 104
  const maxRank = Math.max(1, ...axes.flatMap((axis) => [axis.targetLevelRank ?? 0, axis.currentLevelRank ?? 0]))
  const grid = radarGrid(axes, center, radius, maxRank)
  return <div className="grid gap-5 lg:grid-cols-[minmax(17rem,24rem)_minmax(0,1fr)] lg:items-center">
    <div className="rounded-2xl border bg-muted/20 p-3">
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
    </div>
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{labels.radarDescription}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {axes.map((axis) => <div className="rounded-xl border bg-surface p-3" key={axis.requirementId}><p className="font-medium">{axis.capabilityName}</p><p className="mt-1 text-xs text-muted-foreground">{axis.capabilityCode} · {axis.capabilityType}</p><span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${outcomeClass(axis.status)}`}>{outcomeLabel(axis.status, labels)}</span></div>)}
      </div>
    </div>
  </div>
}

function axisValue(value: string | number | null): string {
  return value === null ? '—' : String(value)
}

export function TalentRoleExplorer({ initial, labels, action, mode }: { initial: TalentRoleExplorerWorkspace; labels: Labels; action: string; mode: TalentRoleExplorerMode }) {
  const comparison = initial.comparison
  return <section className="mt-6 space-y-5">
    <form action={action} method="get" className="grid gap-4 rounded-2xl border bg-surface p-5 shadow-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
      {mode !== 'self' ? <label className="grid gap-1.5 text-sm font-medium" htmlFor="role-explorer-employee">{labels.employee}
        <select className="form-field" defaultValue={initial.selectedEmployeeId ?? ''} id="role-explorer-employee" name="employeeId">
          <option value="">{labels.chooseEmployee}</option>
          {initial.employees.map((employee) => <option key={employee.employeeId} value={employee.employeeId}>{employee.employeeLabel} · {employee.employeeNumber}</option>)}
        </select>
      </label> : <div className="rounded-xl border bg-muted/20 p-3 text-sm"><p className="font-medium">{labels.employee}</p><p className="mt-1">{initial.employees[0]?.employeeLabel ?? labels.chooseEmployee}</p><p className="mt-1 text-xs text-muted-foreground">{labels.currentJob}: {initial.employees[0]?.jobTitle ?? '—'}</p></div>}
      <label className="grid gap-1.5 text-sm font-medium" htmlFor="role-explorer-profile">{labels.profile}
        <select className="form-field" defaultValue={initial.selectedProfileVersionId ?? ''} id="role-explorer-profile" name="profileVersionId">
          <option value="">{labels.chooseProfile}</option>
          {initial.profiles.map((profile) => <option key={profile.profileVersionId} value={profile.profileVersionId}>{profile.jobCode} · v{profile.profileVersion}{profile.jobGroupName ? ` · ${profile.jobGroupName}` : ''}</option>)}
        </select>
      </label>
      <button className="button-primary" type="submit">{labels.compare}</button>
    </form>
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground"><span>{labels.scope}: {mode === 'self' ? initial.employees.length : initial.employees.length}</span><span>{labels.asOf}: {initial.asOf}</span><span>{labels.readOnly}</span></div>
    {!comparison ? <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{initial.profiles.length === 0 || initial.employees.length === 0 ? labels.empty : labels.chooseTarget}</p> : <section aria-labelledby="role-explorer-result-title" className="rounded-2xl border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-xl font-semibold" id="role-explorer-result-title">{comparison.employee.employeeLabel} · {comparison.profile.jobCode}</h2><p className="mt-1 text-sm text-muted-foreground">{comparison.profile.jobGroupName ?? ''}</p></div>
        <div className="text-right text-xs text-muted-foreground"><p>{labels.profileVersion}: v{comparison.profile.profileVersion}</p><p className="mt-1">{labels.asOf}: {initial.asOf}</p></div>
      </div>
      <div className="mt-6"><Radar axes={comparison.axes} labels={labels} /></div>
      <div className="mt-7 space-y-3">
        <h3 className="font-semibold">{labels.table}</h3>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-3 py-3" scope="col">{labels.capability}</th><th className="px-3 py-3" scope="col">{labels.type}</th><th className="px-3 py-3" scope="col">{labels.target}</th><th className="px-3 py-3" scope="col">{labels.current}</th><th className="px-3 py-3" scope="col">{labels.status}</th><th className="px-3 py-3" scope="col">{labels.source}</th><th className="px-3 py-3" scope="col">{labels.validity}</th></tr></thead>
            <tbody className="divide-y">{comparison.axes.map((axis) => <tr key={axis.requirementId}><th className="px-3 py-3 align-top font-medium" scope="row"><span>{axis.capabilityName}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{axis.capabilityCode}</span></th><td className="px-3 py-3 align-top">{axis.capabilityType}</td><td className="px-3 py-3 align-top">{axisValue(axis.targetLevelCode)}{axis.targetLanguageLevel ? ` · ${axis.targetLanguageLevel}` : ''}</td><td className="px-3 py-3 align-top">{axis.currentLevelCode ?? axis.currentLanguageLevel ?? labels.noCurrentRecord}</td><td className="px-3 py-3 align-top"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${outcomeClass(axis.status)}`}>{outcomeLabel(axis.status, labels)}</span></td><td className="px-3 py-3 align-top">{axis.sourceType ?? labels.noSource}</td><td className="px-3 py-3 align-top">{axis.validFrom ? `${axis.validFrom}${axis.validUntil ? ` → ${axis.validUntil}` : ''}` : labels.noCurrentRecord}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
      {comparison.axes.some((axis) => axis.rationale) ? <div className="mt-5 space-y-2"><h3 className="font-semibold">{labels.reason}</h3>{comparison.axes.filter((axis) => axis.rationale).map((axis) => <p className="text-sm text-muted-foreground" key={axis.requirementId}><span className="font-medium text-foreground">{axis.capabilityName}:</span> {axis.rationale}</p>)}</div> : null}
    </section>}
  </section>
}
