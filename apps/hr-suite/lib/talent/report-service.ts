import type { TablesInsert } from '@scope/db'
import { requireAuthContext, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import { listMyTalentEmployeeCapabilityRecords, listTalentEmployeeCapabilityRecords, type TalentEmployeeCapabilityRecord } from './employee-capability-service'
import { listTalentGoals, type TalentGoal } from './goal-service'
import type { TalentReportMode, TalentReportQuery } from './report-schemas'

export class TalentReportError extends Error {
  constructor(public readonly code: string, public readonly status = 500) {
    super(code)
    this.name = 'TalentReportError'
  }
}

export type TalentReportGoalRow = {
  employeeId: string
  employeeLabel: string | null
  title: string
  status: string
  progressPercent: number
  periodStart: string
  periodEnd: string | null
  capabilityLabel: string | null
}

export type TalentReportCapabilityRow = {
  employeeId: string
  employeeLabel: string
  capabilityCode: string
  capabilityName: string
  capabilityType: string
  status: string
  sourceType: string
  validFrom: string
  validUntil: string | null
  evidenceStatus: string | null
  talentLevelName: string | null
}

export type TalentReportWorkspace = {
  mode: TalentReportMode
  query: TalentReportQuery
  population: {
    scope: 'tenant' | 'manager' | 'self'
    employeeCount: number
    rowCount: number
  }
  goals: TalentReportGoalRow[]
  capabilities: TalentReportCapabilityRow[]
}

async function authorize(mode: TalentReportMode): Promise<AuthContext> {
  if (mode === 'admin') return requirePermission('talent-report:read')
  if (mode === 'manager') return requirePermission('talent-report:read')
  return requirePermission('self:talent-report:read')
}

function mapGoal(goal: TalentGoal): TalentReportGoalRow {
  return {
    employeeId: goal.employee_id,
    employeeLabel: goal.employeeLabel,
    title: goal.title,
    status: goal.status,
    progressPercent: goal.progress_percent,
    periodStart: goal.period_start,
    periodEnd: goal.period_end,
    capabilityLabel: goal.capabilityLabel,
  }
}

function mapCapability(record: TalentEmployeeCapabilityRecord): TalentReportCapabilityRow {
  return {
    employeeId: record.employeeId,
    employeeLabel: record.employeeLabel,
    capabilityCode: record.capabilityCode,
    capabilityName: record.capabilityName,
    capabilityType: record.capabilityType,
    status: record.status,
    sourceType: record.sourceType,
    validFrom: record.validFrom,
    validUntil: record.validUntil,
    evidenceStatus: record.evidenceStatus,
    talentLevelName: record.talentLevelName,
  }
}

function overlapsPeriod(start: string, end: string | null, periodFrom?: string, periodTo?: string): boolean {
  if (periodFrom && end && end < periodFrom) return false
  if (periodTo && start > periodTo) return false
  return true
}

export function matchesTalentReportTimeframe(start: string, end: string | null, timeframe: TalentReportQuery['timeframe'], today: string): boolean {
  if (timeframe === 'all') return true
  const isCurrent = start <= today && (!end || end >= today)
  return timeframe === 'current' ? isCurrent : Boolean(end && end < today)
}

function normalizedQuery(mode: TalentReportMode, query: TalentReportQuery): TalentReportQuery {
  return {
    mode,
    reportType: query.reportType ?? 'all',
    timeframe: query.timeframe ?? 'all',
    employeeId: query.employeeId,
    goalStatus: query.goalStatus,
    recordStatus: query.recordStatus,
    periodFrom: query.periodFrom,
    periodTo: query.periodTo,
  }
}

export async function listTalentReport(mode: TalentReportMode, query: TalentReportQuery = { mode, reportType: 'all', timeframe: 'all' }): Promise<TalentReportWorkspace> {
  await authorize(mode)
  await requireTenantModule('TALENT')
  const filters = normalizedQuery(mode, query)
  const employeeId = mode === 'self' ? undefined : query.employeeId
  const goalWorkspace = filters.reportType === 'capabilities'
    ? { goals: [] as TalentGoal[] }
    : await listTalentGoals(mode, { employeeId, status: filters.goalStatus }, { includeOptions: false })
  const capabilityRecords = filters.reportType === 'goals'
    ? [] as TalentEmployeeCapabilityRecord[]
    : mode === 'self'
      ? await listMyTalentEmployeeCapabilityRecords()
      : await listTalentEmployeeCapabilityRecords({ employeeId, status: filters.recordStatus })
  const today = new Date().toISOString().slice(0, 10)
  const goals = filters.reportType === 'capabilities' ? [] : goalWorkspace.goals
    .filter((goal) => overlapsPeriod(goal.period_start, goal.period_end, filters.periodFrom, filters.periodTo))
    .filter((goal) => matchesTalentReportTimeframe(goal.period_start, goal.period_end, filters.timeframe, today))
    .map(mapGoal)
  const capabilities = filters.reportType === 'goals' ? [] : capabilityRecords
    .filter((record) => overlapsPeriod(record.validFrom, record.validUntil, filters.periodFrom, filters.periodTo))
    .filter((record) => matchesTalentReportTimeframe(record.validFrom, record.validUntil, filters.timeframe, today))
    .map(mapCapability)
  const employeeIds = new Set([...goals.map((goal) => goal.employeeId), ...capabilities.map((record) => record.employeeId)])
  return {
    mode,
    query: filters,
    population: {
      scope: mode === 'admin' ? 'tenant' : mode === 'manager' ? 'manager' : 'self',
      employeeCount: employeeIds.size,
      rowCount: goals.length + capabilities.length,
    },
    goals,
    capabilities,
  }
}

function csvCell(value: string | number | null): string {
  const raw = value === null ? '' : String(value)
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw
  return `"${safe.replaceAll('"', '""')}"`
}

export function talentReportCsv(report: TalentReportWorkspace): string {
  const header = ['record_type', 'employee', 'goal_or_capability', 'status', 'progress_percent', 'period_start', 'period_end', 'valid_from', 'valid_until', 'capability_type', 'source_type', 'evidence_status', 'talent_level']
  const goalRows = report.goals.map((goal) => [
    'goal', goal.employeeLabel, goal.title, goal.status, goal.progressPercent, goal.periodStart, goal.periodEnd, null, null, null, null, null, goal.capabilityLabel,
  ])
  const capabilityRows = report.capabilities.map((record) => [
    'capability', record.employeeLabel, `${record.capabilityName} (${record.capabilityCode})`, record.status, null, null, null, record.validFrom, record.validUntil, record.capabilityType, record.sourceType, record.evidenceStatus, record.talentLevelName,
  ])
  return [header, ...goalRows, ...capabilityRows].map((row) => row.map((value) => csvCell(value)).join(',')).join('\r\n') + '\r\n'
}

export async function auditTalentReportExport(mode: TalentReportMode, query: TalentReportQuery, recordCount: number): Promise<void> {
  const context = await requireAuthContext()
  const supabase = await createClient()
  const changes = {
      format: 'csv',
      scope: mode,
      record_count: recordCount,
      filters: {
        report_type: query.reportType ?? 'all',
        timeframe: query.timeframe ?? 'all',
        employee_filtered: Boolean(query.employeeId && mode !== 'self'),
      goal_status: query.goalStatus ?? null,
      record_status: query.recordStatus ?? null,
      period_from: query.periodFrom ?? null,
      period_to: query.periodTo ?? null,
    },
    source_channel: 'WEB',
  }
  const insert: TablesInsert<'audit_logs'> = {
    tenant_id: context.tenantId,
    administration_id: null,
    entity_name: 'talent_export',
    entity_id: context.tenantId,
    actor_user_id: context.userId,
    action: 'EXPORT',
    changes,
  }
  const { error } = await supabase.from('audit_logs').insert(insert)
  if (error) throw new TalentReportError('TALENT_EXPORT_AUDIT_FAILED', 500)
}
