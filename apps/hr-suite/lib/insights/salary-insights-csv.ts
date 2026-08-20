import type { SalaryInsightReport, SalaryInsightRow } from './salary-insights-types'

function cell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[\";,\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function rowValues(report: SalaryInsightReport, row: SalaryInsightRow): Array<string | number | null> {
  const common: Array<string | number | null> = [report.asOfDate, row.employeeName, row.administrationName, row.departmentName, row.functionName, row.fte]
  if (report.report === 'salary-overview') return [...common, row.salaryRoute, row.actualSalary, row.fulltimeSalary, row.salaryStructureName, row.salaryBandName ?? row.salaryScaleCode, row.salaryStepCode, row.bandStatus]
  if (report.report === 'salary-band-position') return [...common, row.salaryStructureName, row.salaryBandName, row.fulltimeSalary, row.bandMinimum, row.bandMidpoint, row.bandMaximum, row.compaRatio, row.rangePenetration, row.bandStatus]
  if (report.report === 'salary-band-status') return [...common, row.salaryStructureName, row.salaryBandName, row.fulltimeSalary, row.bandMinimum, row.bandMidpoint, row.bandMaximum, row.bandDeviation, row.bandStatus]
  if (report.report === 'salary-scale-steps') return [...common, row.salaryStructureName, row.salaryScaleName, row.salaryStepCode, row.revisionEffectiveFrom, row.fulltimeSalary, row.exceptionTypes.join('|')]
  if (report.report === 'salary-structure-exceptions') return [...common, row.employmentNumber ?? row.employmentId, row.salaryRoute, row.salaryStructureName, row.salaryBandName ?? row.salaryScaleCode, row.salaryStepCode, row.exceptionType, row.revisionEffectiveFrom, row.exceptionSeverity, `/employees/${row.employeeId}/employments/${row.employmentId}?tab=salary&fromTab=overview`]
  return [...common, row.peerGroupDefinition, row.peerGroupSize, row.fulltimeSalary, row.peerMedian, row.peerAverage, row.medianDelta, row.medianDeltaPercentage, row.relativePosition, row.peerStatus]
}

function headers(report: SalaryInsightReport['report']): string[] {
  const common = ['asOfDate', 'employee', 'administration', 'department', 'function', 'fte']
  if (report === 'salary-overview') return [...common, 'salaryRoute', 'actualSalary', 'fulltimeSalary', 'salaryStructure', 'bandOrScale', 'step', 'status']
  if (report === 'salary-band-position') return [...common, 'salaryStructure', 'salaryBand', 'fulltimeSalary', 'minimum', 'midpoint', 'maximum', 'compaRatio', 'rangePenetration', 'status']
  if (report === 'salary-band-status') return [...common, 'salaryStructure', 'salaryBand', 'fulltimeSalary', 'minimum', 'midpoint', 'maximum', 'deviation', 'status']
  if (report === 'salary-scale-steps') return [...common, 'salaryStructure', 'salaryScale', 'step', 'revisionEffectiveFrom', 'fulltimeSalary', 'exceptionTypes']
  if (report === 'salary-structure-exceptions') return [...common, 'employmentNumber', 'salaryRoute', 'salaryStructure', 'bandOrScale', 'step', 'exceptionType', 'from', 'severity', 'actionHref']
  return [...common, 'comparisonGroup', 'groupSize', 'ownFulltimeSalary', 'peerMedian', 'peerAverage', 'medianDelta', 'medianDeltaPercentage', 'relativePosition', 'status']
}

export function salaryInsightCsv(report: SalaryInsightReport): string {
  const metadata: Array<[string, string | number]> = [
    ['report', report.report],
    ['asOfDate', report.asOfDate],
    ['authorizedPopulation', report.authorizedPopulation],
    ['filteredRows', report.total],
    ['groupBy', report.filters.groupBy],
    ['sortBy', report.filters.sortBy],
  ]
  const filterFields = ['administrations', 'departments', 'teams', 'managers', 'functions', 'functionGroups', 'locations', 'laborConditions', 'structures', 'bands', 'scales', 'steps', 'fteBuckets', 'employmentTypes', 'salaryRoutes', 'statuses', 'severities', 'exceptionTypes'] as const
  for (const field of filterFields) if (report.filters[field].length) metadata.push([`filter.${field}`, report.filters[field].join(',')])
  const rows = [['metadata', 'value'], ...metadata, [], headers(report.report), ...report.rows.map((row) => rowValues(report, row))]
  return `\uFEFFsep=;\r\n${rows.map((values) => values.map(cell).join(';')).join('\r\n')}`
}
