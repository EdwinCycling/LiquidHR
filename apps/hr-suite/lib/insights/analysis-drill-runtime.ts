import 'server-only'

import { AnalysisEngineError } from './analysis-errors'
import { buildDrilledAnalysisSpec, type ValidatedAnalysisDrillRequest, validateAnalysisDrillRequest } from './analysis-drill'
import { executeAnalysisSpec, loadAuthorizedAnalysisData, type AnalysisExecutionDependencies } from './analysis-engine'
import type { AnalysisResult } from './analysis-result'

export interface AnalysisDrillResult {
  readonly analysisSpec: ValidatedAnalysisDrillRequest['analysisSpec']
  readonly result: AnalysisResult
}

export async function executeAnalysisDrill(
  input: unknown,
  dependencies: AnalysisExecutionDependencies = {},
): Promise<AnalysisDrillResult> {
  const request = validateAnalysisDrillRequest(input)
  const authorized = await loadAuthorizedAnalysisData(dependencies)
  const sharedDependencies: AnalysisExecutionDependencies = {
    getContext: async () => authorized.context,
    retrieve: async () => authorized.records,
  }
  const currentResult = await executeAnalysisSpec(request.analysisSpec, sharedDependencies)
  const visibleContext = currentResult.rows.some((row) => row.values.dimension === request.contextValue)
  if (!visibleContext) throw new AnalysisEngineError('ANALYSIS_DRILL_CONTEXT_INVALID', 400)

  const analysisSpec = buildDrilledAnalysisSpec(request)
  const result = await executeAnalysisSpec(analysisSpec, sharedDependencies)
  return { analysisSpec, result }
}
