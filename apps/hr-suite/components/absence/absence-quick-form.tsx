'use client'

import { useState } from 'react'
import type { AbsenceCaseSummary } from '@/lib/absence/service'

interface AbsenceQuickFormProps {
  employeeId: string
  employmentId?: string
  currentCase?: AbsenceCaseSummary | null
  labels: {
    report: string
    startDate: string
    percentage: string
    expectedRecovery: string
    submit: string
    recover: string
    recoveredOn: string
    failed: string
  }
}

export function AbsenceQuickForm({ employeeId, employmentId, currentCase, labels }: AbsenceQuickFormProps) {
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [percentage, setPercentage] = useState('100')
  const [expectedRecovery, setExpectedRecovery] = useState('')
  const [recoveredOn, setRecoveredOn] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  async function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(false)
    const response = await fetch('/api/absence/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ employeeId, employmentId, startDate, absencePercentage: Number(percentage), expectedRecoveryOn: expectedRecovery || null, idempotencyKey: crypto.randomUUID() }) })
    setSaving(false)
    if (!response.ok) { setError(true); return }
    window.location.reload()
  }

  async function submitRecovery(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!currentCase) return
    setSaving(true); setError(false)
    const response = await fetch('/api/absence/recovery', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ caseId: currentCase.id, recoveredOn, idempotencyKey: crypto.randomUUID() }) })
    setSaving(false)
    if (!response.ok) { setError(true); return }
    window.location.reload()
  }

  return <div className="space-y-4 rounded-xl border border-primary/20 bg-accent/20 p-4">
    <form onSubmit={submitReport} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-medium">{labels.startDate}<input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="input mt-1 w-full" /></label>
      <label className="text-sm font-medium">{labels.percentage}<input required min="0.01" max="100" step="0.01" type="number" value={percentage} onChange={(event) => setPercentage(event.target.value)} className="input mt-1 w-full" /></label>
      <label className="text-sm font-medium sm:col-span-2">{labels.expectedRecovery}<input type="date" value={expectedRecovery} onChange={(event) => setExpectedRecovery(event.target.value)} className="input mt-1 w-full" /></label>
      <button type="submit" disabled={saving} className="button-primary sm:col-span-2">{saving ? '…' : labels.submit}</button>
    </form>
    {currentCase && currentCase.status !== 'CLOSED' && <form onSubmit={submitRecovery} className="grid gap-3 border-t border-border/70 pt-4 sm:grid-cols-[1fr_auto] sm:items-end"><label className="text-sm font-medium">{labels.recoveredOn}<input required type="date" value={recoveredOn} onChange={(event) => setRecoveredOn(event.target.value)} className="input mt-1 w-full" /></label><button type="submit" disabled={saving} className="button-secondary">{labels.recover}</button></form>}
    {error && <p role="alert" className="text-sm font-medium text-destructive">{labels.failed}</p>}
  </div>
}
