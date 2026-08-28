import 'server-only'
import type { TeamCompassAssessmentLabels } from '@/components/team-compass/team-compass-assessment'
import type { TeamCompassResultLabels } from '@/components/team-compass/team-compass-result'
import type { TeamCompassLabels } from '@/components/team-compass/team-compass-workspace'
import { getTranslator } from '@/lib/i18n/server'

const workspaceKeys = [
  'title', 'eyebrow', 'subtitleAdmin', 'subtitleManager', 'subtitleEmployee', 'disclaimer', 'campaigns', 'teamOverview',
  'myCompass', 'newCampaign', 'editCampaign', 'searchCampaigns', 'searchPlaceholder', 'allStatuses', 'campaignName',
  'description', 'questionnaire', 'departments', 'chooseDepartments', 'startsOn', 'endsOn', 'threshold', 'thresholdHelp',
  'personalMessage', 'saveDraft', 'saving', 'cancel', 'saved', 'failed', 'start', 'close', 'archive', 'open',
  'emptyCampaigns', 'emptyParticipations', 'participants', 'completed', 'progress', 'deadline', 'status', 'actions',
  'statusDraft', 'statusActive', 'statusClosed', 'statusArchived', 'statusInvited', 'statusInProgress', 'statusCompleted',
  'statusDeclined', 'selectCampaign', 'privacyTitle', 'privacyThreshold', 'privacyConsent', 'aggregateAvailable',
  'teamCompass', 'teamMix', 'namedProfiles', 'noNamedProfiles', 'insight', 'balancedInsight', 'focusedInsight',
  'dimensionAction', 'dimensionVision', 'dimensionHarmony', 'dimensionLogic', 'continueAssessment', 'viewResult',
  'managementTitle', 'managementSubtitle', 'confirmStart', 'confirmClose', 'confirmArchive', 'discardTitle', 'discardDescription', 'discardConfirm', 'keepEditing',
] as const satisfies readonly (keyof TeamCompassLabels)[]

const assessmentKeys = [
  'assessmentTitle', 'assessmentIntro', 'questionProgress', 'innerPrompt', 'outerPrompt', 'scoreRarely', 'scoreSometimes',
  'scoreOften', 'previous', 'next', 'saveProgress', 'review', 'reviewTitle', 'reviewComplete', 'shareOuter', 'shareOuterHelp',
  'shareInner', 'shareInnerHelp', 'submit', 'responseSaved', 'responseCompleted', 'failed', 'disclaimer', 'privacyTitle',
] as const satisfies readonly (keyof TeamCompassAssessmentLabels)[]

const resultKeys = [
  'resultTitle', 'resultSubtitle', 'innerStyle', 'outerRole', 'energyShift', 'shiftLow', 'shiftMedium', 'shiftHigh',
  'shiftExplanation', 'strengths', 'watchouts', 'communication', 'backToOverview', 'dimensionAction', 'dimensionVision',
  'dimensionHarmony', 'dimensionLogic', 'disclaimer', 'privacyTitle', 'strengthAction', 'strengthVision', 'strengthHarmony',
  'strengthLogic', 'watchoutAction', 'watchoutVision', 'watchoutHarmony', 'watchoutLogic', 'communicationAction',
  'communicationVision', 'communicationHarmony', 'communicationLogic',
] as const satisfies readonly (keyof TeamCompassResultLabels)[]

async function labelsFor<const Key extends string>(keys: readonly Key[]): Promise<Record<Key, string>> {
  const translate = await getTranslator('teamCompass')
  return Object.fromEntries(keys.map((key) => [key, translate(key)])) as Record<Key, string>
}

export const getTeamCompassWorkspaceLabels = () => labelsFor(workspaceKeys)
export const getTeamCompassAssessmentLabels = () => labelsFor(assessmentKeys)
export const getTeamCompassResultLabels = () => labelsFor(resultKeys)
