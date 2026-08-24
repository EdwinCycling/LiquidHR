import { describe, expect, it } from 'vitest'

import { applicantBelongsToVacancy, applicantDetailRouteParamsSchema } from './applicant-detail-service'

const vacancyId = '11111111-1111-4111-8111-111111111111'
const otherVacancyId = '22222222-2222-4222-8222-222222222222'
const applicantId = '33333333-3333-4333-8333-333333333333'

describe('recruitment applicant detail service', () => {
  it('valideert de nested vacancy/application routeparameters', () => {
    expect(applicantDetailRouteParamsSchema.parse({ vacancyId, applicantId })).toEqual({ vacancyId, applicantId })
    expect(applicantDetailRouteParamsSchema.safeParse({ vacancyId: 'not-a-guid', applicantId }).success).toBe(false)
  })

  it('levert alleen de application terug binnen de gevraagde vacaturecontext', () => {
    expect(applicantBelongsToVacancy({ vacancyId }, vacancyId)).toBe(true)
    expect(applicantBelongsToVacancy({ vacancyId }, otherVacancyId)).toBe(false)
  })
})
