'use client'

import { ArrowLeft, ArrowRight, BellRing, CalendarDays, Pencil, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState, type FormEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { FormField } from '@/components/patterns/form-field'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { EntityList } from '@/components/patterns/entity-list'
import { RowActions } from '@/components/patterns/row-actions'
import { SectionHeader } from '@/components/patterns/section-header'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTime } from '@/lib/preferences/formatters'
import type { DateFormat, TimeFormat } from '@/lib/preferences/user-preferences'
import type { ReminderItem } from '@/lib/reminders/reminder-service'

interface Labels {
  title: string
  empty: string
  add: string
  edit: string
  remove: string
  titleLabel: string
  descriptionLabel: string
  dateLabel: string
  save: string
  saved: string
  failed: string
  cancel: string
  close: string
  moreActions: string
  shiftDayBack: string
  shiftDayForward: string
  shiftWeekForward: string
  shiftMonthForward: string
  personalReminder: string
  hrReminder: string
  discardTitle: string
  discardDescription: string
  discardConfirm: string
  discardCancel: string
  deleteTitle: string
  deleteDescription: string
  deleteConfirm: string
  deleteCancel: string
}

type FormValues = {
  title: string
  description: string
  dateTime: string
}

function localDateTimeValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function initialDateTime(): string { return localDateTimeValue(new Date(Date.now() + 60_000)) }

function shift(value: string, kind: 'dayBack' | 'dayForward' | 'weekForward' | 'monthForward'): string {
  const date = new Date(value)
  if (kind === 'dayBack') date.setDate(date.getDate() - 1)
  if (kind === 'dayForward') date.setDate(date.getDate() + 1)
  if (kind === 'weekForward') date.setDate(date.getDate() + 7)
  if (kind === 'monthForward') date.setMonth(date.getMonth() + 1)
  return localDateTimeValue(date)
}

function newFormValues(): FormValues {
  return { title: '', description: '', dateTime: initialDateTime() }
}

export function EmployeeReminders({ employeeId, reminders, locale, dateFormat, timeFormat, labels, mode, canManageHr }: { employeeId: string; reminders: ReminderItem[]; locale: string; dateFormat: DateFormat; timeFormat: TimeFormat; labels: Labels; mode: 'PERSONAL' | 'HR'; canManageHr: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ReminderItem | null>(null)
  const [formValues, setFormValues] = useState<FormValues>(newFormValues)
  const [savedValues, setSavedValues] = useState<FormValues>(newFormValues)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteCandidate, setDeleteCandidate] = useState<ReminderItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const formKey = useMemo(() => editing?.reminderId ?? 'new', [editing])
  const canAdd = mode === 'PERSONAL' || canManageHr
  const dirty = open && JSON.stringify(formValues) !== JSON.stringify(savedValues)

  function startAdd(): void {
    if (!canAdd) return
    const values = newFormValues()
    setEditing(null)
    setFormValues(values)
    setSavedValues(values)
    setFeedback(null)
    setFormError(null)
    setOpen(true)
  }

  function startEdit(item: ReminderItem): void {
    const values = { title: item.title, description: item.description ?? '', dateTime: localDateTimeValue(new Date(item.originalRemindAt)) }
    setEditing(item)
    setFormValues(values)
    setSavedValues(values)
    setFeedback(null)
    setFormError(null)
    setOpen(true)
  }

  function closeForm(): void {
    setOpen(false)
    setEditing(null)
    setFormError(null)
  }

  function updateFormValue<Key extends keyof FormValues>(key: Key, value: FormValues[Key]): void {
    setFormValues((current) => ({ ...current, [key]: value }))
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setFeedback(null)
    setFormError(null)

    try {
      const remindAt = new Date(formValues.dateTime).toISOString()
      const body = { title: formValues.title, description: formValues.description, remindAt }
      const createBody = mode === 'PERSONAL' ? { type: 'PERSONAL' as const, ...body } : { type: 'HR' as const, ...body, targetType: 'EMPLOYEES' as const, targetIds: [employeeId] }
      const response = await fetch(editing ? `/api/reminders/${editing.reminderId}` : '/api/reminders', { method: editing ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(editing ? body : createBody) })
      if (!response.ok) {
        setFormError(labels.failed)
        return
      }

      if (!editing && mode === 'HR') {
        const result = await response.json() as { data?: { id?: string } }
        if (result.data?.id) {
          const publishResponse = await fetch(`/api/reminders/${result.data.id}/publish`, { method: 'POST' })
          if (!publishResponse.ok) {
            setFormError(labels.failed)
            return
          }
        }
      }

      setFeedback(labels.saved)
      closeForm()
      router.refresh()
    } catch {
      setFormError(labels.failed)
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: ReminderItem): Promise<void> {
    if (deleting) return
    setDeleting(true)
    try {
      const response = await fetch(`/api/reminders/${item.reminderId}`, { method: 'DELETE' })
      setFeedback(response.ok ? labels.saved : labels.failed)
      if (response.ok) router.refresh()
    } catch {
      setFeedback(labels.failed)
    } finally {
      setDeleting(false)
      setDeleteCandidate(null)
    }
  }

  const items = reminders.map((item) => {
    const canManageItem = mode === 'PERSONAL' ? item.type === 'PERSONAL' : canManageHr
    const typeLabel = item.type === 'HR' ? labels.hrReminder : labels.personalReminder
    return {
      actions: canManageItem ? <RowActions menuItems={[{ destructive: true, id: 'delete', label: labels.remove, onSelect: () => setDeleteCandidate(item) }]} menuLabel={labels.moreActions} primaryAction={<Button onClick={() => startEdit(item)} size="sm" type="button" variant="secondary"><Pencil aria-hidden="true" />{labels.edit}</Button>} /> : undefined,
      badges: <Badge tone={item.type === 'HR' ? 'info' : 'neutral'}>{typeLabel}</Badge>,
      id: item.recipientId,
      primary: item.title,
      secondary: <div className="grid gap-1">{item.description ? <p className="whitespace-pre-wrap break-words">{item.description}</p> : null}<time className="flex flex-wrap items-center gap-1.5 text-xs" dateTime={item.remindAt}><CalendarDays aria-hidden="true" size={14} />{formatDateTime(item.remindAt, { locale, dateFormat, timeFormat })}</time></div>,
    }
  })

  return (
    <section className="mt-8 space-y-5">
      <SectionHeader actions={canAdd ? <Button className="whitespace-normal text-left" onClick={startAdd} type="button"><Plus aria-hidden="true" />{labels.add}</Button> : undefined} title={labels.title} />
      {feedback ? <p className="border border-border-subtle bg-surface-subtle px-4 py-3 text-sm" role="status">{feedback}</p> : null}
      {reminders.length === 0 ? <EmptyState icon={<BellRing />} title={labels.empty} /> : <EntityList ariaLabel={labels.title} items={items} />}
      <FormDrawer
        cancelLabel={labels.cancel}
        closeLabel={labels.close}
        description={editing ? labels.edit : labels.add}
        dirty={dirty}
        dirtyProtection={{ description: labels.discardDescription, discardLabel: labels.discardConfirm, keepEditingLabel: labels.discardCancel, title: labels.discardTitle }}
        onDiscard={closeForm}
        onOpenChange={(nextOpen) => { if (!nextOpen) closeForm(); else setOpen(true) }}
        onSubmit={(event) => void submit(event)}
        open={open}
        saveLabel={labels.save}
        saving={saving}
        title={editing ? labels.edit : labels.add}
      >
        {formError ? <p className="border border-destructive/40 bg-destructive-surface px-3 py-2 text-sm text-destructive" role="alert">{formError}</p> : null}
        <div className="grid gap-4 md:grid-cols-2" key={formKey}>
          <FormField control={<TextInput name="title" onChange={(event) => updateFormValue('title', event.target.value)} required value={formValues.title} />} label={labels.titleLabel} required />
          <FormField control={<TextInput name="remindAt" onChange={(event) => updateFormValue('dateTime', event.target.value)} required type="datetime-local" value={formValues.dateTime} />} label={labels.dateLabel} required />
          <FormField className="md:col-span-2" control={<Textarea name="description" onChange={(event) => updateFormValue('description', event.target.value)} value={formValues.description} />} label={labels.descriptionLabel} />
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-4">
          <Button onClick={() => updateFormValue('dateTime', shift(formValues.dateTime, 'dayBack'))} size="sm" type="button" variant="ghost"><ArrowLeft aria-hidden="true" />{labels.shiftDayBack}</Button>
          <Button onClick={() => updateFormValue('dateTime', shift(formValues.dateTime, 'dayForward'))} size="sm" type="button" variant="ghost"><ArrowRight aria-hidden="true" />{labels.shiftDayForward}</Button>
          <Button onClick={() => updateFormValue('dateTime', shift(formValues.dateTime, 'weekForward'))} size="sm" type="button" variant="ghost">{labels.shiftWeekForward}</Button>
          <Button onClick={() => updateFormValue('dateTime', shift(formValues.dateTime, 'monthForward'))} size="sm" type="button" variant="ghost">{labels.shiftMonthForward}</Button>
        </div>
      </FormDrawer>
      <ConfirmDialog
        cancelLabel={labels.deleteCancel}
        confirmLabel={labels.deleteConfirm}
        description={labels.deleteDescription}
        destructive
        onConfirm={() => deleteCandidate ? remove(deleteCandidate) : Promise.resolve()}
        onOpenChange={(nextOpen) => { if (!nextOpen && !deleting) setDeleteCandidate(null) }}
        open={deleteCandidate !== null}
        pending={deleting}
        title={labels.deleteTitle}
      />
    </section>
  )
}
