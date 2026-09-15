export type AiUsageCapability = 'IMPROVE_TEXT' | 'OTHER'
export type AiUsageQuality = 'EFFICIENT' | 'BALANCED' | 'IN_DEPTH' | 'UNKNOWN'
export type AiUsageStatus = 'SUCCEEDED' | 'FAILED' | 'REJECTED' | 'IN_PROGRESS' | 'OTHER'

export interface AiUsageInvocationSourceRow {
  tenantId: string
  hrGroupId: string
  id: string
  featureCode: string
  qualityProfile: string | null
  executionStatus: string
  chargedCredits: number
  createdAt: string
  finishedAt: string | null
  invocationOrigin?: string
}

export interface AiUsageVoiceSourceRow {
  tenantId: string
  hrGroupId: string
  id: string
  contextType: string
  sessionStatus: string
  terminationReason: string
  durationSeconds: number
  billableVoiceUnits: number
  voiceCredits: number
  startedAt: string
  endedAt: string
}

export interface AiUsageTrendPoint {
  date: string
  capabilityCredits: number
  voiceCredits: number
  creditsUsed: number
  requests: number
}

export interface AiUsageBreakdownRow<T> {
  key: T
  requests: number
  creditsUsed: number
}

export interface AiUsagePeriodSummary {
  key: string
  startDate: string
  endDate: string
}

export interface AiUsageVoiceSummary {
  sessions: number
  totalDurationSeconds: number
  averageDurationSeconds: number | null
  voiceCredits: number
  successful: number
  failed: number
  cancelled: number
  byContext: {
    employee: number
    team: number
    other: number
  }
}

export interface AiUsageReport {
  report: 'ai-usage'
  period: AiUsagePeriodSummary
  creditsRemaining: number
  capabilityCredits: number
  voiceCredits: number
  combinedCredits: number
  creditsUsed: number
  requests: number
  successRate: number | null
  trend: readonly AiUsageTrendPoint[]
  byFeature: readonly AiUsageBreakdownRow<AiUsageCapability>[]
  byQuality: readonly AiUsageBreakdownRow<AiUsageQuality>[]
  byStatus: readonly AiUsageBreakdownRow<AiUsageStatus>[]
  voice: AiUsageVoiceSummary
}
