'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { LeaveCatalog } from '@/lib/leave/leave-service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'

type Labels = {
  title: string
  description: string
  empty: string
  add: string
  name: string
  summary: string
  validFrom: string
  validUntil: string
  noValue: string
  noAccrual: string
  customAmount: string
  amount: string
  expiry: string
  months: string
  summaryPeople: string
  summaryStart: string
  summaryAmount: string
  summaryExpiry: string
  summaryReason: string
  hoursUnit: string
  reason: string
  selectionMode: string
  onePerson: string
  multiplePeople: string
  selectPerson: string
  search: string
  selectVisible: string
  selected: string
  save: string
  cancel: string
  saving: string
  saved: string
  failed: string
  previous: string
  next: string
  page: string
}

const PAGE_SIZE = 10

function toHours(hours: string, minutes: string): number {
  return Number(hours || 0) + Number(minutes || 0) / 60
}

export function LeaveAccrualExceptionsPanel({ catalog, leaveTypeId, labels }: { catalog: LeaveCatalog; leaveTypeId: string; labels: Labels }) {
  const router = useRouter()
  const rows = useMemo(() => catalog.leaveAccrualExceptions.filter((row) => row.leave_type_id === leaveTypeId), [catalog.leaveAccrualExceptions, leaveTypeId])
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [selectionMode, setSelectionMode] = useState<'one' | 'multiple'>('one')
  const [selectedEmploymentIds, setSelectedEmploymentIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10))
  const [validUntil, setValidUntil] = useState('')
  const [noAccrual, setNoAccrual] = useState(false)
  const [amountHours, setAmountHours] = useState('')
  const [amountMinutes, setAmountMinutes] = useState('0')
  const [expiryMonths, setExpiryMonths] = useState('6')
  const [reason, setReason] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')

  const visibleEmployments = useMemo(() => catalog.leaveExceptionEmployees.filter((employment) => employment.employee_name.toLowerCase().includes(search.toLowerCase()) || employment.employment_number.toLowerCase().includes(search.toLowerCase())), [catalog.leaveExceptionEmployees, search])
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const dirty = Boolean(selectedEmploymentIds.length || search || validUntil || noAccrual || amountHours || amountMinutes !== '0' || expiryMonths !== '6' || reason)

  function closeDrawer(): void {
    setOpen(false)
    setSelectedEmploymentIds([])
    setSearch('')
    setValidFrom(new Date().toISOString().slice(0, 10))
    setValidUntil('')
    setNoAccrual(false)
    setAmountHours('')
    setAmountMinutes('0')
    setExpiryMonths('6')
    setReason('')
    setStatus('idle')
  }

  function toggleEmployment(id: string): void {
    setSelectedEmploymentIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (selectedEmploymentIds.length === 0 || !reason.trim() || (!noAccrual && (!amountHours || !expiryMonths))) { setStatus('failed'); return }
    setStatus('saving')
    try {
      const employmentSelections = selectedEmploymentIds.map((employmentId) => {
        const employment = catalog.leaveExceptionEmployees.find((row) => row.employment_id === employmentId)
        return { employeeId: employment?.employee_id ?? '', employmentId }
      })
      const response = await fetch('/api/leave/catalog', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'ACCRUAL_EXCEPTION', employmentSelections, leaveTypeId, validFrom, validUntil: validUntil || null, noAccrual, accrualAmount: noAccrual ? null : toHours(amountHours, amountMinutes), expirationMonths: noAccrual ? null : Number(expiryMonths), reason: reason.trim() }) })
      if (!response.ok) throw new Error('LEAVE_EXCEPTION_SAVE_FAILED')
      setStatus('saved')
      router.refresh()
      setPage(1)
      window.setTimeout(closeDrawer, 250)
    } catch { setStatus('failed') }
  }

  return <>
    <Surface className="overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle px-5 py-4"><div><h2 className="font-semibold">{labels.title}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.description}</p></div><Button onClick={() => setOpen(true)} size="sm" type="button">{labels.add}</Button></div>
      {pageRows.length === 0 ? <EmptyState className="m-5" title={labels.empty} /> : <div className="overflow-x-auto"><table className="w-full min-w-[48rem] text-left text-sm"><thead className="bg-muted/40 text-xs uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-5 py-3">{labels.name}</th><th className="px-5 py-3">{labels.summary}</th><th className="px-5 py-3">{labels.validFrom}</th><th className="px-5 py-3">{labels.validUntil}</th></tr></thead><tbody className="divide-y divide-border-subtle">{pageRows.map((row) => <tr key={row.id}><td className="px-5 py-4 font-semibold">{row.employee_name}<span className="block text-xs font-normal text-muted-foreground">{catalog.leaveExceptionEmployees.find((employment) => employment.employment_id === row.employment_id)?.employment_number ?? row.employment_id}</span></td><td className="px-5 py-4">{row.no_accrual ? <Badge tone="info">{labels.noAccrual}</Badge> : `${labels.customAmount}: ${row.accrual_amount ?? 0} ${labels.hoursUnit}. ${labels.expiry}: ${row.expiration_months ?? 0} ${labels.months}`}</td><td className="px-5 py-4">{row.valid_from}</td><td className="px-5 py-4">{row.valid_until ?? labels.noValue}</td></tr>)}</tbody></table></div>}
      {rows.length > PAGE_SIZE ? <div className="flex items-center justify-between gap-3 border-t border-border-subtle px-5 py-3 text-sm"><Button disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} size="sm" type="button" variant="secondary">{labels.previous}</Button><span>{labels.page.replace('{current}', String(page)).replace('{total}', String(pageCount))}</span><Button disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} size="sm" type="button" variant="secondary">{labels.next}</Button></div> : null}
    </Surface>
    <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.cancel} description={labels.description} dirty={dirty} dirtyProtection={{ description: labels.failed, discardLabel: labels.cancel, keepEditingLabel: labels.cancel, title: labels.cancel }} onDiscard={closeDrawer} onOpenChange={(nextOpen) => { if (!nextOpen && !dirty) closeDrawer() }} onSubmit={(event) => void save(event)} open={open} saveLabel={labels.save} saving={status === 'saving'} title={labels.add}>
      <fieldset className="grid gap-2 text-sm font-medium"><legend>{labels.selectionMode}</legend><div className="flex flex-wrap gap-2"><Button onClick={() => { setSelectionMode('one'); setSelectedEmploymentIds((current) => current.slice(0, 1)) }} size="sm" type="button" variant={selectionMode === 'one' ? 'primary' : 'secondary'}>{labels.onePerson}</Button><Button onClick={() => setSelectionMode('multiple')} size="sm" type="button" variant={selectionMode === 'multiple' ? 'primary' : 'secondary'}>{labels.multiplePeople}</Button></div></fieldset>
      {selectionMode === 'one' ? <FormField className="md:col-span-2" control={<DropdownSelect aria-label={labels.selectPerson} onChange={(event) => setSelectedEmploymentIds(event.target.value ? [event.target.value] : [])} searchable searchPlaceholder={labels.search} value={selectedEmploymentIds[0] ?? ''}><option value="">{labels.selectPerson}</option>{catalog.leaveExceptionEmployees.map((employment) => <option key={employment.employment_id} value={employment.employment_id}>{employment.employee_name} - {employment.employment_number}</option>)}</DropdownSelect>} label={labels.selectPerson} required /> : <div className="grid gap-3 rounded-[var(--radius-control)] border border-border-subtle p-4 md:col-span-2"><div className="flex flex-wrap items-center justify-between gap-3"><TextInput onChange={(event) => setSearch(event.target.value)} placeholder={labels.search} value={search} /><Button onClick={() => setSelectedEmploymentIds(visibleEmployments.map((employment) => employment.employment_id))} size="sm" type="button" variant="secondary">{labels.selectVisible}</Button></div><div className="max-h-56 divide-y divide-border-subtle overflow-y-auto">{visibleEmployments.map((employment) => <Checkbox checked={selectedEmploymentIds.includes(employment.employment_id)} key={employment.employment_id} label={`${employment.employee_name} - ${employment.employment_number}`} onChange={() => toggleEmployment(employment.employment_id)} />)}</div><p className="text-xs text-muted-foreground">{labels.selected.replace('{count}', String(selectedEmploymentIds.length))}</p></div>}
      <FormField control={<TextInput onChange={(event) => setValidFrom(event.target.value)} type="date" value={validFrom} />} label={labels.validFrom} required /><FormField control={<TextInput onChange={(event) => setValidUntil(event.target.value)} type="date" value={validUntil} />} label={labels.validUntil} />
      <Checkbox checked={noAccrual} label={labels.noAccrual} onChange={(event) => { const checked = event.target.checked; setNoAccrual(checked); if (checked) setExpiryMonths(''); else if (!expiryMonths) setExpiryMonths('6') }} />
      {!noAccrual ? <><div className="grid gap-2 md:col-span-2"><span className="text-sm font-medium">{labels.amount}</span><div className="grid grid-cols-2 gap-3"><TextInput aria-label={labels.amount} min="0" onChange={(event) => setAmountHours(event.target.value)} placeholder="0" step="1" type="number" value={amountHours} /><TextInput aria-label={labels.amount} max="59" min="0" onChange={(event) => setAmountMinutes(event.target.value)} placeholder="0" step="1" type="number" value={amountMinutes} /></div></div><FormField control={<TextInput max="120" min="0" onChange={(event) => setExpiryMonths(event.target.value)} type="number" value={expiryMonths} />} label={labels.expiry} required /></> : null}
      <FormField className="md:col-span-2" control={<Textarea maxLength={500} onChange={(event) => setReason(event.target.value)} value={reason} />} label={labels.reason} required />
      <div className="rounded-[var(--radius-control)] bg-muted/50 p-4 text-sm md:col-span-2"><p className="font-semibold">{labels.summary}</p><p className="mt-1 text-muted-foreground">{selectedEmploymentIds.length} {labels.summaryPeople}. {labels.summaryStart} {validFrom}. {noAccrual ? labels.noAccrual : `${labels.summaryAmount} ${toHours(amountHours, amountMinutes)} ${labels.hoursUnit}. ${labels.summaryExpiry} ${expiryMonths} ${labels.months}.`} {reason.trim() ? `${labels.summaryReason} ${reason.trim()}.` : ''}</p></div>
      {status === 'saved' ? <p className="text-sm text-success" role="status">{labels.saved}</p> : status === 'failed' ? <p className="text-sm text-destructive" role="alert">{labels.failed}</p> : null}
    </FormDrawer>
  </>
}
