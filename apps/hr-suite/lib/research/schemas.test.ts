import { describe, expect, it } from 'vitest'
import { enpsBankCategoryInputSchema, enpsBankQuestionInputSchema, enpsCampaignInputSchema, researchReminderSchema, researchSubmissionSchema, surveyInputSchema } from './schemas'

const futureWindow = {
  startsAt: '2026-09-01T08:00:00.000Z',
  endsAt: '2026-09-30T16:00:00.000Z',
}

describe('research schemas', () => {
  it('accepteert een survey met matrixvraag en expliciete doelgroep', () => {
    const parsed = surveyInputSchema.safeParse({
      title: 'Medewerkersdag',
      description: 'Deel je ervaring.',
      ...futureWindow,
      isAnonymous: true,
      target: { mode: 'ALL', ids: [] },
      questions: [{
        text: 'Hoe beoordeel je de dag?',
        type: 'MATRIX',
        required: true,
        options: ['Matig', 'Goed', 'Uitstekend'],
        rows: [{ label: 'Locatie', required: true }],
      }],
    })

    expect(parsed.success).toBe(true)
  })

  it('weigert een matrix zonder rijen of opties', () => {
    const parsed = surveyInputSchema.safeParse({
      title: 'Onvolledig',
      description: '',
      ...futureWindow,
      isAnonymous: true,
      target: { mode: 'ALL', ids: [] },
      questions: [{ text: 'Matrix', type: 'MATRIX', required: true, options: [], rows: [] }],
    })

    expect(parsed.success).toBe(false)
  })

  it('accepteert een gerichte doelgroep op entiteiten', () => {
    expect(surveyInputSchema.safeParse({
      title: 'Entiteitsmeting', description: '', ...futureWindow, isAnonymous: true,
      target: { mode: 'ENTITIES', ids: ['11111111-1111-4111-8111-111111111111'] },
      questions: [{ text: 'Hoe gaat het?', type: 'TEXT_MULTI', required: false, options: [], rows: [] }],
    }).success).toBe(true)
  })

  it('borgt dat de eNPS-hoofdvraag altijd op positie één staat', () => {
    const parsed = enpsCampaignInputSchema.safeParse({
      title: 'eNPS september',
      ...futureWindow,
      reminderIntervalDays: 7,
      scaleType: 'LIKERT_5',
      target: { mode: 'ALL', ids: [] },
      questions: [
        { bankQuestionId: '11111111-1111-4111-8111-111111111111', order: 2, type: 'SCALE_10', mandatory: true, enabled: true },
      ],
    })

    expect(parsed.success).toBe(false)
  })

  it('weigert dubbele en ongeldige inzendingen', () => {
    expect(researchSubmissionSchema.safeParse({
      answers: [
        { questionId: '11111111-1111-4111-8111-111111111111', value: '9' },
        { questionId: '11111111-1111-4111-8111-111111111111', value: '10' },
      ],
    }).success).toBe(false)
  })

  it('valideert beheerbare eNPS-vragenbankinvoer zonder systeemvelden', () => {
    expect(enpsBankCategoryInputSchema.safeParse({ name: 'Onze cultuur' }).success).toBe(true)
    expect(enpsBankQuestionInputSchema.safeParse({ categoryId: '11111111-1111-4111-8111-111111111111', text: 'Ik krijg ruimte om te leren.', type: 'LIKERT_5' }).success).toBe(true)
    expect(enpsBankQuestionInputSchema.safeParse({ categoryId: 'not-an-id', text: 'x', type: 'INVALID', isSystem: true }).success).toBe(false)
  })

  it('accepteert alleen een optioneel geldig medewerker-id voor herinneringen', () => {
    expect(researchReminderSchema.safeParse({}).success).toBe(true)
    expect(researchReminderSchema.safeParse({ employeeId: '11111111-1111-4111-8111-111111111111' }).success).toBe(true)
    expect(researchReminderSchema.safeParse({ employeeId: 'ongeldig' }).success).toBe(false)
  })
})
