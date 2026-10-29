import { getAbsenceInsightReport, type AbsenceInsightRow, type AbsenceInsightReport } from './absence-report'
import { toAbsenceInsightQuery, type BradfordInsightQuery } from './bradford-query'

export type BradfordBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN'

export interface BradfordInsightRow {
  employeeId: string
  employeeName: string
  departmentName: string | null
  firstAbsenceOn: string
  absenceOccurrences: number
  sickDays: number | null
  score: number | null
  band: BradfordBand
}

export interface BradfordInsightReport {
  report: 'absence-bradford'
  period: BradfordInsightQuery
  rows: BradfordInsightRow[]
  departments: AbsenceInsightReport['departments']
  totalOccurrences: number
  totalSickDays: number | null
  dataQuality: AbsenceInsightReport['dataQuality']
}

function bandFor(score: number): BradfordBand {
  if (score > 400) return 'HIGH'
  if (score >= 51) return 'MEDIUM'
  return 'LOW'
}

export function calculateBradfordScore(absenceOccurrences: number, sickDays: number): number {
  return Math.round(Math.max(0, absenceOccurrences) ** 2 * Math.max(0, sickDays))
}

export function filterBradfordRows(rows: readonly BradfordInsightRow[], query: Pick<BradfordInsightQuery, 'risk' | 'search'>): BradfordInsightRow[] {
  const search = query.search.trim().toLocaleLowerCase('nl-NL')
  return rows.filter((row) => (query.risk === 'ALL' || row.band === query.risk) && row.employeeName.toLocaleLowerCase('nl-NL').includes(search))
}

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export async function getBradfordInsightReport(query: BradfordInsightQuery): Promise<BradfordInsightReport> {
  const report = await getAbsenceInsightReport(toAbsenceInsightQuery(query))
  const calculatedRows = report.rows.map((row: AbsenceInsightRow) => {
    const score = row.sickDays === null ? null : calculateBradfordScore(row.absenceOccurrences, row.sickDays)
    return {
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      departmentName: row.departmentName,
      firstAbsenceOn: row.firstAbsenceOn,
      absenceOccurrences: row.absenceOccurrences,
      sickDays: row.sickDays === null ? null : round(row.sickDays),
      score,
      band: score === null ? 'UNKNOWN' as const : bandFor(score),
    }
  }).sort((left, right) => (right.score ?? -1) - (left.score ?? -1) || left.employeeName.localeCompare(right.employeeName, 'nl'))
  const rows = filterBradfordRows(calculatedRows, query)
  return {
    report: 'absence-bradford',
    period: query,
    rows,
    departments: report.departments,
    totalOccurrences: rows.reduce((total, row) => total + row.absenceOccurrences, 0),
    totalSickDays: rows.some((row) => row.sickDays === null) ? null : round(rows.reduce((total, row) => total + (row.sickDays ?? 0), 0)),
    dataQuality: report.dataQuality,
  }
}
