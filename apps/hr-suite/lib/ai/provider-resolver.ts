import 'server-only'

import { DeterministicTestProvider, type TestProviderMode } from './test-provider'
import { OpenAIProviderConfigurationError, resolveOpenAIProviderConfig, type OpenAIEnvironment } from './openai-config'
import { OpenAIProvider, type OpenAIResponsesClient } from './openai-provider'
import type { ProviderPort, ProviderSafetyPort } from './contracts'
import { InMemoryProviderSafety, resolveProviderSafetyConfig, SupabaseProviderSafety, type ProviderSafetyEnvironmentSource, type ProviderSafetyRpcClient } from './provider-safety'
import OpenAI from 'openai'

export type AiProviderMode = 'TEST' | 'OPENAI'

export interface ServerAiProviderResolverInput {
  environment?: string
  mode?: AiProviderMode
  apiKey?: string
  testMode?: TestProviderMode
  client?: OpenAIResponsesClient
}

export interface ServerAiRuntimeResolverInput extends ServerAiProviderResolverInput {
  safetySource?: ProviderSafetyEnvironmentSource
  safetyClient?: ProviderSafetyRpcClient
}

export interface ServerAiRuntimeProviders {
  provider: ProviderPort
  providerSafety: ProviderSafetyPort
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

export function resolveServerAiRuntimeProviders(input: ServerAiRuntimeResolverInput = {}): ServerAiRuntimeProviders {
  const nodeEnvironment = input.environment ?? process.env.NODE_ENV ?? 'development'
  const mode = input.mode ?? defaultMode(nodeEnvironment)
  if (nodeEnvironment === 'production' && mode === 'TEST') throw new OpenAIProviderConfigurationError()

  const safetySource: ProviderSafetyEnvironmentSource = input.safetySource ?? { ...process.env, NODE_ENV: nodeEnvironment }
  const safetyConfig = resolveProviderSafetyConfig(safetySource, mode)
  if (mode === 'TEST') {
    return {
      provider: new DeterministicTestProvider(input.testMode),
      providerSafety: new InMemoryProviderSafety(safetyConfig, { now: () => new Date() }),
    }
  }

  const environment: OpenAIEnvironment = { OPENAI_API_KEY: input.apiKey ?? process.env.OPENAI_API_KEY }
  const config = resolveOpenAIProviderConfig(environment)
  const client = input.client ?? new OpenAI({ apiKey: config.apiKey, maxRetries: 0 })
  return {
    provider: new OpenAIProvider(client, { ...config, globalMaxOutputTokens: safetyConfig.globalMaxOutputTokens }),
    providerSafety: new SupabaseProviderSafety(safetyConfig, input.safetyClient),
  }
}
