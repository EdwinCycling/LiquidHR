import 'server-only'

import type { AnalysisResult } from './analysis-result'
import { executeAnalysisSpec } from './analysis-engine'
import type { ValidatedAnalysisSpec } from './analysis-spec'
import { getSavedAnalysis, type SavedAnalysisServiceDependencies } from './saved-analysis-service'
import type { SavedAnalysisDefinition } from './saved-analysis-definition'

export interface SavedAnalysisRuntimeDependencies extends SavedAnalysisServiceDependencies {
  readonly execute?: (spec: ValidatedAnalysisSpec) => Promise<AnalysisResult>
}

export interface SavedAnalysisOpenResult {
  readonly definition: SavedAnalysisDefinition
  readonly result: AnalysisResult
}

export async function executeSavedAnalysis(id: unknown, dependencies?: SavedAnalysisRuntimeDependencies): Promise<SavedAnalysisOpenResult> {
  const definition = await getSavedAnalysis(id, dependencies)
  const result = await (dependencies?.execute ?? executeAnalysisSpec)(definition.spec)
  return { definition, result }
}
