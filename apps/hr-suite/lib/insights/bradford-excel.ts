import type { BradfordInsightReport } from './bradford-report'

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}

function cell(value: string | number): string {
  const type = typeof value === 'number' ? 'Number' : 'String'
  return `<Cell><Data ss:Type="${type}">${escapeXml(String(value))}</Data></Cell>`
}

export function bradfordInsightExcel(report: BradfordInsightReport): string {
  const rows = [
    ['Medewerker', 'Afdeling', 'Eerste ziektedag', 'Aantal ziekteperioden (S)', 'Verzuimdagen (D)', 'Bradford-factor', 'Risiconiveau'],
    ...report.rows.map((row) => [row.employeeName, row.departmentName ?? 'Onbekend', row.firstAbsenceOn, row.absenceOccurrences, row.sickDays, row.score, row.band]),
  ]
  const tableRows = rows.map((row) => `<Row>${row.map((value) => cell(value)).join('')}</Row>`).join('')
  return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Bradford factor"><Table>${tableRows}</Table></Worksheet>
</Workbook>`
}
