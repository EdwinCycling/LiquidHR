import type { TalentComparisonWorkspace } from '@/lib/talent/comparison-service'

type Labels = {
  title: string
  subtitle: string
  employee: string
  profile: string
  chooseEmployee: string
  chooseProfile: string
  compare: string
  empty: string
  requirements: string
  match: string
  gap: string
  missingEvidence: string
  unknown: string
  sourceVersion: string
  sourceRecord: string
  noSourceRecord: string
  jobGroup: string
  currentScope: string
}

function outcomeLabel(outcome: 'MATCH' | 'GAP' | 'MISSING_EVIDENCE' | 'UNKNOWN', labels: Labels): string {
  if (outcome === 'MATCH') return labels.match
  if (outcome === 'GAP') return labels.gap
  if (outcome === 'MISSING_EVIDENCE') return labels.missingEvidence
  return labels.unknown
}

function outcomeClass(outcome: 'MATCH' | 'GAP' | 'MISSING_EVIDENCE' | 'UNKNOWN'): string {
  if (outcome === 'MATCH') return 'bg-success-surface text-success'
  if (outcome === 'GAP') return 'bg-destructive/10 text-destructive'
  if (outcome === 'MISSING_EVIDENCE') return 'bg-warning-surface text-warning'
  return 'bg-muted text-muted-foreground'
}

export function TalentComparisonWorkspace({ initial, labels, action }: { initial: TalentComparisonWorkspace; labels: Labels; action: string }) {
  return <section className="mt-6 space-y-5">
    <form action={action} className="grid gap-4 rounded-2xl border bg-surface p-5 shadow-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
      <label className="grid gap-1.5 text-sm font-medium" htmlFor="comparison-employee">{labels.employee}
        <select className="form-field" defaultValue={initial.selectedEmployeeId ?? ''} id="comparison-employee" name="employeeId">
          <option value="">{labels.chooseEmployee}</option>
          {initial.employees.map((employee) => <option key={employee.employeeId} value={employee.employeeId}>{employee.employeeLabel} · {employee.employeeNumber}</option>)}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium" htmlFor="comparison-profile">{labels.profile}
        <select className="form-field" defaultValue={initial.selectedProfileVersionId ?? ''} id="comparison-profile" name="profileVersionId">
          <option value="">{labels.chooseProfile}</option>
          {initial.profiles.map((profile) => <option key={profile.profileVersionId} value={profile.profileVersionId}>{profile.jobCode} · v{profile.profileVersion}</option>)}
        </select>
      </label>
      <button className="button-primary" type="submit">{labels.compare}</button>
    </form>
    <p className="text-sm text-muted-foreground">{labels.currentScope}: {initial.employees.length}</p>
    {!initial.comparison ? <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{initial.employees.length === 0 || initial.profiles.length === 0 ? labels.empty : labels.chooseProfile}</p> : <section aria-labelledby="comparison-result-title" className="rounded-2xl border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-xl font-semibold" id="comparison-result-title">{initial.comparison.employee.employeeLabel} · {initial.comparison.profile.jobCode}</h2><p className="mt-1 text-sm text-muted-foreground">{initial.comparison.profile.jobGroupName ? `${labels.jobGroup}: ${initial.comparison.profile.jobGroupName}` : ''}</p></div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{labels.sourceVersion}: {initial.comparison.sourceVersion}</span>
      </div>
      <div className="mt-5 grid gap-3">
        <h3 className="font-semibold">{labels.requirements}</h3>
        {initial.comparison.requirements.length === 0 ? <p className="text-sm text-muted-foreground">{labels.empty}</p> : initial.comparison.requirements.map((requirement) => <article className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={requirement.requirementId}><div><p className="font-medium">{requirement.capabilityName}</p><p className="mt-1 text-xs text-muted-foreground">{requirement.capabilityCode} · {requirement.capabilityType}{requirement.targetLevelCode ? ` · ${requirement.targetLevelCode}` : ''}</p>{requirement.rationale ? <p className="mt-2 text-sm text-muted-foreground">{requirement.rationale}</p> : null}<p className="mt-2 text-xs text-muted-foreground">{requirement.sourceRecordId ? `${labels.sourceRecord}: ${requirement.sourceRecordId}` : labels.noSourceRecord}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${outcomeClass(requirement.outcome)}`}>{outcomeLabel(requirement.outcome, labels)}</span></article>)}
      </div>
    </section>}
  </section>
}
