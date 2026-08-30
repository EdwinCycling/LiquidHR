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
}

export interface AiUsageTrendPoint {
  date: string
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

export interface AiUsageReport {
  report: 'ai-usage'
  period: AiUsagePeriodSummary
  creditsRemaining: number
  creditsUsed: number
  requests: number
  successRate: number | null
  trend: readonly AiUsageTrendPoint[]
  byFeature: readonly AiUsageBreakdownRow<AiUsageCapability>[]
  byQuality: readonly AiUsageBreakdownRow<AiUsageQuality>[]
  byStatus: readonly AiUsageBreakdownRow<AiUsageStatus>[]
}
