import { safeCsvCell } from './csv'
import type { HeadcountFteReport } from './headcount-fte-service'

export function headcountFteCsv(report: Pick<HeadcountFteReport, 'rows'>, locale: 'nl' | 'en'): string {
  const headers = locale === 'nl'
    ? ['Medewerkernr', 'Medewerker', 'Dienstverbandnr', 'Administratie', 'Afdeling', 'Team', 'FTE', 'Roosterstatus', 'Organisatieplaatsing']
    : ['Employee no.', 'Employee', 'Employment no.', 'Administration', 'Department', 'Team', 'FTE', 'Schedule status', 'Organization placement']
  const lines = [headers.map((value) => safeCsvCell(value, true)).join(';')]
  for (const row of report.rows) {
    lines.push([
      row.employeeNumber, row.employeeName, row.employmentNumber, row.administrationName, row.departmentName,
      row.teamName, row.partTimeFactor, row.scheduleStatus, row.placementStatus,
    ].map((value) => safeCsvCell(value, true)).join(';'))
  }
  return `\uFEFFsep=;\r\n${lines.join('\r\n')}`
}
