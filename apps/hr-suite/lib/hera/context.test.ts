import { describe, expect, it } from 'vitest'
import { buildModelContext, extractMemoryProposal } from './context'

describe('buildModelContext', () => {
  it('behoudt samenvatting en de nieuwste berichten binnen het vaste budget', () => {
    const context = buildModelContext({
      summary: 'Open concept: bel medewerker terug op vrijdag.',
      messages: [
        { role: 'USER', content: 'oud bericht' },
        { role: 'ASSISTANT', content: 'ouder antwoord' },
        { role: 'USER', content: 'nieuwste vraag' },
      ],
      maxCharacters: 120,
    })

    expect(context).toContain('Open concept')
    expect(context).toContain('nieuwste vraag')
    expect(context.length).toBeLessThanOrEqual(120)
  })
})

describe('extractMemoryProposal', () => {
  it('bewaart de voorkeur van de gebruiker en nooit het assistentantwoord', () => {
    expect(extractMemoryProposal(
      'Ik geef de voorkeur aan korte, zakelijke antwoorden op senior HR-niveau.',
    )).toEqual({
      operation: 'CREATE',
      category: 'PREFERENCE',
      content: 'Korte, zakelijke antwoorden op senior HR-niveau.',
    })
  })

  it('maakt geen geheugenvoorstel van een gewone HR-vraag', () => {
    expect(extractMemoryProposal('Zijn er medewerkers met een salaris boven 6000 euro?')).toBeNull()
  })
})
