import { describe, expect, it } from 'vitest'
import { absenceTaskTemplateCreateSchema, absenceTaskTemplateUpdateSchema } from './task-schemas'

describe('absenceTaskTemplate schemas', () => {
  it('normaliseert codes en accepteert bewijsvelden', () => {
    expect(absenceTaskTemplateCreateSchema.parse({ code: 'plan_van_aanpak', title: 'Plan opvolgen', dueAfterEffectiveDays: '56', evidenceRequired: true, evidenceCategory: 'REINTEGRATION_PLAN' })).toMatchObject({ code: 'PLAN_VAN_AANPAK', dueAfterEffectiveDays: 56, evidenceRequired: true })
  })

  it('vereist een bewijs-categorie wanneer bewijs verplicht is', () => {
    expect(() => absenceTaskTemplateCreateSchema.parse({ code: 'CHECK', title: 'Controle', dueAfterEffectiveDays: 10, evidenceRequired: true })).toThrow()
  })

  it('laat code niet wijzigen in een bestaande taak', () => {
    expect(() => absenceTaskTemplateUpdateSchema.parse({ id: '11111111-1111-4111-8111-111111111111', code: 'OTHER' })).toThrow()
  })
})
