import 'server-only'

import { AiExecutionError, type AiProviderMapping } from './contracts'
import type { ReasoningEffort } from 'openai/resources/shared'

export const OPENAI_PROVIDER_CODE = 'openai-responses'
export const OPENAI_EFFICIENT_MODEL = 'gpt-5.6-luna'

export interface OpenAIModelConfiguration {
  model: string
  reasoningEffort: Exclude<ReasoningEffort, null>
  maxOutputTokens?: number
}

export interface OpenAIProviderConfig {
  readonly apiKey: string
  readonly maxRetries?: 0
  readonly globalMaxOutputTokens?: number
}

export interface OpenAIEnvironment {
  readonly OPENAI_API_KEY?: string
  readonly [key: string]: string | undefined
}

export class OpenAIProviderConfigurationError extends AiExecutionError {
  readonly name = 'OpenAIProviderConfigurationError'
  readonly classification = 'CONFIGURATION' as const

  constructor() {
    super('INTERNAL_CONFIGURATION_ERROR')
  }
}

const modelConfigurations: Readonly<Record<string, OpenAIModelConfiguration>> = Object.freeze({
  LUNA_MAX_EFFICIENT: {
    model: OPENAI_EFFICIENT_MODEL,
    reasoningEffort: 'low',
  },
})

export function resolveOpenAIModelConfiguration(mapping: AiProviderMapping): OpenAIModelConfiguration {
  if (mapping.modelFamily !== 'LUNA') throw new OpenAIProviderConfigurationError()
  const configuration = modelConfigurations[mapping.generationProfile]
  if (!configuration) throw new OpenAIProviderConfigurationError()
  return configuration
}

export function resolveOpenAIProviderConfig(environment: OpenAIEnvironment = process.env): OpenAIProviderConfig {
  const apiKey = environment.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new OpenAIProviderConfigurationError()
  return { apiKey, maxRetries: 0 }
}

export function isOpenAIProviderConfigured(environment: OpenAIEnvironment = process.env): boolean {
  return Boolean(environment.OPENAI_API_KEY?.trim())
}
