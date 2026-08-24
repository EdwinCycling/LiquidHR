import { getTranslator } from '@/lib/i18n/server'

const journeyTypes = ['PREBOARDING', 'ONBOARDING', 'REBOARDING', 'INTERNAL_TRANSFER', 'PROMOTION', 'RETURN', 'OFFBOARDING', 'CUSTOM'] as const
const anchors = ['EMPLOYMENT_START_DATE', 'MANUAL_DATE'] as const
const resolvers = ['TARGET_EMPLOYEE', 'DIRECT_MANAGER', 'DEPARTMENT_MANAGER', 'SPECIFIC_EMPLOYEE', 'MANUAL'] as const
const topicTypes = ['INFORMATION', 'ACTION', 'CHECK_IN', 'DOCUMENT'] as const

export async function getJourneyLabels() {
  const t = await getTranslator('journeys')
  const keys = [
    'eyebrow', 'catalogTitle', 'catalogSubtitle', 'designerTitle', 'designerSubtitle', 'backToSettings', 'backToCatalog',
    'search', 'newTemplate', 'noTemplates', 'noResults', 'name', 'description', 'key', 'type', 'anchor', 'status', 'version',
    'draftRevision', 'updated', 'draft', 'published', 'retired', 'create', 'cancel', 'close', 'discardTitle', 'discardDescription', 'discardConfirm', 'discardCancel', 'save', 'saving', 'saved',
    'publish', 'publishConfirm', 'publishing', 'publishedMessage', 'retire', 'failed', 'invalid', 'nl', 'en', 'phases',
    'roles', 'moments', 'topics', 'audience', 'addPhase', 'addRole', 'addMoment', 'addTopic', 'remove', 'required',
    'moveUp', 'moveDown', 'optional', 'sortOrder', 'phase', 'moment', 'ownerRole', 'resolver', 'cardinality', 'resolverRole', 'specificEmployee',
    'dateOffset', 'availabilityOffset', 'topicType', 'body', 'actionUrl', 'one', 'many', 'languageHint', 'immutableHint',
    'moduleDisabled', 'liveTitle', 'liveSubtitle', 'startJourney', 'searchJourneys', 'allStatuses', 'noJourneys',
    'targetEmployee', 'participantsLabel', 'anchorDate', 'nextMoment', 'attention', 'planned', 'active', 'paused',
    'completed', 'cancelled', 'upcoming', 'newTitle', 'newSubtitle', 'selectTemplate', 'selectEmployee',
    'selectEmployment', 'noEmployment', 'continue', 'back', 'resolveTeam', 'preview', 'activate', 'activating',
    'automatic', 'manualSelection', 'missingRequired', 'missingOptional', 'ambiguous', 'activationBlocked',
    'detailTitle', 'timeline', 'topicsLabel', 'pause', 'resume', 'complete', 'cancelJourney', 'replaceParticipant',
    'replacement', 'replacementReason', 'saveReplacement', 'history', 'noHistory', 'operationFailed', 'overdueTopics',
    'participantAssigned', 'participantActive', 'participantReplaced', 'participantRemoved',
    'topicPending', 'topicCompleted', 'topicSkipped', 'participantTitle', 'participantSubtitle', 'progress', 'nextAction', 'available', 'upcomingTopic',
    'completeTopic', 'skipTopic', 'topicDetails', 'openTopicAction', 'outcomeSaved', 'topicActionFailed',
  ] as const
  return {
    ...Object.fromEntries(keys.map((key) => [key, t(key)])) as Record<(typeof keys)[number], string>,
    types: Object.fromEntries(journeyTypes.map((key) => [key, t(`types.${key}`)])) as Record<(typeof journeyTypes)[number], string>,
    anchors: Object.fromEntries(anchors.map((key) => [key, t(`anchors.${key}`)])) as Record<(typeof anchors)[number], string>,
    resolvers: Object.fromEntries(resolvers.map((key) => [key, t(`resolvers.${key}`)])) as Record<(typeof resolvers)[number], string>,
    topicTypes: Object.fromEntries(topicTypes.map((key) => [key, t(`topicTypes.${key}`)])) as Record<(typeof topicTypes)[number], string>,
  }
}

export type JourneyLabels = Awaited<ReturnType<typeof getJourneyLabels>>
