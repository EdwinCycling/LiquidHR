'use client'

import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { TextInput } from '@/components/ui/text-input'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'

interface Option { id: string; name: string }
interface Labels {
  title: string; code: string; name: string; parent: string; noParent: string; create: string; saved: string; failed: string
  close: string; cancel: string; discardTitle: string; discardDescription: string; discardConfirm: string; discardCancel: string
}

export function DepartmentCreateForm({ departments, labels }: { departments: Option[]; labels: Labels }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const dirty = Boolean(code || name || parentId)

  function reset(): void {
    setCode('')
    setName('')
    setParentId('')
    setError(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code, name, parentId: parentId || null }),
      })
      if (!response.ok) throw new Error(labels.failed)
      setOpen(false)
      reset()
      router.refresh()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : labels.failed)
    } finally {
      setSaving(false)
    }
  }

  return <>
    <Button onClick={() => { reset(); setOpen(true) }} type="button"><Plus aria-hidden="true" />{labels.title}</Button>
    <FormDrawer
      cancelLabel={labels.cancel}
      closeLabel={labels.close}
      description={labels.title}
      dirty={dirty}
      dirtyProtection={{ description: labels.discardDescription, discardLabel: labels.discardConfirm, keepEditingLabel: labels.discardCancel, title: labels.discardTitle }}
      onDiscard={reset}
      onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) reset() }}
      onSubmit={(event) => void submit(event)}
      open={open}
      saveLabel={labels.create}
      saving={saving}
      title={labels.title}
    >
      {error ? <p className="border border-destructive/40 bg-destructive-surface px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}
      <FormField control={<TextInput maxLength={40} onChange={(event) => { setCode(event.target.value); setError(null) }} required value={code} />} label={labels.code} required />
      <FormField control={<TextInput maxLength={160} onChange={(event) => { setName(event.target.value); setError(null) }} required value={name} />} label={labels.name} required />
      <FormField control={<DropdownSelect aria-label={labels.parent} onChange={(event) => setParentId(event.target.value)} searchable searchPlaceholder={labels.parent} value={parentId}><option value="">{labels.noParent}</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</DropdownSelect>} label={labels.parent} />
    </FormDrawer>
  </>
}
