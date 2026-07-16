import { describe, expect, it } from 'vitest'
import { getEmploymentImpacts } from './impact-rules'

describe('getEmploymentImpacts', () => {
  it('adviseert salaris en verlof bij een roosterwijziging', () => {
    expect(getEmploymentImpacts('SCHEDULE')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ domain: 'SALARY' }),
        expect.objectContaining({ domain: 'LEAVE' }),
      ]),
    )
  })

  it('adviseert functie en arbeidsvoorwaarden bij salariswijziging', () => {
    expect(getEmploymentImpacts('SALARY')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ domain: 'ORGANIZATION' }),
        expect.objectContaining({ domain: 'LABOR_CONDITIONS' }),
      ]),
    )
  })

  it('adviseert reiskosten bij adreswijziging', () => {
    expect(getEmploymentImpacts('ADDRESS')).toEqual(
      expect.arrayContaining([expect.objectContaining({ domain: 'TRAVEL_ALLOWANCE' })]),
    )
  })
})

