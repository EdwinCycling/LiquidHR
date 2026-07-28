'use client'

import { Plus, Search, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { OvertimeSettingsPageData } from '@/lib/leave/leave-service'

type LimitMode = 'UNLIMITED' | 'MONTHLY_HOURS' | 'YEARLY_HOURS' | 'CONTRACT_HOURS_FACTOR'
export type OvertimePanelMode = 'OVERTIME' | 'WORK'
export type OvertimePanelLabels = {
  managerNotification: string
  selfService: string
  limitForEveryone: string
  unlimited: string
  monthlyHours: string
  yearlyHours: string
  contractFactor: string
  limitHours: string
  factor: string
  save: string
  saving: string
  saved: string
  failed: string
  exceptions: string
  addException: string
  exceptionName: string
  exceptionType: string
  exceptionSelfService: string
  allowEntry: string
  forbidEntry: string
  selectionMode: string
  onePerson: string
  multiplePeople: string
  selectPerson: string
  selectPeople: string
  search: string
  selectAll: string
  next: string
  cancel: string
  create: string
  created: string
  selectedPeople: string
  noExceptions: string
  notAvailable: string
  invalid: string
}

function limitLabel(mode: LimitMode, labels: OvertimePanelLabels): string {
  if (mode === 'MONTHLY_HOURS') return labels.monthlyHours
  if (mode === 'YEARLY_HOURS') return labels.yearlyHours
  if (mode === 'CONTRACT_HOURS_FACTOR') return labels.contractFactor
  return labels.unlimited
}

export function OvertimeSettingsPanel({ workHourTypeId, initial, labels, mode = 'OVERTIME' }: { workHourTypeId: string; initial: OvertimeSettingsPageData; labels: OvertimePanelLabels; mode?: OvertimePanelMode }) {
  const router = useRouter()
  const isWork = mode === 'WORK'
  const [limitMode, setLimitMode] = useState<LimitMode>(initial.settings.limitMode)
  const [limitHours, setLimitHours] = useState(String(initial.settings.limitHours ?? ''))
  const [factor, setFactor] = useState(String(initial.settings.contractHoursFactor ?? ''))
  const [notifyManager, setNotifyManager] = useState(initial.settings.notifyManagerOnEntry)
  const [selfService, setSelfService] = useState(initial.settings.isSelfService)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const [exceptionOpen, setExceptionOpen] = useState(false)
  const [selectionMode, setSelectionMode] = useState<'one' | 'multiple'>('one')
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])
  const [exceptionLimitMode, setExceptionLimitMode] = useState<LimitMode>('UNLIMITED')
  const [exceptionLimitHours, setExceptionLimitHours] = useState('')
  const [exceptionFactor, setExceptionFactor] = useState('')
  const [exceptionSelfService, setExceptionSelfService] = useState(true)
  const [allowEntry, setAllowEntry] = useState(true)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3500)
  }

  const saveSettings = async () => {
    setStatus('saving')
    try {
      const response = await fetch(isWork ? '/api/leave/work-hours' : '/api/leave/overtime', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(isWork ? { action: 'WORK_HOUR_SETTINGS', workHourTypeId, isSelfService: initial.settings.isSelfService, limitMode, limitHours: limitMode === 'MONTHLY_HOURS' || limitMode === 'YEARLY_HOURS' ? Number(limitHours) : null, contractHoursFactor: limitMode === 'CONTRACT_HOURS_FACTOR' ? Number(factor) : null } : { action: 'OVERTIME_SETTINGS', workHourTypeId, notifyManagerOnEntry: notifyManager, isSelfService: selfService, limitMode, limitHours: limitMode === 'MONTHLY_HOURS' || limitMode === 'YEARLY_HOURS' ? Number(limitHours) : null, contractHoursFactor: limitMode === 'CONTRACT_HOURS_FACTOR' ? Number(factor) : null }) })
      if (!response.ok) throw new Error(labels.failed)
      setStatus('saved')
      showToast(labels.saved)
      router.refresh()
    } catch {
      setStatus('failed')
    }
  }

  const createException = async () => {
    if (selectedEmployeeIds.length === 0 || ((exceptionLimitMode === 'MONTHLY_HOURS' || exceptionLimitMode === 'YEARLY_HOURS') && !exceptionLimitHours) || (exceptionLimitMode === 'CONTRACT_HOURS_FACTOR' && !exceptionFactor)) return
    setStatus('saving')
    try {
      const response = await fetch(isWork ? '/api/leave/work-hours' : '/api/leave/overtime', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(isWork ? { action: 'WORK_HOUR_EXCEPTION', workHourTypeId, employeeIds: selectedEmployeeIds, isSelfService: exceptionSelfService, limitMode: exceptionLimitMode, limitHours: exceptionLimitMode === 'MONTHLY_HOURS' || exceptionLimitMode === 'YEARLY_HOURS' ? Number(exceptionLimitHours) : null, contractHoursFactor: exceptionLimitMode === 'CONTRACT_HOURS_FACTOR' ? Number(exceptionFactor) : null } : { action: 'OVERTIME_EXCEPTION', workHourTypeId, employeeIds: selectedEmployeeIds, allowOvertimeEntry: allowEntry, isSelfService: exceptionSelfService, limitMode: exceptionLimitMode, limitHours: exceptionLimitMode === 'MONTHLY_HOURS' || exceptionLimitMode === 'YEARLY_HOURS' ? Number(exceptionLimitHours) : null, contractHoursFactor: exceptionLimitMode === 'CONTRACT_HOURS_FACTOR' ? Number(exceptionFactor) : null }) })
      if (!response.ok) throw new Error(labels.failed)
      setStatus('saved')
      setExceptionOpen(false)
      setSelectedEmployeeIds([])
      showToast(labels.created)
      router.refresh()
    } catch {
      setStatus('failed')
    }
  }

  const visibleEmployees = initial.employees.filter((employee) => `${employee.employeeNumber} ${employee.name}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  const toggleEmployee = (employeeId: string) => setSelectedEmployeeIds((current) => current.includes(employeeId) ? current.filter((id) => id !== employeeId) : selectionMode === 'one' ? [employeeId] : [...current, employeeId])
  const renderLimitFields = (currentMode: LimitMode, hours: string, setHours: (value: string) => void, currentFactor: string, setCurrentFactor: (value: string) => void) => <>{currentMode === 'MONTHLY_HOURS' || currentMode === 'YEARLY_HOURS' ? <label className="grid gap-1.5 text-sm font-medium">{labels.limitHours}<input className="form-field" min="0" onChange={(event) => setHours(event.target.value)} step="0.01" type="number" value={hours} /></label> : null}{currentMode === 'CONTRACT_HOURS_FACTOR' ? <label className="grid gap-1.5 text-sm font-medium">{labels.factor}<input className="form-field" min="0" onChange={(event) => setCurrentFactor(event.target.value)} step="0.01" type="number" value={currentFactor} /></label> : null}</>

  return <>
    <section className="rounded-2xl border bg-surface p-6 shadow-sm"><div className="grid gap-5 md:grid-cols-2">{!isWork ? <><label className="inline-flex items-center gap-3 text-sm font-medium"><input checked={notifyManager} className="size-4 accent-primary" onChange={(event) => setNotifyManager(event.target.checked)} type="checkbox" />{labels.managerNotification}</label><label className="inline-flex items-center gap-3 text-sm font-medium"><input checked={selfService} className="size-4 accent-primary" onChange={(event) => setSelfService(event.target.checked)} type="checkbox" />{labels.selfService}</label></> : null}</div><div className="mt-6 grid gap-5 md:max-w-2xl"><label className="grid gap-1.5 text-sm font-medium">{labels.limitForEveryone}<select className="form-field" onChange={(event) => setLimitMode(event.target.value as LimitMode)} value={limitMode}><option value="UNLIMITED">{labels.unlimited}</option><option value="MONTHLY_HOURS">{labels.monthlyHours}</option><option value="YEARLY_HOURS">{labels.yearlyHours}</option><option value="CONTRACT_HOURS_FACTOR">{labels.contractFactor}</option></select></label>{renderLimitFields(limitMode, limitHours, setLimitHours, factor, setFactor)}<button className="button-primary w-fit" disabled={status === 'saving'} onClick={() => void saveSettings()} type="button">{status === 'saving' ? labels.saving : labels.save}</button></div>{status === 'failed' ? <p aria-live="polite" className="mt-3 text-sm text-destructive">{labels.failed}</p> : null}</section>
    <section className="overflow-hidden rounded-2xl border bg-surface shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><h2 className="font-semibold">{labels.exceptions}</h2><button className="button-primary inline-flex items-center gap-2" onClick={() => setExceptionOpen(true)} type="button"><Plus aria-hidden="true" size={16} />{labels.addException}</button></div><div className="overflow-x-auto"><table className="w-full min-w-[42rem] text-left text-sm"><thead className="bg-muted/40 text-xs uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-5 py-3">{labels.exceptionName}</th><th className="px-5 py-3">{labels.exceptionType}</th><th className="px-5 py-3">{labels.exceptionSelfService}</th></tr></thead><tbody className="divide-y">{initial.exceptions.map((exception) => <tr key={exception.id}><td className="px-5 py-4 font-semibold">{exception.employeeName}</td><td className="px-5 py-4">{!isWork && !exception.allowOvertimeEntry ? labels.forbidEntry : limitLabel(exception.limitMode, labels)}</td><td className="px-5 py-4">{exception.isSelfService ? labels.selfService : labels.notAvailable}</td></tr>)}{initial.exceptions.length === 0 ? <tr><td className="px-5 py-7 text-sm text-muted-foreground" colSpan={3}>{labels.noExceptions}</td></tr> : null}</tbody></table></div></section>
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-5 z-50 flex justify-center px-4">{toast ? <p className="rounded-xl border bg-surface px-4 py-3 text-sm font-medium shadow-lg">{toast}</p> : null}</div>
    {exceptionOpen ? <div aria-modal="true" className="fixed inset-0 z-40 grid place-items-center bg-foreground/30 p-4" role="dialog"><section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border bg-surface p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">{labels.exceptions}</p><h2 className="mt-1 text-xl font-semibold">{labels.addException}</h2></div><button aria-label={labels.cancel} className="button-secondary px-3" onClick={() => setExceptionOpen(false)} type="button"><X size={17} /></button></div><div className="mt-5 grid gap-4 md:grid-cols-2"><fieldset className="grid gap-2 text-sm font-medium md:col-span-2"><legend>{labels.selectionMode}</legend><div className="flex flex-wrap gap-2"><button className={`rounded-lg border px-3 py-2 ${selectionMode === 'one' ? 'border-primary bg-primary/10 text-primary' : ''}`} onClick={() => { setSelectionMode('one'); setSelectedEmployeeIds(selectedEmployeeIds.slice(0, 1)) }} type="button">{labels.onePerson}</button><button className={`rounded-lg border px-3 py-2 ${selectionMode === 'multiple' ? 'border-primary bg-primary/10 text-primary' : ''}`} onClick={() => setSelectionMode('multiple')} type="button">{labels.multiplePeople}</button></div></fieldset>{selectionMode === 'one' ? <label className="grid gap-1.5 text-sm font-medium md:col-span-2">{labels.selectPerson}<select className="form-field" onChange={(event) => setSelectedEmployeeIds(event.target.value ? [event.target.value] : [])} value={selectedEmployeeIds[0] ?? ''}><option value="" />{initial.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeNumber} · {employee.name}</option>)}</select></label> : <div className="rounded-xl border p-4 md:col-span-2"><div className="flex flex-wrap items-center justify-between gap-3"><label className="relative min-w-48 flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><input className="form-field pl-9" onChange={(event) => setSearch(event.target.value)} placeholder={labels.search} value={search} /></label><button className="button-secondary" onClick={() => setSelectedEmployeeIds(visibleEmployees.map((employee) => employee.id))} type="button">{labels.selectAll}</button></div><div className="mt-3 max-h-56 overflow-y-auto divide-y">{visibleEmployees.map((employee) => <label className="flex items-center gap-3 px-2 py-2 text-sm" key={employee.id}><input checked={selectedEmployeeIds.includes(employee.id)} className="size-4 accent-primary" onChange={() => toggleEmployee(employee.id)} type="checkbox" />{employee.name}</label>)}</div><p className="mt-2 text-xs text-muted-foreground">{labels.selectedPeople.replace('{count}', String(selectedEmployeeIds.length))}</p></div>}<label className="grid gap-1.5 text-sm font-medium">{labels.exceptionType}<select className="form-field" onChange={(event) => setExceptionLimitMode(event.target.value as LimitMode)} value={exceptionLimitMode}><option value="UNLIMITED">{labels.unlimited}</option><option value="MONTHLY_HOURS">{labels.monthlyHours}</option><option value="YEARLY_HOURS">{labels.yearlyHours}</option><option value="CONTRACT_HOURS_FACTOR">{labels.contractFactor}</option></select></label><label className="inline-flex items-center gap-3 self-end text-sm font-medium"><input checked={exceptionSelfService} className="size-4 accent-primary" onChange={(event) => setExceptionSelfService(event.target.checked)} type="checkbox" />{labels.exceptionSelfService}</label>{renderLimitFields(exceptionLimitMode, exceptionLimitHours, setExceptionLimitHours, exceptionFactor, setExceptionFactor)}{!isWork ? <label className="inline-flex items-center gap-3 text-sm font-medium md:col-span-2"><input checked={!allowEntry} className="size-4 accent-primary" onChange={(event) => setAllowEntry(!event.target.checked)} type="checkbox" />{labels.forbidEntry}</label> : null}</div><div className="mt-6 flex justify-end gap-2"><button className="button-secondary" onClick={() => setExceptionOpen(false)} type="button">{labels.cancel}</button><button className="button-primary" disabled={status === 'saving' || selectedEmployeeIds.length === 0} onClick={() => void createException()} type="button">{labels.create}</button></div></section></div> : null}
  </>
}
