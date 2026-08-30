import { AiProviderError, type AiProviderRequest, type AiProviderResponse, type ProviderPort } from './contracts'

export type TestProviderMode = 'SUCCESS' | 'UNAVAILABLE' | 'FAILED' | 'INVALID_RESULT'

export class DeterministicTestProvider implements ProviderPort {
  readonly calls: AiProviderRequest[] = []

  constructor(private readonly mode: TestProviderMode = 'SUCCESS') {}

  async execute(request: AiProviderRequest): Promise<AiProviderResponse> {
    this.calls.push(request)

    const metadata = {
      providerCode: 'test-provider',
      modelFamily: 'LUNA',
      reasoningProfile: 'MAX',
      requestId: `test-request-${this.calls.length}`,
      usage: { inputUnits: 10, outputUnits: 5 },
    }

    if (this.mode === 'UNAVAILABLE') throw new AiProviderError('PROVIDER_UNAVAILABLE', metadata)
    if (this.mode === 'FAILED') throw new AiProviderError('PROVIDER_FAILED', metadata)
    if (this.mode === 'INVALID_RESULT') return { output: { invalid: true }, metadata }

    const sourceText = request.authorizedContext.fields.sourceText
    const proposedText = request.featureCode === 'improve-existing-hr-text' && typeof sourceText === 'string'
      ? sourceText.trim()
      : `Test proposal for ${request.featureCode}`

    return {
      output: {
        resultType: 'PROPOSAL',
        proposedText,
        requiresHumanReview: true,
      },
      metadata,
    }
  }
}
