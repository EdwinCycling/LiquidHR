'use client'

import { useState } from 'react'
import type { TalentGoalCheckIn } from '@/lib/talent/check-in-service'

type CheckInLabels = {
  title: string
  open: string
  reflection: string
  observation: string
  followUp: string
  body: string
  followUpTitle: string
  dueOn: string
  save: string
  complete: string
  empty: string
  saved: string
  failed: string
}

type GoalMode = 'admin' | 'manager' | 'self'

export function TalentGoalCheckIns({ goalId, mode, labels }: { goalId: string; mode: GoalMode; labels: CheckInLabels }) {
  const [open, setOpen] = useState(false)
  const [checkIns, setCheckIns] = useState<TalentGoalCheckIn[]>([])
  const [body, setBody] = useState('')
  const [followUpTitle, setFollowUpTitle] = useState('')
  const [followUpDueOn, setFollowUpDueOn] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    const response = await fetch(`/api/talent/goals/${goalId}/check-ins`, { cache: 'no-store' })
    if (!response.ok) { setMessage(labels.failed); return }
    const payload = await response.json() as { data: TalentGoalCheckIn[] }
    setCheckIns(payload.data)
  }

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next) await load()
  }

  async function save() {
    setMessage(null)
    const entryType = mode === 'self' ? 'EMPLOYEE_REFLECTION' : followUpTitle ? 'FOLLOW_UP' : 'MANAGER_OBSERVATION'
    const response = await fetch(`/api/talent/goals/${goalId}/check-ins`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entryType, body, followUpTitle: followUpTitle || null, followUpDueOn: followUpDueOn || null }) })
    if (!response.ok) { setMessage(labels.failed); return }
    setBody('')
    setFollowUpTitle('')
    setFollowUpDueOn('')
    await load()
    setMessage(labels.saved)
  }

  async function complete(checkIn: TalentGoalCheckIn) {
    const response = await fetch(`/api/talent/goals/check-ins/${checkIn.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: checkIn.version, status: 'COMPLETED' }) })
    if (!response.ok) { setMessage(labels.failed); return }
    await load()
    setMessage(labels.saved)
  }

  return <div className="mt-4 border-t pt-4"><button className="button-secondary" onClick={() => void toggle()} type="button" aria-expanded={open}>{labels.open}</button>{open ? <div className="mt-4 space-y-4"><h4 className="text-sm font-semibold">{labels.title}</h4>{checkIns.length === 0 ? <p className="text-sm text-muted-foreground">{labels.empty}</p> : <ul className="space-y-3">{checkIns.map((checkIn) => <li className="rounded-xl border p-3" key={checkIn.id}><p className="text-xs font-semibold uppercase tracking-wide text-primary">{checkIn.entry_type === 'EMPLOYEE_REFLECTION' ? labels.reflection : checkIn.entry_type === 'FOLLOW_UP' ? labels.followUp : labels.observation}</p><p className="mt-1 whitespace-pre-wrap text-sm">{checkIn.body}</p>{checkIn.follow_up_title ? <p className="mt-2 text-xs text-muted-foreground">{checkIn.follow_up_title}{checkIn.follow_up_due_on ? ` · ${checkIn.follow_up_due_on}` : ''}</p> : null}{checkIn.status === 'OPEN' && mode !== 'self' ? <button className="button-secondary mt-3" onClick={() => void complete(checkIn)} type="button">{labels.complete}</button> : null}</li>)}</ul>}<div className="grid gap-3"><label className="text-sm"><span className="mb-1 block">{labels.body}</span><textarea className="form-field min-h-20" value={body} onChange={(event) => setBody(event.target.value)} /></label>{mode !== 'self' ? <><label className="text-sm"><span className="mb-1 block">{labels.followUpTitle}</span><input className="form-field" value={followUpTitle} onChange={(event) => setFollowUpTitle(event.target.value)} /></label><label className="text-sm"><span className="mb-1 block">{labels.dueOn}</span><input className="form-field" type="date" value={followUpDueOn} onChange={(event) => setFollowUpDueOn(event.target.value)} /></label></> : null}<button className="button-primary justify-self-start" disabled={!body.trim()} onClick={() => void save()} type="button">{labels.save}</button></div>{message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}</div> : null}</div>
}
