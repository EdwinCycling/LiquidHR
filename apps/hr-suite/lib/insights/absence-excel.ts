import type { AbsenceInsightReport } from './absence-report'

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}

function cell(value: string | number): string {
  const type = typeof value === 'number' ? 'Number' : 'String'
  return `<Cell><Data ss:Type="${type}">${escapeXml(String(value))}</Data></Cell>`
}

export function absenceInsightExcel(report: AbsenceInsightReport): string {
  const rows = [
    ['Medewerker', 'Afdeling', 'Status', 'Eerste ziektedag', 'Verzuimmeldingen', 'Verzuimdagen', 'Verzuimuren', 'Verzuimpercentage'],
    ...report.rows.map((row) => [row.employeeName, row.departmentName ?? 'Onbekend', row.status, row.firstAbsenceOn, row.caseCount, row.sickDays, row.sickHours, row.absenceRate]),
  ]
  const tableRows = rows.map((row) => `<Row>${row.map((value) => cell(value)).join('')}</Row>`).join('')
  return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Verzuim"><Table>${tableRows}</Table></Worksheet>
</Workbook>`
}
