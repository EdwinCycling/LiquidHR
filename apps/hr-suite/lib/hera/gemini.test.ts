import { describe, expect, it, vi } from 'vitest'
import { generateHeRaResponse } from './gemini'

describe('generateHeRaResponse', () => {
  it('gebruikt het geconfigureerde model, houdt de sleutel uit de body en leest typed tool calls', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ functionCall: { name: 'list_my_reminders', args: {} } }] } }],
    }), { status: 200 }))

    const result = await generateHeRaResponse({
      apiKey: 'secret-key',
      model: 'gemini-3.1-flash-lite',
      systemInstruction: 'Wees behulpzaam.',
      context: 'USER: Welke reminders heb ik?',
      fetcher,
    })

    expect(fetcher.mock.calls[0]?.[0]).toContain('models/gemini-3.1-flash-lite:generateContent')
    expect(fetcher.mock.calls[0]?.[0]).toContain('key=secret-key')
    expect(fetcher.mock.calls[0]?.[1]?.body).not.toContain('secret-key')
    expect(result.toolCall).toEqual({ name: 'list_my_reminders', args: {} })
  })
})
