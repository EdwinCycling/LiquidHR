import type { Database } from '@scope/db'
import type { SupabaseClient } from '@supabase/supabase-js'
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

  it('geeft de archive-publicatie door als succesvolle service-response met slug', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { id: '33333333-3333-4333-8333-333333333333', status: 'ARCHIVED', slug: 'vacancy-11111111' },
      error: null,
    })
    const client = { rpc } as unknown as SupabaseClient<Database>

    await expect(updateRecruitmentPublication({ tenantId: '55555555-5555-4555-8555-555555555555', hrGroupId: '66666666-6666-4666-8666-666666666666' }, '11111111-1111-4111-8111-111111111111', 'ARCHIVED', null, {}, client)).resolves.toEqual({
      id: '33333333-3333-4333-8333-333333333333', status: 'ARCHIVED', slug: 'vacancy-11111111',
    })
    expect(rpc).toHaveBeenCalledWith('publish_recruitment_vacancy', {
      requested_vacancy_id: '11111111-1111-4111-8111-111111111111', requested_status: 'ARCHIVED', requested_slug: null, requested_payload: {},
    })
  })
})
