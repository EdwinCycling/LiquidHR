import 'server-only'

import type { Tables } from '@scope/db'
import { AI_PERMISSION_CODES, type AiScope, type HrGroupTimeZoneResolver } from '@/lib/ai/contracts'
import { resolveHrGroupTimeZone } from '@/lib/ai/timezone'
import { requireHrGroupId, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAiUsagePeriod, localDateForInstant, type AiUsagePeriodWindow, type AiUsageQuery } from './ai-usage-query'
import type { AiUsageBreakdownRow, AiUsageCapability, AiUsageInvocationSourceRow, AiUsageQuality, AiUsageReport, AiUsageStatus, AiUsageTrendPoint } from './ai-usage-types'

type AiUsageInvocationRow = Pick<Tables<'ai_invocations'>, 'tenant_id' | 'hr_group_id' | 'id' | 'feature_code' | 'quality_profile' | 'execution_status' | 'charged_credits' | 'created_at' | 'finished_at'>
type AiUsageTimestampColumn = 'created_at' | 'finished_at'

const PAGE_SIZE = 500

export class AiUsageInsightsServiceError extends Error {
  constructor(readonly code: string, readonly status = 500) {
    super(code)
    this.name = 'AiUsageInsightsServiceError'
  }
}

export interface AiUsageReportDependencies {
  authorize?: () => Promise<AuthContext>
  clock?: { now: () => Date }
  timeZoneResolver?: HrGroupTimeZoneResolver
  readInvocations?: (scope: AiScope, period: AiUsagePeriodWindow) => Promise<readonly AiUsageInvocationSourceRow[]>
  readBalance?: (scope: AiScope) => Promise<number>
}

function toSourceRow(row: AiUsageInvocationRow): AiUsageInvocationSourceRow {
  return {
    tenantId: row.tenant_id,
    hrGroupId: row.hr_group_id,
    id: row.id,
    featureCode: row.feature_code,
    qualityProfile: row.quality_profile,
    executionStatus: row.execution_status,
    chargedCredits: row.charged_credits,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  }
}

async function readInvocationsByTimestamp(
  scope: AiScope,
  period: AiUsagePeriodWindow,
  timestampColumn: AiUsageTimestampColumn,
): Promise<readonly AiUsageInvocationSourceRow[]> {
  const client = createAdminClient()
  const rows: AiUsageInvocationSourceRow[] = []
  let offset = 0

  while (true) {
    const result = await client
      .from('ai_invocations')
      .select('tenant_id,hr_group_id,id,feature_code,quality_profile,execution_status,charged_credits,created_at,finished_at')
      .eq('tenant_id', scope.tenantId)
      .eq('hr_group_id', scope.hrGroupId)
      .gte(timestampColumn, period.startAt)
      .lt(timestampColumn, period.endAt)
      .order(timestampColumn, { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (result.error) throw new AiUsageInsightsServiceError('INSIGHTS_AI_USAGE_REPORT_FAILED')
    const page = (result.data ?? []) as AiUsageInvocationRow[]
    rows.push(...page.map(toSourceRow))
    if (page.length < PAGE_SIZE) break
    offset += page.length
  }

  return rows
}

async function readInvocations(scope: AiScope, period: AiUsagePeriodWindow): Promise<readonly AiUsageInvocationSourceRow[]> {
  const [createdRows, finishedRows] = await Promise.all([
    readInvocationsByTimestamp(scope, period, 'created_at'),
    readInvocationsByTimestamp(scope, period, 'finished_at'),
  ])
  const byId = new Map<string, AiUsageInvocationSourceRow>()
  for (const row of [...createdRows, ...finishedRows]) byId.set(row.id, row)
  return [...byId.values()]
}

async function readBalance(scope: AiScope): Promise<number> {
  const result = await createAdminClient().rpc('get_ai_group_credit_balance', {
    requested_tenant_id: scope.tenantId,
    requested_hr_group_id: scope.hrGroupId,
  })
  if (result.error || !result.data?.[0] || !Number.isInteger(result.data[0].available_credits) || result.data[0].available_credits < 0) {
    throw new AiUsageInsightsServiceError('INSIGHTS_AI_USAGE_REPORT_FAILED')
  }
  return result.data[0].available_credits
}

function timestampInPeriod(value: string | null, period: AiUsagePeriodWindow): boolean {
  if (!value) return false
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && timestamp >= Date.parse(period.startAt) && timestamp < Date.parse(period.endAt)
}

function capabilityFor(featureCode: string): AiUsageCapability {
  return featureCode === 'improve_text' || featureCode === 'improve-existing-hr-text' ? 'IMPROVE_TEXT' : 'OTHER'
}

function qualityFor(value: string | null): AiUsageQuality {
  return value === 'EFFICIENT' || value === 'BALANCED' || value === 'IN_DEPTH' ? value : 'UNKNOWN'
}

function statusFor(row: AiUsageInvocationSourceRow): AiUsageStatus {
  if (!row.finishedAt) return 'IN_PROGRESS'
  if (row.executionStatus === 'SUCCEEDED' || row.executionStatus === 'FAILED' || row.executionStatus === 'REJECTED') return row.executionStatus
  return 'OTHER'
}

function creditValue(row: AiUsageInvocationSourceRow): number {
  return Number.isInteger(row.chargedCredits) && row.chargedCredits > 0 ? row.chargedCredits : 0
}

function sortBreakdown<T extends string>(rows: readonly AiUsageBreakdownRow<T>[], order: readonly T[]): AiUsageBreakdownRow<T>[] {
  const rank = new Map(order.map((key, index) => [key, index]))
  return [...rows].sort((left, right) => right.creditsUsed - left.creditsUsed || right.requests - left.requests || (rank.get(left.key) ?? order.length) - (rank.get(right.key) ?? order.length))
}

function buildBreakdown<T extends string>(rows: readonly AiUsageInvocationSourceRow[], keyFor: (row: AiUsageInvocationSourceRow) => T): AiUsageBreakdownRow<T>[] {
  const grouped = new Map<T, AiUsageBreakdownRow<T>>()
  for (const row of rows) {
    const key = keyFor(row)
    const current = grouped.get(key) ?? { key, requests: 0, creditsUsed: 0 }
    current.requests += 1
    current.creditsUsed += creditValue(row)
    grouped.set(key, current)
  }
  return [...grouped.values()]
}

function buildTrend(rows: readonly AiUsageInvocationSourceRow[], completedRows: readonly AiUsageInvocationSourceRow[], period: AiUsagePeriodWindow): readonly AiUsageTrendPoint[] {
  const trend: AiUsageTrendPoint[] = []
  const cursor = new Date(`${period.startDate}T00:00:00Z`)
  const end = new Date(`${period.endDate}T00:00:00Z`)
  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10)
    const requests = rows.filter((row) => timestampInPeriod(row.createdAt, period) && localDateForInstant(row.createdAt, period.timeZone) === date).length
    const creditsUsed = completedRows
      .filter((row) => localDateForInstant(row.finishedAt as string, period.timeZone) === date)
      .reduce((sum, row) => sum + creditValue(row), 0)
    trend.push({ date, creditsUsed, requests })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return trend
}

function assertSourceScope(rows: readonly AiUsageInvocationSourceRow[], scope: Pick<AiScope, 'tenantId' | 'hrGroupId'>): void {
  if (rows.some((row) => row.tenantId !== scope.tenantId || row.hrGroupId !== scope.hrGroupId)) {
    throw new AiUsageInsightsServiceError('INSIGHTS_AI_USAGE_SCOPE_VIOLATION', 403)
  }
}

export function buildAiUsageReport(
  period: AiUsagePeriodWindow,
  rows: readonly AiUsageInvocationSourceRow[],
  creditsRemaining: number,
  scope: Pick<AiScope, 'tenantId' | 'hrGroupId'>,
): AiUsageReport {
  if (!Number.isInteger(creditsRemaining) || creditsRemaining < 0) throw new AiUsageInsightsServiceError('INSIGHTS_AI_USAGE_REPORT_FAILED')
  assertSourceScope(rows, scope)

  const requestRows = rows.filter((row) => timestampInPeriod(row.createdAt, period))
  const completedRows = rows.filter((row) => timestampInPeriod(row.finishedAt, period))
  const completedSuccesses = completedRows.filter((row) => row.executionStatus === 'SUCCEEDED')
  const completedFailures = completedRows.filter((row) => row.executionStatus === 'FAILED')
  const denominator = completedSuccesses.length + completedFailures.length
  const byStatus = buildBreakdown([...completedRows, ...requestRows.filter((row) => !row.finishedAt)], statusFor)

  return {
    report: 'ai-usage',
    period: { key: period.period, startDate: period.startDate, endDate: period.endDate },
    creditsRemaining,
    creditsUsed: completedRows.reduce((sum, row) => sum + creditValue(row), 0),
    requests: requestRows.length,
    successRate: denominator ? Math.round((completedSuccesses.length / denominator) * 1000) / 10 : null,
    trend: buildTrend(requestRows, completedRows, period),
    byFeature: sortBreakdown(buildBreakdown(completedRows, (row) => capabilityFor(row.featureCode)), ['IMPROVE_TEXT', 'OTHER']),
    byQuality: sortBreakdown(buildBreakdown(completedRows, (row) => qualityFor(row.qualityProfile)), ['EFFICIENT', 'BALANCED', 'IN_DEPTH', 'UNKNOWN']),
    byStatus: sortBreakdown(byStatus, ['SUCCEEDED', 'FAILED', 'REJECTED', 'IN_PROGRESS', 'OTHER']),
  }
}

export async function getAiUsageReport(query: AiUsageQuery, dependencies: AiUsageReportDependencies = {}): Promise<AiUsageReport> {
  const context = await (dependencies.authorize ?? (() => requirePermission(AI_PERMISSION_CODES.usageRead)))()
  const hrGroupId = requireHrGroupId(context)
  const scope: AiScope = { tenantId: context.tenantId, hrGroupId, administrationId: context.administrationId }
  const timeZone = await resolveHrGroupTimeZone(scope, dependencies.timeZoneResolver)
  const period = resolveAiUsagePeriod(query.period, dependencies.clock?.now() ?? new Date(), timeZone)
  const [rows, creditsRemaining] = await Promise.all([
    dependencies.readInvocations?.(scope, period) ?? readInvocations(scope, period),
    dependencies.readBalance?.(scope) ?? readBalance(scope),
  ])
  return buildAiUsageReport(period, rows, creditsRemaining, scope)
}
