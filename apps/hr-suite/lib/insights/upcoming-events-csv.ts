import { safeCsvCell } from './csv'
import type { UpcomingEventsReport } from './upcoming-events'

export function upcomingEventsCsv(report: UpcomingEventsReport): string {
  const rows = [
    ['Administratienr', 'Medewerkernr', 'Gebeurtenis', 'Medewerker', 'Afdeling', 'Datum', 'Jaren'],
    ...report.rows.map((row) => [row.administrationNumber, row.employeeNumber, row.type, row.employeeName, row.departmentName ?? '', row.date, row.years === null ? '' : String(row.years)]),
  ]
  return `\uFEFFsep=;\r\n${rows.map((row) => row.map((value) => safeCsvCell(value, true, ';')).join(';')).join('\r\n')}`
}
