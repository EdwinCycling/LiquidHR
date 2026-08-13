'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { GuidedInterview, GuidedSet, RecruitmentParticipantOption } from '@/lib/recruitment/guided-service'

interface Props { readonly applicationId: string; readonly interviews: readonly GuidedInterview[]; readonly sets: readonly GuidedSet[]; readonly participants: readonly RecruitmentParticipantOption[]; readonly labels: { readonly title: string; readonly description: string; readonly newInterview: string; readonly interviewTitle: string; readonly scheduledAt: string; readonly set: string; readonly noSet: string; readonly participants: string; readonly searchParticipants: string; readonly createInterview: string; readonly cancel: string; readonly saved: string; readonly noInterviews: string } }

async function readData(response: Response): Promise<void> {
  if (!response.ok) throw new Error('RECRUITMENT_INTERVIEW_FAILED')
}

export function GuidedInterviewPlanner({ applicationId, interviews, sets, participants, labels }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [setId, setSetId] = useState<string | null>(sets.find((set) => set.isActive)?.id ?? null)
  const [participantQuery, setParticipantQuery] = useState('')
  const [participantIds, setParticipantIds] = useState<readonly string[]>([])
  const [saving, setSaving] = useState(false)
  const filteredParticipants = useMemo(() => participants.filter((participant) => participant.name.toLocaleLowerCase().includes(participantQuery.trim().toLocaleLowerCase())), [participants, participantQuery])

  async function createInterview() {
    if (!title.trim() || participantIds.length === 0) return
    setSaving(true)
    try { await readData(await fetch('/api/recruitment/interviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ applicationId, title, scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null, setId, participants: participantIds }) })); setOpen(false); setTitle(''); setScheduledAt(''); setParticipantIds([]); router.refresh() } finally { setSaving(false) }
  }

  return <section className="rounded-2xl border bg-surface p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{labels.title}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.description}</p></div><button className="button-primary" onClick={() => setOpen(true)} type="button">{labels.newInterview}</button></div>{interviews.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{labels.noInterviews}</p> : <ul className="mt-4 divide-y rounded-xl border">{interviews.map((interview) => <li className="p-4" key={interview.id}><p className="font-medium">{interview.title}</p><p className="mt-1 text-xs text-muted-foreground">{interview.scheduledAt ?? '—'} · {interview.status}</p></li>)}</ul>}{open ? <div aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-primary/25 p-4" role="dialog"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border bg-surface p-5 shadow-2xl"><h2 className="text-lg font-semibold">{labels.newInterview}</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm sm:col-span-2">{labels.interviewTitle}<input className="input" onChange={(event) => setTitle(event.target.value)} value={title} /></label><label className="grid gap-1 text-sm">{labels.scheduledAt}<input className="input" onChange={(event) => setScheduledAt(event.target.value)} type="datetime-local" value={scheduledAt} /></label><label className="grid gap-1 text-sm">{labels.set}<select className="input" onChange={(event) => setSetId(event.target.value || null)} value={setId ?? ''}><option value="">{labels.noSet}</option>{sets.filter((set) => set.isActive).map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}</select></label><fieldset className="sm:col-span-2"><legend className="text-sm font-medium">{labels.participants}</legend><input aria-label={labels.searchParticipants} className="input mt-2 w-full" onChange={(event) => setParticipantQuery(event.target.value)} placeholder={labels.searchParticipants} value={participantQuery} /><div className="mt-2 grid max-h-48 gap-2 overflow-y-auto rounded-xl border p-2 sm:grid-cols-2">{filteredParticipants.map((participant) => <label className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-muted/30" key={participant.id}><input checked={participantIds.includes(participant.id)} onChange={(event) => setParticipantIds((current) => event.target.checked ? [...current, participant.id] : current.filter((id) => id !== participant.id))} type="checkbox" />{participant.name}</label>)}</div></fieldset></div><div className="mt-5 flex justify-end gap-2"><button className="button-secondary" onClick={() => setOpen(false)} type="button">{labels.cancel}</button><button className="button-primary" disabled={saving || !title.trim() || participantIds.length === 0} onClick={() => void createInterview()} type="button">{labels.createInterview}</button></div></div></div> : null}</section>
}
