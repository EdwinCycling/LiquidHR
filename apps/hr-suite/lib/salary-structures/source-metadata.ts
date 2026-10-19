import type { SalaryStructureDraftInput } from './schemas'

type SalarySourceMetadata = NonNullable<SalaryStructureDraftInput['sourceMetadata']>
type SalaryStepRule = NonNullable<SalarySourceMetadata['stepRules']>[number]
type SalaryStepAdjustment = NonNullable<SalarySourceMetadata['stepAdjustments']>[number]

/** Keep validated import provenance intact when a saved revision is reopened as a draft. */
export function sourceMetadataForDraft(value: unknown): SalarySourceMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  if (typeof source.title !== 'string' || typeof source.version !== 'string'
    || typeof source.effectiveFrom !== 'string' || typeof source.effectiveTo !== 'string'
    || typeof source.url !== 'string' || typeof source.sha256 !== 'string'
    || typeof source.fileName !== 'string' || typeof source.rowCount !== 'number') return null

  const stepRules = source.stepRules === undefined ? undefined : parseStepRules(source.stepRules)
  const stepAdjustments = source.stepAdjustments === undefined ? undefined : parseStepAdjustments(source.stepAdjustments)
  if (stepRules === null || stepAdjustments === null) return null

  return {
    title: source.title,
    version: source.version,
    effectiveFrom: source.effectiveFrom,
    effectiveTo: source.effectiveTo,
    url: source.url,
    sha256: source.sha256,
    fileName: source.fileName,
    rowCount: source.rowCount,
    ...(stepRules ? { stepRules } : {}),
    ...(stepAdjustments ? { stepAdjustments } : {}),
  }
}

function parseStepRules(value: unknown): SalaryStepRule[] | null {
  if (!Array.isArray(value)) return null
  const parsed: SalaryStepRule[] = []
  for (const item of value) {
    const rule = objectRecord(item)
    if (!rule || typeof rule.code !== 'string' || typeof rule.percentage !== 'string'
      || typeof rule.description !== 'string' || typeof rule.condition !== 'string'
      || typeof rule.sourceReference !== 'string' || rule.automaticallyApplied !== false) return null
    parsed.push({
      code: rule.code,
      percentage: rule.percentage,
      description: rule.description,
      condition: rule.condition,
      sourceReference: rule.sourceReference,
      automaticallyApplied: false as const,
    })
  }
  return parsed
}

function parseStepAdjustments(value: unknown): SalaryStepAdjustment[] | null {
  if (!Array.isArray(value)) return null
  const parsed: SalaryStepAdjustment[] = []
  for (const item of value) {
    const adjustment = objectRecord(item)
    if (!adjustment || typeof adjustment.scaleCode !== 'string' || typeof adjustment.stepCode !== 'string'
      || typeof adjustment.basedOnStepCode !== 'string' || typeof adjustment.sourceCell !== 'string'
      || typeof adjustment.percentage !== 'string' || typeof adjustment.calculatedAmount !== 'string'
      || (adjustment.calculationMethod !== 'PREVIOUS_RATE_PERCENT_ROUNDED_HALF_UP_TO_CENT'
        && adjustment.calculationMethod !== 'SOURCE_TABLE_PUBLISHED_AMOUNT')
      || typeof adjustment.sourceRuleCode !== 'string') return null
    parsed.push({
      scaleCode: adjustment.scaleCode,
      stepCode: adjustment.stepCode,
      basedOnStepCode: adjustment.basedOnStepCode,
      sourceCell: adjustment.sourceCell,
      percentage: adjustment.percentage,
      calculatedAmount: adjustment.calculatedAmount,
      calculationMethod: adjustment.calculationMethod,
      sourceRuleCode: adjustment.sourceRuleCode,
    })
  }
  return parsed
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}
