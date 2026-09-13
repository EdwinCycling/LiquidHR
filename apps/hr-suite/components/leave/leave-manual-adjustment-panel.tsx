'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import type { LeaveCatalog } from '@/lib/leave/leave-service'
import type { LeaveBalanceReport } from '@/lib/leave/report'
import { fetchLeaveBalanceReport, LeaveBalanceHistoryPanel, type LeaveBalanceHistoryPanelLabels } from './leave-balance-history-panel'

type YearControl = {
  year: number
  status: 'LOCKED' | 'ACTIVE' | 'OPEN_FOR_FUTURE_REQUESTS'
}

export type LeaveManualAdjustmentPanelLabels = {
  title: string
  description: string
  employee: string
  employeePlaceholder: string
  employeeSearch: string
  employment: string
  employmentPlaceholder: string
  employmentSearch: string
  leaveType: string
  leaveTypePlaceholder: string
  leaveTypeSearch: string
  direction: string
  increase: string
  decrease: string
  hours: string
  effectiveDate: string
  reason: string
  reasonPlaceholder: string
  currentBalance: string
  resultingBalance: string
  unlimited: string
  preview: string
  confirm: string
  confirmTitle: string
  confirmDescription: string
  cancel: string
  saved: string
  failed: string
  locked: string
  insufficientBalance: string
  reasonRequired: string
  hoursRequired: string
  noEmployees: string
  noEmployments: string
  balanceUnavailable: string
  history: LeaveBalanceHistoryPanelLabels
}

function createSourceKey(): string {
  return `hr-manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function numberFormatter(locale: string): Intl.NumberFormat {
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

function formatBalance(value: number | null, locale: string, unlimited: string): string {
  return value === null ? unlimited : numberFormatter(locale).format(value)
}

function errorMessage(code: string | undefined, labels: LeaveManualAdjustmentPanelLabels): string {
  if (code === 'LEAVE_YEAR_LOCKED') return labels.locked
  if (code === 'LEAVE_INSUFFICIENT_BALANCE') return labels.insufficientBalance
  return labels.failed
}

export function LeaveManualAdjustmentPanel({ catalog, labels, locale }: { catalog: LeaveCatalog; labels: LeaveManualAdjustmentPanelLabels; locale: string }) {
  const [employeeId, setEmployeeId] = useState('')
  const [employmentId, setEmploymentId] = useState('')
  const [leaveTypeId, setLeaveTypeId] = useState('')
  const [direction, setDirection] = useState<'INCREASE' | 'DECREASE'>('INCREASE')
  const [hours, setHours] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState('')
  const [report, setReport] = useState<LeaveBalanceReport | null>(null)
  const [yearControls, setYearControls] = useState<YearControl[]>([])
  const [loading, setLoading] = useState(false)
  const [posting, setPosting] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const sourceKeyRef = useRef(createSourceKey())

  const employees = catalog.employees.filter((employee) => catalog.employments.some((employment) => employment.employee_id === employee.id))
  const employments = catalog.employments.filter((employment) => employment.employee_id === employeeId)
  const resolvedEmploymentId = employeeId && employments.some((employment) => employment.id === employmentId) ? employmentId : employeeId ? employments[0]?.id ?? '' : ''
  const leaveTypes = catalog.leaveTypes.filter((leaveType) => leaveType.is_active)
  const reportForSelection = report && report.employmentId === resolvedEmploymentId && report.asOfDate === effectiveDate ? report : null
  const selectedLeaveType = reportForSelection?.leaveTypes.find((leaveType) => leaveType.leaveTypeId === leaveTypeId)
  const currentBalance = selectedLeaveType?.currentBalance ?? null
  const numericHours = Number(hours)
  const amount = direction === 'INCREASE' ? numericHours : -numericHours
  const resultingBalance = currentBalance === null ? null : currentBalance + amount
  const correctionYear = Number(effectiveDate.slice(0, 4))
  const yearLocked = yearControls.some((control) => control.year === correctionYear && control.status === 'LOCKED')
  const dateIsValid = /^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)
  const canConfirm = Boolean(resolvedEmploymentId && leaveTypeId && reportForSelection && selectedLeaveType && currentBalance !== null && Number.isFinite(numericHours) && numericHours > 0 && reason.trim() && dateIsValid && !yearLocked && resultingBalance !== null && resultingBalance >= 0)
  const balanceLabel = selectedLeaveType ? formatBalance(currentBalance, locale, labels.unlimited) : labels.balanceUnavailable
  const resultingBalanceLabel = selectedLeaveType ? formatBalance(resultingBalance, locale, labels.unlimited) : labels.balanceUnavailable

  useEffect(() => {
    let active = true
    void fetch('/api/leave/ledger')
      .then(async (response) => {
        if (!response.ok) return [] as YearControl[]
        const payload = await response.json() as { data?: YearControl[] }
        return payload.data ?? []
      })
      .then((controls) => {
        if (active) setYearControls(controls)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!resolvedEmploymentId || !dateIsValid) return undefined
    let active = true
    const loadReport = async (): Promise<void> => {
      setLoading(true)
      setNotice(null)
      try {
        const nextReport = await fetchLeaveBalanceReport(resolvedEmploymentId, effectiveDate)
        if (active) setReport(nextReport)
      } catch {
        if (active) {
          setReport(null)
          setNotice({ kind: 'error', text: labels.failed })
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadReport()
    return () => {
      active = false
    }
  }, [dateIsValid, effectiveDate, labels.failed, refreshToken, resolvedEmploymentId])

  function selectEmployee(nextEmployeeId: string) {
    setEmployeeId(nextEmployeeId)
    setLeaveTypeId('')
    setReport(null)
    setNotice(null)
  }

  function selectEmployment(nextEmploymentId: string) {
    setEmploymentId(nextEmploymentId)
    setReport(null)
    setNotice(null)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice(null)
    if (!reason.trim()) {
      setNotice({ kind: 'error', text: labels.reasonRequired })
      return
    }
    if (!Number.isFinite(numericHours) || numericHours <= 0) {
      setNotice({ kind: 'error', text: labels.hoursRequired })
      return
    }
    if (yearLocked) {
      setNotice({ kind: 'error', text: labels.locked })
      return
    }
    if (currentBalance === null || resultingBalance === null) {
      setNotice({ kind: 'error', text: labels.balanceUnavailable })
      return
    }
    if (resultingBalance < 0) {
      setNotice({ kind: 'error', text: labels.insufficientBalance })
      return
    }
    setConfirmOpen(true)
  }

  async function confirm(): Promise<void> {
    setPosting(true)
    setNotice(null)
    try {
      const response = await fetch('/api/leave/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'MANUAL_ADJUSTMENT', employeeId, employmentId: resolvedEmploymentId, leaveTypeId, amount, effectiveDate, reason, sourceKey: sourceKeyRef.current }),
      })
      const payload = await response.json() as { error?: string }
      if (!response.ok) throw new Error(payload.error ?? 'LEAVE_MANUAL_ADJUSTMENT_FAILED')
      sourceKeyRef.current = createSourceKey()
      setConfirmOpen(false)
      setRefreshToken((value) => value + 1)
      setNotice({ kind: 'success', text: labels.saved })
    } catch (error) {
      setNotice({ kind: 'error', text: errorMessage(error instanceof Error ? error.message : undefined, labels) })
    } finally {
      setPosting(false)
    }
  }

  const confirmDescription = labels.confirmDescription
    .replace('{amount}', formatBalance(amount, locale, labels.unlimited))
    .replace('{balance}', formatBalance(resultingBalance, locale, labels.unlimited))

  return <div className="space-y-5">
    <Surface className="p-5">
      <h2 className="text-lg font-semibold">{labels.title}</h2>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{labels.description}</p>
      {notice ? <p className={`mt-4 rounded-[var(--radius-control)] p-3 text-sm ${notice.kind === 'error' ? 'bg-destructive-surface text-destructive' : 'bg-accent text-accent-foreground'}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p> : null}
      {employees.length === 0 ? <EmptyState className="mt-5 items-start p-4 text-left" title={labels.noEmployees} /> : <form className="mt-5 space-y-5" onSubmit={submit}>
        <div className="grid gap-4 lg:grid-cols-3">
          <FormField label={labels.employee} required control={<DropdownSelect aria-label={labels.employee} searchable searchPlaceholder={labels.employeeSearch} value={employeeId} onChange={(event) => selectEmployee(event.target.value)}><option value="">{labels.employeePlaceholder}</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{[employee.first_name, employee.birth_name_prefix, employee.birth_name].filter(Boolean).join(' ')}{employee.employee_number ? ` · ${employee.employee_number}` : ''}</option>)}</DropdownSelect>} />
          <FormField label={labels.employment} required control={<DropdownSelect aria-label={labels.employment} searchable searchPlaceholder={labels.employmentSearch} value={resolvedEmploymentId} onChange={(event) => selectEmployment(event.target.value)} disabled={!employeeId}><option value="">{labels.employmentPlaceholder}</option>{employments.map((employment) => <option key={employment.id} value={employment.id}>{employment.employment_number}</option>)}</DropdownSelect>} />
          <FormField label={labels.leaveType} required control={<DropdownSelect aria-label={labels.leaveType} searchable searchPlaceholder={labels.leaveTypeSearch} value={leaveTypeId} onChange={(event) => { setLeaveTypeId(event.target.value); setNotice(null) }} disabled={!resolvedEmploymentId}><option value="">{labels.leaveTypePlaceholder}</option>{leaveTypes.map((leaveType) => <option key={leaveType.id} value={leaveType.id}>{leaveType.name}</option>)}</DropdownSelect>} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <fieldset className="grid gap-1.5 text-sm">
            <legend className="font-medium">{labels.direction}<span aria-hidden="true" className="ml-1 text-destructive">*</span></legend>
            <div className="flex flex-wrap gap-2" role="group" aria-label={labels.direction}>
              <Button aria-pressed={direction === 'INCREASE'} onClick={() => setDirection('INCREASE')} type="button" variant={direction === 'INCREASE' ? 'primary' : 'secondary'}>{labels.increase}</Button>
              <Button aria-pressed={direction === 'DECREASE'} onClick={() => setDirection('DECREASE')} type="button" variant={direction === 'DECREASE' ? 'primary' : 'secondary'}>{labels.decrease}</Button>
            </div>
          </fieldset>
          <FormField label={labels.hours} required control={<TextInput inputMode="decimal" min="0.01" onChange={(event) => setHours(event.target.value)} step="0.01" type="number" value={hours} />} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label={labels.effectiveDate} required control={<TextInput onChange={(event) => { setEffectiveDate(event.target.value); setNotice(null) }} type="date" value={effectiveDate} />} />
          <FormField label={labels.reason} required control={<Textarea maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder={labels.reasonPlaceholder} value={reason} />} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[var(--radius-control)] border border-subtle bg-surface-subtle p-3"><p className="text-xs font-semibold uppercase tracking-[0.11em] text-muted-foreground">{labels.currentBalance}</p><p className="mt-1 text-lg font-semibold tabular-nums">{loading ? '…' : balanceLabel}</p></div>
          <div className="rounded-[var(--radius-control)] border border-subtle bg-surface-subtle p-3"><p className="text-xs font-semibold uppercase tracking-[0.11em] text-muted-foreground">{labels.resultingBalance}</p><p className="mt-1 text-lg font-semibold tabular-nums">{resultingBalanceLabel}</p></div>
        </div>
        {yearLocked ? <p className="rounded-[var(--radius-control)] bg-warning-surface p-3 text-sm text-warning" role="status">{labels.locked}</p> : null}
        {resolvedEmploymentId && reportForSelection && !selectedLeaveType ? <p className="text-sm text-muted-foreground">{labels.balanceUnavailable}</p> : null}
        <div className="flex flex-wrap justify-end gap-2"><Button disabled={!canConfirm || posting} loading={posting} type="submit">{labels.preview}</Button></div>
      </form>}
    </Surface>
    {resolvedEmploymentId ? <Surface className="p-5"><h2 className="text-lg font-semibold">{labels.history.history}</h2><div className="mt-4"><LeaveBalanceHistoryPanel asOfDate={effectiveDate} employmentId={resolvedEmploymentId} labels={labels.history} locale={locale} refreshToken={refreshToken} /></div></Surface> : null}
    <ConfirmDialog cancelLabel={labels.cancel} confirmLabel={labels.confirm} description={confirmDescription} onConfirm={confirm} onOpenChange={(open) => { if (!posting) setConfirmOpen(open) }} open={confirmOpen} pending={posting} title={labels.confirmTitle} />
  </div>
}
