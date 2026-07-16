'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'

interface EmploymentCreateFormProps {
  employeeId: string
  labels: {
    title: string
    number: string
    contractType: string
    indefinite: string
    definite: string
    startDate: string
    seniorityDate: string
    endDate: string
    submit: string
    saved: string
    failed: string
    chainAdvice: string
    chainChecking: string
    chainClear: string
    chainAttention: string
    chainIndefinite: string
    chainInsufficient: string
    chainOverrideReason: string
    historyComplete: string
    knownContracts: string
    review: string
  }
}

interface ChainAssessment {
  outcome: 'CLEAR' | 'ATTENTION' | 'LIKELY_INDEFINITE' | 'INSUFFICIENT_DATA'
  chainContractCount: number
  ruleVersion: 'NL_CHAIN_2020' | 'NL_CHAIN_2028'
}

export function EmploymentCreateForm({ employeeId, labels }: EmploymentCreateFormProps) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const [assessment, setAssessment] = useState<ChainAssessment | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setState('saving')
    const form = new FormData(event.currentTarget)
    const startsOn = String(form.get('startsOn'))
    const contractType = String(form.get('contractType'))
    if (!assessment) {
      const assessmentResponse = await fetch(`/api/employees/${employeeId}/employment-chain-assessment`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          proposed: { startsOn, endsOn: String(form.get('endsOn')) || null, contractType },
          historyComplete: form.get('historyComplete') === 'on', exceptionCode: null,
        }),
      })
      if (!assessmentResponse.ok) { setState('failed'); return }
      const result = await assessmentResponse.json() as { data: ChainAssessment }
      setAssessment(result.data); setState('idle'); return
    }
    const response = await fetch(`/api/employees/${employeeId}/employments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        employmentNumber: String(form.get('employmentNumber')),
        employmentType: 'EMPLOYEE',
        contractType,
        startsOn,
        endsOn: String(form.get('endsOn')) || null,
        seniorityDate: String(form.get('seniorityDate')) || startsOn,
        originalHireDate: startsOn,
        isPrimary: false,
        reasonStarted: String(form.get('chainOverrideReason')) || null,
      }),
    })
    if (!response.ok) {
      setState('failed')
      return
    }
    event.currentTarget.reset()
    setAssessment(null)
    setState('saved')
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="rounded-xl border bg-surface p-5 shadow-sm">
      <h2 className="text-lg font-semibold">{labels.title}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium">
          {labels.number}
          <input name="employmentNumber" required maxLength={40} className="form-field" />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {labels.endDate}
          <input name="endsOn" type="date" className="form-field" />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {labels.contractType}
          <select name="contractType" className="form-field">
            <option value="INDEFINITE">{labels.indefinite}</option>
            <option value="DEFINITE">{labels.definite}</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {labels.startDate}
          <input name="startsOn" type="date" required className="form-field" />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {labels.seniorityDate}
          <input name="seniorityDate" type="date" className="form-field" />
        </label>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm font-medium"><input name="historyComplete" type="checkbox" defaultChecked />{labels.historyComplete}</label>
      {assessment && <section className={`mt-4 rounded-xl border p-4 ${assessment.outcome === 'CLEAR' ? 'bg-success/10' : 'bg-warning/10'}`}>
        <h3 className="font-semibold">{labels.chainAdvice}</h3>
        <p className="mt-1 text-sm">{{ CLEAR: labels.chainClear, ATTENTION: labels.chainAttention, LIKELY_INDEFINITE: labels.chainIndefinite, INSUFFICIENT_DATA: labels.chainInsufficient }[assessment.outcome]}</p>
        <p className="mt-2 text-xs text-muted-foreground">{labels.knownContracts.replace('{count}', String(assessment.chainContractCount))}</p>
        {assessment.outcome !== 'CLEAR' && <label className="mt-3 grid gap-1.5 text-sm font-medium">{labels.chainOverrideReason}<textarea className="form-field min-h-20" name="chainOverrideReason" required /></label>}
      </section>}
      <div className="mt-4 flex items-center gap-3">
        <button disabled={state === 'saving'} className="button-primary" type="submit">
          {assessment ? labels.submit : labels.review}
        </button>
        {state === 'saved' && <p className="text-sm text-success">{labels.saved}</p>}
        {state === 'failed' && <p className="text-sm text-danger">{labels.failed}</p>}
      </div>
    </form>
  )
}
