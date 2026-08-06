'use client'

import { Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LeaveCatalog } from '@/lib/leave/leave-service'

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

  const reset = () => {
    setOpen(false)
    setSelectedEmploymentIds([])
    setSearch('')
    setReason('')
    setStatus('idle')
    router.refresh()
  }

  const toggleEmployment = (id: string) => setSelectedEmploymentIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const save = async () => {
    if (selectedEmploymentIds.length === 0 || !reason.trim() || (!noAccrual && !amountHours)) { setStatus('failed'); return }
    setStatus('saving')
    try {
      const employmentSelections = selectedEmploymentIds.map((employmentId) => {
        const employment = catalog.leaveExceptionEmployees.find((row) => row.employment_id === employmentId)
        return { employeeId: employment?.employee_id ?? '', employmentId }
      })
      const response = await fetch('/api/leave/catalog', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'ACCRUAL_EXCEPTION', employmentSelections, leaveTypeId, validFrom, validUntil: validUntil || null, noAccrual, accrualAmount: noAccrual ? null : toHours(amountHours, amountMinutes), expirationMonths: expiryMonths ? Number(expiryMonths) : null, reason: reason.trim() }) })
      if (!response.ok) throw new Error('LEAVE_EXCEPTION_SAVE_FAILED')
      setStatus('saved')
      router.refresh()
      setPage(1)
      window.setTimeout(reset, 250)
    } catch { setStatus('failed') }
  }

  return <>
    <section className="overflow-hidden rounded-2xl border bg-surface shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4"><div><h2 className="font-semibold">{labels.title}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.description}</p></div><button className="button-primary" onClick={() => setOpen(true)} type="button">{labels.add}</button></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[48rem] text-left text-sm"><thead className="bg-muted/40 text-xs uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-5 py-3">{labels.name}</th><th className="px-5 py-3">{labels.summary}</th><th className="px-5 py-3">{labels.validFrom}</th><th className="px-5 py-3">{labels.validUntil}</th></tr></thead><tbody className="divide-y">{pageRows.map((row) => <tr key={row.id}><td className="px-5 py-4 font-semibold">{row.employee_name}<span className="block text-xs font-normal text-muted-foreground">{catalog.leaveExceptionEmployees.find((employment) => employment.employment_id === row.employment_id)?.employment_number ?? row.employment_id}</span></td><td className="px-5 py-4">{row.no_accrual ? labels.noAccrual : `${labels.customAmount}: ${row.accrual_amount ?? 0}u`} · {labels.expiry}: {row.expiration_months ?? 0} {labels.months}</td><td className="px-5 py-4">{row.valid_from}</td><td className="px-5 py-4">{row.valid_until ?? labels.noValue}</td></tr>)}{pageRows.length === 0 ? <tr><td className="px-5 py-7 text-sm text-muted-foreground" colSpan={4}>{labels.empty}</td></tr> : null}</tbody></table></div>
      {rows.length > PAGE_SIZE ? <div className="flex items-center justify-between gap-3 border-t px-5 py-3 text-sm"><button className="button-secondary" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">{labels.previous}</button><span>{labels.page.replace('{current}', String(page)).replace('{total}', String(pageCount))}</span><button className="button-secondary" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} type="button">{labels.next}</button></div> : null}
    </section>
    {open ? <div aria-modal="true" className="fixed inset-0 z-40 grid place-items-center bg-foreground/30 p-4" role="dialog"><section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border bg-surface p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">{labels.title}</p><h2 className="mt-1 text-xl font-semibold">{labels.add}</h2></div><button aria-label={labels.cancel} className="button-secondary px-3" onClick={reset} type="button"><X size={17} /></button></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2"><fieldset className="grid gap-2 text-sm font-medium md:col-span-2"><legend>{labels.selectionMode}</legend><div className="flex flex-wrap gap-2"><button className={`rounded-lg border px-3 py-2 ${selectionMode === 'one' ? 'border-primary bg-primary/10 text-primary' : ''}`} onClick={() => { setSelectionMode('one'); setSelectedEmploymentIds(selectedEmploymentIds.slice(0, 1)) }} type="button">{labels.onePerson}</button><button className={`rounded-lg border px-3 py-2 ${selectionMode === 'multiple' ? 'border-primary bg-primary/10 text-primary' : ''}`} onClick={() => setSelectionMode('multiple')} type="button">{labels.multiplePeople}</button></div></fieldset>
        {selectionMode === 'one' ? <label className="grid gap-1.5 text-sm font-medium md:col-span-2">{labels.selectPerson}<select className="form-field" onChange={(event) => setSelectedEmploymentIds(event.target.value ? [event.target.value] : [])} value={selectedEmploymentIds[0] ?? ''}><option value="" />{catalog.leaveExceptionEmployees.map((employment) => <option key={employment.employment_id} value={employment.employment_id}>{employment.employee_name} · {employment.employment_number}</option>)}</select></label> : <div className="rounded-xl border p-4 md:col-span-2"><div className="flex flex-wrap items-center justify-between gap-3"><label className="relative min-w-48 flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><input className="form-field pl-9" onChange={(event) => setSearch(event.target.value)} placeholder={labels.search} value={search} /></label><button className="button-secondary" onClick={() => setSelectedEmploymentIds(visibleEmployments.map((employment) => employment.employment_id))} type="button">{labels.selectVisible}</button></div><div className="mt-3 max-h-56 divide-y overflow-y-auto">{visibleEmployments.map((employment) => <label className="flex items-center gap-3 px-2 py-2 text-sm" key={employment.employment_id}><input checked={selectedEmploymentIds.includes(employment.employment_id)} className="size-4 accent-primary" onChange={() => toggleEmployment(employment.employment_id)} type="checkbox" />{employment.employee_name} · {employment.employment_number}</label>)}</div><p className="mt-2 text-xs text-muted-foreground">{labels.selected.replace('{count}', String(selectedEmploymentIds.length))}</p></div>}
        <label className="grid gap-1.5 text-sm font-medium"><span>{labels.validFrom}</span><input className="form-field" onChange={(event) => setValidFrom(event.target.value)} type="date" value={validFrom} /></label><label className="grid gap-1.5 text-sm font-medium"><span>{labels.validUntil}</span><input className="form-field" onChange={(event) => setValidUntil(event.target.value)} type="date" value={validUntil} /></label>
        <label className="inline-flex items-center gap-3 text-sm font-medium md:col-span-2"><input checked={noAccrual} className="size-4 accent-primary" onChange={(event) => setNoAccrual(event.target.checked)} type="checkbox" />{labels.noAccrual}</label>
        {!noAccrual ? <div className="grid gap-2 md:col-span-2"><span className="text-sm font-medium">{labels.amount}</span><div className="grid grid-cols-2 gap-3"><input aria-label={labels.amount} className="form-field" min="0" onChange={(event) => setAmountHours(event.target.value)} placeholder="0" step="1" type="number" value={amountHours} /><input aria-label={labels.amount} className="form-field" min="0" max="59" onChange={(event) => setAmountMinutes(event.target.value)} placeholder="0" step="1" type="number" value={amountMinutes} /></div></div> : null}
        <label className="grid gap-1.5 text-sm font-medium"><span>{labels.expiry}</span><input className="form-field" min="0" max="120" onChange={(event) => setExpiryMonths(event.target.value)} type="number" value={expiryMonths} /></label><label className="grid gap-1.5 text-sm font-medium md:col-span-2"><span>{labels.reason}</span><textarea className="form-field min-h-20" maxLength={500} onChange={(event) => setReason(event.target.value)} value={reason} /></label>
      </div><div className="mt-5 rounded-xl bg-muted/50 p-4 text-sm"><p className="font-semibold">{labels.summary}</p><p className="mt-1 text-muted-foreground">{selectedEmploymentIds.length} · {validFrom} · {noAccrual ? labels.noAccrual : `${labels.customAmount}: ${toHours(amountHours, amountMinutes)}u`} · {labels.expiry}: {expiryMonths} {labels.months}</p></div><div className="mt-6 flex justify-end gap-2"><button className="button-secondary" onClick={reset} type="button">{labels.cancel}</button><button className="button-primary" disabled={status === 'saving'} onClick={() => void save()} type="button">{status === 'saving' ? labels.saving : labels.save}</button></div>{status === 'saved' ? <p className="mt-3 text-sm text-success">{labels.saved}</p> : status === 'failed' ? <p className="mt-3 text-sm text-destructive">{labels.failed}</p> : null}</section></div> : null}
  </>
}
