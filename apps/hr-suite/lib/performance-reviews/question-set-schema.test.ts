import { describe, expect, it } from 'vitest'
import {
  performanceReviewQuestionSetSchema,
  validatePerformanceReviewAnswers,
  type PerformanceReviewQuestion,
} from './question-set-schema'

const localized = { nl: 'Vraag', en: 'Question' }

describe('performance review question sets', () => {
  it('accepts all seven supported question types and keeps question order', () => {
    const set = performanceReviewQuestionSetSchema.parse({
      name: 'Ontwikkelgesprek',
      questions: [
        { id: '00000000-0000-4000-8000-000000000001', type: 'SHORT_TEXT', prompt: localized, required: true },
        { id: '00000000-0000-4000-8000-000000000002', type: 'LONG_TEXT', prompt: localized, required: false },
        { id: '00000000-0000-4000-8000-000000000003', type: 'SINGLE_CHOICE', prompt: localized, required: true, options: [{ id: '00000000-0000-4000-8000-000000000011', label: localized }, { id: '00000000-0000-4000-8000-000000000012', label: { nl: 'Nee', en: 'No' } }] },
        { id: '00000000-0000-4000-8000-000000000004', type: 'MULTI_CHOICE', prompt: localized, required: false, options: [{ id: '00000000-0000-4000-8000-000000000021', label: localized }, { id: '00000000-0000-4000-8000-000000000022', label: { nl: 'Nee', en: 'No' } }] },
        { id: '00000000-0000-4000-8000-000000000005', type: 'YES_NO', variant: 'AGREE_DISAGREE', prompt: localized, required: true },
        { id: '00000000-0000-4000-8000-000000000006', type: 'SCALE', scale: 10, prompt: localized, required: true, labels: [] },
        { id: '00000000-0000-4000-8000-000000000007', type: 'MATRIX', matrixMode: 'SCALE', scale: 4, prompt: localized, required: true, rows: [{ id: '00000000-0000-4000-8000-000000000031', label: localized }], labels: [] },
      ],
    })

    expect(set.questions.map((question) => question.type)).toEqual(['SHORT_TEXT', 'LONG_TEXT', 'SINGLE_CHOICE', 'MULTI_CHOICE', 'YES_NO', 'SCALE', 'MATRIX'])
  })

  it('rejects invalid options, duplicated option ids, and incomplete translations', () => {
    const base = { name: 'Set', questions: [{ id: '00000000-0000-4000-8000-000000000001', type: 'SINGLE_CHOICE', prompt: localized, required: true, options: [{ id: '00000000-0000-4000-8000-000000000011', label: localized }, { id: '00000000-0000-4000-8000-000000000011', label: { nl: 'Nee', en: 'No' } }] }] }
    expect(performanceReviewQuestionSetSchema.safeParse(base).success).toBe(false)
    expect(performanceReviewQuestionSetSchema.safeParse({ name: 'Set', questions: [{ id: '00000000-0000-4000-8000-000000000002', type: 'SHORT_TEXT', prompt: { nl: 'Vraag' }, required: false }] }).success).toBe(false)
    expect(performanceReviewQuestionSetSchema.safeParse({ name: 'Leeg', questions: [] }).success).toBe(false)
  })

  it('validates answer values and required question completion from the snapshot definition', () => {
    const questions = [
      { id: '00000000-0000-4000-8000-000000000001', type: 'SHORT_TEXT', prompt: localized, required: true },
      { id: '00000000-0000-4000-8000-000000000002', type: 'SCALE', scale: 5, prompt: localized, required: true, labels: [] },
    ] as PerformanceReviewQuestion[]

    expect(validatePerformanceReviewAnswers(questions, {}, false)).toEqual({ valid: true, missingQuestionIds: [] })
    expect(validatePerformanceReviewAnswers(questions, { [questions[0]!.id]: 'Goed' }, true)).toEqual({ valid: false, missingQuestionIds: [questions[1]!.id] })
    expect(validatePerformanceReviewAnswers(questions, { [questions[0]!.id]: 'Goed', [questions[1]!.id]: 6 }, false).valid).toBe(false)
    expect(validatePerformanceReviewAnswers(questions, { '00000000-0000-4000-8000-000000000099': 'onbekend' }, false).valid).toBe(false)
    expect(validatePerformanceReviewAnswers(questions, { [questions[0]!.id]: 'Goed', [questions[1]!.id]: 4 }, true).valid).toBe(true)
  })

  it('requires every row when a required matrix question is definitively submitted', () => {
    const matrix = {
      id: '00000000-0000-4000-8000-000000000001', type: 'MATRIX', matrixMode: 'CHOICE', prompt: localized, required: true,
      rows: [
        { id: '00000000-0000-4000-8000-000000000011', label: localized },
        { id: '00000000-0000-4000-8000-000000000012', label: { nl: 'Samenwerking', en: 'Teamwork' } },
      ],
      options: [
        { id: '00000000-0000-4000-8000-000000000021', label: localized },
        { id: '00000000-0000-4000-8000-000000000022', label: { nl: 'Nee', en: 'No' } },
      ],
    } as Extract<PerformanceReviewQuestion, { type: 'MATRIX'; matrixMode: 'CHOICE' }>

    expect(validatePerformanceReviewAnswers([matrix], { [matrix.id]: { [matrix.rows[0]!.id]: matrix.options[0]!.id } }, true).valid).toBe(false)
    expect(validatePerformanceReviewAnswers([matrix], { [matrix.id]: { [matrix.rows[0]!.id]: matrix.options[0]!.id, [matrix.rows[1]!.id]: matrix.options[1]!.id } }, true).valid).toBe(true)
  })
})
