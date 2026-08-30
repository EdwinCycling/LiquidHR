import 'server-only'

import OpenAI from 'openai'
import type {
  ResponseCreateParamsNonStreaming,
  ResponseFormatTextJSONSchemaConfig,
} from 'openai/resources/responses/responses'
import { AiProviderError, type AiProviderMetadata, type AiProviderRequest, type AiProviderResponse, type ProviderPort } from './contracts'
import { OPENAI_PROVIDER_CODE, type OpenAIEnvironment, type OpenAIProviderConfig, type OpenAIModelConfiguration, OpenAIProviderConfigurationError, resolveOpenAIModelConfiguration, resolveOpenAIProviderConfig } from './openai-config'

export interface OpenAIRequestOptions {
  maxRetries?: number
  timeout?: number
  signal?: AbortSignal | null
}

export interface OpenAIResponseUsage {
  input_tokens?: unknown
  output_tokens?: unknown
}

export interface OpenAIResponsesResult {
  id?: unknown
  model?: unknown
  status?: unknown
  error?: { code?: unknown } | null
  output_text?: unknown
  usage?: OpenAIResponseUsage | null
}

export interface OpenAIResponsesClient {
  responses: {
    create: (
      body: ResponseCreateParamsNonStreaming,
      options?: OpenAIRequestOptions,
    ) => Promise<OpenAIResponsesResult>
  }
}

const proposalResponseFormat: ResponseFormatTextJSONSchemaConfig = {
  type: 'json_schema',
  name: 'liquid_hr_proposal',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      resultType: { type: 'string', enum: ['PROPOSAL'] },
      proposedText: { type: 'string' },
      requiresHumanReview: { type: 'boolean', enum: [true] },
    },
    required: ['resultType', 'proposedText', 'requiresHumanReview'],
  },
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function metadataFor(
  request: AiProviderRequest,
  configuration: OpenAIModelConfiguration,
  response: OpenAIResponsesResult | null,
): AiProviderMetadata {
  const inputUnits = nonNegativeInteger(response?.usage?.input_tokens)
  const outputUnits = nonNegativeInteger(response?.usage?.output_tokens)
  return {
    providerCode: OPENAI_PROVIDER_CODE,
    modelFamily: request.providerMapping.modelFamily,
    modelId: stringValue(response?.model) ?? configuration.model,
    reasoningProfile: request.providerMapping.reasoningProfile,
    requestId: stringValue(response?.id),
    usage: inputUnits === null && outputUnits === null ? null : { inputUnits, outputUnits },
  }
}

function statusOf(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null
  const candidate = (error as { status?: unknown }).status
  return typeof candidate === 'number' && Number.isInteger(candidate) ? candidate : null
}

function nameOf(error: unknown): string {
  if (typeof error !== 'object' || error === null) return ''
  const candidate = (error as { name?: unknown }).name
  return typeof candidate === 'string' ? candidate : ''
}

function providerError(
  error: unknown,
  metadata: AiProviderMetadata,
  timedOut: boolean,
  callerAborted: boolean,
): AiProviderError {
  const name = nameOf(error).toLowerCase()
  const status = statusOf(error)
  if (timedOut || name.includes('timeout')) return new AiProviderError('PROVIDER_UNAVAILABLE', metadata, 'TIMEOUT')
  if (callerAborted || name.includes('abort')) return new AiProviderError('PROVIDER_UNAVAILABLE', metadata, 'ABORTED')
  if (status === 401 || status === 403 || name.includes('authentication')) {
    return new AiProviderError('PROVIDER_FAILED', metadata, 'AUTHENTICATION')
  }
  if (status === 429 || name.includes('ratelimit')) {
    return new AiProviderError('PROVIDER_UNAVAILABLE', metadata, 'RATE_LIMIT')
  }
  if (status !== null && status >= 500 || name.includes('connection')) {
    return new AiProviderError('PROVIDER_UNAVAILABLE', metadata, 'UNAVAILABLE')
  }
  return new AiProviderError('PROVIDER_FAILED', metadata, 'UNKNOWN')
}

function responseError(
  response: OpenAIResponsesResult,
  metadata: AiProviderMetadata,
): AiProviderError | null {
  const code = stringValue(response.error?.code)
  if (response.status === 'failed' || response.status === 'incomplete' || response.error) {
    if (code === 'rate_limit_exceeded') return new AiProviderError('PROVIDER_UNAVAILABLE', metadata, 'RATE_LIMIT')
    if (code === 'server_error') return new AiProviderError('PROVIDER_UNAVAILABLE', metadata, 'UNAVAILABLE')
    if (code === 'invalid_prompt') return new AiProviderError('PROVIDER_FAILED', metadata, 'INVALID_REQUEST')
    return new AiProviderError('PROVIDER_FAILED', metadata, 'UNKNOWN')
  }
  return null
}

function buildInstructions(request: AiProviderRequest): string {
  return [
    'You are the LiquidHR server-side proposal generator.',
    'Return only one JSON proposal matching the supplied structured-output contract.',
    'Transform only the supplied sourceText using the supplied transformation and locale.',
    'Preserve meaning and existing facts. Do not invent information, infer employee facts, add names or details, introduce HR judgments, or add recommendations.',
    'Return only the transformed content required by the response contract.',
    'Do not make HR decisions, do not write data, and do not include provider metadata.',
    'Human review is mandatory for every proposal.',
    `Prompt contract version: ${request.promptTemplateVersion}.`,
  ].join(' ')
}

function buildInput(request: AiProviderRequest): string {
  const fields = request.authorizedContext.fields
  if (Object.keys(fields).length > request.technicalLimits.maxContextItems) {
    throw new OpenAIProviderConfigurationError()
  }
  const input = JSON.stringify(fields)
  if (input.length > request.technicalLimits.maxInputCharacters) throw new OpenAIProviderConfigurationError()
  return input
}

function maxOutputTokens(request: AiProviderRequest, configuration: OpenAIModelConfiguration, globalMaxOutputTokens: number | undefined): number {
  const maxCharacters = request.technicalLimits.maxOutputCharacters
  if (!Number.isSafeInteger(maxCharacters) || maxCharacters <= 0) throw new OpenAIProviderConfigurationError()
  const configured = configuration.maxOutputTokens ?? Math.ceil(maxCharacters / 4)
  if (!Number.isSafeInteger(configured) || configured <= 0) throw new OpenAIProviderConfigurationError()
  const globalCap = globalMaxOutputTokens ?? 4096
  if (!Number.isSafeInteger(globalCap) || globalCap <= 0 || configured > globalCap) throw new OpenAIProviderConfigurationError()
  return configured
}

function timeoutMs(request: AiProviderRequest): number {
  const value = request.technicalLimits.timeoutMs
  if (!Number.isSafeInteger(value) || value <= 0) throw new OpenAIProviderConfigurationError()
  return value
}

function parseOutput(response: OpenAIResponsesResult, metadata: AiProviderMetadata): unknown {
  const text = stringValue(response.output_text)?.trim()
  if (!text) throw new AiProviderError('PROVIDER_FAILED', metadata, 'INVALID_RESPONSE')
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new AiProviderError('PROVIDER_FAILED', metadata, 'INVALID_RESPONSE')
  }
}

export class OpenAIProvider implements ProviderPort {
  private readonly config: OpenAIProviderConfig

  constructor(
    private readonly client: OpenAIResponsesClient,
    config: OpenAIProviderConfig,
  ) {
    this.config = { ...config, maxRetries: 0 }
  }

  async execute(request: AiProviderRequest): Promise<AiProviderResponse> {
    const configuration = resolveOpenAIModelConfiguration(request.providerMapping)
    const requestTimeoutMs = timeoutMs(request)
    const input = buildInput(request)
    const metadata = metadataFor(request, configuration, null)
    const controller = new AbortController()
    let timedOut = false
    let callerAborted = false
    const abortFromCaller = (): void => {
      callerAborted = true
      controller.abort()
    }
    if (request.signal?.aborted) abortFromCaller()
    else request.signal?.addEventListener('abort', abortFromCaller, { once: true })
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, requestTimeoutMs)

    try {
      const response = await this.client.responses.create({
        model: configuration.model,
        instructions: buildInstructions(request),
        input,
        reasoning: { effort: configuration.reasoningEffort },
        max_output_tokens: maxOutputTokens(request, configuration, this.config.globalMaxOutputTokens),
        store: false,
        text: { format: proposalResponseFormat },
        metadata: {
          invocation_id: request.invocationId,
          feature_code: request.featureCode,
          config_version: request.configVersion,
          prompt_template_version: request.promptTemplateVersion,
        },
      }, {
        maxRetries: this.config.maxRetries,
        timeout: requestTimeoutMs,
        signal: controller.signal,
      })
      const responseMetadata = metadataFor(request, configuration, response)
      if (timedOut) throw new AiProviderError('PROVIDER_UNAVAILABLE', responseMetadata, 'TIMEOUT')
      if (callerAborted) throw new AiProviderError('PROVIDER_UNAVAILABLE', responseMetadata, 'ABORTED')
      const failed = responseError(response, responseMetadata)
      if (failed) throw failed
      return { output: parseOutput(response, responseMetadata), metadata: responseMetadata }
    } catch (error) {
      if (error instanceof AiProviderError) throw error
      throw providerError(error, metadata, timedOut, callerAborted)
    } finally {
      clearTimeout(timeout)
      request.signal?.removeEventListener('abort', abortFromCaller)
    }
  }
}

export function createOpenAIProvider(
  environment: OpenAIEnvironment = process.env,
  client?: OpenAIResponsesClient,
): OpenAIProvider {
  const config = resolveOpenAIProviderConfig(environment)
  const resolvedClient = client ?? new OpenAI({ apiKey: config.apiKey, maxRetries: 0 })
  return new OpenAIProvider(resolvedClient, config)
}
