import { NextResponse } from 'next/server'
import { saveInsightsPreferences, type StoredInsightFilters } from '@/lib/preferences/insights'

const employeeReports = new Set(['employee-department', 'employee-gender', 'employee-age', 'terminations'])

function strings(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.length <= 500 && value.every((item) => typeof item === 'string' && item.length <= 160) ? value : undefined
}

function parseFilters(value: unknown): StoredInsightFilters | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const input = value as Record<string, unknown>
  const filters: StoredInsightFilters = {}
  if (typeof input.groupBy === 'string' && input.groupBy.length <= 32) filters.groupBy = input.groupBy
  if (typeof input.year === 'number' && Number.isInteger(input.year) && input.year >= 2000 && input.year <= 2100) filters.year = input.year
  if (typeof input.month === 'number' && Number.isInteger(input.month) && input.month >= 1 && input.month <= 12) filters.month = input.month
  if (typeof input.fullYear === 'boolean') filters.fullYear = input.fullYear
  if (typeof input.sortBy === 'string' && input.sortBy.length <= 32) filters.sortBy = input.sortBy
  const teams = strings(input.teams); if (teams) filters.teams = teams
  const segments = strings(input.segments); if (segments) filters.segments = segments
  const reasons = strings(input.reasons); if (reasons) filters.reasons = reasons
  if (input.employeeStatus === 'all' || input.employeeStatus === 'active' || input.employeeStatus === 'former') filters.employeeStatus = input.employeeStatus
  return filters
}

export async function PATCH(request: Request) {
  const body: unknown = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
  const input = body as Record<string, unknown>
  if (typeof input.preserveFilters !== 'boolean' || typeof input.selectionPanelOpen !== 'boolean') return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
  const report = typeof input.report === 'string' && employeeReports.has(input.report) ? input.report as 'employee-department' | 'employee-gender' | 'employee-age' | 'terminations' : undefined
  const filters = parseFilters(input.filters)
  if (input.filters !== undefined && !filters) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
  const saved = await saveInsightsPreferences({ preserveFilters: input.preserveFilters, selectionPanelOpen: input.selectionPanelOpen, report, filters })
  if (!saved) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  return NextResponse.json({ ok: true })
}
