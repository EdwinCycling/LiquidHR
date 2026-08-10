'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildVisibleFormPayload,
  displayFormValue,
  formProjectionSchema,
  isFormValueValid,
  visibleFields,
  type FormFieldProjection,
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
  readonly referenceSearch: string
  readonly referenceLoading: string
  readonly referenceNoOptions: string
  readonly scrollHint: string
}

interface FormRuntimeRendererProps {
  readonly initialProjection: FormProjection
  readonly locale: 'nl' | 'en'
  readonly labels: FormRuntimeLabels
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'stale'

interface FormReferenceOption {
  readonly value: string
  readonly label: string
  readonly meta: string | null
}

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

function referenceValue(value: FormJsonValue | undefined): string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null && !Array.isArray(value) && typeof value.id === 'string') return value.id
  return null
}

function fieldValue(fieldType: string, value: string): FormJsonValue {
  if (value === '') return null
  if (fieldType === 'INTEGER') return Number.parseInt(value, 10)
  if (fieldType === 'DECIMAL' || fieldType === 'MONEY') return Number.parseFloat(value)
  return value
}

function isReferenceType(type: string): boolean {
  return type === 'EMPLOYEE_REFERENCE'
    || type === 'DEPARTMENT_REFERENCE'
    || type === 'JOB_REFERENCE'
    || type === 'EMPLOYMENT_REFERENCE'
    || type === 'DOCUMENT_REFERENCE'
}

function optionFromUnknown(value: unknown): FormReferenceOption | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  if (!('value' in value) || !('label' in value)) return null
  if (typeof value.value !== 'string' || typeof value.label !== 'string') return null
  const meta = 'meta' in value && (typeof value.meta === 'string' || value.meta === null) ? value.meta : null
  return { value: value.value, label: value.label, meta }
}

function fieldError(field: FormFieldProjection, value: FormJsonValue | undefined, labels: FormRuntimeLabels): string | null {
  return isFormValueValid(field, value) ? null : field.required ? labels.required : labels.invalid
}

function ReferencePicker({
  field,
  workItemId,
  language,
  value,
  labels,
  describedBy,
  invalid,
  onChange,
  onBlur,
}: {
  readonly field: FormFieldProjection
  readonly workItemId: string
  readonly language: 'nl' | 'en'
  readonly value: FormJsonValue | undefined
  readonly labels: Pick<FormRuntimeLabels, 'referenceSearch' | 'referenceLoading' | 'referenceNoOptions'>
  readonly describedBy?: string
  readonly invalid: boolean
  readonly onChange: (value: FormJsonValue) => void
  readonly onBlur: (value?: FormJsonValue) => void
}) {
  const selectedValue = referenceValue(value)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<readonly FormReferenceOption[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const loadedSelectedValue = useRef<string | null>(null)
  const selectedDuringPointerInteraction = useRef<FormJsonValue | undefined>(undefined)

  const load = useCallback(async (search: string): Promise<void> => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ fieldKey: field.key, language, q: search })
      const response = await fetch(`/api/process-work-items/${workItemId}/form-options?${params.toString()}`, { cache: 'no-store' })
      const body: unknown = await response.json().catch(() => null)
      if (!response.ok || typeof body !== 'object' || body === null || !('data' in body) || typeof body.data !== 'object' || body.data === null || !('options' in body.data) || !Array.isArray(body.data.options)) return
      const nextOptions = body.data.options.map(optionFromUnknown).filter((option): option is FormReferenceOption => option !== null)
      setOptions((current) => {
        const merged = [...nextOptions, ...current.filter((currentOption) => !nextOptions.some((nextOption) => nextOption.value === currentOption.value))]
        return merged.slice(0, 50)
      })
    } finally {
      setLoading(false)
    }
  }, [field.key, language, workItemId])

  useEffect(() => {
    if (!selectedValue || loadedSelectedValue.current === selectedValue) return
    loadedSelectedValue.current = selectedValue
    void load(selectedValue)
  }, [load, selectedValue])

  useEffect(() => {
    if (!open) return undefined
    const timeout = window.setTimeout(() => { void load(query) }, 180)
    return () => window.clearTimeout(timeout)
  }, [load, open, query])

  const selected = options.find((option) => option.value === selectedValue) ?? null

  return <div className="relative">
    <input
      aria-autocomplete="list"
      aria-controls={`form-reference-options-${field.key}`}
      aria-describedby={describedBy}
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-invalid={invalid}
      className="form-field w-full"
      id={`form-field-${field.key}`}
      onBlur={() => window.setTimeout(() => { setOpen(false); onBlur(selectedDuringPointerInteraction.current ?? selectedValue ?? undefined); selectedDuringPointerInteraction.current = undefined }, 120)}
      onChange={(event) => { selectedDuringPointerInteraction.current = undefined; setQuery(event.target.value); onChange(null); setOpen(true) }}
      onFocus={() => { setOpen(true); if (!options.length) void load('') }}
      placeholder={labels.referenceSearch}
      role="combobox"
      value={selected ? selected.label : query}
    />
    {open ? <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-surface p-1 shadow-lg" id={`form-reference-options-${field.key}`} role="listbox">
      {loading ? <li className="px-3 py-2 text-sm text-muted-foreground">{labels.referenceLoading}</li> : options.length === 0 ? <li className="px-3 py-2 text-sm text-muted-foreground">{labels.referenceNoOptions}</li> : options.map((option) => <li key={option.value} role="option" aria-selected={option.value === selectedValue}>
        <button className="flex min-h-11 w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary" onMouseDown={(event) => event.preventDefault()} onClick={() => { selectedDuringPointerInteraction.current = option.value; onChange(option.value); setQuery(option.label); setOpen(false) }} type="button">
          <span className="font-medium">{option.label}</span>{option.meta ? <span className="text-muted-foreground">{option.meta}</span> : null}
        </button>
      </li>)}
    </ul> : null}
  </div>
}

export function FormRuntimeRenderer({ initialProjection, locale, labels }: FormRuntimeRendererProps) {
  const [projection, setProjection] = useState(initialProjection)
  const [values, setValues] = useState<Record<string, FormJsonValue>>(() => initialValues(initialProjection))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [dirty, setDirty] = useState(false)
  const [changedFieldKeys, setChangedFieldKeys] = useState<ReadonlySet<string>>(new Set())
  const [hasMoreBelow, setHasMoreBelow] = useState(false)
  const summaryRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const savingRef = useRef(false)
  const fields = useMemo(() => visibleFields(projection), [projection])

  function setFieldValue(fieldKey: string, value: FormJsonValue): void {
    setValues((current) => ({ ...current, [fieldKey]: value }))
    setChangedFieldKeys((current) => new Set(current).add(fieldKey))
    setDirty(true)
    setSaveState('idle')
    const field = fields.find((candidate) => candidate.key === fieldKey)
    if (field) {
      const message = fieldError(field, value, labels)
      setErrors((current) => {
        if (!message && !(fieldKey in current)) return current
        const next = { ...current }
        if (message) next[fieldKey] = message
        else delete next[fieldKey]
        return next
      })
    }
  }

  const validateField = useCallback((fieldKey: string, candidate?: FormJsonValue): boolean => {
    const field = fields.find((item) => item.key === fieldKey)
    if (!field || field.accessMode === 'READ') return true
    const message = fieldError(field, candidate ?? values[fieldKey], labels)
    setErrors((current) => {
      const next = { ...current }
      if (message) next[fieldKey] = message
      else delete next[fieldKey]
      return next
    })
    return message === null
  }, [fields, labels, values])

  const validate = useCallback((): boolean => {
    const nextErrors: Record<string, string> = {}
    fields.forEach((field) => {
      if (field.accessMode === 'READ') return
      const message = fieldError(field, values[field.key], labels)
      if (message) nextErrors[field.key] = message
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
    } finally {
      savingRef.current = false
    }
  }, [changedFieldKeys, dirty, locale, projection, validate, values])

  useEffect(() => {
    if (!dirty) return undefined
    const timeout = window.setTimeout(() => { void save() }, 900)
    return () => window.clearTimeout(timeout)
  }, [dirty, save])

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return undefined
    const update = () => setHasMoreBelow(element.scrollTop + element.clientHeight < element.scrollHeight - 8)
    update()
    element.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      element.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [fields.length, projection])

  const valueLabels = { noValue: labels.noValue, booleanTrue: labels.booleanTrue, booleanFalse: labels.booleanFalse }
  const saveStatus = saveState === 'saving' ? labels.saving : saveState === 'saved' ? labels.saved : saveState === 'stale' ? labels.stale : saveState === 'error' ? labels.saveError : ''

  return <section className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
    <header className="rounded-3xl border border-border bg-panel p-6 shadow-sm sm:p-8">
      <p className="eyebrow text-primary">{projection.participantKey}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{projection.title}</h1>
      {projection.description ? <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{projection.description}</p> : null}
      <p aria-live="polite" className="mt-5 min-h-5 text-sm text-muted-foreground">{saveStatus}</p>
    </header>

    {Object.keys(errors).length > 0 ? <div ref={summaryRef} aria-label={labels.errorSummary} className="mt-5 rounded-2xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger" role="alert" tabIndex={-1}>
      <p className="font-semibold">{labels.errorSummary}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">{Object.entries(errors).map(([fieldKey, message]) => <li key={fieldKey}><a href={`#form-field-${fieldKey}`}>{message}</a></li>)}</ul>
    </div> : null}

    <form className="mt-6 flex max-h-[calc(100vh-14rem)] min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-border bg-panel" onSubmit={(event) => { event.preventDefault(); void save() }}>
      <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6" onScroll={(event) => { const element = event.currentTarget; setHasMoreBelow(element.scrollTop + element.clientHeight < element.scrollHeight - 8) }} ref={scrollRef}>
        <div className="grid gap-6">
          {projection.sections.map((section) => <fieldset className="rounded-2xl border border-border bg-surface p-5 sm:p-6" key={section.key}>
            <legend className="px-1 text-xl font-semibold">{section.title}</legend>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              {section.fields.map((field) => {
                const error = errors[field.key]
                const current = displayFormValue(field.currentValue, valueLabels)
                const value = values[field.key]
                const isReadOnly = field.accessMode === 'READ'
                const describedBy = [field.helpText ? `form-help-${field.key}` : '', error ? `form-error-${field.key}` : ''].filter(Boolean).join(' ') || undefined
                const fieldClass = field.type === 'LONG_TEXT' || field.type === 'MULTI_SELECT' ? 'md:col-span-2' : ''
                return <div className={`grid gap-2 ${fieldClass}`} key={field.key}>
                  <label className="text-sm font-semibold" htmlFor={`form-field-${field.key}`}>{field.label}{field.required ? <span aria-hidden="true" className="ml-1 text-danger">*</span> : null}</label>
                  {field.helpText ? <p className="text-sm text-muted-foreground" id={`form-help-${field.key}`}>{field.helpText}</p> : null}
                  {isReadOnly ? <div className="grid gap-3 rounded-xl bg-panel-soft p-3 text-sm sm:grid-cols-2" aria-label={labels.readOnly}><p className="font-semibold text-muted-foreground sm:col-span-2">{labels.readOnly}</p><div><p className="text-muted-foreground">{labels.currentValue}</p><p className="mt-1 font-medium">{current}</p></div><div><p className="text-muted-foreground">{labels.newValue}</p><p className="mt-1 font-medium">{displayFormValue(field.newValue, valueLabels)}</p></div></div>
                    : isReferenceType(field.type) ? <ReferencePicker describedBy={describedBy} field={field} invalid={Boolean(error)} language={locale} labels={{ referenceSearch: labels.referenceSearch, referenceLoading: labels.referenceLoading, referenceNoOptions: labels.referenceNoOptions }} onBlur={() => { validateField(field.key) }} onChange={(nextValue) => setFieldValue(field.key, nextValue)} value={value} workItemId={projection.workItemId} />
                      : field.type === 'LONG_TEXT' ? <textarea className="form-field min-h-28" id={`form-field-${field.key}`} aria-describedby={describedBy} aria-invalid={Boolean(error)} onBlur={() => { validateField(field.key) }} onChange={(event) => setFieldValue(field.key, event.target.value)} value={inputValue(value)} />
                        : field.type === 'BOOLEAN' ? <label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm"><input aria-describedby={describedBy} aria-invalid={Boolean(error)} checked={value === true} id={`form-field-${field.key}`} onBlur={() => { validateField(field.key) }} onChange={(event) => setFieldValue(field.key, event.target.checked)} type="checkbox" /><span>{field.label}</span></label>
                          : field.type === 'SINGLE_SELECT' ? <select className="form-field" id={`form-field-${field.key}`} aria-describedby={describedBy} aria-invalid={Boolean(error)} onBlur={() => { validateField(field.key) }} onChange={(event) => setFieldValue(field.key, event.target.value)} value={inputValue(value)}><option value="">{labels.noValue}</option>{field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                            : field.type === 'MULTI_SELECT' ? <div aria-describedby={describedBy} aria-invalid={Boolean(error)} className="grid gap-2 rounded-xl border border-border p-3">{field.options.map((option) => { const selected = Array.isArray(value) && value.includes(option.value); return <label className="flex items-center gap-3 text-sm" key={option.value}><input checked={selected} onBlur={() => { validateField(field.key) }} onChange={(event) => { const currentValues = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []; setFieldValue(field.key, event.target.checked ? [...currentValues, option.value] : currentValues.filter((item) => item !== option.value)) }} type="checkbox" />{option.label}</label> })}</div>
                            : <input className="form-field" id={`form-field-${field.key}`} aria-describedby={describedBy} aria-invalid={Boolean(error)} onBlur={() => { validateField(field.key) }} onChange={(event) => setFieldValue(field.key, fieldValue(field.type, event.target.value))} onInput={(event) => setFieldValue(field.key, fieldValue(field.type, event.currentTarget.value))} type={field.type === 'DATE' ? 'date' : field.type === 'TIME' ? 'time' : field.type === 'DATETIME' ? 'datetime-local' : field.type === 'INTEGER' || field.type === 'DECIMAL' || field.type === 'MONEY' ? 'number' : 'text'} value={inputValue(value)} />}
                  {error ? <p className="text-sm text-danger" id={`form-error-${field.key}`}>{error}</p> : null}
                </div>
              })}
            </div>
          </fieldset>)}
        </div>
      </div>
      <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-panel/95 p-4 backdrop-blur sm:px-6">
        {hasMoreBelow ? <p className="basis-full text-xs text-muted-foreground" role="status">{labels.scrollHint}</p> : null}
        <span aria-live="polite" className="min-h-5 text-sm text-muted-foreground">{saveStatus}</span>
        <button className="button-primary" disabled={!dirty || saveState === 'saving' || saveState === 'stale'} onClick={() => { void save() }} type="submit">{labels.save}</button>
      </footer>
    </form>
  </section>
}
