'use client'

import type { Json } from '@scope/db'
import { useState } from 'react'
import type { EmployeeCustomField } from '@/lib/custom-fields/service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/patterns/form-field'

interface Labels { title: string; subtitle: string; save: string; saving: string; saved: string; failed: string; readOnly: string; yes: string; no: string }

function inputValue(field: EmployeeCustomField, formData: FormData): Json {
  if (field.fieldType === 'BOOLEAN') return formData.get(field.key) === 'on'
  if (field.fieldType === 'NUMBER') {
    const value = String(formData.get(field.key) ?? '').trim()
    return value ? Number(value) : null
  }
  if (field.fieldType === 'MULTI_SELECT') return formData.getAll(field.key).map(String)
  const value = String(formData.get(field.key) ?? '').trim()
  return value || null
}

function displayValue(field: EmployeeCustomField, labels: Labels): string {
  if (field.value === undefined || field.value === null) return '—'
  if (typeof field.value === 'boolean') return field.value ? labels.yes : labels.no
  if (Array.isArray(field.value)) return field.value.map(String).join(', ')
  if (typeof field.value === 'object') return JSON.stringify(field.value)
  return String(field.value)
}

export function EmployeeCustomFields({ employeeId, fields, labels, embedded = false }: { employeeId: string; fields: EmployeeCustomField[]; labels: Labels; embedded?: boolean }) {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const writable = fields.some((field) => field.access === 'WRITE')

  async function submit(formData: FormData): Promise<void> {
    setSaving(true)
    setMessage(null)
    try {
      const values = Object.fromEntries(fields.filter((field) => field.access === 'WRITE' && field.fieldType !== 'AUTO_INCREMENT').map((field) => [field.key, inputValue(field, formData)]))
      const response = await fetch(`/api/employees/${employeeId}/custom-fields`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values) })
      if (!response.ok) throw new Error('FAILED')
      setMessage(labels.saved)
    } catch { setMessage(labels.failed) } finally { setSaving(false) }
  }

  if (!fields.length) return null
  const content = <>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold text-foreground">{labels.title}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.subtitle}</p></div>{!writable ? <Badge tone="neutral">{labels.readOnly}</Badge> : null}</div>
    <form action={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
      {fields.map((field) => <Field key={field.id} field={field} labels={labels} />)}
      {message ? <p aria-live="polite" className="text-sm text-muted-foreground sm:col-span-2">{message}</p> : null}
      {writable ? <Button className="sm:col-span-2 sm:justify-self-start" disabled={saving} loading={saving} type="submit">{saving ? labels.saving : labels.save}</Button> : null}
    </form>
  </>
  return embedded ? <section>{content}</section> : <Surface className="mt-8 p-5 sm:p-6"><section>{content}</section></Surface>
}

function Field({ field, labels }: { field: EmployeeCustomField; labels: Labels }) {
  const disabled = field.access !== 'WRITE' || field.fieldType === 'AUTO_INCREMENT'
  const label = <span>{field.labelNl}{field.isRequired ? ' *' : ''}</span>
  if (disabled) return <div className="grid gap-1.5 text-sm"><span className="font-medium text-foreground">{label}</span><Surface className="bg-surface-subtle px-3 py-2 text-muted-foreground" variant="subtle">{displayValue(field, labels)}</Surface></div>
  if (field.fieldType === 'TEXTAREA') return <FormField control={<Textarea defaultValue={typeof field.value === 'string' ? field.value : ''} name={field.key} required={field.isRequired} />} label={label} required={field.isRequired} />
  if (field.fieldType === 'BOOLEAN') return <FormField control={<Checkbox defaultChecked={field.value === true} name={field.key} />} label={label} />
  if (field.fieldType === 'SELECT' || field.fieldType === 'MULTI_SELECT') {
    const selected = Array.isArray(field.value) ? field.value.map(String) : typeof field.value === 'string' ? [field.value] : []
    return <FormField control={<DropdownSelect defaultValue={field.fieldType === 'MULTI_SELECT' ? selected as unknown as string : selected[0] ?? ''} multiple={field.fieldType === 'MULTI_SELECT'} name={field.key} required={field.isRequired}><option value="">—</option>{field.options.map((option) => <option key={option.id} value={option.value}>{option.labelNl}</option>)}</DropdownSelect>} label={label} required={field.isRequired} />
  }
  const type = field.fieldType === 'NUMBER' ? 'number' : field.fieldType === 'DATE' ? 'date' : 'text'
  return <FormField control={<TextInput defaultValue={typeof field.value === 'string' || typeof field.value === 'number' ? String(field.value) : ''} name={field.key} required={field.isRequired} type={type} />} label={label} required={field.isRequired} />
}
