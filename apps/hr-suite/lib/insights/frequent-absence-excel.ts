import type { FrequentAbsenceReport } from './frequent-absence-report'

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}

function cell(value: string | number, style?: string): string {
  const type = typeof value === 'number' ? 'Number' : 'String'
  const styleAttribute = style ? ` ss:StyleID="${style}"` : ''
  return `<Cell${styleAttribute}><Data ss:Type="${type}">${escapeXml(String(value))}</Data></Cell>`
}

function periodLabel(period: FrequentAbsenceReport['period']['period'], year: number): string {
  if (period === 'this-year') return `Dit kalenderjaar (${year})`
  if (period === 'previous-year') return `Vorig kalenderjaar (${year})`
  return 'Laatste 365 dagen'
}

export function frequentAbsenceExcel(report: FrequentAbsenceReport): string {
  const rows = [
    ['Rapportageperiode', periodLabel(report.period.period, report.period.year)],
    ['Periode van (inclusief)', report.period.startDate],
    ['Periode tot en met (inclusief)', report.period.endDate],
    ['Teller', 'Unieke verzuimcases op basis van de eerste ziektedag; meerdere spells binnen één case tellen niet extra.'],
    ['Frequentiedrempel', report.threshold],
    [],
    ['Medewerker', 'Afdeling', 'Aantal verzuimcases', 'Kalenderdagen in ziekteperioden', 'Frequent verzuimer'],
    ...report.rows.map((row) => [row.employeeName, row.departmentName ?? 'Onbekend', row.reportCount, row.totalSickDays, row.isFrequent ? 'Ja' : 'Nee']),
  ]
  const tableRows = rows.map((row) => `<Row>${row.map((value, index) => cell(value, index === 3 ? 'OneDecimal' : undefined)).join('')}</Row>`).join('')
  const qualityRows = [
    ['Datakwaliteit', 'Waarde'],
    ['Onbekende historische plaatsingen', report.dataQuality.unknownPlacements],
    ['Volledigheid', report.dataQuality.complete ? 'Volledig' : 'Onvolledig'],
  ].map((row) => `<Row>${row.map((value) => cell(value)).join('')}</Row>`).join('')
  return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles><Style ss:ID="OneDecimal"><NumberFormat ss:Format="0.0"/></Style></Styles>
  <Worksheet ss:Name="Frequent verzuim"><Table>${tableRows}</Table></Worksheet>
  <Worksheet ss:Name="Datakwaliteit"><Table>${qualityRows}</Table></Worksheet>
</Workbook>`
}
