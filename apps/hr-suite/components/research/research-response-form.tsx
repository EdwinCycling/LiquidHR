'use client'

import { CheckCircle2, LockKeyhole, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ResearchResponseForm } from '@/lib/research/respondent-service'
import type { SurveyMatrixRow, SurveyOptionRow } from '@/lib/research/database'
import type { ResearchSubmission } from '@/lib/research/schemas'

type AnswerState = Record<string, string | string[]>

interface ResponseLabels {
  privacyAnonymous: string
  privacyNamed: string
  required: string
  optional: string
  select: string
  selectMultiple: string
  yes: string
  no: string
  scaleLow: string
  scaleHigh: string
  submit: string
  submitting: string
  error: string
  completedTitle: string
  completedDescription: string
}

function answerKey(questionId: string, rowId?: string) {
  return rowId ? `${questionId}:${rowId}` : questionId
}

function hasValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value?.trim())
}

function textValue(answers: AnswerState, key: string) {
  const value = answers[key]
  return typeof value === 'string' ? value : ''
}

export function ResearchResponseForm({ form, labels }: { form: ResearchResponseForm; labels: ResponseLabels }) {
  const [answers, setAnswers] = useState<AnswerState>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const optionsByQuestion = useMemo<Map<string, SurveyOptionRow[]>>(() => form.kind === 'survey' ? new Map(form.questions.map((question) => [question.id, form.options.filter((option) => option.question_id === question.id)])) : new Map(), [form])
  const rowsByQuestion = useMemo<Map<string, SurveyMatrixRow[]>>(() => form.kind === 'survey' ? new Map(form.questions.map((question) => [question.id, form.rows.filter((row) => row.question_id === question.id)])) : new Map(), [form])

  function setValue(key: string, value: string) {
    setAnswers((current) => ({ ...current, [key]: value }))
  }

  function toggleValue(key: string, value: string) {
    setAnswers((current) => {
      const selected = Array.isArray(current[key]) ? current[key] : []
      return { ...current, [key]: selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value] }
    })
  }

  function validate() {
    if (form.kind === 'enps') return form.questions.every((question) => !question.is_mandatory || hasValue(answers[question.id]))
    return form.questions.every((question) => {
      if (question.question_type === 'MATRIX') {
        const rows = rowsByQuestion.get(question.id) ?? []
        return rows.every((row) => !row.is_required || hasValue(answers[answerKey(question.id, row.id)]))
      }
      return !question.is_required || hasValue(answers[question.id])
    })
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (!validate()) {
      setError(labels.error)
      return
    }
    type ResearchAnswer = ResearchSubmission['answers'][number]
    const payload: ResearchAnswer[] = form.kind === 'enps'
      ? form.questions.flatMap<ResearchAnswer>((question) => {
          const value = answers[question.id]
          return typeof value === 'string' && value.trim() ? [{ questionId: question.id, value: value.trim() }] : []
        })
      : form.questions.flatMap<ResearchAnswer>((question) => {
          const options = optionsByQuestion.get(question.id) ?? []
          if (question.question_type === 'MATRIX') {
            return (rowsByQuestion.get(question.id) ?? []).flatMap((row) => {
              const value = answers[answerKey(question.id, row.id)]
              return typeof value === 'string' && value ? [{ questionId: question.id, matrixRowId: row.id, optionId: value }] : []
            })
          }
          if (question.question_type === 'MULTI_CHOICE') {
            const currentAnswer = answers[question.id]
            const selected: string[] = Array.isArray(currentAnswer) ? currentAnswer : []
            return selected.map((optionId) => ({ questionId: question.id, optionId }))
          }
          if (question.question_type === 'SINGLE_CHOICE') {
            const optionId = answers[question.id]
            return typeof optionId === 'string' && options.some((option) => option.id === optionId) ? [{ questionId: question.id, optionId }] : []
          }
          const value = answers[question.id]
          return typeof value === 'string' && value.trim() ? [{ questionId: question.id, value: value.trim() }] : []
        })
    if (!payload.length) {
      setError(labels.error)
      return
    }
    setSubmitting(true)
    try {
      const response = await fetch(`/api/research/respond/${form.kind}/${form.invitationId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: payload }) })
      if (!response.ok) throw new Error('submit')
      setSubmitted(true)
    } catch {
      setError(labels.error)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) return <section className="rounded-3xl border bg-surface p-8 text-center shadow-sm"><CheckCircle2 aria-hidden="true" className="mx-auto text-primary" size={38} /><h2 className="mt-5 text-2xl font-semibold tracking-tight">{labels.completedTitle}</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{labels.completedDescription}</p></section>

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div className="flex items-start gap-3 rounded-2xl border bg-accent/60 p-4 text-sm leading-6 text-accent-foreground"><LockKeyhole aria-hidden="true" className="mt-0.5 shrink-0 text-primary" size={18} /><p>{form.anonymous ? labels.privacyAnonymous : labels.privacyNamed}</p></div>
      {form.kind === 'enps' ? form.questions.map((question, index) => <fieldset className="rounded-3xl border bg-surface p-5 shadow-sm sm:p-6" key={question.id}>
          <legend className="w-full px-0">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{String(index + 1).padStart(2, '0')}</span>
            <span className="mt-2 block text-lg font-semibold leading-7">{question.question_text}</span>
            <span className="mt-1 block text-xs font-medium text-muted-foreground">{question.is_mandatory ? labels.required : labels.optional}</span>
          </legend>
          <div className="mt-5"><EnpsAnswer question={question} labels={labels} value={textValue(answers, question.id)} onChange={(value) => setValue(question.id, value)} /></div>
        </fieldset>) : form.questions.map((question, index) => {
        const required = question.is_required
        const options = optionsByQuestion.get(question.id) ?? []
        const rows = rowsByQuestion.get(question.id) ?? []
        return <fieldset className="rounded-3xl border bg-surface p-5 shadow-sm sm:p-6" key={question.id}>
          <legend className="w-full px-0">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{String(index + 1).padStart(2, '0')}</span>
            <span className="mt-2 block text-lg font-semibold leading-7">{question.question_text}</span>
            <span className="mt-1 block text-xs font-medium text-muted-foreground">{required ? labels.required : labels.optional}</span>
          </legend>
          <div className="mt-5">
            {question.question_type === 'TEXT_SINGLE' ? <input aria-label={question.question_text} className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-focus/20" onChange={(event) => setValue(question.id, event.target.value)} required={required} value={textValue(answers, question.id)} /> : null}
            {question.question_type === 'TEXT_MULTI' ? <textarea aria-label={question.question_text} className="min-h-32 w-full resize-y rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-focus/20" onChange={(event) => setValue(question.id, event.target.value)} required={required} value={textValue(answers, question.id)} /> : null}
            {['NUMBER', 'DATE', 'DATETIME'].includes(question.question_type) ? <input aria-label={question.question_text} className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-focus/20" onChange={(event) => setValue(question.id, event.target.value)} required={required} type={question.question_type === 'NUMBER' ? 'number' : question.question_type === 'DATE' ? 'date' : 'datetime-local'} value={textValue(answers, question.id)} /> : null}
            {question.question_type === 'SINGLE_CHOICE' || question.question_type === 'MULTI_CHOICE' ? <div aria-label={question.question_type === 'MULTI_CHOICE' ? labels.selectMultiple : labels.select} className="grid gap-2" role="group">{options.map((option) => { const checked = question.question_type === 'MULTI_CHOICE' ? (Array.isArray(answers[question.id]) && answers[question.id].includes(option.id)) : answers[question.id] === option.id; return <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition ${checked ? 'border-primary bg-accent text-accent-foreground' : 'hover:border-primary/40 hover:bg-muted/50'}`} key={option.id}><input checked={checked} className="size-4 accent-[var(--primary)]" name={question.id} onChange={() => question.question_type === 'MULTI_CHOICE' ? toggleValue(question.id, option.id) : setValue(question.id, option.id)} type={question.question_type === 'MULTI_CHOICE' ? 'checkbox' : 'radio'} value={option.id} />{option.option_label}</label> })}</div> : null}
            {question.question_type === 'MATRIX' ? <div className="space-y-5">{rows.map((row) => <fieldset className="rounded-2xl bg-muted/45 p-4" key={row.id}><legend className="px-1 text-sm font-semibold">{row.row_label}<span className="ml-2 text-xs font-medium text-muted-foreground">{row.is_required ? labels.required : labels.optional}</span></legend><div className="mt-3 flex flex-wrap gap-2">{options.map((option) => { const key = answerKey(question.id, row.id); const checked = answers[key] === option.id; return <label className={`cursor-pointer rounded-xl border px-3 py-2 text-sm font-medium transition ${checked ? 'border-primary bg-primary text-primary-foreground' : 'bg-surface hover:border-primary/40'}`} key={option.id}><input checked={checked} className="sr-only" name={key} onChange={() => setValue(key, option.id)} type="radio" value={option.id} />{option.option_label}</label> })}</div></fieldset>)}</div> : null}
          </div>
        </fieldset>
      })}
      {error ? <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-medium text-destructive" role="alert">{error}</p> : null}
      <div className="sticky bottom-4 rounded-2xl border bg-surface/95 p-3 shadow-lg backdrop-blur"><button className="button-primary w-full justify-center sm:w-auto" disabled={submitting} type="submit"><Send aria-hidden="true" size={16} />{submitting ? labels.submitting : labels.submit}</button></div>
    </form>
  )
}

function EnpsAnswer({ question, labels, value, onChange }: { question: Extract<ResearchResponseForm, { kind: 'enps' }>['questions'][number]; labels: ResponseLabels; value: string; onChange: (value: string) => void }) {
  if (question.question_type === 'OPEN_TEXT') return <textarea aria-label={question.question_text} className="min-h-28 w-full resize-y rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-focus/20" onChange={(event) => onChange(event.target.value)} value={value} />
  const values = question.question_type === 'YES_NO' ? ['YES', 'NO'] : question.question_type === 'LIKERT_4' ? ['1', '2', '3', '4'] : question.question_type === 'LIKERT_5' ? ['1', '2', '3', '4', '5'] : Array.from({ length: 11 }, (_, index) => String(index))
  return <div><div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap">{values.map((option) => <label className={`grid min-h-12 min-w-12 cursor-pointer place-items-center rounded-xl border px-3 text-sm font-semibold transition ${value === option ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'bg-background hover:border-primary/50 hover:bg-accent'}`} key={option}><input checked={value === option} className="sr-only" name={question.id} onChange={() => onChange(option)} type="radio" value={option} />{option === 'YES' ? labels.yes : option === 'NO' ? labels.no : option}</label>)}</div>{question.question_type === 'SCALE_10' ? <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{labels.scaleLow}</span><span>{labels.scaleHigh}</span></div> : null}</div>
}
