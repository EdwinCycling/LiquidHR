'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

interface TaskTemplate {
  id: string
  code: string
  title: string
  description: string | null
  due_after_effective_days: number
  evidence_required: boolean
  evidence_category: string | null
  source: string
  is_active: boolean
  is_system: boolean
}

interface Labels {
  title: string
  subtitle: string
  code: string
  taskTitle: string
  description: string
  dueDays: string
  evidenceRequired: string
  evidenceCategory: string
  add: string
  saving: string
  activate: string
  deactivate: string
  custom: string
  system: string
  empty: string
  failed: string
  codeConflict: string
}

export function AbsenceTaskTemplateManager({ templates, labels }: { templates: TaskTemplate[]; labels: Labels }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setSaving(true)
    setError(null)
    const response = await fetch('/api/settings/absence/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: form.get('code'),
        title: form.get('title'),
        description: form.get('description') || null,
        dueAfterEffectiveDays: form.get('dueAfterEffectiveDays'),
        evidenceRequired: form.get('evidenceRequired') === 'on',
        evidenceCategory: form.get('evidenceCategory') || null,
      }),
    })
    setSaving(false)
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null
      setError(body?.error === 'ABSENCE_TASK_CODE_CONFLICT' ? labels.codeConflict : labels.failed)
      return
    }
    formElement.reset()
    router.refresh()
  }

  async function toggle(template: TaskTemplate) {
    setSavingId(template.id)
    setError(null)
    const response = await fetch('/api/settings/absence/tasks', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: template.id, isActive: !template.is_active }),
    })
    setSavingId(null)
    if (!response.ok) setError(labels.failed)
    else router.refresh()
  }

  return (
    <section className="mt-8 rounded-2xl border bg-surface p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">{labels.title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.subtitle}</p>
      </div>
      <form className="mt-5 grid gap-3 rounded-xl border bg-background p-4 md:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)_8rem_auto]" onSubmit={(event) => void create(event)}>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span className="sr-only">{labels.code}</span><input className="form-field mt-1 w-full" maxLength={40} name="code" placeholder={labels.code} required /></label>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span className="sr-only">{labels.taskTitle}</span><input className="form-field mt-1 w-full" maxLength={160} name="title" placeholder={labels.taskTitle} required /></label>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span className="sr-only">{labels.description}</span><input className="form-field mt-1 w-full" maxLength={1000} name="description" placeholder={labels.description} /></label>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span className="sr-only">{labels.dueDays}</span><input className="form-field mt-1 w-full" max={3650} min={1} name="dueAfterEffectiveDays" placeholder={labels.dueDays} required type="number" /></label>
        <button className="button-primary" disabled={saving} type="submit">{saving ? labels.saving : labels.add}</button>
        <label className="flex items-center gap-2 text-sm md:col-span-2"><input name="evidenceRequired" type="checkbox" />{labels.evidenceRequired}</label>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground md:col-span-2"><span className="sr-only">{labels.evidenceCategory}</span><input className="form-field mt-1 w-full" maxLength={120} name="evidenceCategory" placeholder={labels.evidenceCategory} /></label>
      </form>
      {error ? <p className="mt-3 text-sm font-medium text-destructive">{error}</p> : null}
      {templates.length === 0 ? <p className="mt-5 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{labels.empty}</p> : (
        <ul className="mt-5 grid gap-3">
          {templates.map((template) => (
            <li className="flex flex-wrap items-start justify-between gap-4 rounded-xl border p-4" key={template.id}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{template.title}</h3>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{template.code}</span>
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium">{template.is_system ? labels.system : labels.custom}</span>
                </div>
                {template.description ? <p className="mt-1 text-sm text-muted-foreground">{template.description}</p> : null}
                <p className="mt-2 text-xs text-muted-foreground">{template.due_after_effective_days} {labels.dueDays}{template.evidence_required && template.evidence_category ? ` · ${template.evidence_category}` : ''}</p>
              </div>
              {!template.is_system ? <button className="button-secondary" disabled={savingId === template.id} onClick={() => void toggle(template)} type="button">{template.is_active ? labels.deactivate : labels.activate}</button> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
