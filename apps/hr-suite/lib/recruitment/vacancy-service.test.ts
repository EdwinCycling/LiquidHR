import { describe, expect, it, vi } from 'vitest'
import {
  buildDefaultVacancySections,
  createVacancySlug,
  updateRecruitmentPublication,
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

  it('weigert omgekeerde uren- en salarisranges vóór de databasecall', () => {
    const sections = buildDefaultVacancySections()
    expect(vacancyInputSchema.safeParse({ title: 'TEST-RECRUITMENT-invalid-hours', minHours: 40, maxHours: 32, sections }).success).toBe(false)
    expect(vacancyInputSchema.safeParse({ title: 'TEST-RECRUITMENT-invalid-salary', salaryMin: 8000, salaryMax: 6500, sections }).success).toBe(false)
  })

  it('stuurt bestaande publicatiestatussen ongewijzigd naar het RPC-contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: '11111111-1111-4111-8111-111111111111', status: 'CLOSED', slug: 'test-recruitment-vacancy' }, error: null })
    const supabase = { rpc } as unknown as Parameters<typeof updateRecruitmentPublication>[5]

    await expect(updateRecruitmentPublication(
      { tenantId: '22222222-2222-4222-8222-222222222222', hrGroupId: '33333333-3333-4333-8333-333333333333' },
      '44444444-4444-4444-8444-444444444444',
      'CLOSED',
      null,
      {},
      supabase,
    )).resolves.toEqual({ id: '11111111-1111-4111-8111-111111111111', status: 'CLOSED', slug: 'test-recruitment-vacancy' })
    expect(rpc).toHaveBeenCalledWith('publish_recruitment_vacancy', {
      requested_payload: {},
      requested_slug: null,
      requested_status: 'CLOSED',
      requested_vacancy_id: '44444444-4444-4444-8444-444444444444',
    })
  })
})
