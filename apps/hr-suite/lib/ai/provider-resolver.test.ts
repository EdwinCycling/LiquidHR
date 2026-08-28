import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { DeterministicTestProvider } from './test-provider'
import { resolveServerAiProvider, resolveServerAiRuntimeProviders } from './provider-resolver'
import { OpenAIProvider, type OpenAIResponsesClient } from './openai-provider'
import { InMemoryProviderSafety, SupabaseProviderSafety } from './provider-safety'

describe('server AI provider resolver', () => {
  it.each(['test', 'development'])('gebruikt de deterministische TestProvider in %s', (environment) => {
    expect(resolveServerAiProvider({ environment })).toBeInstanceOf(DeterministicTestProvider)
  })

  it('kiest in production expliciet de OpenAIProvider en faalt gesloten zonder key', () => {
    expect(() => resolveServerAiProvider({ environment: 'production', apiKey: '' }))
      .toThrowError(expect.objectContaining({ code: 'INTERNAL_CONFIGURATION_ERROR' }))
  })

  it('geeft geen TestProvider terug voor production, ook niet bij expliciete testmodus', () => {
    expect(() => resolveServerAiProvider({ environment: 'production', mode: 'TEST' }))
      .toThrowError(expect.objectContaining({ code: 'INTERNAL_CONFIGURATION_ERROR' }))
  })

  it('maakt een OpenAIProvider met configuratie zonder de key terug te geven', () => {
    const client: OpenAIResponsesClient = {
      responses: { create: vi.fn() },
    }

    const provider = resolveServerAiProvider({ environment: 'production', apiKey: 'unit-test-secret', client })

    expect(provider).toBeInstanceOf(OpenAIProvider)
    expect(Object.keys(provider)).not.toContain('apiKey')
  })

  it('resolveert provider en safety samen met TEST-seam of service-only OPENAI safety', () => {
    const testProviders = resolveServerAiRuntimeProviders({ environment: 'test', mode: 'TEST' })
    expect(testProviders.provider).toBeInstanceOf(DeterministicTestProvider)
    expect(testProviders.providerSafety).toBeInstanceOf(InMemoryProviderSafety)

    const client: OpenAIResponsesClient = { responses: { create: vi.fn() } }
    const productionProviders = resolveServerAiRuntimeProviders({
      environment: 'production',
      mode: 'OPENAI',
      apiKey: 'unit-test-secret',
      client,
      safetySource: {
        NODE_ENV: 'production',
        AI_PROVIDER_ENABLED: 'false',
      },
    })
    expect(productionProviders.provider).toBeInstanceOf(OpenAIProvider)
    expect(productionProviders.providerSafety).toBeInstanceOf(SupabaseProviderSafety)
  })
})
