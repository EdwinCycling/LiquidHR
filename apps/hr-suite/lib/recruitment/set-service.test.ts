import { describe, expect, it } from 'vitest'
import { buildSetSnapshot, setItemTypeSchema, validateSetItems } from './set-service'

describe('guided recruitment set service', () => {
  it('laat sollicitatievragen buiten interviewsets', () => {
    expect(setItemTypeSchema.safeParse('INTERVIEW_QUESTION').success).toBe(true)
    expect(validateSetItems(['INTERVIEW_QUESTION', 'CRITERION', 'PREPARATION'])).toBe(true)
    expect(validateSetItems(['APPLICATION_QUESTION'])).toBe(false)
  })

  it('maakt geordende snapshots met drie inhoudstypen', () => {
    expect(buildSetSnapshot([
      { itemType: 'INTERVIEW_QUESTION', title: 'Vraag', content: { prompt: 'Vertel.' } },
      { itemType: 'CRITERION', title: 'Criterium', content: { anchors: { 1: 'Laag', 5: 'Hoog' } } },
    ])).toEqual({ interviewQuestions: [{ itemType: 'INTERVIEW_QUESTION', title: 'Vraag', content: { prompt: 'Vertel.' } }], criteria: [{ itemType: 'CRITERION', title: 'Criterium', content: { anchors: { 1: 'Laag', 5: 'Hoog' } } }], preparation: [] })
  })
})
