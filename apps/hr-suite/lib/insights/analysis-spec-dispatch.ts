import type { ValidatedAnalysisSpec } from './analysis-spec'
import { validateAnalysisSpec } from './analysis-spec'
import { validateAnalysisSpecV2, type ValidatedAnalysisSpecV2 } from './analysis-spec-v2'

export type ValidatedAnalysisRequest = ValidatedAnalysisSpec | ValidatedAnalysisSpecV2

export function validateAnalysisRequest(input: unknown): ValidatedAnalysisRequest {
  if (typeof input === 'object' && input !== null && 'version' in input && input.version === 2) {
    return validateAnalysisSpecV2(input)
  }
  return validateAnalysisSpec(input)
}
