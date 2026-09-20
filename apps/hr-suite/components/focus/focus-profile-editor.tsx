'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface EmployeeUpdateResponse {
  data?: {
    updatedAt?: unknown
  }
}

export interface FocusProfileEditorLabels {
  editTitle: string
  firstName: string
  save: string
  saving: string
  saved: string
  failed: string
}

function updatedAtFromResponse(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null || !('data' in payload)) return null
  const data = (payload as EmployeeUpdateResponse).data
  return typeof data?.updatedAt === 'string' ? data.updatedAt : null
}

export function FocusProfileEditor({ employeeId, firstName: initialFirstName, updatedAt: initialUpdatedAt, labels }: { employeeId: string; firstName: string; updatedAt: string; labels: FocusProfileEditorLabels }) {
  const router = useRouter()
  const [firstName, setFirstName] = useState(initialFirstName)
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const nextFirstName = firstName.trim()
    if (!nextFirstName || state === 'saving') return
    setState('saving')
    try {
      const response = await fetch(`/api/employees/${employeeId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ firstName: nextFirstName, updatedAt }),
      })
      const payload: unknown = await response.json()
      if (!response.ok) throw new Error('FOCUS_PROFILE_UPDATE_FAILED')
      const nextUpdatedAt = updatedAtFromResponse(payload)
      if (nextUpdatedAt) setUpdatedAt(nextUpdatedAt)
      setFirstName(nextFirstName)
      setState('saved')
      router.refresh()
    } catch {
      setState('failed')
    }
  }

  return <form aria-label={labels.editTitle} className="flex flex-wrap items-end gap-2" onSubmit={(event) => void save(event)}>
    <label className="grid gap-1 text-xs font-medium text-muted-foreground" htmlFor="focus-profile-first-name">
      {labels.firstName}
      <input className="form-field min-h-9 w-44 text-sm" id="focus-profile-first-name" maxLength={120} name="firstName" onChange={(event) => { setFirstName(event.currentTarget.value); setState('idle') }} required value={firstName} />
    </label>
    <Button disabled={!firstName.trim()} loading={state === 'saving'} size="sm" type="submit">{state === 'saving' ? labels.saving : labels.save}</Button>
    {state === 'saved' ? <span aria-live="polite" className="text-xs text-success">{labels.saved}</span> : null}
    {state === 'failed' ? <span aria-live="assertive" className="text-xs text-destructive">{labels.failed}</span> : null}
  </form>
}
