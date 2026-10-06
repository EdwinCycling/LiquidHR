import { describe, expect, it, vi } from 'vitest'
import { buildWorkforceHeRaDeclarations, generateHeRaResponse } from './gemini'

describe('generateHeRaResponse', () => {
  it('gebruikt het geconfigureerde model, houdt de sleutel uit de body en leest typed tool calls', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ functionCall: { name: 'list_my_reminders', args: {} }, thoughtSignature: 'signed-state' }] } }],
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
    expect(result.toolCall).toEqual({ name: 'list_my_reminders', args: {}, thoughtSignature: 'signed-state' })
  })

  it('stuurt een geautoriseerd toolresultaat als native function response terug', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'Er zijn 3 zichtbare resultaten.' }] } }],
    }), { status: 200 }))

    await generateHeRaResponse({
      apiKey: 'secret-key',
      model: 'gemini-3.1-flash-lite',
      systemInstruction: 'Gebruik uitsluitend toolbewijs.',
      context: 'USER: Zijn er salarissen boven 6000 euro?',
      toolResponse: {
        call: { name: 'analyze_salary_threshold', args: { amount: 6000 }, thoughtSignature: 'signed-state' },
        result: { source: 'LIQUID_HR', data: { matchedCount: 3 } },
      },
      fetcher,
    })

    const requestBody = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)) as {
      contents: Array<{ role: string; parts: Array<Record<string, unknown>> }>
    }
    expect(requestBody.contents).toEqual([
      { role: 'user', parts: [{ text: 'USER: Zijn er salarissen boven 6000 euro?' }] },
      { role: 'model', parts: [{ functionCall: { name: 'analyze_salary_threshold', args: { amount: 6000 } }, thoughtSignature: 'signed-state' }] },
      { role: 'user', parts: [{ functionResponse: { name: 'analyze_salary_threshold', response: { source: 'LIQUID_HR', data: { matchedCount: 3 } } } }] },
    ])
  })
})

describe('HeRa workforce declarations', () => {
  it('publishes shared provider-neutral tools with generated bounded input schemas', () => {
    const declarations = buildWorkforceHeRaDeclarations()
    expect(declarations.map((tool) => tool.name)).toContain('workforce_employee_talent_development_plans_read')
    expect(declarations.find((tool) => tool.name === 'workforce_employee_talent_goal_check_ins_read')?.parameters).toMatchObject({
      type: 'OBJECT',
      properties: { goalId: { type: 'STRING' } },
      required: ['goalId'],
    })
    expect(declarations.every((tool) => tool.name.startsWith('workforce_'))).toBe(true)
  })
})
