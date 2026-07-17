import { describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import { runHeRaTurn } from './orchestrator'

const context: AuthContext = {
  tenantId: 'tenant-1', administrationId: 'administration-1', userId: 'user-1',
  employeeId: 'employee-1', activeRoles: ['HR_MANAGER'], permissions: ['salary:read'],
}

const userContext = {
  locale: 'nl' as const,
  timeZone: 'Europe/Amsterdam',
  tone: 'BUSINESS' as const,
  detailLevel: 'COMPACT' as const,
  seniorityLevel: 'EXPERT' as const,
  memory: [{ id: 'memory-1', category: 'PREFERENCE' as const, content: 'Antwoord compact.' }],
}

describe('runHeRaTurn', () => {
  it('beantwoordt de salarisvraag pas na geautoriseerd toolbewijs', async () => {
    const generate = vi.fn()
      .mockResolvedValueOnce({
        text: '', model: 'gemini-test',
        toolCall: { name: 'analyze_salary_threshold', args: { amount: 6000, asOfDate: '2026-07-17' } },
      })
      .mockResolvedValueOnce({
        text: 'Ja. Binnen 42 zichtbare maandsalarissen zijn er 3 boven € 6.000.',
        model: 'gemini-test', toolCall: null,
      })
    const evidence = {
      source: 'LIQUID_HR' as const,
      data: { matchedCount: 3, populationCount: 42 },
      scope: { population: 'Zichtbare actuele vaste maandsalarissen', visibleCount: 42 },
      filters: [{ field: 'fulltime_amount', operator: '>', value: '6000' }],
      asOfDate: '2026-07-17',
      uncertainties: [],
    }
    const dispatchTool = vi.fn().mockResolvedValue(evidence)

    const result = await runHeRaTurn({
      context,
      userContext,
      latestUserMessage: 'Zijn er medewerkers die meer dan 6000 euro verdienen?',
      modelContext: 'USER: Zijn er medewerkers die meer dan 6000 euro verdienen?',
      personaInstruction: 'Schrijf precies en datagericht.',
      groundingRequiredMessage: 'Alleen met geautoriseerde data.',
      now: new Date('2026-07-17T10:00:00.000Z'),
    }, { generate, dispatchTool })

    expect(result.content).toContain('3 boven € 6.000')
    expect(result.evidence).toEqual(evidence)
    expect(generate).toHaveBeenCalledTimes(2)
    expect(generate.mock.calls[1]?.[0]).toMatchObject({
      toolResponse: {
        call: { name: 'analyze_salary_threshold' },
        result: evidence,
      },
    })
  })

  it('blokkeert een intern HR-feitantwoord zonder toolbewijs', async () => {
    const result = await runHeRaTurn({
      context,
      userContext,
      latestUserMessage: 'Zijn er medewerkers met een salaris boven 6000 euro?',
      modelContext: 'USER: Zijn er medewerkers met een salaris boven 6000 euro?',
      personaInstruction: 'Schrijf precies.',
      groundingRequiredMessage: 'Ik kan dit alleen beantwoorden met geautoriseerde Liquid HR-data. Geef de ontbrekende scope aan of vraag iemand met de juiste toegang.',
      now: new Date('2026-07-17T10:00:00.000Z'),
    }, {
      generate: async () => ({
        text: 'In Nederland verdienen sommige managers meer dan € 6.000.',
        model: 'gemini-test',
        toolCall: null,
      }),
      dispatchTool: vi.fn(),
    })

    expect(result.content).toBe('Ik kan dit alleen beantwoorden met geautoriseerde Liquid HR-data. Geef de ontbrekende scope aan of vraag iemand met de juiste toegang.')
    expect(result.evidence).toBeNull()
  })
})
