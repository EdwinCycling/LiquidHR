'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import type { CustomFieldDefinition } from '@/lib/custom-fields/service'

const TYPES = ['TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'MULTI_SELECT', 'AUTO_INCREMENT'] as const
const ACCESS = ['HIDDEN', 'READ', 'WRITE'] as const
type FieldType = (typeof TYPES)[number]
type Access = (typeof ACCESS)[number]
type SortKey = 'LABEL' | 'ACTIVE'

interface Labels {
  newField: string; technicalKey: string; labelNl: string; labelEn: string; fieldType: string; country: string
  required: string; hrAccess: string; managerAccess: string; selfAccess: string; options: string
  chartFilter: string; chartFilterHelp: string; create: string; creating: string; empty: string
  created: string; failed: string; active: string; inactive: string; edit: string; editField: string
  saveDefinition: string; savingDefinition: string; delete: string; deleteConfirm: string; deleted: string
  inUse: string; activate: string; deactivate: string; sortBy: string; sortLabel: string; sortActive: string
  ascending: string; descending: string; preview: string; previewEmpty: string; previewValue: string
  technicalIdentityHelp: string; types: Record<FieldType, string>; access: Record<Access, string>
}

const inputClass = 'mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm'

function parseOptions(value: string): Array<{ value: string; labelNl: string; labelEn: string }> {
  return value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [optionValue = '', labelNl = '', labelEn = ''] = line.split(':').map((part) => part.trim())
    return { value: optionValue, labelNl: labelNl || optionValue, labelEn: labelEn || labelNl || optionValue }
  }).filter((option) => option.value)
}

function PreviewControl({ fieldType, options, labels }: { fieldType: FieldType; options: Array<{ value: string; labelNl: string; labelEn: string }>; labels: Labels }): ReactNode {
  if (fieldType === 'TEXTAREA') return <textarea className={`${inputClass} min-h-20`} disabled placeholder={labels.previewValue} />
  if (fieldType === 'BOOLEAN') return <label className="mt-3 flex items-center gap-2 text-sm"><input disabled type="checkbox" />{labels.previewValue}</label>
  if (fieldType === 'SELECT' || fieldType === 'MULTI_SELECT') return <select className={inputClass} disabled multiple={fieldType === 'MULTI_SELECT'}><option>{options[0]?.labelNl || labels.previewValue}</option></select>
  if (fieldType === 'AUTO_INCREMENT') return <input className={inputClass} disabled value="1001" readOnly />
  return <input className={inputClass} disabled placeholder={labels.previewValue} type={fieldType === 'NUMBER' ? 'number' : fieldType === 'DATE' ? 'date' : 'text'} />
}

export function CustomFieldManager({ definitions, labels }: { definitions: CustomFieldDefinition[]; labels: Labels }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [fieldType, setFieldType] = useState<FieldType>('TEXT')
  const [newLabelNl, setNewLabelNl] = useState('')
  const [newLabelEn, setNewLabelEn] = useState('')
  const [newCountry, setNewCountry] = useState('NL')
  const [newOptions, setNewOptions] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('LABEL')
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('ASC')
  const [editingId, setEditingId] = useState<string | null>(null)

  const sortedDefinitions = useMemo(() => {
    const collator = new Intl.Collator('nl-NL', { sensitivity: 'base' })
    return [...definitions].sort((left, right) => {
      const result = sortKey === 'LABEL'
        ? collator.compare(left.labelNl, right.labelNl)
        : Number(right.isActive) - Number(left.isActive) || collator.compare(left.labelNl, right.labelNl)
      return sortDirection === 'ASC' ? result : -result
    })
  }, [definitions, sortDirection, sortKey])

  async function responseMessage(response: Response): Promise<string> {
    if (response.ok) return ''
    const payload = await response.json().catch(() => null) as { error?: string } | null
    return payload?.error === 'CUSTOM_FIELD_IN_USE' ? labels.inUse : labels.failed
  }

  async function submit(formData: FormData): Promise<void> {
    setSaving(true); setMessage(null)
    const options = parseOptions(String(formData.get('options') ?? '')).map((option, index) => ({ ...option, sortOrder: index }))
    try {
      const response = await fetch('/api/custom-fields', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        key: formData.get('key'), labelNl: formData.get('labelNl'), labelEn: formData.get('labelEn'), countryCode: formData.get('countryCode'),
        fieldType, isRequired: formData.get('required') === 'on', hrAccess: formData.get('hrAccess'),
        showInOrganizationChartFilter: formData.get('chartFilter') === 'on', managerAccess: formData.get('managerAccess'), employeeSelfAccess: formData.get('selfAccess'), options,
      }) })
      const errorMessage = await responseMessage(response)
      if (errorMessage) throw new Error(errorMessage)
      setMessage(labels.created); setNewLabelNl(''); setNewLabelEn(''); setNewCountry('NL'); setNewOptions(''); router.refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : labels.failed) } finally { setSaving(false) }
  }

  async function updateDefinition(event: FormEvent<HTMLFormElement>, definitionId: string): Promise<void> {
    event.preventDefault(); setSaving(true); setMessage(null)
    const formData = new FormData(event.currentTarget)
    try {
      const response = await fetch(`/api/custom-fields/${definitionId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        labelNl: formData.get('labelNl'), labelEn: formData.get('labelEn'), countryCode: formData.get('countryCode'),
        isRequired: formData.get('required') === 'on', showInOrganizationChartFilter: formData.get('chartFilter') === 'on',
        hrAccess: formData.get('hrAccess'), managerAccess: formData.get('managerAccess'), employeeSelfAccess: formData.get('selfAccess'),
      }) })
      const errorMessage = await responseMessage(response)
      if (errorMessage) throw new Error(errorMessage)
      setMessage(labels.created); setEditingId(null); router.refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : labels.failed) } finally { setSaving(false) }
  }

  async function toggleActive(definition: CustomFieldDefinition): Promise<void> {
    setSaving(true); setMessage(null)
    try {
      const response = await fetch(`/api/custom-fields/${definition.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ isActive: !definition.isActive }) })
      const errorMessage = await responseMessage(response)
      if (errorMessage) throw new Error(errorMessage)
      router.refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : labels.failed) } finally { setSaving(false) }
  }

  async function deleteDefinition(definition: CustomFieldDefinition): Promise<void> {
    if (!window.confirm(labels.deleteConfirm)) return
    setSaving(true); setMessage(null)
    try {
      const response = await fetch(`/api/custom-fields/${definition.id}`, { method: 'DELETE' })
      const errorMessage = await responseMessage(response)
      if (errorMessage) throw new Error(errorMessage)
      setMessage(labels.deleted); router.refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : labels.failed) } finally { setSaving(false) }
  }

  return <div className="space-y-6">
    <section className="rounded-2xl border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow text-primary">{labels.sortBy}</p><h2 className="mt-1 text-lg font-semibold text-foreground">{definitions.length}</h2></div>
        <div className="flex flex-wrap gap-2">
          <label className="text-xs font-semibold text-muted-foreground">{labels.sortBy}<select className="ml-2 rounded-lg border bg-background px-2 py-1.5 text-sm text-foreground" onChange={(event) => setSortKey(event.target.value as SortKey)} value={sortKey}><option value="LABEL">{labels.sortLabel}</option><option value="ACTIVE">{labels.sortActive}</option></select></label>
          <button className="button-secondary" onClick={() => setSortDirection((current) => current === 'ASC' ? 'DESC' : 'ASC')} type="button">{sortDirection === 'ASC' ? labels.ascending : labels.descending}</button>
        </div>
      </div>
      {message ? <p aria-live="polite" className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{message}</p> : null}
      {definitions.length === 0 ? <p className="mt-5 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{labels.empty}</p> : <ul className="mt-5 space-y-3">{sortedDefinitions.map((definition) => <li className="rounded-xl border bg-background/60 p-4" key={definition.id}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-foreground">{definition.labelNl}</h3><code className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{definition.key}</code><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">{definition.countryCode}</span></div><p className="mt-1 text-sm text-muted-foreground">{labels.types[definition.fieldType]} · {labels.hrAccess}: {labels.access[definition.hrAccess]}</p></div>
          <div className="flex flex-wrap items-center justify-end gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${definition.isActive ? 'bg-success-surface text-success' : 'bg-muted text-muted-foreground'}`}>{definition.isActive ? labels.active : labels.inactive}</span><button className="button-secondary" disabled={saving} onClick={() => setEditingId((current) => current === definition.id ? null : definition.id)} type="button">{labels.edit}</button><button className="button-secondary" disabled={saving} onClick={() => void toggleActive(definition)} type="button">{definition.isActive ? labels.deactivate : labels.activate}</button><button className="rounded-lg border border-destructive/30 px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10" disabled={saving} onClick={() => void deleteDefinition(definition)} type="button">{labels.delete}</button></div>
        </div>
        {editingId === definition.id ? <form className="mt-4 grid gap-3 rounded-xl bg-muted/40 p-4 sm:grid-cols-2" onSubmit={(event) => void updateDefinition(event, definition.id)}>
          <label className="text-sm font-medium">{labels.labelNl}<input className={inputClass} defaultValue={definition.labelNl} name="labelNl" required /></label><label className="text-sm font-medium">{labels.labelEn}<input className={inputClass} defaultValue={definition.labelEn} name="labelEn" required /></label>
          <label className="text-sm font-medium">{labels.country}<input className={`${inputClass} uppercase`} defaultValue={definition.countryCode} maxLength={2} name="countryCode" required /></label><p className="self-end text-xs text-muted-foreground sm:pb-2">{labels.technicalIdentityHelp}</p>
          <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">{([['hrAccess', labels.hrAccess, definition.hrAccess], ['managerAccess', labels.managerAccess, definition.managerAccess], ['selfAccess', labels.selfAccess, definition.employeeSelfAccess]] as const).map(([name, label, value]) => <label className="text-sm font-medium" key={name}>{label}<select className={inputClass} defaultValue={value} name={name}>{ACCESS.map((access) => <option key={access} value={access}>{labels.access[access]}</option>)}</select></label>)}</div>
          <label className="flex items-center gap-2 text-sm"><input defaultChecked={definition.isRequired} name="required" type="checkbox" />{labels.required}</label><label className="flex items-center gap-2 text-sm"><input defaultChecked={definition.showInOrganizationChartFilter} name="chartFilter" type="checkbox" />{labels.chartFilter}</label>
          <button className="button-primary sm:col-span-2" disabled={saving} type="submit">{saving ? labels.savingDefinition : labels.saveDefinition}</button>
        </form> : null}
      </li>)}</ul>}
    </section>
    <details className="group rounded-2xl border bg-surface p-5 shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4"><span><span className="eyebrow text-primary">{labels.newField}</span><span className="mt-1 block text-lg font-semibold text-foreground">{labels.create}</span></span><span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">+</span></summary>
      <div className="mt-5 space-y-6">
        <form action={submit} className="space-y-4">
          <label className="block text-sm font-medium">{labels.technicalKey}<input className={inputClass} name="key" pattern="[a-z][a-z0-9_]{1,62}" required /></label><label className="block text-sm font-medium">{labels.labelNl}<input className={inputClass} name="labelNl" onChange={(event) => setNewLabelNl(event.target.value)} required value={newLabelNl} /></label><label className="block text-sm font-medium">{labels.labelEn}<input className={inputClass} name="labelEn" onChange={(event) => setNewLabelEn(event.target.value)} required value={newLabelEn} /></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">{labels.fieldType}<select className={inputClass} name="fieldType" onChange={(event) => setFieldType(event.target.value as FieldType)} value={fieldType}>{TYPES.map((type) => <option key={type} value={type}>{labels.types[type]}</option>)}</select></label><label className="text-sm font-medium">{labels.country}<input className={`${inputClass} uppercase`} maxLength={2} name="countryCode" onChange={(event) => setNewCountry(event.target.value.toUpperCase())} value={newCountry} required /></label></div>
          <div className="grid gap-3 sm:grid-cols-3">{([['hrAccess', labels.hrAccess, 'WRITE'], ['managerAccess', labels.managerAccess, 'HIDDEN'], ['selfAccess', labels.selfAccess, 'HIDDEN']] as const).map(([name, label, initial]) => <label className="block text-sm font-medium" key={name}>{label}<select className={inputClass} defaultValue={initial} name={name}>{ACCESS.map((value) => <option key={value} value={value}>{labels.access[value]}</option>)}</select></label>)}</div>
          {(fieldType === 'SELECT' || fieldType === 'MULTI_SELECT') ? <label className="block text-sm font-medium">{labels.options}<textarea className={`${inputClass} min-h-28`} name="options" onChange={(event) => setNewOptions(event.target.value)} required value={newOptions} /></label> : null}
          <label className="flex items-center gap-2 text-sm"><input name="required" type="checkbox" />{labels.required}</label><label className="flex items-start gap-2 rounded-xl border bg-muted/40 p-3 text-sm"><input className="mt-0.5" name="chartFilter" type="checkbox" /><span><span className="font-medium">{labels.chartFilter}</span><span className="mt-0.5 block text-xs text-muted-foreground">{labels.chartFilterHelp}</span></span></label>
          <button className="button-primary w-full" disabled={saving} type="submit">{saving ? labels.creating : labels.create}</button>
        </form>
        <section aria-label={labels.preview} className="h-fit rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-accent/20 p-5"><p className="eyebrow text-primary">{labels.preview}</p><h3 className="mt-1 text-lg font-semibold">{newLabelNl || labels.previewEmpty}</h3><p className="mt-1 text-sm text-muted-foreground">{labels.types[fieldType]} · {newCountry || 'NL'}</p><div className="mt-5"><label className="text-sm font-medium">{newLabelNl || labels.previewValue}<PreviewControl fieldType={fieldType} options={parseOptions(newOptions)} labels={labels} /></label></div></section>
      </div>
    </details>
  </div>
}
