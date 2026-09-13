'use client'

import { useRef, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import type { LeaveCatalog } from '@/lib/leave/leave-service'

export type LeaveOpeningBalancePanelLabels = {
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
  amount: string
  startDate: string
  sourceAccrualYear: string
  expirationDate: string
  reason: string
  reasonPlaceholder: string
  save: string
  saving: string
  confirm: string
  cancel: string
  confirmTitle: string
  confirmDescription: string
  saved: string
  failed: string
  required: string
  invalidExpiration: string
  noEmployees: string
}

function sourceKey(): string {
  return `hr-migration-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export function LeaveOpeningBalancePanel({ catalog, labels }: { catalog: LeaveCatalog; labels: LeaveOpeningBalancePanelLabels }) {
  const [employeeId, setEmployeeId] = useState('')
  const [employmentId, setEmploymentId] = useState('')
  const [leaveTypeId, setLeaveTypeId] = useState('')
  const [amount, setAmount] = useState('')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [sourceAccrualYear, setSourceAccrualYear] = useState(String(new Date().getUTCFullYear()))
  const [expirationDate, setExpirationDate] = useState('')
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const sourceKeyRef = useRef(sourceKey())

  const employees = catalog.employees.filter((employee) => catalog.employments.some((employment) => employment.employee_id === employee.id))
  const employments = catalog.employments.filter((employment) => employment.employee_id === employeeId)
  const resolvedEmploymentId = employmentId && employments.some((employment) => employment.id === employmentId) ? employmentId : employments[0]?.id ?? ''
  const leaveTypes = catalog.leaveTypes.filter((leaveType) => leaveType.is_active && leaveType.entitlement_mode === 'ACCRUAL')

  function selectEmployee(nextEmployeeId: string): void {
    setEmployeeId(nextEmployeeId)
    setEmploymentId('')
    setNotice(null)
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    setNotice(null)
    const numericAmount = Number(amount)
    const numericYear = Number(sourceAccrualYear)
    if (!resolvedEmploymentId || !leaveTypeId || !reason.trim() || !startDate || !Number.isFinite(numericAmount) || numericAmount <= 0 || !Number.isInteger(numericYear)) {
      setNotice({ kind: 'error', text: labels.required })
      return
    }
    if (!expirationDate || expirationDate <= startDate) {
      setNotice({ kind: 'error', text: labels.invalidExpiration })
      return
    }
    setConfirmOpen(true)
  }

  async function save(): Promise<void> {
    setSaving(true)
    setNotice(null)
    try {
      const response = await fetch('/api/leave/ledger', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'OPENING_BALANCE',
          employeeId,
          employmentId: resolvedEmploymentId,
          leaveTypeId,
          amount: Number(amount),
          startDate,
          sourceAccrualYear: Number(sourceAccrualYear),
          expirationDate,
          reason: reason.trim(),
          sourceKey: sourceKeyRef.current,
        }),
      })
      const payload = await response.json() as { error?: string }
      if (!response.ok) throw new Error(payload.error ?? 'LEAVE_OPENING_BALANCE_FAILED')
      sourceKeyRef.current = sourceKey()
      setConfirmOpen(false)
      setNotice({ kind: 'success', text: labels.saved })
    } catch {
      setNotice({ kind: 'error', text: labels.failed })
    } finally {
      setSaving(false)
    }
  }

  return <Surface className="p-5">
    <h2 className="text-lg font-semibold">{labels.title}</h2>
    <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{labels.description}</p>
    {notice ? <p className={`mt-4 rounded-[var(--radius-control)] p-3 text-sm ${notice.kind === 'error' ? 'bg-destructive-surface text-destructive' : 'bg-accent text-accent-foreground'}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p> : null}
    {employees.length === 0 ? <EmptyState className="mt-5 items-start p-4 text-left" title={labels.noEmployees} /> : <form className="mt-5 space-y-5" onSubmit={submit}>
      <div className="grid gap-4 lg:grid-cols-3">
        <FormField label={labels.employee} required control={<DropdownSelect aria-label={labels.employee} searchable searchPlaceholder={labels.employeeSearch} value={employeeId} onChange={(event) => selectEmployee(event.target.value)}><option value="">{labels.employeePlaceholder}</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{[employee.first_name, employee.birth_name_prefix, employee.birth_name].filter(Boolean).join(' ')}{employee.employee_number ? ` · ${employee.employee_number}` : ''}</option>)}</DropdownSelect>} />
        <FormField label={labels.employment} required control={<DropdownSelect aria-label={labels.employment} searchable searchPlaceholder={labels.employmentSearch} value={resolvedEmploymentId} onChange={(event) => setEmploymentId(event.target.value)} disabled={!employeeId}><option value="">{labels.employmentPlaceholder}</option>{employments.map((employment) => <option key={employment.id} value={employment.id}>{employment.employment_number}</option>)}</DropdownSelect>} />
        <FormField label={labels.leaveType} required control={<DropdownSelect aria-label={labels.leaveType} searchable searchPlaceholder={labels.leaveTypeSearch} value={leaveTypeId} onChange={(event) => setLeaveTypeId(event.target.value)} disabled={!resolvedEmploymentId}><option value="">{labels.leaveTypePlaceholder}</option>{leaveTypes.map((leaveType) => <option key={leaveType.id} value={leaveType.id}>{leaveType.name}</option>)}</DropdownSelect>} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <FormField label={labels.amount} required control={<TextInput min="0.0001" onChange={(event) => setAmount(event.target.value)} step="0.0001" type="number" value={amount} />} />
        <FormField label={labels.startDate} required control={<TextInput onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />} />
        <FormField label={labels.sourceAccrualYear} required control={<TextInput min="2000" max="2200" onChange={(event) => setSourceAccrualYear(event.target.value)} step="1" type="number" value={sourceAccrualYear} />} />
        <FormField label={labels.expirationDate} required control={<TextInput min={startDate} onChange={(event) => setExpirationDate(event.target.value)} type="date" value={expirationDate} />} />
      </div>
      <FormField label={labels.reason} required control={<Textarea maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder={labels.reasonPlaceholder} value={reason} />} />
      <div className="flex justify-end"><Button disabled={saving} loading={saving} type="submit">{labels.save}</Button></div>
    </form>}
    <ConfirmDialog cancelLabel={labels.cancel} confirmLabel={labels.confirm} description={labels.confirmDescription} onConfirm={() => void save()} onOpenChange={(open) => { if (!saving) setConfirmOpen(open) }} open={confirmOpen} pending={saving} title={labels.confirmTitle} />
  </Surface>
}
