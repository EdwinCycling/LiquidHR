'use client'

import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import type { OvertimeSettingsPageData } from '@/lib/leave/leave-service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { DataTableShell } from '@/components/patterns/data-table-shell'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'

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
  previous: string
  next: string
  page: string
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
  const [page, setPage] = useState(1)
  const [notice, setNotice] = useState<string | null>(null)

  async function saveSettings(): Promise<void> {
    setStatus('saving'); setNotice(null)
    try {
      const response = await fetch(isWork ? '/api/leave/work-hours' : '/api/leave/overtime', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(isWork ? { action: 'WORK_HOUR_SETTINGS', workHourTypeId, isSelfService: initial.settings.isSelfService, requiresManagerApproval: initial.settings.requiresManagerApproval, limitMode, limitHours: limitMode === 'MONTHLY_HOURS' || limitMode === 'YEARLY_HOURS' ? Number(limitHours) : null, contractHoursFactor: limitMode === 'CONTRACT_HOURS_FACTOR' ? Number(factor) : null } : { action: 'OVERTIME_SETTINGS', workHourTypeId, notifyManagerOnEntry: initial.settings.notifyManagerOnEntry, requiresManagerApproval: initial.settings.requiresManagerApproval, isSelfService: initial.settings.isSelfService, limitMode, limitHours: limitMode === 'MONTHLY_HOURS' || limitMode === 'YEARLY_HOURS' ? Number(limitHours) : null, contractHoursFactor: limitMode === 'CONTRACT_HOURS_FACTOR' ? Number(factor) : null }) })
      if (!response.ok) throw new Error(labels.failed)
      setStatus('saved'); setNotice(labels.saved); router.refresh()
    } catch { setStatus('failed'); setNotice(labels.failed) }
  }

  function closeException(): void {
    setExceptionOpen(false); setSelectedEmployeeIds([]); setSearch(''); setExceptionLimitMode('UNLIMITED'); setExceptionLimitHours(''); setExceptionFactor(''); setExceptionSelfService(true); setAllowEntry(true); setStatus('idle')
  }

  async function createException(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (selectedEmployeeIds.length === 0 || ((exceptionLimitMode === 'MONTHLY_HOURS' || exceptionLimitMode === 'YEARLY_HOURS') && !exceptionLimitHours) || (exceptionLimitMode === 'CONTRACT_HOURS_FACTOR' && !exceptionFactor)) { setStatus('failed'); return }
    setStatus('saving')
    try {
      const response = await fetch(isWork ? '/api/leave/work-hours' : '/api/leave/overtime', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(isWork ? { action: 'WORK_HOUR_EXCEPTION', workHourTypeId, employeeIds: selectedEmployeeIds, isSelfService: exceptionSelfService, limitMode: exceptionLimitMode, limitHours: exceptionLimitMode === 'MONTHLY_HOURS' || exceptionLimitMode === 'YEARLY_HOURS' ? Number(exceptionLimitHours) : null, contractHoursFactor: exceptionLimitMode === 'CONTRACT_HOURS_FACTOR' ? Number(exceptionFactor) : null } : { action: 'OVERTIME_EXCEPTION', workHourTypeId, employeeIds: selectedEmployeeIds, allowOvertimeEntry: allowEntry, isSelfService: exceptionSelfService, limitMode: exceptionLimitMode, limitHours: exceptionLimitMode === 'MONTHLY_HOURS' || exceptionLimitMode === 'YEARLY_HOURS' ? Number(exceptionLimitHours) : null, contractHoursFactor: exceptionLimitMode === 'CONTRACT_HOURS_FACTOR' ? Number(exceptionFactor) : null }) })
      if (!response.ok) throw new Error(labels.failed)
      setStatus('saved'); setNotice(labels.created); closeException(); router.refresh()
    } catch { setStatus('failed'); setNotice(labels.failed) }
  }

  const visibleEmployees = initial.employees.filter((employee) => `${employee.employeeNumber} ${employee.name}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  const pageCount = Math.max(1, Math.ceil(initial.exceptions.length / 10))
  const currentPage = Math.min(page, pageCount)
  const visibleExceptions = initial.exceptions.slice((currentPage - 1) * 10, currentPage * 10)
  const exceptionDirty = Boolean(selectedEmployeeIds.length || search || exceptionLimitMode !== 'UNLIMITED' || exceptionLimitHours || exceptionFactor || !exceptionSelfService || !allowEntry)
  const renderLimitFields = (currentMode: LimitMode, hours: string, setHours: (value: string) => void, currentFactor: string, setCurrentFactor: (value: string) => void) => <>{currentMode === 'MONTHLY_HOURS' || currentMode === 'YEARLY_HOURS' ? <FormField control={<TextInput min="0" onChange={(event) => setHours(event.target.value)} step="0.01" type="number" value={hours} />} label={labels.limitHours} required /> : null}{currentMode === 'CONTRACT_HOURS_FACTOR' ? <FormField control={<TextInput min="0" onChange={(event) => setCurrentFactor(event.target.value)} step="0.01" type="number" value={currentFactor} />} label={labels.factor} required /> : null}</>
  const toggleEmployee = (employeeId: string): void => setSelectedEmployeeIds((current) => current.includes(employeeId) ? current.filter((id) => id !== employeeId) : selectionMode === 'one' ? [employeeId] : [...current, employeeId])

  return <>
    <Surface className="p-6"><div className="grid gap-5 md:max-w-2xl"><FormField control={<DropdownSelect aria-label={labels.limitForEveryone} onChange={(event) => setLimitMode(event.target.value as LimitMode)} value={limitMode}><option value="UNLIMITED">{labels.unlimited}</option><option value="MONTHLY_HOURS">{labels.monthlyHours}</option><option value="YEARLY_HOURS">{labels.yearlyHours}</option><option value="CONTRACT_HOURS_FACTOR">{labels.contractFactor}</option></DropdownSelect>} label={labels.limitForEveryone} required />{renderLimitFields(limitMode, limitHours, setLimitHours, factor, setFactor)}<Button disabled={status === 'saving'} loading={status === 'saving'} onClick={() => void saveSettings()} type="button">{labels.save}</Button></div>{notice ? <p aria-live="polite" className={`mt-3 text-sm ${status === 'failed' ? 'text-destructive' : 'text-success'}`}>{notice}</p> : null}</Surface>
    <Surface className="overflow-hidden p-0"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-5 py-4"><h2 className="font-semibold">{labels.exceptions}</h2><Button onClick={() => setExceptionOpen(true)} size="sm" type="button"><Plus aria-hidden="true" />{labels.addException}</Button></div><DataTableShell caption={labels.exceptions} className="rounded-none border-0" state={visibleExceptions.length === 0 ? 'empty' : 'ready'} stateContent={<EmptyState title={labels.noExceptions} />}><thead className="bg-muted/40 text-xs uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-5 py-3">{labels.exceptionName}</th><th className="px-5 py-3">{labels.exceptionType}</th><th className="px-5 py-3">{labels.exceptionSelfService}</th></tr></thead><tbody className="divide-y divide-border-subtle">{visibleExceptions.map((exception) => <tr key={exception.id}><td className="px-5 py-4 font-semibold">{exception.employeeName}</td><td className="px-5 py-4">{!isWork && !exception.allowOvertimeEntry ? labels.forbidEntry : <Badge tone="neutral">{limitLabel(exception.limitMode, labels)}</Badge>}</td><td className="px-5 py-4">{exception.isSelfService ? labels.selfService : labels.notAvailable}</td></tr>)}</tbody></DataTableShell>{initial.exceptions.length > 10 ? <div className="flex items-center justify-between border-t border-border-subtle px-5 py-3 text-sm"><Button disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} size="sm" type="button" variant="secondary">{labels.previous}</Button><span className="text-muted-foreground">{labels.page.replace('{page}', String(currentPage)).replace('{pages}', String(pageCount))}</span><Button disabled={currentPage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} size="sm" type="button" variant="secondary">{labels.next}</Button></div> : null}</Surface>
    <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.cancel} description={labels.exceptions} dirty={exceptionDirty} dirtyProtection={{ description: labels.failed, discardLabel: labels.cancel, keepEditingLabel: labels.cancel, title: labels.cancel }} onDiscard={closeException} onOpenChange={(open) => { if (!open && !exceptionDirty) closeException() }} onSubmit={(event) => void createException(event)} open={exceptionOpen} saveLabel={labels.create} saving={status === 'saving'} title={labels.addException}>
      <fieldset className="grid gap-2 text-sm font-medium"><legend>{labels.selectionMode}</legend><div className="flex flex-wrap gap-2"><Button onClick={() => { setSelectionMode('one'); setSelectedEmployeeIds((current) => current.slice(0, 1)) }} size="sm" type="button" variant={selectionMode === 'one' ? 'primary' : 'secondary'}>{labels.onePerson}</Button><Button onClick={() => setSelectionMode('multiple')} size="sm" type="button" variant={selectionMode === 'multiple' ? 'primary' : 'secondary'}>{labels.multiplePeople}</Button></div></fieldset>
      {selectionMode === 'one' ? <FormField className="md:col-span-2" control={<DropdownSelect aria-label={labels.selectPerson} onChange={(event) => setSelectedEmployeeIds(event.target.value ? [event.target.value] : [])} searchable searchPlaceholder={labels.search} value={selectedEmployeeIds[0] ?? ''}><option value="">{labels.selectPerson}</option>{initial.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeNumber} · {employee.name}</option>)}</DropdownSelect>} label={labels.selectPerson} required /> : <div className="grid gap-3 rounded-[var(--radius-control)] border border-border-subtle p-4 md:col-span-2"><div className="flex flex-wrap items-center justify-between gap-3"><TextInput onChange={(event) => setSearch(event.target.value)} placeholder={labels.search} value={search} /><Button onClick={() => setSelectedEmployeeIds(visibleEmployees.map((employee) => employee.id))} size="sm" type="button" variant="secondary">{labels.selectAll}</Button></div><div className="max-h-56 divide-y divide-border-subtle overflow-y-auto">{visibleEmployees.map((employee) => <Checkbox checked={selectedEmployeeIds.includes(employee.id)} key={employee.id} label={employee.name} onChange={() => toggleEmployee(employee.id)} />)}</div><p className="text-xs text-muted-foreground">{labels.selectedPeople.replace('{count}', String(selectedEmployeeIds.length))}</p></div>}
      <FormField control={<DropdownSelect aria-label={labels.exceptionType} onChange={(event) => setExceptionLimitMode(event.target.value as LimitMode)} value={exceptionLimitMode}><option value="UNLIMITED">{labels.unlimited}</option><option value="MONTHLY_HOURS">{labels.monthlyHours}</option><option value="YEARLY_HOURS">{labels.yearlyHours}</option><option value="CONTRACT_HOURS_FACTOR">{labels.contractFactor}</option></DropdownSelect>} label={labels.exceptionType} required />
      <Checkbox checked={exceptionSelfService} label={labels.exceptionSelfService} onChange={(event) => setExceptionSelfService(event.target.checked)} />{renderLimitFields(exceptionLimitMode, exceptionLimitHours, setExceptionLimitHours, exceptionFactor, setExceptionFactor)}{!isWork ? <Checkbox checked={!allowEntry} className="md:col-span-2" label={labels.forbidEntry} onChange={(event) => setAllowEntry(!event.target.checked)} /> : null}
      {status === 'failed' ? <p className="text-sm text-destructive" role="alert">{labels.failed}</p> : null}
    </FormDrawer>
  </>
}
