import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { OpenAIProvider, type OpenAIRequestOptions, type OpenAIResponsesClient, type OpenAIResponsesResult } from './openai-provider'
import type { AiProviderRequest } from './contracts'

function request(overrides: Partial<AiProviderRequest> = {}): AiProviderRequest {
  return {
    invocationId: 'invocation-1',
    featureCode: 'improve-existing-hr-text',
    qualityProfile: 'EFFICIENT',
    writingStyle: 'PLAIN',
    configVersion: 'ai-foundation-1a.20260828.1',
    promptTemplateVersion: 'improve-existing-hr-text.v0',
    technicalLimits: {
      maxInputCharacters: 12_000,
      maxContextItems: 25,
      maxOutputCharacters: 12_000,
      timeoutMs: 20_000,
    },
    authorizedContext: {
      source: { type: 'hr-note', id: 'note-1' },
      fields: { sourceText: 'Maak deze tekst duidelijker.' },
    },
    providerMapping: {
      modelFamily: 'LUNA',
      reasoningProfile: 'MAX',
      generationProfile: 'LUNA_MAX_EFFICIENT',
    },
    ...overrides,
  }
}

describe('OpenAIProvider', () => {
  it('vertaalt de ProviderPort-request naar een Responses-call en mapteert het typed resultaat', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'resp_123',
      model: 'gpt-5.6-luna',
      status: 'completed',
      output_text: JSON.stringify({
        resultType: 'PROPOSAL',
        proposedText: 'Maak deze tekst duidelijker.',
        requiresHumanReview: true,
      }),
      usage: {
        input_tokens: 41,
        output_tokens: 19,
        total_tokens: 60,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens_details: { reasoning_tokens: 4 },
      },
    })
    const client: OpenAIResponsesClient = { responses: { create } }
    const provider = new OpenAIProvider(client, { apiKey: 'unit-test-secret' })

    const result = await provider.execute(request())

    expect(result.output).toEqual({
      resultType: 'PROPOSAL',
      proposedText: 'Maak deze tekst duidelijker.',
      requiresHumanReview: true,
    })
    expect(result.metadata).toEqual({
      providerCode: 'openai-responses',
      modelFamily: 'LUNA',
      modelId: 'gpt-5.6-luna',
      reasoningProfile: 'MAX',
      requestId: 'resp_123',
      usage: { inputUnits: 41, outputUnits: 19 },
    })

    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gpt-5.6-luna',
      reasoning: { effort: 'low' },
      max_output_tokens: 3_000,
      store: false,
      metadata: {
        invocation_id: 'invocation-1',
        feature_code: 'improve-existing-hr-text',
        config_version: 'ai-foundation-1a.20260828.1',
        prompt_template_version: 'improve-existing-hr-text.v0',
      },
      text: expect.objectContaining({
        format: expect.objectContaining({ type: 'json_schema', strict: true }),
      }),
    }), expect.objectContaining({ maxRetries: 0, timeout: 20_000, signal: expect.any(AbortSignal) }))

    const body = create.mock.calls[0]?.[0] as { input?: string; instructions?: string }
    expect(body.instructions?.toLowerCase()).toContain('human review')
    expect(body.input).toContain('Maak deze tekst duidelijker.')
    expect(body.input).not.toContain('unit-test-secret')
  })

  it.each([
    ['authentication', { name: 'AuthenticationError', status: 401 }, 'PROVIDER_FAILED', 'AUTHENTICATION'],
    ['rate limit', { name: 'RateLimitError', status: 429 }, 'PROVIDER_UNAVAILABLE', 'RATE_LIMIT'],
    ['provider unavailable', { name: 'InternalServerError', status: 503 }, 'PROVIDER_UNAVAILABLE', 'UNAVAILABLE'],
  ] as const)('classificeert %s zonder SDK-error naar de caller door te geven', async (_label, error, code, classification) => {
    const create = vi.fn().mockRejectedValue(error)
    const provider = new OpenAIProvider({ responses: { create } }, { apiKey: 'unit-test-secret' })

    await expect(provider.execute(request())).rejects.toMatchObject({ code, classification })
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('classificeert een netwerkfout als provider unavailable', async () => {
    const create = vi.fn().mockRejectedValue({ name: 'APIConnectionError' })
    const provider = new OpenAIProvider({ responses: { create } }, { apiKey: 'unit-test-secret' })

    await expect(provider.execute(request())).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
      classification: 'UNAVAILABLE',
    })
  })

  it.each(['', 'geen geldige json'])('weigert lege of malformed output als invalid response', async (outputText) => {
    const create = vi.fn().mockResolvedValue({ id: 'resp-invalid', model: 'gpt-5.6-luna', status: 'completed', output_text: outputText })
    const provider = new OpenAIProvider({ responses: { create } }, { apiKey: 'unit-test-secret' })

    await expect(provider.execute(request())).rejects.toMatchObject({
      code: 'PROVIDER_FAILED',
      classification: 'INVALID_RESPONSE',
    })
  })

  it('mapteert een provider response-failure zonder raw foutdetails', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'resp-failed',
      model: 'gpt-5.6-luna',
      status: 'failed',
      error: { code: 'server_error' },
      output_text: '',
    })
    const provider = new OpenAIProvider({ responses: { create } }, { apiKey: 'unit-test-secret' })

    await expect(provider.execute(request())).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
      classification: 'UNAVAILABLE',
    })
  })

  function abortAwareClient(errorName: string): OpenAIResponsesClient {
    const create = vi.fn((_body: unknown, options?: OpenAIRequestOptions) => new Promise<OpenAIResponsesResult>((_resolve, reject) => {
      const abort = () => reject({ name: errorName })
      if (options?.signal?.aborted) abort()
      else options?.signal?.addEventListener('abort', abort, { once: true })
    }))
    return { responses: { create } }
  }

  it('breekt een vastgelopen request af op de technische timeout', async () => {
    const provider = new OpenAIProvider(abortAwareClient('AbortError'), { apiKey: 'unit-test-secret' })

    await expect(provider.execute(request({
      technicalLimits: { ...request().technicalLimits, timeoutMs: 5 },
    }))).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE', classification: 'TIMEOUT' })
  })

  it('propageert caller cancellation en breekt de SDK-call af', async () => {
    const controller = new AbortController()
    const provider = new OpenAIProvider(abortAwareClient('AbortError'), { apiKey: 'unit-test-secret' })
    const execution = provider.execute(request({ signal: controller.signal }))
    controller.abort()

    await expect(execution).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE', classification: 'ABORTED' })
  })
})
