import { describe, expect, it } from 'vitest'
import {
  buildDefaultVacancySections,
  canUpdateRecruitmentPublication,
  createVacancySlug,
  publicationRequestSchema,
  vacancyInputSchema,
} from './vacancy-service'

describe('vacancy service contract', () => {
  it('biedt exact zes vaste contentblokken in een stabiele volgorde', () => {
    expect(buildDefaultVacancySections()).toEqual([
      { sectionType: 'INTRODUCTION', title: 'Over de functie', sortOrder: 0, isVisible: true, content: '' },
      { sectionType: 'ROLE', title: 'Jouw rol', sortOrder: 1, isVisible: true, content: '' },
      { sectionType: 'PROFILE', title: 'Wat breng je mee?', sortOrder: 2, isVisible: true, content: '' },
      { sectionType: 'OFFER', title: 'Wat bieden wij?', sortOrder: 3, isVisible: true, content: '' },
      { sectionType: 'PROCESS', title: 'Sollicitatieprocedure', sortOrder: 4, isVisible: true, content: '' },
      { sectionType: 'CONTACT', title: 'Aanvullende informatie', sortOrder: 5, isVisible: true, content: '' },
    ])
  })

  it('maakt een publieke slug zonder vrije HTML of hoofdletters', () => {
    expect(createVacancySlug(' Lead Product Manager — Ground Intelligence ')).toBe('lead-product-manager-ground-intelligence')
  })

  it('valideert gestructureerde vacaturegegevens', () => {
    expect(vacancyInputSchema.safeParse({
      title: 'TEST-RECRUITMENT-Lead Product Manager',
      locationLabel: 'Nootdorp',
      workMode: 'HYBRID',
      minHours: 32,
      maxHours: 40,
      salaryMin: 6500,
      salaryMax: 8000,
      salaryVisible: true,
      sections: buildDefaultVacancySections(),
    }).success).toBe(true)
    expect(vacancyInputSchema.safeParse({ title: '', workMode: 'HYBRID' }).success).toBe(false)
  })

  it('valideert publicatiepayload en vereist een veilige slug voor openen', () => {
    const payload = { companyName: 'LiquidHR', sections: buildDefaultVacancySections(), formConfig: { phone: 'OPTIONAL', cv: 'OPTIONAL', motivation: 'REQUIRED' } }
    expect(publicationRequestSchema.safeParse({ status: 'CLOSED', slug: 'test-vacature', payload }).success).toBe(true)
    expect(publicationRequestSchema.safeParse({ status: 'OPEN', slug: 'Test vacature', payload }).success).toBe(false)
    expect(publicationRequestSchema.safeParse({ status: 'OPEN', payload }).success).toBe(false)
  })

  it('blokkeert herpublicatie van een gearchiveerde vacature', () => {
    expect(canUpdateRecruitmentPublication('DRAFT', 'OPEN')).toBe(true)
    expect(canUpdateRecruitmentPublication('ACTIVE', 'CLOSED')).toBe(true)
    expect(canUpdateRecruitmentPublication('ARCHIVED', 'OPEN')).toBe(false)
    expect(canUpdateRecruitmentPublication('ARCHIVED', 'ARCHIVED')).toBe(true)
  })
})
