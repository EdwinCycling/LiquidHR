'use client'

import Link from 'next/link'
import { type FormEvent, useState } from 'react'

interface Candidate {
  id: string
  employeeNumber: string
  firstName: string
  birthName: string
  birthDate: string | null
  matchKind: 'BSN_EXACT' | 'FUZZY'
}

interface IdentityMatchFormProps {
  labels: {
    bsn: string
    birthDate: string
    birthName: string
    privateEmail: string
    check: string
    candidates: string
    none: string
    exact: string
    possible: string
    choose: string
    failed: string
  }
}

export function IdentityMatchForm({ labels }: IdentityMatchFormProps) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [failed, setFailed] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setFailed(false)
    const form = new FormData(event.currentTarget)
    const value = (name: string) => String(form.get(name) ?? '').trim() || undefined
    const response = await fetch('/api/employees/matches', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        bsn: value('bsn'),
        birthDate: value('birthDate'),
        birthName: value('birthName'),
        privateEmail: value('privateEmail'),
      }),
    })
    if (!response.ok) {
      setFailed(true)
      return
    }
    const payload: { data: Candidate[] } = await response.json()
    setCandidates(payload.data)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={submit} className="rounded-xl border bg-surface p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
            {labels.bsn}
            <input name="bsn" inputMode="numeric" autoComplete="off" className="form-field" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            {labels.birthDate}
            <input name="birthDate" type="date" className="form-field" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            {labels.birthName}
            <input name="birthName" className="form-field" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
            {labels.privateEmail}
            <input name="privateEmail" type="email" className="form-field" />
          </label>
        </div>
        <button type="submit" className="button-primary mt-5">{labels.check}</button>
        {failed && <p className="mt-3 text-sm text-danger">{labels.failed}</p>}
      </form>

      <section className="rounded-xl border bg-surface p-5 shadow-sm" aria-live="polite">
        <h2 className="text-lg font-semibold">{labels.candidates}</h2>
        {candidates?.length === 0 && <p className="mt-4 text-muted-foreground">{labels.none}</p>}
        {candidates && candidates.length > 0 && (
          <ul className="mt-4 space-y-3">
            {candidates.map((candidate) => (
              <li key={candidate.id} className="rounded-lg border bg-background p-4">
                <span className="status-chip">
                  {candidate.matchKind === 'BSN_EXACT' ? labels.exact : labels.possible}
                </span>
                <p className="mt-3 font-semibold">{candidate.firstName} {candidate.birthName}</p>
                <p className="text-sm text-muted-foreground">{candidate.employeeNumber}</p>
                <Link href={`/employees/${candidate.id}`} className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
                  {labels.choose}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
