import type { EmployeeInsightRow } from './types'

export function safeCsvCell(value: string | number | null | undefined, alwaysQuote = false, delimiter = ';'): string {
  const source = value === null || value === undefined ? '' : String(value)
  const safe = /^[\t\r\n ]*[=+\-@]/.test(source) ? `'${source}` : source
  if (!alwaysQuote && !safe.includes(delimiter) && !/["\r\n]/.test(safe)) return safe
  return `"${safe.replaceAll('"', '""')}"`
}

export function employeeInsightCsv(rows: readonly EmployeeInsightRow[]): string {
  const headers = ['Administratienr', 'Medewerkernr', 'Medewerker', 'Geslacht', 'Leeftijd', 'Team', 'Segment', 'Einddatum', 'Reden']
  const lines = [headers.map((value) => safeCsvCell(value, true, ';')).join(';')]

  for (const row of rows) {
    lines.push([row.administrationNumber, row.employeeNumber, row.employeeName, row.gender, row.age, row.team, row.segment, row.endDate, row.reason].map((value) => safeCsvCell(value, true, ';')).join(';'))
  }

  return `\uFEFFsep=;\r\n${lines.join('\r\n')}`
}
