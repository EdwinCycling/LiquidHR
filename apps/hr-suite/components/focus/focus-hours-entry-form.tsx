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
  type: string
  selectType: string
  searchTypes: string
  date: string
  hours: string
  hoursPlaceholder: string
  note: string
  save: string
  saving: string
  saved: string
  failed: string
  noTypes: string
}

export function FocusHoursEntryForm({ employeeId, projection, labels, today }: { employeeId: string; projection: ActualWorkEmployeeProjection; labels: FocusHoursEntryLabels; today: string }) {
  const router = useRouter()
  const activeTypes = useMemo(() => projection.types.filter((type) => type.is_active), [projection.types])
  const defaultType = activeTypes.find((type) => type.family !== 'TRANSPARENT') ?? activeTypes[0]
  const [typeId, setTypeId] = useState(defaultType?.id ?? '')
  const [date, setDate] = useState(today)
  const [hours, setHours] = useState('')
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const selectedType = activeTypes.find((type) => type.id === typeId) ?? defaultType
  const periodEntry = selectedType?.entry_granularity === 'PERIOD'

  async function save(): Promise<void> {
    if (!selectedType) return
    setState('saving')
    try {
      const response = await fetch('/api/actual-work/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, employmentId: projection.employment.id, workHourTypeId: selectedType.id, entryGranularity: selectedType.entry_granularity === 'PERIOD' ? 'PERIOD' : 'DAY', subjectPeriodStart: date, hours, note: note || null, correctionReason: null }),
      })
      if (!response.ok) throw new Error(labels.failed)
      setHours('')
      setNote('')
      setState('saved')
      router.refresh()
    } catch {
      setState('error')
    }
  }

  return <Surface className="space-y-4 p-4 sm:p-6"><div><h2 className="text-lg font-semibold">{labels.title}</h2></div>{activeTypes.length === 0 ? <p className="text-sm text-muted-foreground">{labels.noTypes}</p> : <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium"><span>{labels.type}</span><DropdownSelect aria-label={labels.selectType} onChange={(event) => setTypeId(event.target.value)} placeholder={labels.selectType} searchable searchPlaceholder={labels.searchTypes} value={typeId}>{activeTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</DropdownSelect></label><label className="grid gap-1.5 text-sm font-medium"><span>{labels.date}</span><TextInput onChange={(event) => setDate(periodEntry ? `${event.target.value}-01` : event.target.value)} required type={periodEntry ? 'month' : 'date'} value={periodEntry ? date.slice(0, 7) : date} /></label><label className="grid gap-1.5 text-sm font-medium"><span>{labels.hours}</span><TextInput inputMode="decimal" onChange={(event) => setHours(event.target.value)} placeholder={labels.hoursPlaceholder} required type="text" value={hours} /></label><label className="grid gap-1.5 text-sm font-medium sm:col-span-2"><span>{labels.note}</span><Textarea maxLength={500} onChange={(event) => setNote(event.target.value)} value={note} /></label>{state === 'saved' ? <p className="text-sm text-success sm:col-span-2" role="status">{labels.saved}</p> : null}{state === 'error' ? <p className="text-sm text-destructive sm:col-span-2" role="alert">{labels.failed}</p> : null}<div className="sm:col-span-2"><Button disabled={state === 'saving' || !selectedType} onClick={() => void save()} type="button">{state === 'saving' ? labels.saving : labels.save}</Button></div></div>}</Surface>
}
