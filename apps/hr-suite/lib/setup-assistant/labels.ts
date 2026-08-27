import type { Translator } from '@/lib/i18n/translator'
import {
  SETUP_ASSISTANT_GUIDE,
  type SetupAssistantCategoryKey,
  type SetupAssistantSuggestionKey,
} from './guide'

export interface SetupAssistantLabels {
  title: string
  subtitle: string
  edgeLabel: string
  edgeOpen: string
  close: string
  progress: string
  progressPercent: string
  complete: string
  empty: string
  helpTitle: string
  helpDescription: string
  categoryOpen: string
  categoryClose: string
  markComplete: string
  markIncomplete: string
  openStep: string
  openRelatedStep: string
  suggestionLabel: string
  markReady: string
  notYet: string
  categories: Record<SetupAssistantCategoryKey, { title: string; description: string }>
  steps: Record<string, { title: string; description: string }>
  suggestions: Record<SetupAssistantSuggestionKey, string>
}

export function createSetupAssistantLabels(messages: Translator): SetupAssistantLabels {
  const categories = {} as SetupAssistantLabels['categories']
  const steps = {} as SetupAssistantLabels['steps']
  for (const category of SETUP_ASSISTANT_GUIDE) {
    categories[category.categoryKey] = {
      title: messages(category.titleKey),
      description: messages(category.descriptionKey),
    }
    for (const step of category.steps) {
      steps[step.stepKey] = {
        title: messages(step.titleKey),
        description: messages(step.descriptionKey),
      }
    }
  }

  const suggestionKeys: SetupAssistantSuggestionKey[] = [
    'departments',
    'jobs',
    'hrStructure',
    'companyData',
    'branding',
    'customFields',
    'employees',
    'holidays',
    'leave',
    'absence',
  ]
  const suggestions = {} as SetupAssistantLabels['suggestions']
  for (const key of suggestionKeys) suggestions[key] = messages(`suggestions.${key}`)

  return {
    title: messages('title'),
    subtitle: messages('subtitle'),
    edgeLabel: messages('edgeLabel'),
    edgeOpen: messages('edgeOpen'),
    close: messages('close'),
    progress: messages('progress'),
    progressPercent: messages('progressPercent'),
    complete: messages('complete'),
    empty: messages('empty'),
    helpTitle: messages('helpTitle'),
    helpDescription: messages('helpDescription'),
    categoryOpen: messages('categoryOpen'),
    categoryClose: messages('categoryClose'),
    markComplete: messages('markComplete'),
    markIncomplete: messages('markIncomplete'),
    openStep: messages('openStep'),
    openRelatedStep: messages('openRelatedStep'),
    suggestionLabel: messages('suggestionLabel'),
    markReady: messages('markReady'),
    notYet: messages('notYet'),
    categories,
    steps,
    suggestions,
  }
}
