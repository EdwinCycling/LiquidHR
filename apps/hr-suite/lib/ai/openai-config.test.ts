import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { isOpenAIProviderConfigured, OPENAI_EFFICIENT_MODEL, resolveOpenAIModelConfiguration, resolveOpenAIProviderConfig } from './openai-config'

describe('OpenAI provider configuration', () => {
  it('resolveert de voorbereide Efficient mapping naar GPT-5.6 Luna met lage reasoning', () => {
    expect(resolveOpenAIModelConfiguration({
      modelFamily: 'LUNA',
      reasoningProfile: 'MAX',
      generationProfile: 'LUNA_MAX_EFFICIENT',
    })).toEqual({ model: OPENAI_EFFICIENT_MODEL, reasoningEffort: 'low' })
  })

  it('laat niet-vastgezette modelmappings fail closed', () => {
    expect(() => resolveOpenAIModelConfiguration({
      modelFamily: 'LUNA',
      reasoningProfile: 'MAX',
      generationProfile: 'LUNA_MAX_BALANCED',
    })).toThrowError(expect.objectContaining({ code: 'INTERNAL_CONFIGURATION_ERROR' }))
  })

  it('trimt de server-side key en retourneert geen config zonder key', () => {
    expect(resolveOpenAIProviderConfig({ OPENAI_API_KEY: '  unit-test-secret  ' }).apiKey).toBe('unit-test-secret')
    expect(isOpenAIProviderConfigured({ OPENAI_API_KEY: 'unit-test-secret' })).toBe(true)
    expect(isOpenAIProviderConfigured({ OPENAI_API_KEY: '   ' })).toBe(false)
    expect(() => resolveOpenAIProviderConfig({})).toThrowError(expect.objectContaining({ code: 'INTERNAL_CONFIGURATION_ERROR' }))
  })
})
