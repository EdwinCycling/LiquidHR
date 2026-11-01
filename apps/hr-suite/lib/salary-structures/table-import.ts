import { salaryStructureDraftSchema, type SalaryStructureDraftInput } from './schemas'

export type SalaryTableImportMetadata = {
  readonly effectiveFrom: string
  readonly effectiveTo: string
  readonly salaryBasis: 'MONTHLY_BASE' | 'FOUR_WEEKLY_BASE' | 'ANNUAL_BASE' | 'HOURLY'
  readonly sourceTitle: string
  readonly sourceVersion: string
  readonly sourceUrl: string
  readonly sourceSha256: string
  readonly sourceFileName: string
}

export type SalaryTableImportRow = {
  readonly scaleCode: string
  readonly scaleName: string
  readonly stepCode: string
  readonly stepName: string
  readonly sequenceNumber: number
  readonly fulltimeAmount: string
  readonly hourlyAmount: string | null
  readonly stepKind: 'REGULAR' | 'START' | 'MAXIMUM' | 'SPECIAL'
  readonly sourceRule: { readonly sourceCell: string; readonly percentage: string; readonly description: string } | null
}

type SourceStepRule = {
  readonly code: string
  readonly percentage: string
  readonly description: string
  readonly condition: string
  readonly sourceReference: string
  readonly automaticallyApplied: false
}

type SourceStepAdjustment = {
  readonly scaleCode: string
  readonly stepCode: string
  readonly basedOnStepCode: string
  readonly sourceCell: string
  readonly percentage: string
  readonly calculatedAmount: string
  readonly calculationMethod: 'PREVIOUS_RATE_PERCENT_ROUNDED_HALF_UP_TO_CENT' | 'SOURCE_TABLE_PUBLISHED_AMOUNT'
  readonly sourceRuleCode: string
}

export type SalaryTableImportResult = {
  readonly draft: SalaryStructureDraftInput | null
  readonly rows: readonly SalaryTableImportRow[]
  readonly errors: readonly string[]
  readonly warnings: readonly string[]
}

const canonicalDate = /^\d{4}-\d{2}-\d{2}$/
const sha256Pattern = /^[a-f0-9]{64}$/i
const progressionTypes = new Set(['MANUAL', 'TIME_IN_STEP', 'FIXED_DATE'])
const stepKinds = new Set(['REGULAR', 'START', 'MAXIMUM', 'SPECIAL'])

function validDate(value: string): boolean {
  if (!canonicalDate.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function splitCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const value = text.replace(/^\uFEFF/, '')
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (character === '"') {
      if (quoted && value[index + 1] === '"') { cell += '"'; index += 1 }
      else quoted = !quoted
    } else if (character === delimiter && !quoted) {
      row.push(cell.trim())
      cell = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && value[index + 1] === '\n') index += 1
      row.push(cell.trim())
      if (row.some((item) => item !== '')) rows.push(row)
      row = []
      cell = ''
    } else cell += character
  }
  if (quoted) throw new Error('CSV_UNCLOSED_QUOTE')
  row.push(cell.trim())
  if (row.some((item) => item !== '')) rows.push(row)
  return rows
}

function normalizedHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function columnIndex(headers: readonly string[], ...aliases: string[]): number {
  return headers.findIndex((header) => aliases.includes(header))
}

function field(cells: readonly string[], index: number, fallback = ''): string {
  return index < 0 ? fallback : (cells[index] ?? '').trim()
}

function decimal(value: string, scale: 2 | 4): string | null {
  const cleaned = value.trim().replace(/[€$\s\u00a0]/g, '')
  if (!cleaned || !/^[0-9.,]+$/.test(cleaned)) return null
  const comma = cleaned.lastIndexOf(',')
  const dot = cleaned.lastIndexOf('.')
  let decimalSeparator: ',' | '.' | null = null
  if (comma >= 0 && dot >= 0) decimalSeparator = comma > dot ? ',' : '.'
  else if (comma >= 0) decimalSeparator = ','
  else if (dot >= 0 && cleaned.length - dot - 1 !== 3) decimalSeparator = '.'
  const parts = decimalSeparator
    ? cleaned.split(decimalSeparator)
    : [cleaned]
  if (parts.length > 2) return null
  const whole = parts[0].replace(/[.,]/g, '')
  const fraction = (parts[1] ?? '').replace(/[.,]/g, '')
  if (!/^\d+$/.test(whole) || (fraction && !/^\d+$/.test(fraction)) || fraction.length > scale) return null
  const padded = fraction.padEnd(scale, '0')
  const amount = `${whole.replace(/^0+(?=\d)/, '')}.${padded}`
  if (/^0+\.0+$/.test(amount)) return null
  return amount
}

function parsePercent(value: string): { readonly normalized: string; readonly units: bigint } | null {
  const cleaned = value.trim().replace(',', '.')
  const match = /^(\d{1,3})(?:\.(\d{1,4}))?$/.exec(cleaned)
  if (!match) return null
  const whole = BigInt(match[1])
  const fractionalUnits = BigInt((match[2] ?? '').padEnd(4, '0') || '0')
  const units = whole * BigInt(10_000) + fractionalUnits
  if (units <= BigInt(0) || units > BigInt(1_000_000)) return null
  const visibleFraction = (match[2] ?? '').padEnd(Math.max(2, match[2]?.length ?? 0), '0')
  return { normalized: `${whole}.${visibleFraction}`, units }
}

function cents(value: string): bigint {
  return BigInt(value.replace('.', ''))
}

function formatMoneyCents(value: bigint, digits: 2 | 4): string {
  const amount = digits === 4 ? value * BigInt(100) : value
  const divisor = digits === 4 ? BigInt(10_000) : BigInt(100)
  return `${amount / divisor}.${(amount % divisor).toString().padStart(digits, '0')}`
}

function applyPercentage(previous: { readonly numerator: bigint; readonly denominator: bigint }, percentageUnits: bigint): { readonly exact: { readonly numerator: bigint; readonly denominator: bigint }; readonly cents: bigint } {
  const denominator = BigInt(1_000_000)
  const exact = { numerator: previous.numerator * (denominator + percentageUnits), denominator: previous.denominator * denominator }
  const roundedCents = (exact.numerator * BigInt(2) + exact.denominator) / (BigInt(2) * exact.denominator)
  return { exact, cents: roundedCents }
}

export function parseSalaryTableImport(csv: string, metadata: SalaryTableImportMetadata): SalaryTableImportResult {
  const errors: string[] = []
  const warnings: string[] = []
  if (!csv.trim()) errors.push('CSV_EMPTY')
  if (csv.length > 900_000) errors.push('CSV_TOO_LARGE')
  if (!validDate(metadata.effectiveFrom) || !validDate(metadata.effectiveTo) || metadata.effectiveTo < metadata.effectiveFrom) errors.push('EFFECTIVE_PERIOD_INVALID')
  if (!metadata.sourceTitle.trim()) errors.push('SOURCE_TITLE_REQUIRED')
  if (metadata.sourceTitle.trim().length > 180) errors.push('SOURCE_TITLE_TOO_LONG')
  if (!metadata.sourceVersion.trim()) errors.push('SOURCE_VERSION_REQUIRED')
  if (metadata.sourceVersion.trim().length > 80) errors.push('SOURCE_VERSION_TOO_LONG')
  if (!metadata.sourceFileName.trim()) errors.push('SOURCE_FILE_REQUIRED')
  if (metadata.sourceFileName.trim().length > 260) errors.push('SOURCE_FILE_NAME_TOO_LONG')
  if (!sha256Pattern.test(metadata.sourceSha256)) errors.push('SOURCE_HASH_INVALID')
  try {
    const sourceUrl = new URL(metadata.sourceUrl.trim())
    if (sourceUrl.protocol !== 'https:') errors.push('SOURCE_URL_HTTPS_REQUIRED')
    if (sourceUrl.username || sourceUrl.password || metadata.sourceUrl.trim().length > 500) errors.push('SOURCE_URL_INVALID')
  } catch {
    errors.push('SOURCE_URL_INVALID')
  }

  let parsedRows: string[][] = []
  try { parsedRows = splitCsv(csv) } catch { errors.push('CSV_INVALID') }
  const headers = (parsedRows.shift() ?? []).map(normalizedHeader)
  const requiredColumns = {
    scaleCode: columnIndex(headers, 'scale_code', 'scale', 'function_group', 'functiegroep'),
    scaleName: columnIndex(headers, 'scale_name', 'scale_label', 'scale_description', 'schaalnaam'),
    stepCode: columnIndex(headers, 'step_code', 'step', 'salary_number', 'salarisnummer', 'trede'),
    stepName: columnIndex(headers, 'step_name', 'step_label', 'step_description', 'tredenaam'),
    sequenceNumber: columnIndex(headers, 'step_order', 'sequence_number', 'sequence', 'volgorde'),
  }
  if (Object.values(requiredColumns).some((index) => index < 0)) errors.push('CSV_REQUIRED_COLUMNS_MISSING')
  const fulltimeColumn = columnIndex(headers, 'fulltime_amount', 'monthly_amount', 'amount', 'bedrag')
  const hourlyColumn = columnIndex(headers, 'hourly_amount', 'hourly_rate', 'hourly_wage', 'uurloon')
  if (fulltimeColumn < 0 && hourlyColumn < 0) errors.push('CSV_AMOUNT_COLUMN_MISSING')

  const scaleSortColumn = columnIndex(headers, 'scale_order', 'scale_sort_order', 'schaalvolgorde')
  const stepKindColumn = columnIndex(headers, 'step_kind', 'staptype')
  const progressionColumn = columnIndex(headers, 'progression_type', 'voortgangstype')
  const monthsColumn = columnIndex(headers, 'months_to_next_step', 'months_to_next', 'maanden_tot_volgende_trede')
  const ruleColumns = {
    code: columnIndex(headers, 'source_rule_code', 'regelcode'),
    percentage: columnIndex(headers, 'source_rule_percent', 'regelpercentage'),
    description: columnIndex(headers, 'source_rule_description', 'regelomschrijving'),
    condition: columnIndex(headers, 'source_rule_condition', 'regelvoorwaarde'),
    reference: columnIndex(headers, 'source_rule_reference', 'regelbron'),
  }
  const hasRuleColumns = Object.values(ruleColumns).every((index) => index >= 0)
  if (Object.values(ruleColumns).some((index) => index >= 0) && !hasRuleColumns) errors.push('CSV_SOURCE_RULE_COLUMNS_INCOMPLETE')
  const groups = new Map<string, {
    code: string
    name: string
    order: number
    rows: Array<{
      row: SalaryTableImportRow
      progressionType: string
      months: number | null
      stepKindProvided: boolean
      rowNumber: number
      percentageUnits: bigint | null
      sourceRuleMode: 'PERCENT_CELL' | 'SOURCE_TABLE_AMOUNT' | null
      sourceRule: SourceStepRule | null
      exactAmount: { readonly numerator: bigint; readonly denominator: bigint } | null
    }>
  }>()
  const sourceRules = new Map<string, SourceStepRule>()
  const stepAdjustments: SourceStepAdjustment[] = []
  const seen = new Set<string>()

  parsedRows.forEach((cells, rowIndex) => {
    const rowNumber = rowIndex + 2
    const scaleCode = field(cells, requiredColumns.scaleCode).toUpperCase()
    const scaleName = field(cells, requiredColumns.scaleName)
    const stepCode = field(cells, requiredColumns.stepCode)
    const stepName = field(cells, requiredColumns.stepName)
    const orderValue = field(cells, requiredColumns.sequenceNumber)
    const sequenceNumber = /^\d+$/.test(orderValue) ? Number(orderValue) : Number.NaN
    if (!scaleCode || !scaleName || !stepCode || !stepName || !Number.isInteger(sequenceNumber) || sequenceNumber < 0 || sequenceNumber > 999) {
      errors.push(`CSV_ROW_${rowNumber}_IDENTITY_INVALID`)
      return
    }
    const identity = `${scaleCode}\u0000${stepCode.toUpperCase()}`
    if (seen.has(identity)) errors.push(`CSV_ROW_${rowNumber}_DUPLICATE_STEP`)
    seen.add(identity)

    const fulltimeText = field(cells, fulltimeColumn)
    const hourlyText = field(cells, hourlyColumn)
    const fulltimeTextForBasis = metadata.salaryBasis === 'HOURLY' ? (fulltimeText || hourlyText) : fulltimeText
    const percentCell = /^(\d{1,3}(?:[.,]\d{1,4})?)\s*%$/.exec(fulltimeTextForBasis)
    const percentage = percentCell ? parsePercent(percentCell[1]) : null
    if (percentCell && !percentage) errors.push(`CSV_ROW_${rowNumber}_PERCENT_INVALID`)
    const ruleValues = hasRuleColumns ? {
      code: field(cells, ruleColumns.code),
      percentage: field(cells, ruleColumns.percentage),
      description: field(cells, ruleColumns.description),
      condition: field(cells, ruleColumns.condition),
      sourceReference: field(cells, ruleColumns.reference),
    } : null
    const hasRuleMetadata = Boolean(ruleValues && Object.values(ruleValues).some(Boolean))
    let sourceRule: SourceStepRule | null = null
    let sourceRuleMode: 'PERCENT_CELL' | 'SOURCE_TABLE_AMOUNT' | null = null
    let sourceRulePercentageUnits: bigint | null = null
    let fulltimeAmount = ''
    let hourlyAmount: string | null = null
    if (percentCell) {
      const rulePercentage = parsePercent(ruleValues?.percentage ?? '')
      if (!ruleValues || !ruleValues.code || !rulePercentage || !ruleValues.description || !ruleValues.condition || !ruleValues.sourceReference
        || !percentage || percentage.units !== rulePercentage.units) {
        errors.push(`CSV_ROW_${rowNumber}_PERCENT_RULE_METADATA_INVALID`)
      } else {
        sourceRule = {
          code: ruleValues.code,
          percentage: rulePercentage.normalized,
          description: ruleValues.description,
          condition: ruleValues.condition,
          sourceReference: ruleValues.sourceReference,
          automaticallyApplied: false,
        }
        sourceRuleMode = 'PERCENT_CELL'
        sourceRulePercentageUnits = rulePercentage.units
        const existingRule = sourceRules.get(sourceRule.code)
        if (existingRule && JSON.stringify(existingRule) !== JSON.stringify(sourceRule)) errors.push(`CSV_ROW_${rowNumber}_SOURCE_RULE_CONFLICT`)
        else sourceRules.set(sourceRule.code, sourceRule)
        if (field(cells, progressionColumn, 'MANUAL').toUpperCase() !== 'MANUAL') errors.push(`CSV_ROW_${rowNumber}_RULE_PROGRESSION_MUST_BE_MANUAL`)
      }
    } else {
      if (hasRuleMetadata) {
        const rulePercentage = parsePercent(ruleValues?.percentage ?? '')
        if (!ruleValues || !ruleValues.code || !rulePercentage || !ruleValues.description || !ruleValues.condition || !ruleValues.sourceReference) {
          errors.push(`CSV_ROW_${rowNumber}_PUBLISHED_AMOUNT_RULE_METADATA_INVALID`)
        } else {
          sourceRule = {
            code: ruleValues.code,
            percentage: rulePercentage.normalized,
            description: ruleValues.description,
            condition: ruleValues.condition,
            sourceReference: ruleValues.sourceReference,
            automaticallyApplied: false,
          }
          sourceRuleMode = 'SOURCE_TABLE_AMOUNT'
          sourceRulePercentageUnits = rulePercentage.units
          const existingRule = sourceRules.get(sourceRule.code)
          if (existingRule && JSON.stringify(existingRule) !== JSON.stringify(sourceRule)) errors.push(`CSV_ROW_${rowNumber}_SOURCE_RULE_CONFLICT`)
          else sourceRules.set(sourceRule.code, sourceRule)
        }
      }
      fulltimeAmount = decimal(fulltimeTextForBasis, 2) ?? ''
      hourlyAmount = hourlyText ? decimal(hourlyText, 4) : metadata.salaryBasis === 'HOURLY' ? decimal(fulltimeTextForBasis, 4) : null
      if (!fulltimeAmount || (hourlyText && !hourlyAmount) || (metadata.salaryBasis === 'HOURLY' && !hourlyAmount)) {
        errors.push(`CSV_ROW_${rowNumber}_AMOUNT_INVALID`)
        return
      }
    }

    const rawSort = field(cells, scaleSortColumn)
    const existingGroup = groups.get(scaleCode)
    const scaleOrder = rawSort && /^\d+$/.test(rawSort) ? Number(rawSort) : rawSort ? Number.NaN : existingGroup?.order ?? groups.size + 1
    if (!Number.isInteger(scaleOrder) || scaleOrder < 0 || scaleOrder > 999) errors.push(`CSV_ROW_${rowNumber}_SCALE_ORDER_INVALID`)
    const rawKind = field(cells, stepKindColumn).toUpperCase()
    const kind = stepKinds.has(rawKind) ? rawKind as SalaryTableImportRow['stepKind'] : null
    if (rawKind && !kind) errors.push(`CSV_ROW_${rowNumber}_STEP_KIND_INVALID`)
    const rawProgression = field(cells, progressionColumn, 'MANUAL').toUpperCase()
    const progressionType = progressionTypes.has(rawProgression) ? rawProgression : 'INVALID'
    const rawMonths = field(cells, monthsColumn)
    const months = rawMonths && /^\d+$/.test(rawMonths) ? Number(rawMonths) : null
    if (progressionType === 'INVALID') errors.push(`CSV_ROW_${rowNumber}_PROGRESSION_INVALID`)
    if (rawMonths && (months === null || months < 1 || months > 1200)) errors.push(`CSV_ROW_${rowNumber}_MONTHS_INVALID`)
    if (sourceRuleMode === 'PERCENT_CELL' && progressionType !== 'MANUAL') errors.push(`CSV_ROW_${rowNumber}_RULE_PROGRESSION_MUST_BE_MANUAL`)

    const group = existingGroup ?? { code: scaleCode, name: scaleName, order: scaleOrder, rows: [] }
    if (group.name !== scaleName || group.order !== scaleOrder) errors.push(`CSV_ROW_${rowNumber}_SCALE_IDENTITY_CONFLICT`)
    group.rows.push({
      row: { scaleCode, scaleName, stepCode, stepName, sequenceNumber, fulltimeAmount, hourlyAmount, stepKind: kind ?? 'REGULAR', sourceRule: sourceRule ? { sourceCell: sourceRuleMode === 'SOURCE_TABLE_AMOUNT' ? `${sourceRule.percentage}%` : fulltimeTextForBasis, percentage: sourceRule.percentage, description: sourceRule.description } : null },
      progressionType,
      months,
      stepKindProvided: Boolean(rawKind),
      rowNumber,
      percentageUnits: sourceRulePercentageUnits ?? percentage?.units ?? null,
      sourceRuleMode,
      sourceRule,
      exactAmount: fulltimeAmount ? { numerator: cents(fulltimeAmount), denominator: BigInt(1) } : null,
    })
    groups.set(scaleCode, group)
  })

  const scales = [...groups.values()].sort((left, right) => left.order - right.order).map((group) => {
    const entries = group.rows.sort((left, right) => left.row.sequenceNumber - right.row.sequenceNumber)
    const scaleStepOrder = new Set(entries.map((entry) => entry.row.sequenceNumber))
    if (scaleStepOrder.size !== entries.length) errors.push('CSV_SCALE_DUPLICATE_ORDER')
    const steps = entries.map((entry, index) => {
      if (entry.sourceRuleMode === 'PERCENT_CELL' && entry.sourceRule) {
        const previous = entries[index - 1]
        if (!previous || !previous.exactAmount || entry.percentageUnits === null) {
          errors.push(`CSV_ROW_${entry.rowNumber}_PERCENT_RULE_PREDECESSOR_MISSING`)
        } else {
          const applied = applyPercentage(previous.exactAmount, entry.percentageUnits)
          entry.exactAmount = applied.exact
          const calculatedCents = applied.cents
          const calculatedAmount = formatMoneyCents(calculatedCents, 2)
          entry.row = {
            ...entry.row,
            fulltimeAmount: calculatedAmount,
            hourlyAmount: metadata.salaryBasis === 'HOURLY' ? formatMoneyCents(calculatedCents, 4) : entry.row.hourlyAmount,
          }
          stepAdjustments.push({
            scaleCode: group.code,
            stepCode: entry.row.stepCode,
            basedOnStepCode: previous.row.stepCode,
            sourceCell: entry.row.sourceRule?.sourceCell ?? '',
            percentage: entry.sourceRule.percentage,
            calculatedAmount,
            calculationMethod: 'PREVIOUS_RATE_PERCENT_ROUNDED_HALF_UP_TO_CENT',
            sourceRuleCode: entry.sourceRule.code,
          })
        }
      } else if (entry.sourceRuleMode === 'SOURCE_TABLE_AMOUNT' && entry.sourceRule) {
        const previous = entries[index - 1]
        if (!previous) {
          errors.push(`CSV_ROW_${entry.rowNumber}_PERCENT_RULE_PREDECESSOR_MISSING`)
        } else {
          stepAdjustments.push({
            scaleCode: group.code,
            stepCode: entry.row.stepCode,
            basedOnStepCode: previous.row.stepCode,
            sourceCell: `${entry.sourceRule.percentage}%`,
            percentage: entry.sourceRule.percentage,
            calculatedAmount: entry.row.fulltimeAmount,
            calculationMethod: 'SOURCE_TABLE_PUBLISHED_AMOUNT',
            sourceRuleCode: entry.sourceRule.code,
          })
        }
      }
      const last = index === entries.length - 1
      if (!entry.stepKindProvided) {
        const expected = last ? 'MAXIMUM' : index === 0 ? 'START' : 'REGULAR'
        entry.row = { ...entry.row, stepKind: expected }
      }
      if (last && (entry.progressionType !== 'MANUAL' || entry.months !== null)) errors.push('CSV_FINAL_STEP_PROGRESSION_INVALID')
      const progressionType = last ? 'MANUAL' : entry.progressionType
      const monthsToNextStep = last ? null : entry.months
      return {
        stepCode: entry.row.stepCode,
        stepName: entry.row.stepName,
        sequenceNumber: entry.row.sequenceNumber,
        fulltimeAmount: entry.row.fulltimeAmount,
        hourlyAmount: entry.row.hourlyAmount,
        progressionType: progressionType as 'MANUAL' | 'TIME_IN_STEP' | 'FIXED_DATE',
        monthsToNextStep,
        stepKind: entry.row.stepKind,
      }
    })
    return {
      code: group.code,
      name: group.name,
      description: null,
      sortOrder: group.order,
      progressionType: 'MANUAL' as const,
      defaultMonthsToNextStep: null,
      steps,
    }
  })

  if (scales.length === 0) errors.push('CSV_NO_SCALE_ROWS')
  if (parsedRows.length > 0 && errors.length === 0) warnings.push(`${parsedRows.length} salary rows are ready for review.`)
  const sourceDescription = `Source reference: ${metadata.sourceTitle.trim()} | Version: ${metadata.sourceVersion.trim()} | Valid: ${metadata.effectiveFrom} to ${metadata.effectiveTo} | URL: ${metadata.sourceUrl.trim()} | SHA-256: ${metadata.sourceSha256.toLowerCase()}`
  if (sourceDescription.length > 1000) errors.push('SOURCE_REFERENCE_TOO_LONG')
  const draft: SalaryStructureDraftInput = {
    structureType: 'SCALE_WITH_STEPS',
    effectiveFrom: metadata.effectiveFrom,
    salaryBasis: metadata.salaryBasis,
    currencyCode: 'EUR',
    description: sourceDescription,
    sourceMetadata: {
      title: metadata.sourceTitle.trim(),
      version: metadata.sourceVersion.trim(),
      effectiveFrom: metadata.effectiveFrom,
      effectiveTo: metadata.effectiveTo,
      url: metadata.sourceUrl.trim(),
      sha256: metadata.sourceSha256.toLowerCase(),
      fileName: metadata.sourceFileName.trim(),
      rowCount: parsedRows.length,
        ...(sourceRules.size ? { stepRules: [...sourceRules.values()].sort((left, right) => left.code.localeCompare(right.code)) } : {}),
        ...(stepAdjustments.length ? { stepAdjustments } : {}),
    },
    correctionOfRevisionId: null,
    scales,
  }
  const schemaResult = salaryStructureDraftSchema.safeParse(draft)
  if (!schemaResult.success) errors.push(...schemaResult.error.issues.map((issue) => `DRAFT_${issue.code.toUpperCase()}`))
  return { draft: schemaResult.success && errors.length === 0 ? schemaResult.data : null, rows: [...groups.values()].flatMap((group) => group.rows.map((entry) => entry.row)), errors: [...new Set(errors)], warnings }
}
