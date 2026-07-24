import type { EmployeeInsightRow } from './types'

function csvCell(value: string | number | null): string {
  const source = value === null ? '' : String(value)
  return `"${source.replaceAll('"', '""')}"`
}

export function employeeInsightCsv(rows: readonly EmployeeInsightRow[]): string {
  const headers = ['Administratienr', 'Medewerkernr', 'Medewerker', 'Geslacht', 'Leeftijd', 'Team', 'Segment', 'Einddatum', 'Reden']
  const lines = [headers.map(csvCell).join(';')]

  for (const row of rows) {
    lines.push([row.administrationNumber, row.employeeNumber, row.employeeName, row.gender, row.age, row.team, row.segment, row.endDate, row.reason].map(csvCell).join(';'))
  }

  return `\uFEFFsep=;\r\n${lines.join('\r\n')}`
}
