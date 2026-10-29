import type { FrequentAbsenceReport } from './frequent-absence-report'

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}

function cell(value: string | number): string {
  const type = typeof value === 'number' ? 'Number' : 'String'
  return `<Cell><Data ss:Type="${type}">${escapeXml(String(value))}</Data></Cell>`
}

export function frequentAbsenceExcel(report: FrequentAbsenceReport): string {
  const rows = [
    ['Medewerker', 'Afdeling', 'Aantal verzuimcases', 'Kalenderdagen in ziekteperioden', 'Frequent verzuimer'],
    ...report.rows.map((row) => [row.employeeName, row.departmentName ?? 'Onbekend', row.reportCount, row.totalSickDays, row.isFrequent ? 'Ja' : 'Nee']),
  ]
  const tableRows = rows.map((row) => `<Row>${row.map((value) => cell(value)).join('')}</Row>`).join('')
  const qualityRows = [
    ['Datakwaliteit', 'Waarde'],
    ['Onbekende historische plaatsingen', report.dataQuality.unknownPlacements],
    ['Volledigheid', report.dataQuality.complete ? 'Volledig' : 'Onvolledig'],
  ].map((row) => `<Row>${row.map((value) => cell(value)).join('')}</Row>`).join('')
  return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Frequent verzuim"><Table>${tableRows}</Table></Worksheet>
  <Worksheet ss:Name="Datakwaliteit"><Table>${qualityRows}</Table></Worksheet>
</Workbook>`
}
