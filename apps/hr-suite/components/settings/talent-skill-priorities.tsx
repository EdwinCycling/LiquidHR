'use client'

import Link from 'next/link'
import { useState } from 'react'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { FormField } from '@/components/patterns/form-field'
import type { StarPerformersInsights } from '@/lib/star-performers/insights-service'
import type { StarPerformersInsightLabels } from '@/lib/star-performers/presentation'
import { matchingDevelopmentPlans } from '@/lib/star-performers/skill-gap-priorities'

export function TalentSkillPriorities({ data, labels, canViewEmployees }: { data: StarPerformersInsights; labels: StarPerformersInsightLabels; canViewEmployees: boolean }) {
  const [capability, setCapability] = useState('')
  const [planStatus, setPlanStatus] = useState('')
  if (data.skillGaps.state === 'unavailable') return <Surface className="p-4" variant="subtle"><p role="status">{labels.unavailable}</p></Surface>
  const planSource = data.development.sources.plans
  const choices = [...new Map(data.skillGaps.rows.map(row => [row.capabilityId, row.capabilityName])).entries()].sort((a, b) => a[1].localeCompare(b[1]))
  const entries = data.skillGaps.rows.flatMap(row => row.employees.filter(employee => employee.status !== 'MATCH').map(employee => ({ row, employee, plans: matchingDevelopmentPlans(data.development.plans, employee.employeeId, row.capabilityId) })))
    .filter(item => (!capability || item.row.capabilityId === capability) && (!planSource || !planStatus || (planStatus === 'NO_PLAN' ? item.plans.length === 0 : item.plans.some(plan => plan.status === planStatus))))
  const statusNames: Record<string, string> = { INSUFFICIENT_LEVEL: labels.skillGapInsufficientLevel, MISSING_LEVEL: labels.skillGapMissingLevel, NOT_ASSESSED: labels.skillGapNotAssessed, MISSING_EVIDENCE: labels.skillGapMissingEvidence, EXPIRED_EVIDENCE: labels.skillGapExpiredEvidence }
  const planStatusNames: Record<string, string> = { ACTIVE: labels.priorityActive, DRAFT: labels.priorityDraft, COMPLETED: labels.priorityCompleted, CANCELLED: labels.priorityCancelled, ARCHIVED: labels.priorityArchived }
  return <Surface className="space-y-4 p-4" variant="subtle">
    <div><h3 className="font-semibold">{labels.priorityTitle}</h3><p className="mt-1 text-sm text-muted-foreground">{labels.priorityExplanation}</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <FormField label={labels.priorityCapability} control={<DropdownSelect value={capability} onChange={event => setCapability(event.target.value)} searchable><option value="">{labels.priorityAll}</option>{choices.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</DropdownSelect>} />
      <FormField label={labels.priorityPlanStatus} control={<DropdownSelect value={planStatus} onChange={event => setPlanStatus(event.target.value)} disabled={!planSource}><option value="">{labels.priorityAll}</option><option value="ACTIVE">{labels.priorityActive}</option><option value="DRAFT">{labels.priorityDraft}</option><option value="COMPLETED">{labels.priorityCompleted}</option><option value="CANCELLED">{labels.priorityCancelled}</option><option value="ARCHIVED">{labels.priorityArchived}</option><option value="NO_PLAN">{labels.priorityNoPlan}</option></DropdownSelect>} />
    </div>
    <p className="text-xs text-muted-foreground">{labels.priorityFilterScope}</p>
    {!planSource && <p role="status" className="text-sm">{labels.prioritySourceUnavailable}</p>}
    {!data.development.sources.actions && <p role="status" className="text-sm">{labels.priorityActionsUnavailable}</p>}
    <ul className="divide-y divide-border-subtle">{entries.slice(0, 100).map(({ row, employee, plans }) => {
      const visiblePlans = planSource && planStatus && planStatus !== 'NO_PLAN' ? plans.filter(plan => plan.status === planStatus) : plans
      const actions = data.development.actions.filter(action => action.employeeId === employee.employeeId)
      return <li key={`${row.id}:${employee.employeeId}`} className="space-y-1 py-3 text-sm">
        <p className="font-semibold"><Link className="text-primary underline" href={row.href}>{row.capabilityName} · {row.roleLabel}</Link> · {row.departmentName ?? '—'}</p>
        <p>{canViewEmployees ? <Link className="text-primary underline" href={employee.href}>{employee.employeeLabel}</Link> : employee.employeeLabel} · {statusNames[employee.status] ?? labels.skillGapStatus}{employee.currentLevelLabel ? ` · ${labels.skillGapCurrentLevel}: ${employee.currentLevelLabel}` : ''} · {labels.skillGapRequiredLevel}: {row.requiredLevelLabel ?? '—'}</p>
        {planSource && (visiblePlans.length ? <ul>{visiblePlans.map(plan => <li key={plan.id}><Link className="text-primary underline" href={plan.href}>{plan.title}</Link> · {planStatusNames[plan.status] ?? labels.priorityUnknownStatus} · {plan.progressPercent}%</li>)}</ul> : <p className="text-muted-foreground">{labels.priorityNoPlan}</p>)}
        {data.development.sources.actions && actions.length > 0 && <details><summary className="cursor-pointer text-primary">{labels.priorityContextActions}</summary><p className="text-xs text-muted-foreground">{labels.priorityActionDisclaimer}</p><ul>{actions.map(action => <li key={action.id}><Link className="text-primary underline" href={action.href}>{action.title}</Link>{action.dueOn ? ` · ${action.dueOn}` : ''}</li>)}</ul></details>}
      </li>
    })}</ul>
    {!entries.length && <p className="text-sm text-muted-foreground">{labels.priorityEmpty}</p>}
    {entries.length > 100 && <p role="status" className="text-sm">{labels.priorityTruncated}</p>}
    <p className="text-xs text-muted-foreground">{labels.prioritySourceLimit}</p>
  </Surface>
}
