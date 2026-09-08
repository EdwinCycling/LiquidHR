import { describe, expect, it } from 'vitest'

import { createVacancyDraftContextLoader, createVacancyDraftInvocationInput, vacancyDraftRequestSchema } from './vacancy-ai'

const sections = ['INTRODUCTION', 'ROLE', 'PROFILE', 'OFFER', 'PROCESS', 'CONTACT'].map((sectionType, index) => ({ sectionType: sectionType as 'INTRODUCTION' | 'ROLE' | 'PROFILE' | 'OFFER' | 'PROCESS' | 'CONTACT', title: `Section ${index}`, content: index === 0 ? 'Werk met ons team.' : '', isVisible: index !== 5 }))

describe('Vacancy text AI contract', () => {
  it('uses only supplied vacancy facts, excludes salary and supports local block proposals', async () => {
    const request = { vacancy: { title: 'HR adviseur', locationLabel: 'Utrecht', workMode: 'HYBRID' as const, minHours: 32, maxHours: 40, sections }, targetSection: 'ROLE' as const, locale: 'nl' as const }
    expect(vacancyDraftRequestSchema.safeParse(request).success).toBe(true)
    const context = await createVacancyDraftContextLoader({ title: request.vacancy.title, locationLabel: request.vacancy.locationLabel, workMode: request.vacancy.workMode, minHours: request.vacancy.minHours, maxHours: request.vacancy.maxHours, sections: request.vacancy.sections.filter((section) => section.isVisible).map(({ sectionType, title, content }) => ({ sectionType, title, content })), targetSection: 'ROLE', instruction: null }, request).load({ businessObject: { type: 'recruitment-vacancy-draft', id: 'draft-1' } })

    expect(context.fields).toMatchObject({ title: 'HR adviseur', locationLabel: 'Utrecht', workMode: 'HYBRID', minHours: 32, maxHours: 40 })
    expect(context.fields).not.toHaveProperty('targetSection')
    expect(JSON.stringify(context.fields)).not.toContain('50000')
    expect(JSON.stringify(context.fields)).not.toContain('CONTACT')
    expect(context.prompt?.instructions).toContain('alleen de inhoud voor het vacatureblok ROLE')
    expect(createVacancyDraftInvocationInput(request, 'key-1', 'draft-1')).toMatchObject({ featureCode: 'VACANCY_DRAFT', businessPermissionCode: 'recruitment-vacancy:write' })
  })

  it('requires vacancy context for new drafts', () => {
    expect(vacancyDraftRequestSchema.safeParse({ locale: 'nl' }).success).toBe(false)
  })
})
