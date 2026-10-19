'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw } from 'lucide-react'
import { buttonClasses } from '@/components/ui/button'
import { ConfirmationDialog } from './confirmation-dialog'

interface Labels {
  button: string
  title: string
  description: string
  reason: string
  confirm: string
  cancel: string
  saving: string
  saved: string
  failed: string
}

interface FutureSalaryTimelineCorrectionProps {
  employmentId: string
  effectiveOn: string
  today: string
  periodCount: number
  canWrite: boolean
  labels: Labels
}

export function FutureSalaryTimelineCorrection({ employmentId, effectiveOn, today, periodCount, canWrite, labels }: FutureSalaryTimelineCorrectionProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'saved' | 'failed'>('idle')

  if (!canWrite || periodCount < 2 || effectiveOn <= today) return null

  async function rollback() {
    const trimmedReason = reason.trim()
    if (!trimmedReason || state === 'busy') return

    setState('busy')
    try {
      const response = await fetch(`/api/employments/${employmentId}/timeline/SALARY`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ effectiveOn, reason: trimmedReason }),
      })
      if (!response.ok) {
        setState('failed')
        return
      }
      setOpen(false)
      setReason('')
      setState('saved')
      router.refresh()
    } catch {
      setState('failed')
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={buttonClasses({ variant: 'secondary' })} onClick={() => { setState('idle'); setOpen(true) }}>
          <RotateCcw aria-hidden="true" className="h-4 w-4" />{labels.button}
        </button>
        {state === 'saved' && <span role="status" className="text-sm text-success">{labels.saved}</span>}
      </div>
      <ConfirmationDialog
        open={open}
        title={labels.title}
        description={labels.description.replace('{date}', effectiveOn)}
        confirmLabel={state === 'busy' ? labels.saving : labels.confirm}
        cancelLabel={labels.cancel}
        busy={state === 'busy' || !reason.trim()}
        warning
        onCancel={() => setOpen(false)}
        onConfirm={rollback}
      >
        <label className="mt-4 grid gap-1.5 text-sm font-medium">
          {labels.reason}
          <input className="form-field" value={reason} maxLength={500} onChange={(event) => { setReason(event.target.value); setState('idle') }} />
        </label>
        {state === 'failed' && <p role="alert" className="mt-3 text-sm text-danger">{labels.failed}</p>}
      </ConfirmationDialog>
    </>
  )
}
