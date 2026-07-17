import { describe, expect, it } from 'vitest'
import { buildModelContext, extractMemoryProposal, resolveMemoryProposal } from './context'

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

  it('herkent een natuurlijke voorkeur zonder te beweren dat die al is opgeslagen', () => {
    expect(extractMemoryProposal('Ik wil graag dat je mij voortaan Edwin noemt.')).toEqual({
      operation: 'CREATE',
      category: 'PREFERENCE',
      content: 'Ik wil graag dat je mij voortaan Edwin noemt.',
    })
  })

  it('maakt bij één bestaande voorkeur een expliciet wijzigingsvoorstel', () => {
    expect(resolveMemoryProposal('Wijzig mijn voorkeur naar: spreek mij aan als Edwin.', [
      { id: 'memory-1', category: 'PREFERENCE', content: 'Spreek mij formeel aan.' },
    ])).toEqual({
      operation: 'UPDATE',
      id: 'memory-1',
      category: 'PREFERENCE',
      content: 'Spreek mij aan als Edwin.',
      currentContent: 'Spreek mij formeel aan.',
    })
  })

  it('maakt bij één bestaande voorkeur een expliciet verwijdervoorstel', () => {
    expect(resolveMemoryProposal('Verwijder mijn voorkeur.', [
      { id: 'memory-1', category: 'PREFERENCE', content: 'Spreek mij formeel aan.' },
    ])).toEqual({
      operation: 'DELETE',
      id: 'memory-1',
      category: 'PREFERENCE',
      content: 'Spreek mij formeel aan.',
    })
  })
})
