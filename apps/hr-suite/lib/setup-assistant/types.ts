import type { SetupAssistantSuggestionKey } from './guide'

export interface SetupAssistantSuggestion {
  stepKey: string
  suggestionKey: SetupAssistantSuggestionKey
  count: number
}

export interface SetupAssistantState {
  guideCode: 'CORE'
  isEnabled: boolean
  canWrite: boolean
  visibleStepKeys: string[]
  availableRelatedRouteKeys: string[]
  completedStepKeys: string[]
  suggestions: SetupAssistantSuggestion[]
}
