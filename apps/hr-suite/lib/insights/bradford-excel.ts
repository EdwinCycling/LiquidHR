import type { BradfordInsightReport } from './bradford-report'

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}

function cell(value: string | number | null, style?: string): string {
  const safeValue = value === null ? 'Onbekend' : value
  const type = typeof safeValue === 'number' ? 'Number' : 'String'
  const styleAttribute = style ? ` ss:StyleID="${style}"` : ''
  return `<Cell${styleAttribute}><Data ss:Type="${type}">${escapeXml(String(safeValue))}</Data></Cell>`
}

function periodLabel(period: BradfordInsightReport['period']['period'], year: number): string {
  if (period === 'this-year') return `Dit kalenderjaar (${year})`
  if (period === 'previous-year') return `Vorig kalenderjaar (${year})`
  return 'Laatste 365 dagen'
}

export function bradfordInsightExcel(report: BradfordInsightReport): string {
  const rows = [
    ['Rapportageperiode', periodLabel(report.period.period, report.period.year)],
    ['Periode van (inclusief)', report.period.startDate],
    ['Periode tot en met (inclusief)', report.period.endDate],
    ['Berekening', 'Bradford = S² × D; S telt unieke spells die de periode overlappen; D telt roostergewogen verzuimdagen binnen die periode.'],
    ['Gebruik', 'Bradford is een signaleringsmaat en geen automatische personeelsbeslissing.'],
    [],
    ['Medewerker', 'Afdeling', 'Eerste ziektedag', 'Aantal ziekteperioden (S)', 'Roostergewogen verzuimdagen (D, één decimaal)', 'Bradford-score (afgerond)', 'Risiconiveau'],
    ...report.rows.map((row) => [row.employeeName, row.departmentName ?? 'Onbekend', row.firstAbsenceOn, row.absenceOccurrences, row.sickDays, row.score, row.band === 'UNKNOWN' ? 'Onbekend' : row.band]),
  ]
  const tableRows = rows.map((row) => `<Row>${row.map((value, index) => cell(value, index === 4 ? 'OneDecimal' : undefined)).join('')}</Row>`).join('')
  const qualityRows = [
    ['Datakwaliteit', 'Waarde'],
    ['Verzuimdagen en Bradford-factor', report.dataQuality.complete ? 'Volledig' : 'Onvolledig'],
    ['Ontbrekende of conflicterende rooster-dagen', report.dataQuality.unknownScheduleDays],
    ['Onbekende capaciteitsdagen', report.dataQuality.unknownCapacityDays],
    ['Onbekende historische plaatsingen', report.dataQuality.unknownPlacements],
    ['Overlappende spellparen binnen hetzelfde dienstverband', report.dataQuality.overlappingSpellPairs],
  ].map((row) => `<Row>${row.map((value) => cell(value)).join('')}</Row>`).join('')
  return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles><Style ss:ID="OneDecimal"><NumberFormat ss:Format="0.0"/></Style></Styles>
  <Worksheet ss:Name="Bradford factor"><Table>${tableRows}</Table></Worksheet>
  <Worksheet ss:Name="Datakwaliteit"><Table>${qualityRows}</Table></Worksheet>
</Workbook>`
}
