'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { TextInput } from '@/components/ui/text-input'
import type { GuidedInterview, GuidedSet, RecruitmentParticipantOption } from '@/lib/recruitment/guided-service'

interface Props { readonly applicationId: string; readonly interviews: readonly GuidedInterview[]; readonly sets: readonly GuidedSet[]; readonly participants: readonly RecruitmentParticipantOption[]; readonly labels: { readonly title: string; readonly description: string; readonly newInterview: string; readonly interviewTitle: string; readonly scheduledAt: string; readonly set: string; readonly noSet: string; readonly participants: string; readonly searchParticipants: string; readonly createInterview: string; readonly cancel: string; readonly saved: string; readonly noInterviews: string; readonly emptyValue?: string; readonly close?: string; readonly dirtyTitle?: string; readonly dirtyDescription?: string; readonly discard?: string; readonly keepEditing?: string } }

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
  const dirty = title.trim().length > 0 || scheduledAt.length > 0 || participantQuery.length > 0 || participantIds.length > 0

  function resetDraft(): void {
    setTitle('')
    setScheduledAt('')
    setParticipantQuery('')
    setParticipantIds([])
    setSetId(sets.find((set) => set.isActive)?.id ?? null)
  }

  async function createInterview(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!title.trim() || participantIds.length === 0) return
    setSaving(true)
    try {
      const response = await fetch('/api/recruitment/interviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ applicationId, title, scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null, setId, participants: participantIds }) }).catch(() => null)
      const status = response?.status ?? 0
      if (!response || status < 200 || status >= 300) throw new Error('RECRUITMENT_INTERVIEW_FAILED')
      resetDraft()
      setOpen(false)
      router.refresh()
    } finally { setSaving(false) }
  }

  return <section className="rounded-[var(--radius-surface)] border border-subtle bg-surface p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{labels.title}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.description}</p></div><button className="button-primary" onClick={() => setOpen(true)} type="button">{labels.newInterview}</button></div>{interviews.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{labels.noInterviews}</p> : <ul className="mt-4 divide-y divide-border-subtle rounded-[var(--radius-surface)] border border-subtle">{interviews.map((interview) => <li className="p-4" key={interview.id}><p className="break-words font-medium">{interview.title}</p><p className="mt-1 text-xs text-muted-foreground">{interview.scheduledAt ?? labels.emptyValue ?? labels.cancel} · {interview.status}</p></li>)}</ul>}
    <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.close ?? labels.cancel} description={labels.description} dirty={dirty} dirtyProtection={{ title: labels.dirtyTitle ?? labels.newInterview, description: labels.dirtyDescription ?? labels.description, discardLabel: labels.discard ?? labels.cancel, keepEditingLabel: labels.keepEditing ?? labels.cancel }} disabled={saving || !title.trim() || participantIds.length === 0} onDiscard={resetDraft} onOpenChange={setOpen} open={open} saveLabel={labels.createInterview} saving={saving} title={labels.newInterview} onSubmit={(event) => void createInterview(event)}>
      <label className="grid gap-1.5 text-sm font-medium sm:col-span-2"><span>{labels.interviewTitle}</span><TextInput onChange={(event) => setTitle(event.target.value)} required value={title} /></label>
      <label className="grid gap-1.5 text-sm font-medium"><span>{labels.scheduledAt}</span><TextInput onChange={(event) => setScheduledAt(event.target.value)} type="datetime-local" value={scheduledAt} /></label>
      <label className="grid gap-1.5 text-sm font-medium"><span>{labels.set}</span><DropdownSelect aria-label={labels.set} onChange={(event) => setSetId(event.target.value || null)} value={setId ?? ''}><option value="">{labels.noSet}</option>{sets.filter((set) => set.isActive).map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}</DropdownSelect></label>
      <fieldset className="grid gap-2 sm:col-span-2"><legend className="text-sm font-medium">{labels.participants}</legend><TextInput aria-label={labels.searchParticipants} onChange={(event) => setParticipantQuery(event.target.value)} placeholder={labels.searchParticipants} value={participantQuery} /><div className="grid max-h-48 gap-2 overflow-y-auto rounded-[var(--radius-surface)] border border-subtle p-2 sm:grid-cols-2">{filteredParticipants.map((participant) => <label className="flex min-w-0 items-start gap-2 rounded-[var(--radius-control)] p-2 text-sm hover:bg-muted/30" key={participant.id}><input checked={participantIds.includes(participant.id)} className="mt-1" onChange={(event) => setParticipantIds((current) => event.target.checked ? [...current, participant.id] : current.filter((id) => id !== participant.id))} type="checkbox" /><span className="min-w-0 break-words">{participant.name}</span></label>)}</div></fieldset>
    </FormDrawer>
  </section>
}
