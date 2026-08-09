'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildVisibleFormPayload,
  displayFormValue,
  formProjectionSchema,
  isFormValueValid,
  visibleFields,
  type FormJsonValue,
  type FormProjection,
} from '@/lib/process-automation/form-runtime'

export interface FormRuntimeLabels {
  readonly currentValue: string
  readonly newValue: string
  readonly saving: string
  readonly saved: string
  readonly saveError: string
  readonly stale: string
  readonly save: string
  readonly errorSummary: string
  readonly required: string
  readonly invalid: string
  readonly readOnly: string
  readonly noValue: string
  readonly booleanTrue: string
  readonly booleanFalse: string
}

interface FormRuntimeRendererProps {
  readonly initialProjection: FormProjection
  readonly locale: 'nl' | 'en'
  readonly labels: FormRuntimeLabels
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'stale'

function initialValues(projection: FormProjection): Record<string, FormJsonValue> {
  return Object.fromEntries(visibleFields(projection)
    .filter((field) => field.accessMode !== 'READ' && field.newValue !== null)
    .map((field) => [field.key, field.newValue]))
}

function inputValue(value: FormJsonValue | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function fieldValue(fieldType: string, value: string): FormJsonValue {
  if (value === '') return null
  if (fieldType === 'INTEGER') return Number.parseInt(value, 10)
  if (fieldType === 'DECIMAL' || fieldType === 'MONEY') return Number.parseFloat(value)
  return value
}

export function FormRuntimeRenderer({ initialProjection, locale, labels }: FormRuntimeRendererProps) {
  const [projection, setProjection] = useState(initialProjection)
  const [values, setValues] = useState<Record<string, FormJsonValue>>(() => initialValues(initialProjection))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [dirty, setDirty] = useState(false)
  const [changedFieldKeys, setChangedFieldKeys] = useState<ReadonlySet<string>>(new Set())
  const summaryRef = useRef<HTMLDivElement>(null)
  const savingRef = useRef(false)
  const fields = useMemo(() => visibleFields(projection), [projection])

  function setFieldValue(fieldKey: string, value: FormJsonValue): void {
    setValues((current) => ({ ...current, [fieldKey]: value }))
    setChangedFieldKeys((current) => new Set(current).add(fieldKey))
    setDirty(true)
    setSaveState('idle')
  }

  const validate = useCallback((): boolean => {
    const nextErrors: Record<string, string> = {}
    fields.forEach((field) => {
      if (field.accessMode === 'READ') return
      if (!isFormValueValid(field, values[field.key])) nextErrors[field.key] = field.required ? labels.required : labels.invalid
    })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) window.requestAnimationFrame(() => summaryRef.current?.focus())
    return Object.keys(nextErrors).length === 0
  }, [fields, labels, values])

  const save = useCallback(async (): Promise<void> => {
    if (!dirty || savingRef.current || !validate()) return
    savingRef.current = true
    setSaveState('saving')
    try {
      const payload = buildVisibleFormPayload(projection, values, changedFieldKeys)
      const response = await fetch(`/api/process-work-items/${projection.workItemId}/form-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRevision: projection.revision,
          expectedVersion: projection.expectedVersion,
          values: payload,
          idempotencyKey: crypto.randomUUID(),
          correlationId: projection.processInstanceId,
          language: locale,
        }),
      })
      const body: unknown = await response.json()
      if (!response.ok || typeof body !== 'object' || body === null || !('data' in body)) {
        const code = typeof body === 'object' && body !== null && 'code' in body && typeof body.code === 'string' ? body.code : 'PROCESS_FORM_RUNTIME_OPERATION_FAILED'
        if (code === 'STALE_FORM_RESPONSE') setSaveState('stale')
        else setSaveState('error')
        return
      }
      const parsedProjection = formProjectionSchema.safeParse(body.data)
      if (!parsedProjection.success) {
        setSaveState('error')
        return
      }
      setProjection(parsedProjection.data)
      setValues(initialValues(parsedProjection.data))
      setChangedFieldKeys(new Set())
      setDirty(false)
      setSaveState('saved')
    } catch {
      setSaveState('error')
    }
    finally {
      savingRef.current = false
    }
  }, [changedFieldKeys, dirty, locale, projection, validate, values])

  useEffect(() => {
    if (!dirty) return undefined
    const timeout = window.setTimeout(() => { void save() }, 900)
    return () => window.clearTimeout(timeout)
  }, [dirty, save])

  return <section className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
    <header className="rounded-3xl border border-border bg-panel p-6 shadow-sm sm:p-8">
      <p className="eyebrow text-primary">{projection.participantKey}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{projection.title}</h1>
      {projection.description ? <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{projection.description}</p> : null}
      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground" aria-live="polite">
        <span>{saveState === 'saving' ? labels.saving : saveState === 'saved' ? labels.saved : saveState === 'stale' ? labels.stale : saveState === 'error' ? labels.saveError : ''}</span>
        <button className="button-secondary" disabled={!dirty || saveState === 'saving' || saveState === 'stale'} onClick={() => { void save() }} type="button">{labels.save}</button>
      </div>
    </header>

    {Object.keys(errors).length > 0 ? <div ref={summaryRef} aria-label={labels.errorSummary} className="mt-5 rounded-2xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger" role="alert" tabIndex={-1}>
      <p className="font-semibold">{labels.errorSummary}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">{Object.entries(errors).map(([fieldKey, message]) => <li key={fieldKey}><a href={`#form-field-${fieldKey}`}>{message}</a></li>)}</ul>
    </div> : null}

    <form className="mt-6 space-y-6" onSubmit={(event) => { event.preventDefault(); void save() }}>
      {projection.sections.map((section) => <fieldset className="rounded-2xl border border-border bg-panel p-5 sm:p-6" key={section.key}>
        <legend className="px-1 text-xl font-semibold">{section.title}</legend>
        <div className="mt-5 grid gap-5">
          {section.fields.map((field) => {
            const error = errors[field.key]
            const valueLabels = { noValue: labels.noValue, booleanTrue: labels.booleanTrue, booleanFalse: labels.booleanFalse }
            const current = displayFormValue(field.currentValue, valueLabels)
            const value = values[field.key]
            const isReadOnly = field.accessMode === 'READ'
            return <div className="grid gap-2" key={field.key}>
              <label className="text-sm font-semibold" htmlFor={`form-field-${field.key}`}>{field.label}{field.required ? <span aria-hidden="true" className="ml-1 text-danger">*</span> : null}</label>
              {field.helpText ? <p className="text-sm text-muted-foreground">{field.helpText}</p> : null}
              {isReadOnly ? <div className="grid gap-2 rounded-xl bg-panel-soft p-3 text-sm" aria-label={labels.readOnly}><p className="font-semibold text-muted-foreground">{labels.readOnly}</p><dl className="grid gap-2 sm:grid-cols-2"><div><dt className="text-muted-foreground">{labels.currentValue}</dt><dd className="mt-1 font-medium">{current}</dd></div><div><dt className="text-muted-foreground">{labels.newValue}</dt><dd className="mt-1 font-medium">{displayFormValue(field.newValue, valueLabels)}</dd></div></dl></div> : field.type === 'LONG_TEXT' ? <textarea className="form-field min-h-28" id={`form-field-${field.key}`} aria-describedby={error ? `form-error-${field.key}` : undefined} aria-invalid={Boolean(error)} onChange={(event) => setFieldValue(field.key, event.target.value)} value={inputValue(value)} /> : field.type === 'BOOLEAN' ? <label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm"><input checked={value === true} id={`form-field-${field.key}`} onChange={(event) => setFieldValue(field.key, event.target.checked)} type="checkbox" />{field.label}</label> : field.type === 'SINGLE_SELECT' ? <select className="form-field" id={`form-field-${field.key}`} aria-describedby={error ? `form-error-${field.key}` : undefined} aria-invalid={Boolean(error)} onChange={(event) => setFieldValue(field.key, event.target.value)} value={inputValue(value)}><option value="">{labels.noValue}</option>{field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : field.type === 'MULTI_SELECT' ? <div aria-describedby={error ? `form-error-${field.key}` : undefined} aria-invalid={Boolean(error)} className="grid gap-2 rounded-xl border border-border p-3">{field.options.map((option) => { const selected = Array.isArray(value) && value.includes(option.value); return <label className="flex items-center gap-3 text-sm" key={option.value}><input checked={selected} onChange={(event) => { const currentValues = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []; setFieldValue(field.key, event.target.checked ? [...currentValues, option.value] : currentValues.filter((item) => item !== option.value)) }} type="checkbox" />{option.label}</label> })}</div> : <input className="form-field" id={`form-field-${field.key}`} aria-describedby={error ? `form-error-${field.key}` : undefined} aria-invalid={Boolean(error)} onChange={(event) => setFieldValue(field.key, fieldValue(field.type, event.target.value))} type={field.type === 'DATE' ? 'date' : field.type === 'TIME' ? 'time' : field.type === 'DATETIME' ? 'datetime-local' : field.type === 'INTEGER' || field.type === 'DECIMAL' || field.type === 'MONEY' ? 'number' : 'text'} value={inputValue(value)} />}
              {error ? <p className="text-sm text-danger" id={`form-error-${field.key}`}>{error}</p> : null}
            </div>
          })}
        </div>
      </fieldset>)}
    </form>
  </section>
}
