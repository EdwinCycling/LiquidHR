import { z } from 'zod'

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
})
const money = z.string().regex(/^\d{1,12}\.\d{2}$/)
const percentage = z.string().regex(/^\d{1,3}(?:\.\d{1,4})?$/)
const currencyCode = z.string().regex(/^[A-Z]{3}$/)
const optionalText = z.string().trim().max(1000).nullish()
const progressionType = z.enum(['MANUAL', 'TIME_IN_STEP', 'FIXED_DATE'])

function cents(value: string): bigint {
  return BigInt(value.replace('.', ''))
}

export const salaryStructureCreateSchema = z.object({
  structureType: z.enum(['SCALE_WITH_STEPS', 'SALARY_BAND']),
  code: z.string().trim().min(1).max(40).toUpperCase().nullable(),
  name: z.string().trim().min(1).max(160),
  description: optionalText,
}).strict()

export const salaryStructureUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  code: z.string().trim().min(1).max(40).toUpperCase().nullable(),
  description: optionalText,
}).strict()

const salaryStepSchema = z.object({
  stepCode: z.string().trim().min(1).max(40),
  stepName: z.string().trim().min(1).max(120),
  sequenceNumber: z.number().int().min(0).max(999),
  fulltimeAmount: money,
  hourlyAmount: z.string().regex(/^\d{1,10}\.\d{4}$/).nullable().optional(),
  progressionType,
  monthsToNextStep: z.number().int().positive().max(1200).nullable(),
  stepKind: z.enum(['REGULAR', 'START', 'MAXIMUM', 'SPECIAL']),
}).strict()

const salaryScaleSchema = z.object({
  logicalScaleId: z.guid().optional(),
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(160),
  description: optionalText,
  sortOrder: z.number().int().min(0).max(999),
  progressionType,
  defaultMonthsToNextStep: z.number().int().positive().max(1200).nullable(),
  steps: z.array(salaryStepSchema).min(1).max(250),
}).strict().superRefine((value, context) => {
  const stepCodes = value.steps.map((step) => step.stepCode.toLocaleUpperCase('nl-NL'))
  const sequences = value.steps.map((step) => step.sequenceNumber)
  if (new Set(stepCodes).size !== stepCodes.length) context.addIssue({ code: 'custom', path: ['steps'], message: 'DUPLICATE_STEP_CODE' })
  if (new Set(sequences).size !== sequences.length) context.addIssue({ code: 'custom', path: ['steps'], message: 'DUPLICATE_STEP_ORDER' })
  const finalSequence = Math.max(...sequences)
  const finalStep = value.steps.find((step) => step.sequenceNumber === finalSequence)
  if (finalStep && (finalStep.progressionType !== 'MANUAL' || finalStep.monthsToNextStep !== null)) {
    context.addIssue({ code: 'custom', path: ['steps'], message: 'FINAL_STEP_PROGRESSION_INVALID' })
  }
})

const salaryBandSchema = z.object({
  logicalBandId: z.guid().optional(),
  identityKey: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(160),
  sortOrder: z.number().int().min(0).max(999),
  inputMethod: z.enum(['MIDPOINT_SPREAD', 'MIN_MAX', 'MANUAL_ANCHORS']),
  minimum: money,
  midpoint: money,
  maximum: money.nullable(),
  inputSpreadPercentage: percentage.nullable(),
}).strict().superRefine((value, context) => {
  const minimum = cents(value.minimum)
  const midpoint = cents(value.midpoint)
  const maximum = value.maximum === null ? null : cents(value.maximum)
  if (minimum <= BigInt(0) || midpoint <= minimum || (maximum !== null && maximum <= midpoint)) {
    context.addIssue({ code: 'custom', path: ['minimum'], message: 'INVALID_BAND_ANCHORS' })
  }
  if (value.inputMethod === 'MIDPOINT_SPREAD' && value.inputSpreadPercentage === null) {
    context.addIssue({ code: 'custom', path: ['inputSpreadPercentage'], message: 'SPREAD_REQUIRED' })
  }
})

const sourceMetadataSchema = z.object({
  title: z.string().trim().min(1).max(180),
  version: z.string().trim().min(1).max(80),
  effectiveFrom: dateOnly,
  effectiveTo: dateOnly,
  url: z.string().trim().url().max(500).refine((value) => {
    try {
      const parsed = new URL(value)
      return parsed.protocol === 'https:' && !parsed.username && !parsed.password
    } catch {
      return false
    }
  }),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i).transform((value) => value.toLowerCase()),
  fileName: z.string().trim().min(1).max(260),
  rowCount: z.number().int().positive().max(10_000),
  stepRules: z.array(z.object({
    code: z.string().trim().min(1).max(80),
    percentage: percentage.refine((value) => Number(value) > 0 && Number(value) <= 100),
    description: z.string().trim().min(1).max(500),
    condition: z.string().trim().min(1).max(1000),
    sourceReference: z.string().trim().min(1).max(300),
    automaticallyApplied: z.literal(false),
  }).strict()).max(100).optional(),
  stepAdjustments: z.array(z.object({
    scaleCode: z.string().trim().min(1).max(40),
    stepCode: z.string().trim().min(1).max(40),
    basedOnStepCode: z.string().trim().min(1).max(40),
    sourceCell: z.string().regex(/^\d+(?:[.,]\d{1,4})?%$/),
    percentage: percentage.refine((value) => Number(value) > 0 && Number(value) <= 100),
    calculatedAmount: money,
    calculationMethod: z.enum(['PREVIOUS_RATE_PERCENT_ROUNDED_HALF_UP_TO_CENT', 'SOURCE_TABLE_PUBLISHED_AMOUNT']),
    sourceRuleCode: z.string().trim().min(1).max(80),
  }).strict()).max(10_000).optional(),
}).strict().superRefine((value, context) => {
  if (value.effectiveTo < value.effectiveFrom) context.addIssue({ code: 'custom', path: ['effectiveTo'], message: 'SOURCE_PERIOD_INVALID' })
  const rules = value.stepRules ?? []
  const adjustments = value.stepAdjustments ?? []
  const ruleCodes = new Set(rules.map((rule) => rule.code))
  if (ruleCodes.size !== rules.length) context.addIssue({ code: 'custom', path: ['stepRules'], message: 'DUPLICATE_SOURCE_STEP_RULE' })
  const adjustmentKeys = adjustments.map((adjustment) => `${adjustment.scaleCode.toUpperCase()}\u0000${adjustment.stepCode.toUpperCase()}`)
  if (new Set(adjustmentKeys).size !== adjustmentKeys.length) context.addIssue({ code: 'custom', path: ['stepAdjustments'], message: 'DUPLICATE_SOURCE_STEP_ADJUSTMENT' })
  for (const [index, adjustment] of adjustments.entries()) {
    if (!ruleCodes.has(adjustment.sourceRuleCode)) context.addIssue({ code: 'custom', path: ['stepAdjustments', index, 'sourceRuleCode'], message: 'SOURCE_STEP_RULE_NOT_FOUND' })
  }
})

const draftBase = z.object({
  effectiveFrom: dateOnly,
  salaryBasis: z.enum(['MONTHLY_BASE', 'FOUR_WEEKLY_BASE', 'ANNUAL_BASE', 'HOURLY']),
  currencyCode,
  description: optionalText,
  sourceMetadata: sourceMetadataSchema.nullish(),
  correctionOfRevisionId: z.guid().nullable().optional(),
}).strict()

const scaleDraftSchema = draftBase.extend({
  structureType: z.literal('SCALE_WITH_STEPS'),
  scales: z.array(salaryScaleSchema).min(1).max(100),
}).strict().superRefine((value, context) => {
  const codes = value.scales.map((scale) => scale.code.toLocaleUpperCase('nl-NL'))
  const orders = value.scales.map((scale) => scale.sortOrder)
  if (new Set(codes).size !== codes.length) context.addIssue({ code: 'custom', path: ['scales'], message: 'DUPLICATE_SCALE_CODE' })
  if (new Set(orders).size !== orders.length) context.addIssue({ code: 'custom', path: ['scales'], message: 'DUPLICATE_SCALE_ORDER' })
})

const bandDraftSchema = draftBase.extend({
  structureType: z.literal('SALARY_BAND'),
  bands: z.array(salaryBandSchema).min(1).max(100),
}).strict().superRefine((value, context) => {
  const codes = value.bands.map((band) => band.code.toLocaleUpperCase('nl-NL'))
  const identityKeys = value.bands.map((band) => band.identityKey.toLocaleUpperCase('nl-NL'))
  const orders = value.bands.map((band) => band.sortOrder)
  if (new Set(codes).size !== codes.length) context.addIssue({ code: 'custom', path: ['bands'], message: 'DUPLICATE_BAND_CODE' })
  if (new Set(identityKeys).size !== identityKeys.length) context.addIssue({ code: 'custom', path: ['bands'], message: 'DUPLICATE_BAND_IDENTITY' })
  if (new Set(orders).size !== orders.length) context.addIssue({ code: 'custom', path: ['bands'], message: 'DUPLICATE_BAND_ORDER' })
  const highestOrder = Math.max(...orders)
  if (value.bands.some((band) => band.maximum === null && band.sortOrder !== highestOrder)) {
    context.addIssue({ code: 'custom', path: ['bands'], message: 'OPEN_BAND_NOT_HIGHEST' })
  }
})

export const salaryStructureDraftSchema = z.discriminatedUnion('structureType', [scaleDraftSchema, bandDraftSchema])
  .superRefine((value, context) => {
    if (value.sourceMetadata && value.sourceMetadata.effectiveFrom !== value.effectiveFrom) {
      context.addIssue({ code: 'custom', path: ['sourceMetadata', 'effectiveFrom'], message: 'SOURCE_EFFECTIVE_DATE_MISMATCH' })
    }
    if (value.correctionOfRevisionId && !value.sourceMetadata) {
      context.addIssue({ code: 'custom', path: ['correctionOfRevisionId'], message: 'CORRECTION_SOURCE_REQUIRED' })
    }
  })

export const salaryStructureDraftSaveSchema = z.object({
  draftId: z.guid().nullable(),
  expectedLockVersion: z.number().int().positive().nullable(),
  draft: salaryStructureDraftSchema,
}).strict().superRefine((value, context) => {
  if ((value.draftId === null) !== (value.expectedLockVersion === null)) {
    context.addIssue({
      code: 'custom',
      message: 'DRAFT_ID_AND_LOCK_VERSION_MUST_BOTH_BE_SET_OR_NULL',
      path: ['expectedLockVersion'],
    })
  }
})

export const salaryStructurePublishSchema = z.object({
  expectedLockVersion: z.number().int().positive(),
}).strict()

export const laborConditionSalaryStructuresSchema = z.object({
  salaryStructureIds: z.array(z.guid()).max(250),
}).strict().superRefine((value, context) => {
  if (new Set(value.salaryStructureIds).size !== value.salaryStructureIds.length) {
    context.addIssue({ code: 'custom', path: ['salaryStructureIds'], message: 'DUPLICATE_SALARY_STRUCTURE' })
  }
})

export const salaryStructureMigrationConflictSchema = z.object({
  action: z.enum(['KEEP_SEPARATE', 'RENAME_OR_RECODE', 'TREAT_AS_SAME', 'LATER']),
  note: z.string().trim().max(500).nullable(),
}).strict()

export type SalaryStructureCreateInput = z.infer<typeof salaryStructureCreateSchema>
export type SalaryStructureUpdateInput = z.infer<typeof salaryStructureUpdateSchema>
export type SalaryStructureDraftInput = z.infer<typeof salaryStructureDraftSchema>
export type SalaryStructureDraftSaveInput = z.infer<typeof salaryStructureDraftSaveSchema>
