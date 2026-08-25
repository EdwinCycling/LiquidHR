import type { JourneyRuntimeDetail } from './runtime-service'
import { deriveJourneyAttention, type JourneyAttention } from './runtime-domain'

export type JourneyManagementAction = 'PAUSE' | 'RESUME' | 'CANCEL' | 'COMPLETE'

export type JourneyManagementOverview = {
  readonly progress: {
    readonly completed: number
    readonly total: number
    readonly percent: number
  }
  readonly attention: JourneyAttention
  readonly overdueRequiredTopics: number
  readonly activeParticipantCount: number
  readonly phases: readonly {
    readonly id: string
    readonly name: { nl: string; en: string }
    readonly moments: readonly {
      readonly id: string
      readonly name: { nl: string; en: string }
      readonly scheduledOn: string
      readonly availableOn: string
      readonly topics: readonly (JourneyRuntimeDetail['topics'][number] & { readonly overdue: boolean })[]
    }[]
  }[]
}

const terminalStatuses = new Set<JourneyRuntimeDetail['status']>(['COMPLETED', 'CANCELLED'])

export function availableJourneyManagementActions(status: JourneyRuntimeDetail['status']): readonly JourneyManagementAction[] {
  if (status === 'ACTIVE' || status === 'PLANNED') return ['PAUSE', 'COMPLETE', 'CANCEL']
  if (status === 'PAUSED') return ['RESUME', 'CANCEL']
  return []
}

export function buildJourneyManagementOverview(detail: JourneyRuntimeDetail, today = new Date().toISOString().slice(0, 10)): JourneyManagementOverview {
  const completed = detail.topics.filter((topic) => topic.status === 'COMPLETED').length
  const total = detail.topics.length
  const phaseById = new Map(detail.phases.map((phase) => [phase.id, phase]))
  const momentsByPhase = new Map<string, Array<JourneyRuntimeDetail['moments'][number]>>()

  for (const moment of detail.moments) {
    const phaseMoments = momentsByPhase.get(moment.phaseId) ?? []
    phaseMoments.push(moment)
    momentsByPhase.set(moment.phaseId, phaseMoments)
  }

  const phases = [...phaseById.values()].map((phase) => ({
    id: phase.id,
    name: phase.name,
    moments: (momentsByPhase.get(phase.id) ?? []).map((moment) => ({
      id: moment.id,
      name: moment.name,
      scheduledOn: moment.scheduledOn,
      availableOn: moment.availableOn,
      topics: detail.topics
        .filter((topic) => topic.momentId === moment.id)
        .map((topic) => ({
          ...topic,
          overdue: topic.isRequired && topic.status === 'PENDING' && moment.scheduledOn < today,
        })),
    })),
  }))

  const activeParticipantCount = detail.participants.filter((participant) => participant.status === 'ACTIVE' || participant.status === 'ASSIGNED').length
  return {
    progress: { completed, total, percent: total === 0 ? 0 : Math.min(100, Math.round((completed / total) * 100)) },
    attention: deriveJourneyAttention({ status: detail.status, nextMomentOn: detail.nextMomentOn, overdueRequiredTopics: detail.overdueRequiredTopics, today }),
    overdueRequiredTopics: detail.overdueRequiredTopics,
    activeParticipantCount,
    phases,
  }
}

export function isJourneyTerminal(status: JourneyRuntimeDetail['status']): boolean {
  return terminalStatuses.has(status)
}
