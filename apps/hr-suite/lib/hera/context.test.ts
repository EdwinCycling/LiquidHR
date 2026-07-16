import { describe, expect, it } from 'vitest'
import { buildModelContext } from './context'

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
