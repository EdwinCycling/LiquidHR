import { getAbsenceInsightReport, type AbsenceInsightRow, type AbsenceInsightReport } from './absence-report'
import { toAbsenceInsightQuery, type BradfordInsightQuery } from './bradford-query'

export type BradfordBand = 'LOW' | 'MEDIUM' | 'HIGH'

export interface BradfordInsightRow {
  employeeId: string
  employeeName: string
  departmentName: string | null
  firstAbsenceOn: string
  absenceOccurrences: number
  sickDays: number
  score: number
  band: BradfordBand
}

export interface BradfordInsightReport {
  report: 'absence-bradford'
  period: BradfordInsightQuery
  rows: BradfordInsightRow[]
  departments: AbsenceInsightReport['departments']
  totalOccurrences: number
  totalSickDays: number
}

function bandFor(score: number): BradfordBand {
  if (score > 400) return 'HIGH'
  if (score >= 51) return 'MEDIUM'
  return 'LOW'
}

export function calculateBradfordScore(absenceOccurrences: number, sickDays: number): number {
  return Math.round(Math.max(0, absenceOccurrences) ** 2 * Math.max(0, sickDays))
}

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export async function getBradfordInsightReport(query: BradfordInsightQuery): Promise<BradfordInsightReport> {
  const report = await getAbsenceInsightReport(toAbsenceInsightQuery(query))
  const rows = report.rows.map((row: AbsenceInsightRow) => {
    const score = calculateBradfordScore(row.absenceOccurrences, row.sickDays)
    return {
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      departmentName: row.departmentName,
      firstAbsenceOn: row.firstAbsenceOn,
      absenceOccurrences: row.absenceOccurrences,
      sickDays: round(row.sickDays),
      score,
      band: bandFor(score),
    }
  }).sort((left, right) => right.score - left.score || left.employeeName.localeCompare(right.employeeName, 'nl'))
  return {
    report: 'absence-bradford',
    period: query,
    rows,
    departments: report.departments,
    totalOccurrences: rows.reduce((total, row) => total + row.absenceOccurrences, 0),
    totalSickDays: round(rows.reduce((total, row) => total + row.sickDays, 0)),
  }
}
