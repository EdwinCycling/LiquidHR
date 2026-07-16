'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useMemo, useState } from 'react'
import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { ConfirmationDialog } from './confirmation-dialog'

type Timeline = 'LABOR_CONDITIONS' | 'SCHEDULE' | 'SALARY' | 'COST_ALLOCATION'
interface Option { id: string; code: string; name: string }
interface Allocation { costCenterId: string; percentage: number }
interface ImpactChoice { key: string; label: string; directTimeline?: Timeline; choice: 'DIRECT' | 'LATER' | 'NOT_APPLICABLE' }
interface ImpactDefinition { key: string; label: string; directTimeline?: Timeline }
interface EmploymentMutationPanelProps {
  employmentId: string
  timeline: Timeline
  canWrite: boolean
  blockCount: number
  latestEffectiveOn?: string
  costCenters?: Option[]
  directPayloads?: Partial<Record<Timeline, object>>
  labels: Record<string, string>
}

export function EmploymentMutationPanel({ employmentId, timeline, canWrite, blockCount, latestEffectiveOn, costCenters = [], directPayloads = {}, labels }: EmploymentMutationPanelProps) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  const [dialog, setDialog] = useState<'change' | 'rollback' | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'failed'>('idle')
  const [pending, setPending] = useState<Record<string, FormDataEntryValue> | null>(null)
  const [rollbackReason, setRollbackReason] = useState('')
  const [allocations, setAllocations] = useState<Allocation[]>([{ costCenterId: costCenters[0]?.id ?? '', percentage: 100 }])
  const impactDefinitions: ImpactDefinition[] = timeline === 'SCHEDULE'
    ? [{ key: 'salary', label: labels.impactScheduleSalary, directTimeline: 'SALARY' }, { key: 'leave', label: labels.impactScheduleLeave }, { key: 'pension', label: labels.impactSchedulePension }, { key: 'payroll', label: labels.impactSchedulePayroll }]
    : timeline === 'SALARY'
      ? [{ key: 'organization', label: labels.impactSalaryOrganization }, { key: 'labor', label: labels.impactSalaryLabor }, { key: 'payroll', label: labels.impactSalaryPayroll }]
      : timeline === 'LABOR_CONDITIONS'
        ? [{ key: 'schedule', label: labels.impactLaborSchedule, directTimeline: 'SCHEDULE' }, { key: 'salary', label: labels.impactLaborSalary, directTimeline: 'SALARY' }, { key: 'leave', label: labels.impactLaborLeave }]
        : []
  const [impacts, setImpacts] = useState<ImpactChoice[]>(impactDefinitions.map((impact) => ({ ...impact, choice: 'LATER' })))
  const allocationTotal = useMemo(() => allocations.reduce((sum, item) => sum + item.percentage, 0), [allocations])
  if (!canWrite) return null

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(Object.fromEntries(form.entries()))
    setDialog('change')
  }

  function payload(values: Record<string, FormDataEntryValue>) {
    if (timeline === 'LABOR_CONDITIONS') return { conditionGroup: String(values.conditionGroup) }
    if (timeline === 'SCHEDULE') return {
      scheduleType: String(values.scheduleType), startWeek: Number(values.startWeek),
      averageDaysPerWeek: Number(values.averageDaysPerWeek), averageHoursPerWeek: Number(values.averageHoursPerWeek),
      partTimeFactor: Number(values.partTimeFactor), timeForTimeAccrual: Number(values.timeForTimeAccrual),
      mondayHours: null, tuesdayHours: null, wednesdayHours: null, thursdayHours: null,
      fridayHours: null, saturdayHours: null, sundayHours: null,
    }
    if (timeline === 'SALARY') return {
      paymentType: String(values.paymentType), paymentFrequency: String(values.paymentFrequency), salaryBasis: 'MANUAL',
      fulltimeAmount: values.paymentType === 'PERIODIC_FIXED' ? Number(values.amount) : null,
      hourlyRate: values.paymentType === 'HOURLY_VARIABLE' ? Number(values.amount) : null,
      currencyCode: 'EUR', salaryScaleStepId: null, caoScaleName: null, caoStepName: null,
    }
    return { allocations }
  }

  async function applyChange() {
    if (!pending || (timeline === 'COST_ALLOCATION' && Math.abs(allocationTotal - 100) > 0.0001)) return
    setBusy(true)
    const directMutations = impacts.flatMap((impact) => impact.choice === 'DIRECT' && impact.directTimeline && directPayloads[impact.directTimeline]
      ? [{ timeline: impact.directTimeline, payload: directPayloads[impact.directTimeline] }]
      : [])
    const requestBody = {
      effectiveOn: String(pending.effectiveOn), reason: String(pending.reason),
      warningCodes: String(pending.effectiveOn) < today ? ['RETROACTIVE_CHANGE'] : [],
      acknowledgements: { confirmed: true, retroactive: String(pending.effectiveOn) < today },
    }
    const response = await fetch(directMutations.length > 0 ? `/api/employments/${employmentId}/changes` : `/api/employments/${employmentId}/timeline/${timeline}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(directMutations.length > 0
        ? { ...requestBody, mutations: [{ timeline, payload: payload(pending) }, ...directMutations] }
        : { ...requestBody, payload: payload(pending) }),
    })
    if (response.ok) {
      const result = await response.json() as { data: { changeSetId: string } }
      await Promise.all(impacts.filter((impact) => impact.choice === 'LATER').map((impact) => fetch(`/api/employments/${employmentId}/follow-ups`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ changeSetId: result.data.changeSetId, subject: impact.label, description: null, responsibleRoleCode: null, responsibleUserId: null, dueOn: null, priority: 'NORMAL' }),
      })))
    }
    setBusy(false); setDialog(null); setStatus(response.ok ? 'saved' : 'failed')
    if (response.ok) router.refresh()
  }

  async function rollback() {
    if (!latestEffectiveOn || !rollbackReason.trim()) return
    setBusy(true)
    const response = await fetch(`/api/employments/${employmentId}/timeline/${timeline}`, {
      method: 'DELETE', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ effectiveOn: latestEffectiveOn, reason: rollbackReason }),
    })
    setBusy(false); setDialog(null); setStatus(response.ok ? 'saved' : 'failed')
    if (response.ok) router.refresh()
  }

  const isTwk = pending ? String(pending.effectiveOn) < today : false
  return (
    <section className="rounded-2xl border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{labels.change}</h2>
        <button type="button" disabled={blockCount <= 1} onClick={() => setDialog('rollback')} className="button-secondary inline-flex items-center gap-2">
          <RotateCcw aria-hidden="true" className="h-4 w-4" />{labels.rollback}
        </button>
      </div>
      {blockCount <= 1 && <p className="mt-2 text-xs text-muted-foreground">{labels.onlyBlockProtected}</p>}
      <form onSubmit={review} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium">{labels.effectiveOn}<input className="form-field" name="effectiveOn" type="date" required defaultValue={today} /></label>
        {timeline === 'LABOR_CONDITIONS' && <label className="grid gap-1.5 text-sm font-medium">{labels.conditionGroup}<input className="form-field" name="conditionGroup" required /></label>}
        {timeline === 'SCHEDULE' && <>
          <label className="grid gap-1.5 text-sm font-medium">{labels.scheduleType}<select className="form-field" name="scheduleType"><option value="HOURS_AND_AVG_DAYS">{labels.hoursAndAverageDays}</option><option value="HOURS_PER_DAY">{labels.hoursPerDay}</option><option value="HOURS_AND_SPECIFIC_DAYS">{labels.hoursAndSpecificDays}</option><option value="TIMES_PER_DAY">{labels.timesPerDay}</option></select></label>
          <label className="grid gap-1.5 text-sm font-medium">{labels.averageHours}<input className="form-field" name="averageHoursPerWeek" type="number" min="0" max="168" step="0.01" required /></label>
          <label className="grid gap-1.5 text-sm font-medium">{labels.averageDays}<input className="form-field" name="averageDaysPerWeek" type="number" min="0" max="7" step="0.01" required /></label>
          <label className="grid gap-1.5 text-sm font-medium">{labels.partTimeFactor}<input className="form-field" name="partTimeFactor" type="number" min="0" max="2" step="0.0001" required /></label>
          <label className="grid gap-1.5 text-sm font-medium">{labels.startWeek}<input className="form-field" name="startWeek" type="number" min="1" max="53" defaultValue="1" required /></label>
          <label className="grid gap-1.5 text-sm font-medium">{labels.timeForTime}<input className="form-field" name="timeForTimeAccrual" type="number" min="0" step="0.01" defaultValue="0" required /></label>
        </>}
        {timeline === 'SALARY' && <>
          <label className="grid gap-1.5 text-sm font-medium">{labels.paymentType}<select className="form-field" name="paymentType"><option value="PERIODIC_FIXED">{labels.periodicFixed}</option><option value="HOURLY_VARIABLE">{labels.hourlyVariable}</option></select></label>
          <label className="grid gap-1.5 text-sm font-medium">{labels.paymentFrequency}<select className="form-field" name="paymentFrequency"><option value="MONTHLY">{labels.monthly}</option><option value="FOUR_WEEKLY">{labels.fourWeekly}</option></select></label>
          <label className="grid gap-1.5 text-sm font-medium">{labels.fulltimeAmount} / {labels.hourlyRate}<input className="form-field" name="amount" type="number" min="0" step="0.01" required /></label>
        </>}
        {timeline === 'COST_ALLOCATION' && <div className="sm:col-span-2 space-y-3">
          {allocations.map((allocation, index) => <div key={index} className="grid grid-cols-[1fr_8rem_auto] gap-2">
            <select aria-label={labels.costCenter} className="form-field" value={allocation.costCenterId} onChange={(event) => setAllocations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, costCenterId: event.target.value } : item))}>{costCenters.map((option) => <option key={option.id} value={option.id}>{option.code} · {option.name}</option>)}</select>
            <input aria-label={labels.percentage} className="form-field" type="number" min="0.01" max="100" step="0.01" value={allocation.percentage} onChange={(event) => setAllocations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, percentage: Number(event.target.value) } : item))} />
            <button aria-label={labels.rollback} type="button" className="rounded-lg p-2 hover:bg-muted" onClick={() => setAllocations((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></button>
          </div>)}
          <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" className="button-secondary inline-flex items-center gap-2" onClick={() => setAllocations((current) => [...current, { costCenterId: costCenters[0]?.id ?? '', percentage: 0 }])}><Plus className="h-4 w-4" />{labels.addAllocation}</button><p className={allocationTotal === 100 ? 'text-sm text-success' : 'text-sm text-danger'}>{labels.allocationTotal.replace('{total}', String(allocationTotal))}</p></div>
          {allocationTotal !== 100 && <p className="text-sm text-danger">{labels.allocationMustBe100}</p>}
        </div>}
        {impacts.length > 0 && <fieldset className="sm:col-span-2 rounded-xl border bg-muted/40 p-4"><legend className="px-1 text-sm font-semibold">{labels.impactTitle}</legend><div className="mt-2 space-y-3">{impacts.map((impact) => <div key={impact.key} className="grid gap-2 sm:grid-cols-[1fr_12rem] sm:items-center"><p className="text-sm text-muted-foreground">{impact.label}</p><select className="form-field" value={impact.choice} onChange={(event) => setImpacts((current) => current.map((item) => item.key === impact.key ? { ...item, choice: event.target.value as ImpactChoice['choice'] } : item))}><option value="DIRECT" disabled={!impact.directTimeline || !directPayloads[impact.directTimeline]}>{labels.impactDirect}</option><option value="LATER">{labels.impactLater}</option><option value="NOT_APPLICABLE">{labels.impactNotApplicable}</option></select></div>)}</div></fieldset>}
        <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">{labels.changeReason}<textarea className="form-field min-h-24" name="reason" required maxLength={500} /></label>
        <div className="sm:col-span-2 flex items-center gap-3"><button className="button-primary" type="submit">{labels.continue}</button>{status === 'saved' && <span className="text-sm text-success">{labels.changeSaved}</span>}{status === 'failed' && <span className="text-sm text-danger">{labels.changeFailed}</span>}</div>
      </form>
      <ConfirmationDialog open={dialog === 'change'} title={isTwk ? labels.twkTitle : labels.normalConfirmTitle} description={isTwk ? labels.twkWarning : labels.normalConfirmText} confirmLabel={labels.confirm} cancelLabel={labels.cancel} busy={busy} warning={isTwk} onCancel={() => setDialog(null)} onConfirm={applyChange} />
      <ConfirmationDialog open={dialog === 'rollback'} title={labels.rollbackTitle} description={labels.rollbackWarning} confirmLabel={labels.rollbackConfirm} cancelLabel={labels.cancel} busy={busy} warning onCancel={() => setDialog(null)} onConfirm={rollback}>
        <label className="mt-4 grid gap-1.5 text-sm font-medium">{labels.rollbackReason}<input className="form-field" value={rollbackReason} onChange={(event) => setRollbackReason(event.target.value)} /></label>
      </ConfirmationDialog>
    </section>
  )
}
