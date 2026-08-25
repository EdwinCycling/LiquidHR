'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { TextInput } from '@/components/ui/text-input'
import type { JourneyLabels } from '@/lib/journeys/labels'
import type { JourneyRuntimeDetail, JourneyStartOptions } from '@/lib/journeys/runtime-service'

type TransitionAction = 'PAUSE' | 'RESUME' | 'CANCEL' | 'COMPLETE'

type JourneyDetailActionsProps = {
  readonly journeyId: string
  readonly version: number
  readonly status: JourneyRuntimeDetail['status']
  readonly participants: JourneyRuntimeDetail['participants']
  readonly employees: JourneyStartOptions['employees']
  readonly labels: JourneyLabels
  readonly locale: 'nl' | 'en'
}

export function JourneyDetailActions({ journeyId, version, status, participants, employees, labels, locale }: JourneyDetailActionsProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmAction, setConfirmAction] = useState<Extract<TransitionAction, 'CANCEL' | 'COMPLETE'> | null>(null)
  const [participantId, setParticipantId] = useState(participants.find((participant) => participant.status === 'ACTIVE' || participant.status === 'ASSIGNED')?.id ?? '')
  const [replacementId, setReplacementId] = useState('')
  const [reason, setReason] = useState('')

  async function post(url: string, body: Record<string, unknown>): Promise<void> {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      if (!response.ok) throw new Error('journey operation failed')
      router.refresh()
    } catch {
      setError(labels.operationFailed)
    } finally {
      setBusy(false)
    }
  }

  function requestTransition(action: TransitionAction): void {
    if (action === 'CANCEL' || action === 'COMPLETE') {
      setConfirmAction(action)
      return
    }
    void post(`/api/journeys/${journeyId}/transition`, { expectedVersion: version, action })
  }

  async function confirmTransition(): Promise<void> {
    if (!confirmAction) return
    const action = confirmAction
    setConfirmAction(null)
    await post(`/api/journeys/${journeyId}/transition`, { expectedVersion: version, action })
  }

  const activeParticipants = participants.filter((participant) => participant.status === 'ACTIVE' || participant.status === 'ASSIGNED')
  const transitionLabel = confirmAction === 'COMPLETE' ? labels.complete : labels.cancelJourney

  return <div className="space-y-5">
    <div className="flex flex-wrap gap-2">
      {status === 'ACTIVE' || status === 'PLANNED' ? <Button disabled={busy} onClick={() => requestTransition('PAUSE')} size="sm" type="button" variant="secondary">{labels.pause}</Button> : null}
      {status !== 'COMPLETED' && status !== 'CANCELLED' ? <Button disabled={busy} onClick={() => requestTransition('COMPLETE')} size="sm" type="button" variant="secondary">{labels.complete}</Button> : null}
      {status === 'PAUSED' ? <Button disabled={busy} onClick={() => requestTransition('RESUME')} size="sm" type="button" variant="secondary">{labels.resume}</Button> : null}
      {status !== 'COMPLETED' && status !== 'CANCELLED' ? <Button disabled={busy} onClick={() => requestTransition('CANCEL')} size="sm" type="button" variant="danger">{labels.cancelJourney}</Button> : null}
    </div>

    {activeParticipants.length > 0 && status !== 'COMPLETED' && status !== 'CANCELLED' ? <section className="space-y-4 border-t border-border-subtle pt-5">
      <h3 className="font-semibold">{labels.replaceParticipant}</h3>
      <div className="grid gap-3">
        <DropdownSelect aria-label={labels.replaceParticipant} searchable searchPlaceholder={labels.search} value={participantId} onChange={(event) => setParticipantId(event.target.value)}>{activeParticipants.map((participant) => <option key={participant.id} value={participant.id}>{participant.roleName[locale]} · {participant.employeeName}</option>)}</DropdownSelect>
        <DropdownSelect aria-label={labels.replacement} searchable searchPlaceholder={labels.search} value={replacementId} onChange={(event) => setReplacementId(event.target.value)}><option value="">{labels.replacement}</option>{employees.filter((employee) => employee.id !== activeParticipants.find((participant) => participant.id === participantId)?.employeeId).map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</DropdownSelect>
        <label className="space-y-1 text-sm font-medium" htmlFor="journey-replacement-reason"><span>{labels.replacementReason}</span><TextInput id="journey-replacement-reason" maxLength={500} onChange={(event) => setReason(event.target.value)} value={reason} /></label>
        <Button disabled={busy || !participantId || !replacementId || !reason.trim()} loading={busy} type="button" variant="primary" onClick={() => void post(`/api/journeys/${journeyId}/participants/${participantId}/replace`, { replacementEmployeeId: replacementId, expectedVersion: version, reason })}>{labels.saveReplacement}</Button>
      </div>
    </section> : null}

    {error ? <p className="break-words text-sm text-destructive" role="alert">{error}</p> : null}
    <ConfirmDialog cancelLabel={labels.cancel} confirmLabel={transitionLabel} description={labels.confirmTransition} onConfirm={confirmTransition} onOpenChange={(open) => { if (!open) setConfirmAction(null) }} open={confirmAction !== null} pending={busy} title={transitionLabel} destructive={confirmAction === 'CANCEL'} />
  </div>
}
