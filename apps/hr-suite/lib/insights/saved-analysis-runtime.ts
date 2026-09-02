import 'server-only'

import type { AnalysisResult } from './analysis-result'
import { executeAnalysisRequest } from './analysis-engine'
import type { AnalysisResultV2 } from './analysis-result-v2'
import type { ValidatedAnalysisRequest } from './analysis-spec-dispatch'
import { getSavedAnalysis, type SavedAnalysisServiceDependencies } from './saved-analysis-service'
import type { SavedAnalysisDefinition } from './saved-analysis-definition'

export interface SavedAnalysisRuntimeDependencies extends SavedAnalysisServiceDependencies {
  readonly execute?: (spec: ValidatedAnalysisRequest) => Promise<AnalysisResult | AnalysisResultV2>
}

export interface SavedAnalysisOpenResult {
  readonly definition: SavedAnalysisDefinition
  readonly result: AnalysisResult | AnalysisResultV2
}

export async function executeSavedAnalysis(id: unknown, dependencies?: SavedAnalysisRuntimeDependencies): Promise<SavedAnalysisOpenResult> {
  const definition = await getSavedAnalysis(id, dependencies)
  const result = await (dependencies?.execute ?? executeAnalysisRequest)(definition.spec)
  return { definition, result }
}
