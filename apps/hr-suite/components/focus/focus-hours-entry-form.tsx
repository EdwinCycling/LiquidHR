'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { ActualWorkEmployeeProjection } from '@/lib/actual-work/actual-work-service'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'

export interface FocusHoursEntryLabels {
  title: string
  editTitle: string
  existingTitle: string
  edit: string
  cancel: string
  type: string
  selectType: string
  searchTypes: string
  date: string
  hours: string
  hoursPlaceholder: string
  note: string
  correctionReason: string
  save: string
  saveEdit: string
  saving: string
  saved: string
  failed: string
  noTypes: string
  errorClosedPeriod: string
  errorFutureDate: string
  errorInactiveType: string
  errorLeaveOverlap: string
  errorUnauthorized: string
  errorHoursInvalid: string
  errorStale: string
  errorCommentRequired: string
  errorGeneric: string
}

export function focusHoursErrorMessage(code: string | null | undefined, labels: FocusHoursEntryLabels): string {
  switch (code) {
    case 'ACTUAL_WORK_PERIOD_CLOSED': return labels.errorClosedPeriod
    case 'ACTUAL_WORK_FUTURE_NOT_ALLOWED': return labels.errorFutureDate
    case 'ACTUAL_WORK_TYPE_NOT_ACTIVE': return labels.errorInactiveType
    case 'ACTUAL_WORK_LEAVE_OVERLAP': return labels.errorLeaveOverlap
    case 'ACTUAL_WORK_NOT_AUTHORIZED': return labels.errorUnauthorized
    case 'ACTUAL_WORK_CORRECTION_REASON_REQUIRED': return labels.errorCommentRequired
    case 'ACTUAL_WORK_COMMENT_REQUIRED': return labels.errorCommentRequired
    case 'ACTUAL_WORK_HOURS_REQUIRED': return labels.errorHoursInvalid
    case 'ACTUAL_WORK_HOURS_PRECISION_INVALID': return labels.errorHoursInvalid
    case 'ACTUAL_WORK_HOURS_FORMAT_INVALID': return labels.errorHoursInvalid
    case 'ACTUAL_WORK_CONCURRENT_UPDATE': return labels.errorStale
    default: return labels.errorGeneric
  }
}

function validHours(value: string): boolean {
  const normalized = value.trim().replace(',', '.')
  return /^(?:\d+)(?:\.\d{1,4})?$/.test(normalized) && Number(normalized) > 0
}

export function FocusHoursEntryForm({ employeeId, projection, labels, today }: { employeeId: string; projection: ActualWorkEmployeeProjection; labels: FocusHoursEntryLabels; today: string }) {
  const router = useRouter()
  const activeTypes = useMemo(() => projection.types.filter((type) => type.is_active), [projection.types])
  const defaultType = activeTypes.find((type) => type.family !== 'TRANSPARENT') ?? activeTypes[0]
  const [typeId, setTypeId] = useState(defaultType?.id ?? '')
  const [date, setDate] = useState(today)
  const [hours, setHours] = useState('')
  const [note, setNote] = useState('')
  const [correctionReason, setCorrectionReason] = useState('')
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const selectedType = activeTypes.find((type) => type.id === typeId) ?? defaultType
  const periodEntry = selectedType?.entry_granularity === 'PERIOD'
  const editableEntries = projection.entries.filter((entry) => entry.status !== 'REVOKED')

  function beginEdit(entry: ActualWorkEmployeeProjection['entries'][number]): void {
    setEditingEntryId(entry.id)
    setTypeId(entry.work_hour_type_id)
    setDate(entry.subject_period_start)
    setHours(String(entry.hours))
    setNote(entry.note ?? '')
    setCorrectionReason('')
    setState('idle')
    setErrorCode(null)
  }

  function cancelEdit(): void {
    setEditingEntryId(null)
    setDate(today)
    setHours('')
    setNote('')
    setCorrectionReason('')
    setState('idle')
    setErrorCode(null)
  }

  async function save(): Promise<void> {
    if (!selectedType) return
    if (!date || !validHours(hours)) {
      setErrorCode('ACTUAL_WORK_HOURS_FORMAT_INVALID')
      setState('error')
      return
    }
    if (selectedType.comment_required && !note.trim()) {
      setErrorCode('ACTUAL_WORK_COMMENT_REQUIRED')
      setState('error')
      return
    }
    if (editingEntryId && !correctionReason.trim()) {
      setErrorCode('ACTUAL_WORK_CORRECTION_REASON_REQUIRED')
      setState('error')
      return
    }
    setState('saving')
    setErrorCode(null)
    try {
      const response = await fetch('/api/actual-work/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, employmentId: projection.employment.id, entryId: editingEntryId, workHourTypeId: selectedType.id, entryGranularity: selectedType.entry_granularity === 'PERIOD' ? 'PERIOD' : 'DAY', subjectPeriodStart: date, hours: hours.trim().replace(',', '.'), note: note || null, correctionReason: editingEntryId ? correctionReason || null : null }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: unknown } | null
        setErrorCode(typeof payload?.error === 'string' ? payload.error : null)
        setState('error')
        return
      }
      setEditingEntryId(null)
      setHours('')
      setNote('')
      setCorrectionReason('')
      setErrorCode(null)
      setState('saved')
      router.refresh()
    } catch {
      setErrorCode(null)
      setState('error')
    }
  }

  return <Surface className="space-y-4 p-4 sm:p-6"><div><h2 className="text-lg font-semibold">{editingEntryId ? labels.editTitle : labels.title}</h2></div>{editableEntries.length ? <div className="space-y-2 border-b border-border-subtle pb-4"><h3 className="text-sm font-semibold">{labels.existingTitle}</h3>{editableEntries.map((entry) => <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-2 text-sm" key={entry.id}><div className="min-w-0"><p className="font-medium">{entry.subject_period_start} · {entry.hours} {labels.hours}</p><p className="text-xs text-muted-foreground">{projection.types.find((type) => type.id === entry.work_hour_type_id)?.name ?? entry.work_hour_type_id}</p></div><Button onClick={() => editingEntryId === entry.id ? cancelEdit() : beginEdit(entry)} size="sm" type="button" variant="secondary">{editingEntryId === entry.id ? labels.cancel : labels.edit}</Button></div>)}</div> : null}{activeTypes.length === 0 ? <p className="text-sm text-muted-foreground">{labels.noTypes}</p> : <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium"><span>{labels.type}</span><DropdownSelect aria-label={labels.selectType} onChange={(event) => setTypeId(event.target.value)} placeholder={labels.selectType} searchable searchPlaceholder={labels.searchTypes} value={typeId}>{activeTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</DropdownSelect></label><label className="grid gap-1.5 text-sm font-medium"><span>{labels.date}</span><TextInput max={selectedType?.future_entry_allowed ? undefined : periodEntry ? today.slice(0, 7) : today} onChange={(event) => setDate(periodEntry ? `${event.target.value}-01` : event.target.value)} required type={periodEntry ? 'month' : 'date'} value={periodEntry ? date.slice(0, 7) : date} /></label><label className="grid gap-1.5 text-sm font-medium"><span>{labels.hours}</span><TextInput inputMode="decimal" onChange={(event) => setHours(event.target.value)} placeholder={labels.hoursPlaceholder} required type="text" value={hours} /></label><label className="grid gap-1.5 text-sm font-medium sm:col-span-2"><span>{labels.note}{selectedType?.comment_required ? ' *' : ''}</span><Textarea maxLength={500} onChange={(event) => setNote(event.target.value)} required={selectedType?.comment_required ?? false} value={note} /></label>{editingEntryId ? <label className="grid gap-1.5 text-sm font-medium sm:col-span-2"><span>{labels.correctionReason}</span><Textarea maxLength={500} onChange={(event) => setCorrectionReason(event.target.value)} required value={correctionReason} /></label> : null}{state === 'saved' ? <p className="text-sm text-success sm:col-span-2" role="status">{labels.saved}</p> : null}{state === 'error' ? <p className="text-sm text-destructive sm:col-span-2" role="alert">{focusHoursErrorMessage(errorCode, labels)}</p> : null}<div className="flex flex-wrap gap-2 sm:col-span-2"><Button disabled={state === 'saving' || !selectedType} onClick={() => void save()} type="button">{state === 'saving' ? labels.saving : editingEntryId ? labels.saveEdit : labels.save}</Button>{editingEntryId ? <Button onClick={cancelEdit} type="button" variant="secondary">{labels.cancel}</Button> : null}</div></div>}</Surface>
}
