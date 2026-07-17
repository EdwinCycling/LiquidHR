import { z } from 'zod'

const providerResponseSchema = z.object({
  candidates: z.array(z.object({
    content: z.object({
      parts: z.array(z.object({
        text: z.string().optional(),
        functionCall: z.object({
          name: z.string(),
          args: z.record(z.string(), z.unknown()).optional(),
        }).optional(),
      })),
    }),
  })).min(1),
})

export interface HeRaToolCall {
  name: string
  args: Record<string, unknown>
}

export interface GenerateHeRaResponseInput {
  apiKey?: string
  model?: string
  systemInstruction: string
  context: string
  toolResponse?: {
    call: HeRaToolCall
    result: Record<string, unknown>
  }
  fetcher?: typeof fetch
}

export interface HeRaGeneration {
  text: string
  toolCall: HeRaToolCall | null
  model: string
}

export class HeRaProviderError extends Error {
  constructor(readonly code: 'HERA_PROVIDER_UNAVAILABLE' | 'HERA_PROVIDER_INVALID_RESPONSE') {
    super(code)
  }
}

export async function generateHeRaResponse(input: GenerateHeRaResponseInput): Promise<HeRaGeneration> {
  const apiKey = input.apiKey ?? process.env.GEMINI_KEY
  const model = input.model ?? process.env.GEMINI_MODEL
  if (!apiKey || !model) throw new HeRaProviderError('HERA_PROVIDER_UNAVAILABLE')

  const fetcher = input.fetcher ?? fetch
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const contents: Array<{ role: 'user' | 'model'; parts: Array<Record<string, unknown>> }> = [
    { role: 'user', parts: [{ text: input.context }] },
  ]
  if (input.toolResponse) {
    contents.push(
      {
        role: 'model',
        parts: [{ functionCall: input.toolResponse.call }],
      },
      {
        role: 'user',
        parts: [{
          functionResponse: {
            name: input.toolResponse.call.name,
            response: input.toolResponse.result,
          },
        }],
      },
    )
  }
  const response = await fetcher(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.systemInstruction }] },
      contents,
      tools: [{ functionDeclarations: [
        { name: 'get_my_profile', description: 'Lees alleen de eigen basisgegevens.', parameters: { type: 'OBJECT', properties: {} } },
        { name: 'list_my_reminders', description: 'Lees alleen de eigen reminders.', parameters: { type: 'OBJECT', properties: {} } },
        {
          name: 'analyze_salary_threshold',
          description: 'Tel uitsluitend de voor de gebruiker zichtbare actuele vaste maandsalarissen boven een grensbedrag.',
          parameters: {
            type: 'OBJECT',
            properties: {
              amount: { type: 'NUMBER' },
              asOfDate: { type: 'STRING', description: 'Peildatum in YYYY-MM-DD.' },
            },
            required: ['amount', 'asOfDate'],
          },
        },
        {
          name: 'search_visible_employees',
          description: 'Zoek uitsluitend minimale gegevens van medewerkers die de gebruiker mag zien.',
          parameters: {
            type: 'OBJECT',
            properties: { query: { type: 'STRING' }, limit: { type: 'NUMBER' } },
            required: ['query'],
          },
        },
        {
          name: 'get_visible_employment',
          description: 'Lees een zichtbaar dienstverband voor één medewerker en peildatum, zonder salarisvelden.',
          parameters: {
            type: 'OBJECT',
            properties: {
              employeeId: { type: 'STRING' },
              asOfDate: { type: 'STRING', description: 'Peildatum in YYYY-MM-DD.' },
            },
            required: ['employeeId', 'asOfDate'],
          },
        },
        {
          name: 'get_visible_organization',
          description: 'Lees zichtbare afdelingen en aantallen zichtbare actuele plaatsingen.',
          parameters: {
            type: 'OBJECT',
            properties: {
              asOfDate: { type: 'STRING', description: 'Peildatum in YYYY-MM-DD.' },
              departmentId: { type: 'STRING' },
            },
            required: ['asOfDate'],
          },
        },
        {
          name: 'draft_personal_reminder',
          description: 'Bereid uitsluitend een persoonlijk reminderconcept voor; voer niets uit.',
          parameters: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING' },
              remindAt: { type: 'STRING' },
              description: { type: 'STRING' },
            },
            required: ['title', 'remindAt'],
          },
        },
      ] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
    }),
  })

  if (!response.ok) throw new HeRaProviderError('HERA_PROVIDER_UNAVAILABLE')
  const parsed = providerResponseSchema.safeParse(await response.json())
  if (!parsed.success) throw new HeRaProviderError('HERA_PROVIDER_INVALID_RESPONSE')

  const parts = parsed.data.candidates[0].content.parts
  const functionCall = parts.find((part) => part.functionCall)?.functionCall
  return {
    text: parts.flatMap((part) => part.text ? [part.text] : []).join('').trim(),
    toolCall: functionCall ? { name: functionCall.name, args: functionCall.args ?? {} } : null,
    model,
  }
}
