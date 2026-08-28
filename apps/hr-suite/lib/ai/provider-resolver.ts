import 'server-only'

import { DeterministicTestProvider, type TestProviderMode } from './test-provider'
import { OpenAIProviderConfigurationError, resolveOpenAIProviderConfig, type OpenAIEnvironment } from './openai-config'
import { OpenAIProvider, type OpenAIResponsesClient } from './openai-provider'
import type { ProviderPort } from './contracts'
import OpenAI from 'openai'

export type AiProviderMode = 'TEST' | 'OPENAI'

export interface ServerAiProviderResolverInput {
  environment?: string
  mode?: AiProviderMode
  apiKey?: string
  testMode?: TestProviderMode
  client?: OpenAIResponsesClient
}

function defaultMode(environment: string): AiProviderMode {
  return environment === 'test' || environment === 'development' ? 'TEST' : 'OPENAI'
}

export function resolveServerAiProvider(input: ServerAiProviderResolverInput = {}): ProviderPort {
  const nodeEnvironment = input.environment ?? process.env.NODE_ENV ?? 'development'
  const mode = input.mode ?? defaultMode(nodeEnvironment)

  if (nodeEnvironment === 'production' && mode === 'TEST') throw new OpenAIProviderConfigurationError()
  if (mode === 'TEST') return new DeterministicTestProvider(input.testMode)

  const environment: OpenAIEnvironment = { OPENAI_API_KEY: input.apiKey ?? process.env.OPENAI_API_KEY }
  const config = resolveOpenAIProviderConfig(environment)
  const client = input.client ?? new OpenAI({ apiKey: config.apiKey, maxRetries: 0 })
  return new OpenAIProvider(client, config)
}
