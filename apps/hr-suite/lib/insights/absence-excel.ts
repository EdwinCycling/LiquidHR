import type { AbsenceInsightReport } from './absence-report'

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}

function cell(value: string | number | null): string {
  const safeValue = value === null ? 'Onbekend' : value
  const type = typeof safeValue === 'number' ? 'Number' : 'String'
  return `<Cell><Data ss:Type="${type}">${escapeXml(String(safeValue))}</Data></Cell>`
}

export function absenceInsightExcel(report: AbsenceInsightReport): string {
  const rows = [
    ['Medewerker', 'Afdeling', 'Status', 'Eerste ziektedag', 'Verzuimcases', 'Ziekteperioden', 'Verzuimdagen', 'Verzuimuren', 'Verzuimpercentage', 'Datakwaliteit'],
    ...report.rows.map((row) => [row.employeeName, row.departmentName ?? 'Onbekend', row.status, row.firstAbsenceOn, row.caseCount, row.absenceOccurrences, row.sickDays, row.sickHours, row.absenceRate, row.dataQuality.complete ? 'Volledig' : 'Onvolledig']),
  ]
  const tableRows = rows.map((row) => `<Row>${row.map((value) => cell(value)).join('')}</Row>`).join('')
  const qualityRows = [
    ['Datakwaliteit', 'Waarde'],
    ['Verzuimpercentage', report.absenceRate === null ? 'Onbekend' : `${report.absenceRate}%`],
    ['Ontbrekende of conflicterende rooster-dagen', report.dataQuality.unknownScheduleDays],
    ['Onbekende capaciteitsdagen', report.dataQuality.unknownCapacityDays],
    ['Onbekende historische plaatsingen', report.dataQuality.unknownPlacements],
    ['Volledigheid', report.dataQuality.complete ? 'Volledig' : 'Onvolledig'],
  ].map((row) => `<Row>${row.map((value) => cell(value)).join('')}</Row>`).join('')
  return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Verzuim"><Table>${tableRows}</Table></Worksheet>
  <Worksheet ss:Name="Datakwaliteit"><Table>${qualityRows}</Table></Worksheet>
</Workbook>`
}
