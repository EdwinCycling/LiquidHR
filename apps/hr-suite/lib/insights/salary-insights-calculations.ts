import { calculateSalaryBandPosition } from '@/lib/salary-application/calculations'
import type {
  SalaryInsightExceptionSeverity,
  SalaryInsightExceptionType,
  SalaryInsightChart,
  SalaryInsightChartBucket,
  SalaryInsightFilterOptions,
  SalaryInsightFilters,
  SalaryInsightGroup,
  SalaryInsightGroupBy,
  SalaryInsightKpi,
  SalaryInsightOption,
  SalaryInsightProjectionRow,
  SalaryInsightReport,
  SalaryInsightReportId,
  SalaryInsightRow,
  SalaryInsightSortBy,
} from './salary-insights-types'

const MONEY_SCALE = 2
const PERCENTAGE_SCALE = 2
const FTE_SCALE = 4

function parseScaled(value: string | number | null, scale: number): bigint | null {
  if (value === null || value === '') return null
  const normalized = String(value).trim()
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null
  const [whole, fraction = ''] = normalized.split('.')
  if (fraction.length > scale) return null
  return BigInt(`${whole}${fraction.padEnd(scale, '0')}`)
}

function divideRoundedHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator === BigInt(0)) return BigInt(0)
  const negative = numerator < BigInt(0)
  const absolute = negative ? -numerator : numerator
  const rounded = (absolute + denominator / BigInt(2)) / denominator
  return negative ? -rounded : rounded
}

function formatScaled(value: bigint | null, scale: number): string | null {
  if (value === null) return null
  const negative = value < BigInt(0)
  const absolute = negative ? -value : value
  const divisor = BigInt(10) ** BigInt(scale)
  const whole = absolute / divisor
  const fraction = (absolute % divisor).toString().padStart(scale, '0')
  return `${negative ? '-' : ''}${whole}.${fraction}`
}

function normalizeMoney(value: string | number | null): string | null {
  return formatScaled(parseScaled(value, MONEY_SCALE), MONEY_SCALE)
}

function normalizeFte(value: string | number | null): string | null {
  return formatScaled(parseScaled(value, FTE_SCALE), 2)
}

function fteBucket(value: string | null): SalaryInsightRow['fteBucket'] {
  const number = value === null ? null : Number(value)
  if (number === null || !Number.isFinite(number)) return null
  if (number < 0.5) return 'lt0.5'
  if (number < 1) return '0.5to1'
  return 'gte1'
}

function exceptionTypes(row: SalaryInsightProjectionRow): SalaryInsightExceptionType[] {
  const values: SalaryInsightExceptionType[] = []
  if (row.salaryRoute === 'SALARY_BAND' && (!row.hasPublishedRevision || !row.hasResolvedBand)) values.push('NO_VALID_BAND')
  if (row.salaryRoute === 'SCALE_WITH_STEPS' && (!row.hasPublishedRevision || !row.hasResolvedScaleStep)) values.push('INVALID_SCALE_STEP')
  if (row.structureDisabled) values.push('DISABLED_STRUCTURE')
  if ((row.salaryRoute === 'SALARY_BAND' || row.salaryRoute === 'SCALE_WITH_STEPS') && !row.hasPublishedRevision) values.push('NO_PUBLISHED_REVISION')
  return [...new Set(values)]
}

function exceptionSeverity(type: SalaryInsightExceptionType): SalaryInsightExceptionSeverity {
  return type === 'NO_VALID_BAND' ? 'ATTENTION' : 'ACTION_REQUIRED'
}

function bandDeviation(row: SalaryInsightProjectionRow, status: SalaryInsightRow['bandStatus']): string | null {
  const salary = parseScaled(normalizeMoney(row.fulltimeSalary), MONEY_SCALE)
  if (salary === null || status === null) return null
  const boundary = status === 'UNDER_MINIMUM' ? parseScaled(normalizeMoney(row.bandMinimum), MONEY_SCALE)
    : status === 'ABOVE_MAXIMUM' ? parseScaled(normalizeMoney(row.bandMaximum), MONEY_SCALE)
      : null
  return boundary === null ? null : formatScaled(salary - boundary, MONEY_SCALE)
}

export function normalizeSalaryInsightRows(input: readonly SalaryInsightProjectionRow[]): SalaryInsightRow[] {
  return input.map((row) => {
    const fulltimeSalary = normalizeMoney(row.fulltimeSalary)
    const band = row.bandMinimum !== null && row.bandMidpoint !== null
      ? { minimum: normalizeMoney(row.bandMinimum) ?? '', midpoint: normalizeMoney(row.bandMidpoint) ?? '', maximum: normalizeMoney(row.bandMaximum) }
      : null
    let bandStatus: SalaryInsightRow['bandStatus'] = null
    let compaRatio: string | null = null
    let rangePenetration: string | null = null
    if (row.salaryRoute === 'SALARY_BAND' && fulltimeSalary !== null && band !== null) {
      try {
        const position = calculateSalaryBandPosition(fulltimeSalary, band)
        bandStatus = position.status
        compaRatio = position.compaRatioPercentage
        rangePenetration = position.rangePenetrationPercentage
      } catch {
        bandStatus = 'NO_VALID_BAND'
      }
    }
    const types = exceptionTypes(row)
    return {
      ...row,
      employeeNumber: row.employeeNumber ?? null,
      employmentNumber: row.employmentNumber ?? null,
      administrationName: row.administrationName ?? null,
      administrationNumber: row.administrationNumber ?? null,
      departmentName: row.departmentName ?? null,
      managerName: row.managerName ?? null,
      functionName: row.functionName ?? null,
      functionGroupName: row.functionGroupName ?? null,
      seniorityName: row.seniorityName ?? null,
      locationName: row.locationName ?? null,
      laborConditionSetName: row.laborConditionSetName ?? null,
      employmentType: row.employmentType ?? null,
      fte: normalizeFte(row.fte),
      fulltimeSalary,
      actualSalary: normalizeMoney(row.actualSalary),
      salaryStructureName: row.salaryStructureName ?? null,
      salaryStructureCode: row.salaryStructureCode ?? null,
      salaryBandCode: row.salaryBandCode ?? null,
      salaryBandName: row.salaryBandName ?? null,
      bandMinimum: normalizeMoney(row.bandMinimum),
      bandMidpoint: normalizeMoney(row.bandMidpoint),
      bandMaximum: normalizeMoney(row.bandMaximum),
      salaryScaleCode: row.salaryScaleCode ?? null,
      salaryScaleName: row.salaryScaleName ?? null,
      salaryStepCode: row.salaryStepCode ?? null,
      salaryStepName: row.salaryStepName ?? null,
      bandStatus,
      bandDeviation: bandDeviation(row, bandStatus),
      compaRatio,
      rangePenetration,
      fteBucket: fteBucket(row.fte),
      exceptionTypes: types,
      exceptionType: null,
      exceptionSeverity: null,
      peerGroupDefinition: null,
      peerGroupSize: null,
      peerMedian: null,
      peerAverage: null,
      medianDelta: null,
      medianDeltaPercentage: null,
      relativePosition: null,
      peerStatus: null,
    }
  })
}

function option(value: string | null, label: string | null): SalaryInsightOption | null {
  return value && label ? { value, label } : null
}

function uniqueOptions(values: readonly (SalaryInsightOption | null)[]): SalaryInsightOption[] {
  const seen = new Set<string>()
  return values.flatMap((value) => {
    if (!value || seen.has(value.value)) return []
    seen.add(value.value)
    return [value]
  }).sort((left, right) => left.label.localeCompare(right.label, 'nl'))
}

type SalaryInsightFilterKey = keyof Pick<SalaryInsightFilters, 'administrations' | 'departments' | 'teams' | 'managers' | 'functions' | 'functionGroups' | 'locations' | 'laborConditions' | 'structures' | 'bands' | 'scales' | 'steps' | 'fteBuckets' | 'employmentTypes' | 'salaryRoutes' | 'statuses' | 'severities' | 'exceptionTypes'>

function rowsForFilter(rows: readonly SalaryInsightRow[], filters: SalaryInsightFilters | undefined, field: SalaryInsightFilterKey): SalaryInsightRow[] {
  if (!filters) return [...rows]
  return filterSalaryInsightRows(rows, { ...filters, [field]: [] })
}

function statusOption(row: SalaryInsightRow): SalaryInsightOption | null {
  return option(row.bandStatus ?? (row.exceptionTypes.includes('NO_VALID_BAND') ? 'NO_VALID_BAND' : null), row.bandStatus ?? (row.exceptionTypes.includes('NO_VALID_BAND') ? 'NO_VALID_BAND' : null))
}

function severityOptions(row: SalaryInsightRow): SalaryInsightOption[] {
  return row.exceptionTypes.map((type) => option(type, exceptionSeverity(type))).filter((value): value is SalaryInsightOption => value !== null)
}

export function buildSalaryInsightFilterOptions(rows: readonly SalaryInsightRow[], filters?: SalaryInsightFilters): SalaryInsightFilterOptions {
  return {
    administrations: uniqueOptions(rowsForFilter(rows, filters, 'administrations').map((row) => option(row.administrationId, row.administrationName))),
    departments: uniqueOptions(rowsForFilter(rows, filters, 'departments').map((row) => option(row.departmentId, row.departmentName))),
    teams: uniqueOptions(rowsForFilter(rows, filters, 'teams').map((row) => option(row.departmentId, row.departmentName))),
    managers: uniqueOptions(rowsForFilter(rows, filters, 'managers').map((row) => option(row.managerId, row.managerName))),
    functions: uniqueOptions(rowsForFilter(rows, filters, 'functions').map((row) => option(row.functionName, row.functionName))),
    functionGroups: uniqueOptions(rowsForFilter(rows, filters, 'functionGroups').map((row) => option(row.functionGroupId, row.functionGroupName))),
    locations: uniqueOptions(rowsForFilter(rows, filters, 'locations').map((row) => option(row.locationId, row.locationName))),
    laborConditions: uniqueOptions(rowsForFilter(rows, filters, 'laborConditions').map((row) => option(row.laborConditionSetId, row.laborConditionSetName))),
    structures: uniqueOptions(rowsForFilter(rows, filters, 'structures').map((row) => option(row.salaryStructureId, row.salaryStructureName))),
    bands: uniqueOptions(rowsForFilter(rows, filters, 'bands').map((row) => option(row.salaryBandId, row.salaryBandName))),
    scales: uniqueOptions(rowsForFilter(rows, filters, 'scales').map((row) => option(row.salaryScaleId, row.salaryScaleName))),
    steps: uniqueOptions(rowsForFilter(rows, filters, 'steps').map((row) => option(row.salaryStepCode, row.salaryStepName ?? row.salaryStepCode))),
    fteBuckets: uniqueOptions([...new Set(rowsForFilter(rows, filters, 'fteBuckets').map((row) => row.fteBucket).filter((value): value is NonNullable<typeof value> => value !== null))].map((value) => ({ value, label: value }))),
    employmentTypes: uniqueOptions(rowsForFilter(rows, filters, 'employmentTypes').map((row) => option(row.employmentType, row.employmentType))),
    salaryRoutes: uniqueOptions(rowsForFilter(rows, filters, 'salaryRoutes').map((row) => option(row.salaryRoute, row.salaryRoute))),
    statuses: uniqueOptions(rowsForFilter(rows, filters, 'statuses').map(statusOption)),
    severities: uniqueOptions(rowsForFilter(rows, filters, 'severities').flatMap(severityOptions)),
    exceptionTypes: uniqueOptions(rowsForFilter(rows, filters, 'exceptionTypes').flatMap((row) => row.exceptionTypes.map((type) => option(type, type)))),
  }
}

function includesSelected(selected: readonly string[], value: string | null): boolean {
  return selected.length === 0 || (value !== null && selected.includes(value))
}

function matchesRow(row: SalaryInsightRow, filters: SalaryInsightFilters): boolean {
  const status = row.bandStatus ?? (row.exceptionTypes.includes('NO_VALID_BAND') ? 'NO_VALID_BAND' : null)
  return includesSelected(filters.administrations, row.administrationId)
    && includesSelected(filters.departments, row.departmentId)
    && includesSelected(filters.teams, row.departmentId)
    && includesSelected(filters.managers, row.managerId)
    && includesSelected(filters.functions, row.functionName)
    && includesSelected(filters.functionGroups, row.functionGroupId)
    && includesSelected(filters.locations, row.locationId)
    && includesSelected(filters.laborConditions, row.laborConditionSetId)
    && includesSelected(filters.structures, row.salaryStructureId)
    && includesSelected(filters.bands, row.salaryBandId)
    && includesSelected(filters.scales, row.salaryScaleId)
    && includesSelected(filters.steps, row.salaryStepCode)
    && includesSelected(filters.fteBuckets, row.fteBucket)
    && includesSelected(filters.employmentTypes, row.employmentType)
    && includesSelected(filters.salaryRoutes, row.salaryRoute)
    && includesSelected(filters.statuses, status)
    && (filters.exceptionTypes.length === 0 || filters.exceptionTypes.some((value) => row.exceptionTypes.includes(value as SalaryInsightExceptionType)))
    && (filters.severities.length === 0 || filters.severities.some((value) => row.exceptionTypes.some((type) => exceptionSeverity(type) === value)))
}

export function filterSalaryInsightRows(rows: readonly SalaryInsightRow[], filters: SalaryInsightFilters): SalaryInsightRow[] {
  return rows.filter((row) => matchesRow(row, filters))
}

function compareText(left: string | null, right: string | null): number {
  return (left ?? '').localeCompare(right ?? '', 'nl')
}

function compareScaled(left: string | null, right: string | null, scale: number): number {
  const leftValue = parseScaled(left, scale) ?? BigInt(0)
  const rightValue = parseScaled(right, scale) ?? BigInt(0)
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0
}

function statusValue(row: SalaryInsightRow): string {
  return row.bandStatus ?? (row.exceptionType ?? row.exceptionTypes[0] ?? 'VALID')
}

export function sortSalaryInsightRows(rows: readonly SalaryInsightRow[], sortBy: SalaryInsightSortBy): SalaryInsightRow[] {
  return [...rows].sort((left, right) => {
    const bySort = sortBy === 'salary-desc' ? -compareScaled(left.fulltimeSalary, right.fulltimeSalary, MONEY_SCALE)
      : sortBy === 'salary-asc' ? compareScaled(left.fulltimeSalary, right.fulltimeSalary, MONEY_SCALE)
        : sortBy === 'fte' ? -compareScaled(left.fte, right.fte, 2)
          : sortBy === 'compa-desc' ? -compareScaled(left.compaRatio, right.compaRatio, PERCENTAGE_SCALE)
            : sortBy === 'compa-asc' ? compareScaled(left.compaRatio, right.compaRatio, PERCENTAGE_SCALE)
              : sortBy === 'deviation' ? -Math.abs(Number(left.bandDeviation ?? 0)) + Math.abs(Number(right.bandDeviation ?? 0))
                : sortBy === 'structure' ? compareText(left.salaryStructureName, right.salaryStructureName)
                  : sortBy === 'scale' ? compareText(left.salaryScaleCode, right.salaryScaleCode)
                    : sortBy === 'step' ? compareText(left.salaryStepCode, right.salaryStepCode)
                      : sortBy === 'severity' ? compareText(left.exceptionSeverity, right.exceptionSeverity)
                        : sortBy === 'date' ? compareText(left.revisionEffectiveFrom, right.revisionEffectiveFrom)
                          : sortBy === 'type' ? compareText(left.exceptionType, right.exceptionType)
                            : sortBy === 'median-delta' ? -Math.abs(Number(left.medianDelta ?? 0)) + Math.abs(Number(right.medianDelta ?? 0))
                              : sortBy === 'relative-position' ? -compareScaled(left.relativePosition, right.relativePosition, PERCENTAGE_SCALE)
                                : sortBy === 'status' ? compareText(statusValue(left), statusValue(right))
                                  : compareText(left.employeeName, right.employeeName)
    return bySort || compareText(left.employeeName, right.employeeName) || compareText(left.employeeId, right.employeeId)
  })
}

function groupValue(row: SalaryInsightRow, groupBy: SalaryInsightGroupBy): { value: string; label: string } {
  if (groupBy === 'salaryRoute') return { value: row.salaryRoute ?? 'NO_SALARY', label: row.salaryRoute ?? 'NO_SALARY' }
  if (groupBy === 'administration') return { value: row.administrationId, label: row.administrationName ?? row.administrationId }
  if (groupBy === 'department' || groupBy === 'team') return { value: row.departmentId ?? 'NO_DEPARTMENT', label: row.departmentName ?? 'NO_DEPARTMENT' }
  if (groupBy === 'function') return { value: row.functionName ?? 'NO_FUNCTION', label: row.functionName ?? 'NO_FUNCTION' }
  if (groupBy === 'functionGroup') return { value: row.functionGroupId ?? 'NO_FUNCTION_GROUP', label: row.functionGroupName ?? 'NO_FUNCTION_GROUP' }
  if (groupBy === 'salaryStructure') return { value: row.salaryStructureId ?? 'NO_STRUCTURE', label: row.salaryStructureName ?? 'NO_STRUCTURE' }
  if (groupBy === 'salaryBand') return { value: row.salaryBandId ?? 'NO_BAND', label: row.salaryBandName ?? 'NO_BAND' }
  if (groupBy === 'salaryScale') return { value: row.salaryScaleId ?? 'NO_SCALE', label: row.salaryScaleName ?? 'NO_SCALE' }
  if (groupBy === 'salaryStep') return { value: row.salaryStepCode ?? 'NO_STEP', label: row.salaryStepName ?? row.salaryStepCode ?? 'NO_STEP' }
  if (groupBy === 'severity') return { value: row.exceptionSeverity ?? 'NONE', label: row.exceptionSeverity ?? 'NONE' }
  if (groupBy === 'exceptionType') return { value: row.exceptionType ?? row.exceptionTypes[0] ?? 'NONE', label: row.exceptionType ?? row.exceptionTypes[0] ?? 'NONE' }
  if (groupBy === 'validity') return { value: row.hasPublishedRevision ? 'VALID' : 'INVALID', label: row.hasPublishedRevision ? 'VALID' : 'INVALID' }
  return { value: statusValue(row), label: statusValue(row) }
}

export function groupSalaryInsightRows(rows: readonly SalaryInsightRow[], groupBy: SalaryInsightGroupBy): SalaryInsightGroup[] {
  const grouped = new Map<string, { label: string; count: number }>()
  for (const row of rows) {
    const group = groupValue(row, groupBy)
    const current = grouped.get(group.value) ?? { label: group.label, count: 0 }
    current.count += 1
    grouped.set(group.value, current)
  }
  const total = rows.length || 1
  return [...grouped.entries()]
    .map(([value, group]) => ({ value, label: group.label, count: group.count, percentage: Math.round((group.count / total) * 1000) / 10 }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'nl'))
}

function chartPercentage(count: number, population: number): number {
  return population === 0 ? 0 : Math.round((count / population) * 1000) / 10
}

function chartBucket(value: string, label: string, count: number, population: number, lowerBound: string | null = null, upperBound: string | null = null): SalaryInsightChartBucket {
  return { value, label, count, percentage: chartPercentage(count, population), lowerBound, upperBound }
}

function groupDistributionChart(rows: readonly SalaryInsightRow[], groupBy: SalaryInsightGroupBy): SalaryInsightChart {
  const groups = groupSalaryInsightRows(rows, groupBy)
  return {
    kind: 'group-distribution',
    population: rows.length,
    excluded: 0,
    buckets: groups.map((group) => chartBucket(group.value, group.label, group.count, rows.length)),
  }
}

function compaDistributionChart(rows: readonly SalaryInsightRow[]): SalaryInsightChart {
  const eligible = rows.filter((row) => row.compaRatio !== null)
  const buckets = [
    { value: 'COMPA_LT_80', label: '<80%', count: 0, lower: null, upper: '80.00' },
    { value: 'COMPA_80_TO_90', label: '80–<90%', count: 0, lower: '80.00', upper: '90.00' },
    { value: 'COMPA_90_TO_100', label: '90–<100%', count: 0, lower: '90.00', upper: '100.00' },
    { value: 'COMPA_100_TO_110', label: '100–<110%', count: 0, lower: '100.00', upper: '110.00' },
    { value: 'COMPA_GTE_110', label: '≥110%', count: 0, lower: '110.00', upper: null },
  ]
  for (const row of eligible) {
    const ratio = parseScaled(row.compaRatio, PERCENTAGE_SCALE)
    if (ratio === null) continue
    const index = ratio < BigInt(8000) ? 0 : ratio < BigInt(9000) ? 1 : ratio < BigInt(10000) ? 2 : ratio < BigInt(11000) ? 3 : 4
    buckets[index].count += 1
  }
  return {
    kind: 'compa-distribution',
    population: eligible.length,
    excluded: rows.length - eligible.length,
    buckets: buckets.map((bucket) => chartBucket(bucket.value, bucket.label, bucket.count, eligible.length, bucket.lower, bucket.upper)),
  }
}

function bandStatusChart(rows: readonly SalaryInsightRow[]): SalaryInsightChart {
  const statuses = [
    { value: 'UNDER_MINIMUM', label: 'UNDER_MINIMUM' },
    { value: 'WITHIN_RANGE', label: 'WITHIN_RANGE' },
    { value: 'ABOVE_MAXIMUM', label: 'ABOVE_MAXIMUM' },
    { value: 'NO_VALID_BAND', label: 'NO_VALID_BAND' },
  ]
  return {
    kind: 'band-status',
    population: rows.length,
    excluded: 0,
    buckets: statuses.map((status) => chartBucket(status.value, status.label, countStatus(rows, status.value), rows.length)),
  }
}

function salaryDistributionChart(rows: readonly SalaryInsightRow[]): SalaryInsightChart {
  const eligible = rows.map((row) => parseScaled(row.fulltimeSalary, MONEY_SCALE)).filter((value): value is bigint => value !== null)
  if (eligible.length === 0) return { kind: 'fte-salary', population: 0, excluded: rows.length, buckets: [] }
  const minimum = eligible.reduce((lowest, value) => value < lowest ? value : lowest)
  const maximum = eligible.reduce((highest, value) => value > highest ? value : highest)
  const bucketCount = minimum === maximum ? 1 : 5
  const span = maximum - minimum
  const width = span === BigInt(0) ? BigInt(1) : (span + BigInt(bucketCount) - BigInt(1)) / BigInt(bucketCount)
  const start = (minimum / width) * width
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const lower = start + width * BigInt(index)
    return { lower, upper: lower + width, count: 0 }
  })
  for (const value of eligible) {
    const index = Math.min(bucketCount - 1, Number((value - start) / width))
    buckets[index].count += 1
  }
  return {
    kind: 'fte-salary',
    population: eligible.length,
    excluded: rows.length - eligible.length,
    buckets: buckets.map((bucket, index) => chartBucket(
      `SALARY_RANGE_${index + 1}`,
      `${formatScaled(bucket.lower, MONEY_SCALE)}–<${formatScaled(bucket.upper, MONEY_SCALE)}`,
      bucket.count,
      eligible.length,
      formatScaled(bucket.lower, MONEY_SCALE),
      formatScaled(bucket.upper, MONEY_SCALE),
    )),
  }
}

function peerPositionChart(rows: readonly SalaryInsightRow[]): SalaryInsightChart {
  const buckets = [
    { value: 'PEER_BELOW_10', label: '<−10%', count: 0, lower: null, upper: '-10.00' },
    { value: 'PEER_NEAR_MEDIAN', label: '−10–<10%', count: 0, lower: '-10.00', upper: '10.00' },
    { value: 'PEER_ABOVE_10', label: '≥10%', count: 0, lower: '10.00', upper: null },
    { value: 'NO_COMPARISON', label: 'NO_COMPARISON', count: 0, lower: null, upper: null },
  ]
  for (const row of rows) {
    if (row.peerStatus !== 'SUFFICIENT' || row.medianDeltaPercentage === null) {
      buckets[3].count += 1
      continue
    }
    const delta = parseScaled(row.medianDeltaPercentage, PERCENTAGE_SCALE)
    if (delta === null) { buckets[3].count += 1; continue }
    const index = delta < BigInt(-1000) ? 0 : delta < BigInt(1000) ? 1 : 2
    buckets[index].count += 1
  }
  return {
    kind: 'peer-position',
    population: rows.length,
    excluded: 0,
    buckets: buckets.map((bucket) => chartBucket(bucket.value, bucket.label, bucket.count, rows.length, bucket.lower, bucket.upper)),
  }
}

function reportChart(report: SalaryInsightReportId, rows: readonly SalaryInsightRow[], groupBy: SalaryInsightGroupBy): SalaryInsightChart {
  if (report === 'salary-overview') return salaryDistributionChart(rows)
  if (report === 'salary-band-position') return compaDistributionChart(rows)
  if (report === 'salary-band-status') return bandStatusChart(rows)
  if (report === 'salary-internal-position') return peerPositionChart(rows)
  return groupDistributionChart(rows, groupBy)
}

export function sumScaled(input: readonly (string | null)[], scale = MONEY_SCALE): string | null {
  const parsed = input.map((value) => parseScaled(value, scale)).filter((value): value is bigint => value !== null)
  return parsed.length ? formatScaled(parsed.reduce((sum, value) => sum + value, BigInt(0)), scale) : null
}

export function averageScaled(input: readonly (string | null)[], scale = MONEY_SCALE): string | null {
  const parsed = input.map((value) => parseScaled(value, scale)).filter((value): value is bigint => value !== null)
  return parsed.length ? formatScaled(divideRoundedHalfUp(parsed.reduce((sum, value) => sum + value, BigInt(0)), BigInt(parsed.length)), scale) : null
}

export function medianScaled(input: readonly (string | null)[], scale = MONEY_SCALE): string | null {
  const parsed = input.map((value) => parseScaled(value, scale)).filter((value): value is bigint => value !== null).sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
  if (!parsed.length) return null
  if (parsed.length % 2 === 1) return formatScaled(parsed[Math.floor(parsed.length / 2)], scale)
  return formatScaled(divideRoundedHalfUp(parsed[parsed.length / 2 - 1] + parsed[parsed.length / 2], BigInt(2)), scale)
}

function percentageAverage(rows: readonly SalaryInsightRow[], selector: (row: SalaryInsightRow) => string | null): string | null {
  return averageScaled(rows.map(selector), PERCENTAGE_SCALE)
}

function kpi(id: string, value: string | number | null, context: string | null = null): SalaryInsightKpi {
  return { id, value: value === null ? '—' : String(value), context }
}

function countStatus(rows: readonly SalaryInsightRow[], status: string): number {
  return rows.filter((row) => (row.bandStatus ?? (row.exceptionTypes.includes('NO_VALID_BAND') ? 'NO_VALID_BAND' : null)) === status).length
}

function overviewKpis(rows: readonly SalaryInsightRow[], asOfDate: string): SalaryInsightKpi[] {
  const validCompa = rows.filter((row) => row.compaRatio !== null)
  return [
    kpi('employees', rows.length),
    kpi('salarySum', sumScaled(rows.map((row) => row.actualSalary))),
    kpi('averageFulltimeSalary', averageScaled(rows.map((row) => row.fulltimeSalary))),
    kpi('medianFulltimeSalary', medianScaled(rows.map((row) => row.fulltimeSalary))),
    kpi('averageFte', averageScaled(rows.map((row) => row.fte), 2)),
    kpi('averageCompa', percentageAverage(validCompa, (row) => row.compaRatio), `${validCompa.length} medewerkers`),
    kpi('belowBand', countStatus(rows, 'UNDER_MINIMUM')),
    kpi('aboveBand', countStatus(rows, 'ABOVE_MAXIMUM')),
    kpi('exceptions', new Set(rows.filter((row) => row.exceptionTypes.length).map((row) => row.employmentId)).size),
    kpi('asOfDate', asOfDate),
  ]
}

function bandKpis(rows: readonly SalaryInsightRow[], asOfDate: string): SalaryInsightKpi[] {
  const valid = rows.filter((row) => row.compaRatio !== null)
  return [
    kpi('employees', rows.length),
    kpi('averageCompa', percentageAverage(valid, (row) => row.compaRatio), `${valid.length} medewerkers`),
    kpi('averageRangePenetration', percentageAverage(rows.filter((row) => row.rangePenetration !== null), (row) => row.rangePenetration)),
    kpi('belowBand', countStatus(rows, 'UNDER_MINIMUM')),
    kpi('withinBand', countStatus(rows, 'WITHIN_RANGE')),
    kpi('aboveBand', countStatus(rows, 'ABOVE_MAXIMUM')),
    kpi('noValidBand', countStatus(rows, 'NO_VALID_BAND')),
    kpi('asOfDate', asOfDate),
  ]
}

function bandStatusKpis(rows: readonly SalaryInsightRow[], asOfDate: string): SalaryInsightKpi[] {
  return [
    kpi('belowBand', countStatus(rows, 'UNDER_MINIMUM')),
    kpi('withinBand', countStatus(rows, 'WITHIN_RANGE')),
    kpi('aboveBand', countStatus(rows, 'ABOVE_MAXIMUM')),
    kpi('noValidBand', countStatus(rows, 'NO_VALID_BAND')),
    kpi('employees', rows.length),
    kpi('asOfDate', asOfDate),
  ]
}

function scaleKpis(rows: readonly SalaryInsightRow[], asOfDate: string): SalaryInsightKpi[] {
  return [
    kpi('employees', rows.length),
    kpi('structures', new Set(rows.map((row) => row.salaryStructureId).filter((value): value is string => value !== null)).size),
    kpi('scales', new Set(rows.map((row) => row.salaryScaleId).filter((value): value is string => value !== null)).size),
    kpi('steps', new Set(rows.map((row) => row.salaryStepCode).filter((value): value is string => value !== null)).size),
    kpi('invalidScaleStep', rows.filter((row) => row.exceptionTypes.includes('INVALID_SCALE_STEP')).length),
    kpi('asOfDate', asOfDate),
  ]
}

function exceptionKpis(rows: readonly SalaryInsightRow[], asOfDate: string): SalaryInsightKpi[] {
  return [
    kpi('total', rows.length),
    kpi('attention', rows.filter((row) => row.exceptionSeverity === 'ATTENTION').length),
    kpi('actionRequired', rows.filter((row) => row.exceptionSeverity === 'ACTION_REQUIRED').length),
    kpi('noValidBand', rows.filter((row) => row.exceptionType === 'NO_VALID_BAND').length),
    kpi('invalidScaleStep', rows.filter((row) => row.exceptionType === 'INVALID_SCALE_STEP').length),
    kpi('asOfDate', asOfDate),
  ]
}

function internalKpis(rows: readonly SalaryInsightRow[], asOfDate: string): SalaryInsightKpi[] {
  const sufficient = new Set(rows.filter((row) => row.peerStatus === 'SUFFICIENT').map((row) => row.peerGroupDefinition).filter((value): value is string => value !== null)).size
  const insufficient = new Set(rows.filter((row) => row.peerStatus === 'INSUFFICIENT').map((row) => row.peerGroupDefinition ?? row.employmentId)).size
  return [
    kpi('employees', rows.length),
    kpi('sufficientGroups', sufficient),
    kpi('insufficientGroups', insufficient),
    kpi('averageMedianDelta', averageScaled(rows.map((row) => row.medianDelta))),
    kpi('asOfDate', asOfDate),
  ]
}

function groupDefinition(row: SalaryInsightRow): { key: string | null; label: string | null; fallbackKey: string | null; fallbackLabel: string | null } {
  const primaryKey = row.functionName && row.seniorityId ? `${row.functionName}:${row.seniorityId}` : null
  const primaryLabel = row.functionName && row.seniorityName ? `${row.functionName} · ${row.seniorityName}` : row.functionName
  return {
    key: primaryKey,
    label: primaryLabel,
    fallbackKey: row.salaryBandId,
    fallbackLabel: row.salaryBandName,
  }
}

function applyPeerMetrics(rows: readonly SalaryInsightRow[]): SalaryInsightRow[] {
  const byPrimary = new Map<string, SalaryInsightRow[]>()
  const byBand = new Map<string, SalaryInsightRow[]>()
  for (const row of rows) {
    if (row.fulltimeSalary === null) continue
    const definition = groupDefinition(row)
    if (definition.key) byPrimary.set(definition.key, [...(byPrimary.get(definition.key) ?? []), row])
    if (definition.fallbackKey) byBand.set(definition.fallbackKey, [...(byBand.get(definition.fallbackKey) ?? []), row])
  }
  return rows.map((row) => {
    const definition = groupDefinition(row)
    const primary = definition.key ? byPrimary.get(definition.key) ?? [] : []
    const fallback = definition.fallbackKey ? byBand.get(definition.fallbackKey) ?? [] : []
    const group = primary.length >= 5 ? primary : fallback.length >= 5 ? fallback : []
    if (group.length < 5 || row.fulltimeSalary === null) {
      return { ...row, peerGroupDefinition: primary.length >= 5 ? definition.label : fallback.length >= 5 ? definition.fallbackLabel : null, peerGroupSize: null, peerMedian: null, peerAverage: null, medianDelta: null, medianDeltaPercentage: null, relativePosition: null, peerStatus: 'INSUFFICIENT' }
    }
    const salaries = group.map((member) => member.fulltimeSalary)
    const median = medianScaled(salaries)
    const average = averageScaled(salaries)
    const own = parseScaled(row.fulltimeSalary, MONEY_SCALE)
    const medianValue = parseScaled(median, MONEY_SCALE)
    const delta = own !== null && medianValue !== null ? formatScaled(own - medianValue, MONEY_SCALE) : null
    const deltaPercentage = own !== null && medianValue !== null && medianValue !== BigInt(0)
      ? formatScaled(divideRoundedHalfUp((own - medianValue) * BigInt(100) * BigInt(10) ** BigInt(PERCENTAGE_SCALE), medianValue), PERCENTAGE_SCALE)
      : null
    const rank = group.filter((member) => compareScaled(member.fulltimeSalary, row.fulltimeSalary, MONEY_SCALE) <= 0).length
    const relativePosition = formatScaled(divideRoundedHalfUp(BigInt(rank) * BigInt(100) * BigInt(10) ** BigInt(PERCENTAGE_SCALE), BigInt(group.length)), PERCENTAGE_SCALE)
    return { ...row, peerGroupDefinition: primary.length >= 5 ? definition.label : definition.fallbackLabel, peerGroupSize: group.length, peerMedian: median, peerAverage: average, medianDelta: delta, medianDeltaPercentage: deltaPercentage, relativePosition, peerStatus: 'SUFFICIENT' }
  })
}

function expandExceptionRows(rows: readonly SalaryInsightRow[]): SalaryInsightRow[] {
  return rows.flatMap((row) => row.exceptionTypes.map((type) => ({ ...row, exceptionType: type, exceptionSeverity: exceptionSeverity(type) })))
}

function reportRows(report: SalaryInsightReportId, rows: readonly SalaryInsightRow[]): SalaryInsightRow[] {
  if (report === 'salary-band-position' || report === 'salary-band-status') return rows.filter((row) => row.salaryRoute === 'SALARY_BAND')
  if (report === 'salary-scale-steps') return rows.filter((row) => row.salaryRoute === 'SCALE_WITH_STEPS')
  if (report === 'salary-structure-exceptions') return expandExceptionRows(rows)
  return [...rows]
}

function reportKpis(report: SalaryInsightReportId, rows: readonly SalaryInsightRow[], asOfDate: string): SalaryInsightKpi[] {
  if (report === 'salary-band-position') return bandKpis(rows, asOfDate)
  if (report === 'salary-band-status') return bandStatusKpis(rows, asOfDate)
  if (report === 'salary-scale-steps') return scaleKpis(rows, asOfDate)
  if (report === 'salary-structure-exceptions') return exceptionKpis(rows, asOfDate)
  if (report === 'salary-internal-position') return internalKpis(rows, asOfDate)
  return overviewKpis(rows, asOfDate)
}

function defaultGroupBy(report: SalaryInsightReportId): SalaryInsightGroupBy {
  if (report === 'salary-band-position') return 'salaryBand'
  if (report === 'salary-band-status') return 'status'
  if (report === 'salary-scale-steps') return 'salaryScale'
  if (report === 'salary-structure-exceptions') return 'exceptionType'
  if (report === 'salary-internal-position') return 'function'
  return 'salaryRoute'
}

function defaultSortBy(report: SalaryInsightReportId): SalaryInsightSortBy {
  if (report === 'salary-band-position') return 'compa-desc'
  if (report === 'salary-band-status') return 'status'
  if (report === 'salary-scale-steps') return 'structure'
  if (report === 'salary-structure-exceptions') return 'severity'
  if (report === 'salary-internal-position') return 'median-delta'
  return 'name'
}

export function createSalaryInsightReport(input: {
  report: SalaryInsightReportId
  asOfDate: string
  rows: readonly SalaryInsightProjectionRow[]
  filters: SalaryInsightFilters
  isHrAdmin: boolean
}): SalaryInsightReport {
  const normalized = normalizeSalaryInsightRows(input.rows)
  const authorizedPopulation = normalized.length
  const filtered = filterSalaryInsightRows(normalized, input.filters)
  const selectedRows = reportRows(input.report, filtered)
  const reportSpecificRows = input.report === 'salary-internal-position' && input.isHrAdmin ? applyPeerMetrics(selectedRows) : selectedRows
  const rows = sortSalaryInsightRows(reportSpecificRows, input.filters.sortBy ?? defaultSortBy(input.report))
  return {
    report: input.report,
    asOfDate: input.asOfDate,
    total: rows.length,
    authorizedPopulation,
    filters: input.filters,
    kpis: reportKpis(input.report, rows, input.asOfDate),
    groups: groupSalaryInsightRows(rows, input.filters.groupBy ?? defaultGroupBy(input.report)),
    chart: reportChart(input.report, rows, input.filters.groupBy ?? defaultGroupBy(input.report)),
    rows,
    filterOptions: buildSalaryInsightFilterOptions(reportRows(input.report, normalized), input.filters),
  }
}

export function defaultSalaryInsightFilters(report: SalaryInsightReportId, asOfDate = new Date().toISOString().slice(0, 10)): SalaryInsightFilters {
  return {
    asOfDate,
    groupBy: defaultGroupBy(report),
    sortBy: defaultSortBy(report),
    administrations: [], departments: [], teams: [], managers: [], functions: [], functionGroups: [], locations: [], laborConditions: [], structures: [], bands: [], scales: [], steps: [], fteBuckets: [], employmentTypes: [], salaryRoutes: [], statuses: [], severities: [], exceptionTypes: [],
  }
}

export function salaryInsightExceptionLabel(type: SalaryInsightExceptionType): string {
  return type
}

export function salaryInsightRouteLabel(route: string | null): string {
  return route ?? 'NO_SALARY'
}

export function salaryInsightStatusLabel(status: string | null): string {
  return status ?? 'VALID'
}

export function salaryInsightGroupDefault(report: SalaryInsightReportId): SalaryInsightGroupBy {
  return defaultGroupBy(report)
}
