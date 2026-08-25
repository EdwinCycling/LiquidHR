import { describe, expect, it, vi } from 'vitest'
import {
  buildDefaultVacancySections,
  createVacancySlug,
  filterAndSortRecruitmentVacancies,
  paginateRecruitmentVacancies,
  parseRecruitmentVacancyListQuery,
  type RecruitmentVacancyListQuery,
  type VacancySummary,
  updateRecruitmentPublication,
  vacancyInputSchema,
} from './vacancy-service'

function vacancy(overrides: Partial<VacancySummary> = {}): VacancySummary {
  return {
    id: 'vacancy-1',
    title: 'Recruiter',
    locationLabel: 'Amsterdam',
    workMode: 'HYBRID',
    status: 'ACTIVE',
    updatedAt: '2026-08-24T12:00:00.000Z',
    version: 1,
    applicationCount: 3,
    activeApplicationCount: 2,
    publication: { id: 'publication-1', slug: 'recruiter', status: 'OPEN', payload: {} },
    ...overrides,
  }
}

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

  it('normaliseert URL-state en valt veilig terug op de eerste pagina en bekende opties', () => {
    expect(parseRecruitmentVacancyListQuery({ q: '  R4-REC-LIST ', status: 'DRAFT', publication: 'UNPUBLISHED', sort: 'TITLE_ASC', page: '3' })).toEqual({
      q: 'R4-REC-LIST', status: 'DRAFT', publication: 'UNPUBLISHED', sort: 'TITLE_ASC', page: 3,
    })
    expect(parseRecruitmentVacancyListQuery({ status: 'unknown', publication: 'unknown', sort: 'unknown', page: '0' })).toEqual({
      q: '', status: 'ALL', publication: 'ALL', sort: 'UPDATED_DESC', page: 1,
    })
  })

  it('filtert op titel/locatie, vacaturestatus en publicatiestatus', () => {
    const vacancies = [
      vacancy({ id: 'active', title: 'Recruiter', locationLabel: 'Amsterdam', status: 'ACTIVE', publication: { id: 'p1', slug: 'recruiter', status: 'OPEN', payload: {} } }),
      vacancy({ id: 'draft', title: 'HR assistent', locationLabel: 'Utrecht', status: 'DRAFT', publication: null }),
      vacancy({ id: 'closed', title: 'Recruitment lead', locationLabel: 'Rotterdam', status: 'CLOSED', publication: { id: 'p3', slug: 'lead', status: 'CLOSED', payload: {} } }),
    ]

    expect(filterAndSortRecruitmentVacancies(vacancies, { q: 'utrecht', status: 'ALL', publication: 'ALL', sort: 'UPDATED_DESC' }).map((item) => item.id)).toEqual(['draft'])
    expect(filterAndSortRecruitmentVacancies(vacancies, { q: '', status: 'DRAFT', publication: 'UNPUBLISHED', sort: 'UPDATED_DESC' }).map((item) => item.id)).toEqual(['draft'])
    expect(filterAndSortRecruitmentVacancies(vacancies, { q: '', status: 'ALL', publication: 'OPEN', sort: 'UPDATED_DESC' }).map((item) => item.id)).toEqual(['active'])
  })

  it('sorteert en pagineert zonder URL-state te verliezen', () => {
    const vacancies = Array.from({ length: 11 }, (_, index) => vacancy({
      id: `vacancy-${index}`,
      title: `Vacancy ${String(index).padStart(2, '0')}`,
      updatedAt: `2026-08-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
      activeApplicationCount: index,
    }))
    const query: RecruitmentVacancyListQuery = { q: '', status: 'ALL', publication: 'ALL', sort: 'APPLICATIONS_DESC', page: 2 }
    const result = paginateRecruitmentVacancies(vacancies, query)

    expect(result.total).toBe(11)
    expect(result.pageCount).toBe(2)
    expect(result.page).toBe(2)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.activeApplicationCount).toBe(0)
    expect(paginateRecruitmentVacancies(vacancies, { ...query, page: 99 }).page).toBe(2)
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
