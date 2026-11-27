'use client'

import { useId } from 'react'
import type { Locale } from '@/lib/i18n/config'
import type { PerformanceReviewQuestion, QuestionAnswers } from '@/lib/performance-reviews/question-set-schema'

type Labels = { required: string; optional: string }

export function PerformanceReviewQuestionFields({
  questions,
  answers,
  onChange,
  locale,
  labels,
  disabled = false,
  invalidQuestionIds = [],
}: {
  questions: readonly PerformanceReviewQuestion[]
  answers: QuestionAnswers
  onChange: (questionId: string, value: unknown) => void
  locale: Locale
  labels: Labels
  disabled?: boolean
  invalidQuestionIds?: readonly string[]
}) {
  const headingId = useId()
  const invalid = new Set(invalidQuestionIds)
  return <section aria-labelledby={headingId} className="mt-6 space-y-5 border-t border-border-subtle pt-5">
    <h3 className="text-lg font-semibold" id={headingId}>{locale === 'nl' ? 'Vragen' : 'Questions'}</h3>
    {questions.map((question, index) => {
      const answer = answers[question.id]
      const prompt = question.prompt[locale]
      const help = question.help?.[locale]
      const errorId = `question-error-${question.id}`
      const invalidQuestion = invalid.has(question.id)
      const commonLabel = `${index + 1}. ${prompt}`
      const textClasses = `min-h-11 w-full rounded-[var(--radius-control)] border ${invalidQuestion ? 'border-destructive' : 'border-border'} bg-surface px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-focus`
      return <fieldset aria-describedby={invalidQuestion ? errorId : undefined} aria-invalid={invalidQuestion || undefined} className="min-w-0 space-y-3" key={question.id}>
        <legend className="max-w-full text-sm font-medium">{commonLabel}<span className="ml-2 text-xs font-normal text-muted-foreground">{question.required ? labels.required : labels.optional}</span></legend>
        {help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
        {question.type === 'SHORT_TEXT' ? <input aria-label={prompt} className={textClasses} disabled={disabled} maxLength={500} value={typeof answer === 'string' ? answer : ''} onChange={(event) => onChange(question.id, event.target.value)} /> : null}
        {question.type === 'LONG_TEXT' ? <textarea aria-label={prompt} className={`${textClasses} min-h-28`} disabled={disabled} maxLength={5000} value={typeof answer === 'string' ? answer : ''} onChange={(event) => onChange(question.id, event.target.value)} /> : null}
        {question.type === 'SINGLE_CHOICE' ? <div className="grid gap-2" role="radiogroup" aria-label={prompt}>{question.options.map((option) => <label className="flex min-h-11 items-center gap-2 text-sm" key={option.id}><input className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-focus" type="radio" name={question.id} value={option.id} checked={answer === option.id} disabled={disabled} onChange={() => onChange(question.id, option.id)} /><span>{option.label[locale]}</span></label>)}</div> : null}
        {question.type === 'MULTI_CHOICE' ? <div className="grid gap-2">{question.options.map((option) => {
          const selected = Array.isArray(answer) && answer.includes(option.id)
          return <label className="flex min-h-11 items-center gap-2 text-sm" key={option.id}><input className="size-4 rounded accent-primary focus-visible:outline-2 focus-visible:outline-focus" type="checkbox" checked={selected} disabled={disabled} onChange={(event) => {
            const current = Array.isArray(answer) ? answer.filter((value): value is string => typeof value === 'string') : []
            onChange(question.id, event.target.checked ? [...current, option.id] : current.filter((value) => value !== option.id))
          }} /><span>{option.label[locale]}</span></label>
        })}</div> : null}
        {question.type === 'YES_NO' ? <div className="flex flex-wrap gap-x-5 gap-y-2" role="radiogroup" aria-label={prompt}>{(question.variant === 'YES_NO' ? [['YES', locale === 'nl' ? 'Ja' : 'Yes'], ['NO', locale === 'nl' ? 'Nee' : 'No']] : [['AGREE', locale === 'nl' ? 'Eens' : 'Agree'], ['DISAGREE', locale === 'nl' ? 'Oneens' : 'Disagree']]).map(([value, label]) => <label className="flex min-h-11 items-center gap-2 text-sm" key={value}><input className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-focus" type="radio" name={question.id} value={value} checked={answer === value} disabled={disabled} onChange={() => onChange(question.id, value)} /><span>{label}</span></label>)}</div> : null}
        {question.type === 'SCALE' ? <ScaleChoices answer={answer} disabled={disabled} labels={question.labels} locale={locale} name={question.id} onChange={(value) => onChange(question.id, value)} prompt={prompt} scale={question.scale} /> : null}
        {question.type === 'MATRIX' ? <div className="space-y-4">{question.rows.map((row) => {
          const matrixAnswers = typeof answer === 'object' && answer !== null && !Array.isArray(answer) ? answer as Record<string, unknown> : {}
          const rowValue = matrixAnswers[row.id]
          return <fieldset className="min-w-0 space-y-2" key={row.id}>
            <legend className="text-sm font-medium">{row.label[locale]}</legend>
            {question.matrixMode === 'CHOICE'
              ? <div className="flex flex-wrap gap-x-4 gap-y-2" role="radiogroup" aria-label={`${prompt}: ${row.label[locale]}`}>{question.options.map((option) => <label className="flex min-h-10 items-center gap-2 text-sm" key={option.id}><input className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-focus" type="radio" name={`${question.id}-${row.id}`} value={option.id} checked={rowValue === option.id} disabled={disabled} onChange={() => onChange(question.id, { ...matrixAnswers, [row.id]: option.id })} /><span>{option.label[locale]}</span></label>)}</div>
              : <ScaleChoices answer={rowValue} disabled={disabled} labels={question.labels} locale={locale} name={`${question.id}-${row.id}`} onChange={(value) => onChange(question.id, { ...matrixAnswers, [row.id]: value })} prompt={`${prompt}: ${row.label[locale]}`} scale={question.scale} />}
          </fieldset>
        })}</div> : null}
        {invalidQuestion ? <p className="text-sm text-destructive" id={errorId} role="alert">{locale === 'nl' ? 'Vul deze vraag volledig en geldig in.' : 'Complete this question with a valid answer.'}</p> : null}
      </fieldset>
    })}
  </section>
}

function ScaleChoices({ answer, disabled, labels, locale, name, onChange, prompt, scale }: {
  answer: unknown
  disabled: boolean
  labels: readonly { value: number; label: { nl: string; en: string } }[]
  locale: Locale
  name: string
  onChange: (value: number) => void
  prompt: string
  scale: number
}) {
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-x-3 gap-y-2" role="radiogroup" aria-label={prompt}>
      {Array.from({ length: scale }, (_, index) => index + 1).map((value) => <label className="flex min-h-11 items-center gap-2 text-sm" key={value}>
        <input className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-focus" type="radio" name={name} value={value} checked={answer === value} disabled={disabled} onChange={() => onChange(value)} />
        <span>{labels.find((item) => item.value === value)?.label[locale] ?? value}</span>
      </label>)}
    </div>
    <p className="text-xs text-muted-foreground">{locale === 'nl' ? `Kies een waarde van 1 tot en met ${scale}.` : `Choose a value from 1 to ${scale}.`}</p>
  </div>
}
