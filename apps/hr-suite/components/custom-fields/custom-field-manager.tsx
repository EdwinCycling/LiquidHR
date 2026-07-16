'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { CustomFieldDefinition } from '@/lib/custom-fields/service'

const TYPES = ['TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'MULTI_SELECT', 'AUTO_INCREMENT'] as const
const ACCESS = ['HIDDEN', 'READ', 'WRITE'] as const
type FieldType = (typeof TYPES)[number]
type Access = (typeof ACCESS)[number]

interface Labels {
  newField: string; technicalKey: string; labelNl: string; labelEn: string; fieldType: string
  required: string; hrAccess: string; managerAccess: string; selfAccess: string; options: string
  chartFilter: string; chartFilterHelp: string
  create: string; creating: string; empty: string; created: string; failed: string; active: string; inactive: string
  types: Record<FieldType, string>; access: Record<Access, string>
}

export function CustomFieldManager({ definitions, labels }: { definitions: CustomFieldDefinition[]; labels: Labels }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [fieldType, setFieldType] = useState<FieldType>('TEXT')

  async function submit(formData: FormData): Promise<void> {
    setSaving(true); setMessage(null)
    const optionLines = String(formData.get('options') ?? '').split('\n').map((line) => line.trim()).filter(Boolean)
    const options = optionLines.map((line, index) => {
      const [value = '', labelNl = '', labelEn = ''] = line.split(':').map((part) => part.trim())
      return { value, labelNl, labelEn, sortOrder: index }
    })
    try {
      const response = await fetch('/api/custom-fields', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        key: formData.get('key'), labelNl: formData.get('labelNl'), labelEn: formData.get('labelEn'),
        fieldType, isRequired: formData.get('required') === 'on', hrAccess: formData.get('hrAccess'),
        showInOrganizationChartFilter: formData.get('chartFilter') === 'on',
        managerAccess: formData.get('managerAccess'), employeeSelfAccess: formData.get('selfAccess'), options,
      }) })
      if (!response.ok) throw new Error('SAVE_FAILED')
      setMessage(labels.created); router.refresh()
    } catch { setMessage(labels.failed) } finally { setSaving(false) }
  }

  async function toggleChartFilter(definition: CustomFieldDefinition): Promise<void> {
    setSaving(true); setMessage(null)
    try {
      const response = await fetch(`/api/custom-fields/${definition.id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ showInOrganizationChartFilter: !definition.showInOrganizationChartFilter }),
      })
      if (!response.ok) throw new Error('SAVE_FAILED')
      router.refresh()
    } catch { setMessage(labels.failed) } finally { setSaving(false) }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
      <section className="overflow-hidden rounded-2xl border bg-surface">
        {definitions.length ? <ul className="divide-y">{definitions.map((definition) => <li className="flex items-start justify-between gap-4 p-5" key={definition.id}>
          <div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-foreground">{definition.labelNl}</h2><code className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{definition.key}</code></div><p className="mt-1 text-sm text-muted-foreground">{labels.types[definition.fieldType]} · {labels.hrAccess}: {labels.access[definition.hrAccess]}</p></div>
          <div className="flex shrink-0 flex-col items-end gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${definition.isActive ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>{definition.isActive ? labels.active : labels.inactive}</span><button className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${definition.showInOrganizationChartFilter ? 'border-primary/30 bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`} disabled={saving || !definition.isActive} onClick={() => toggleChartFilter(definition)} type="button">{labels.chartFilter}</button></div>
        </li>)}</ul> : <p className="p-8 text-sm text-muted-foreground">{labels.empty}</p>}
      </section>
      <form action={submit} className="h-fit space-y-4 rounded-2xl border bg-surface p-5">
        <h2 className="text-lg font-semibold text-foreground">{labels.newField}</h2>
        <label className="block text-sm font-medium text-foreground">{labels.technicalKey}<input className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2" name="key" pattern="[a-z][a-z0-9_]{1,62}" required /></label>
        <label className="block text-sm font-medium text-foreground">{labels.labelNl}<input className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2" name="labelNl" required /></label>
        <label className="block text-sm font-medium text-foreground">{labels.labelEn}<input className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2" name="labelEn" required /></label>
        <label className="block text-sm font-medium text-foreground">{labels.fieldType}<select className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2" onChange={(event) => setFieldType(event.target.value as FieldType)} value={fieldType}>{TYPES.map((type) => <option key={type} value={type}>{labels.types[type]}</option>)}</select></label>
        <div className="grid gap-3 sm:grid-cols-3">{([['hrAccess', labels.hrAccess, 'WRITE'], ['managerAccess', labels.managerAccess, 'HIDDEN'], ['selfAccess', labels.selfAccess, 'HIDDEN']] as const).map(([name, label, initial]) => <label className="block text-sm font-medium text-foreground" key={name}>{label}<select className="mt-1.5 w-full rounded-lg border bg-background px-2 py-2" defaultValue={initial} name={name}>{ACCESS.map((value) => <option key={value} value={value}>{labels.access[value]}</option>)}</select></label>)}</div>
        {(fieldType === 'SELECT' || fieldType === 'MULTI_SELECT') ? <label className="block text-sm font-medium text-foreground">{labels.options}<textarea className="mt-1.5 min-h-28 w-full rounded-lg border bg-background px-3 py-2" name="options" required /></label> : null}
        <label className="flex items-center gap-2 text-sm text-foreground"><input name="required" type="checkbox" />{labels.required}</label>
        <label className="flex items-start gap-2 rounded-xl border bg-muted/40 p-3 text-sm text-foreground"><input className="mt-0.5" name="chartFilter" type="checkbox" /><span><span className="font-medium">{labels.chartFilter}</span><span className="mt-0.5 block text-xs text-muted-foreground">{labels.chartFilterHelp}</span></span></label>
        {message ? <p aria-live="polite" className="text-sm text-muted-foreground">{message}</p> : null}
        <button className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={saving} type="submit">{saving ? labels.creating : labels.create}</button>
      </form>
    </div>
  )
}
