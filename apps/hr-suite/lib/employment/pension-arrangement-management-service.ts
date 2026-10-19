import 'server-only'

import type { Json } from '@scope/db'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

type AuthContext = Awaited<ReturnType<typeof requirePermission>>
type ScopedPensionContext = AuthContext & { readonly hrGroupId: string; readonly administrationId: string }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ARRANGEMENT_TYPES = ['FLAT_PREMIUM', 'PROGRESSIVE_PREMIUM'] as const
const GRANDFATHERING_MODES = ['NONE', 'EERBIEDIGENDE_WERKING'] as const
const CONTRACT_CLASSIFICATIONS = ['SOLIDARITY', 'NON_SOLIDARITY', 'UNKNOWN'] as const
const SOURCE_STATUSES = ['REFERENCE_ONLY', 'EMPLOYER_RECORDED', 'VERIFIED_SOURCE'] as const
const PENSION_COMPONENT_TYPES = ['BASE', 'ADDITIONAL'] as const
const PENSION_COMPONENT_TAX_TREATMENTS = ['PRE_TAX_EMPLOYEE_DEDUCTION', 'EMPLOYER_COST_ONLY', 'UNVERIFIED'] as const

const pensionArrangementComponentSchema = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(180),
  componentType: z.enum(PENSION_COMPONENT_TYPES),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  basisCode: z.string().trim().min(1).max(100),
  basisDescription: z.string().trim().min(1).max(1000),
  totalRate: z.number().finite().min(0).max(100),
  employeeRate: z.number().finite().min(0).max(100),
  employerRate: z.number().finite().min(0).max(100),
  annualFranchise: z.number().finite().min(0),
  annualPensionableSalaryCap: z.number().finite().min(0).nullable(),
  eligibilityRule: z.string().trim().min(1).max(1000),
  calculationMethod: z.string().trim().min(1).max(1000),
  roundingRule: z.string().trim().min(1).max(500),
  sourceVersion: z.string().trim().min(1).max(180),
  sourceReference: z.string().url().max(1000),
  sourceSha256: z.string().regex(/^[0-9a-f]{64}$/i),
  sourceValidationStatus: z.enum(SOURCE_STATUSES),
  taxTreatment: z.enum(PENSION_COMPONENT_TAX_TREATMENTS),
}).strict().superRefine((component, context) => {
  if (component.effectiveTo !== null && component.effectiveTo < component.effectiveFrom) {
    context.addIssue({ code: 'custom', path: ['effectiveTo'], message: 'PENSION_COMPONENT_EFFECTIVE_PERIOD_INVALID' })
  }
  if (Math.abs(component.totalRate - component.employeeRate - component.employerRate) >= 0.0001) {
    context.addIssue({ code: 'custom', path: ['totalRate'], message: 'PENSION_COMPONENT_RATE_SPLIT_INVALID' })
  }
})

export type PensionArrangementComponentInput = z.infer<typeof pensionArrangementComponentSchema>

export type PensionArrangementTierInput = {
  readonly minAge: number
  readonly maxAge: number
  readonly totalRate: number
}

export type PensionArrangementCreateInput = {
  readonly code: string
  readonly name: string
  readonly arrangementType: (typeof ARRANGEMENT_TYPES)[number]
  readonly effectiveFrom: string
  readonly effectiveTo: string | null
  readonly transitionDate: string | null
  readonly grandfatheringMode: (typeof GRANDFATHERING_MODES)[number]
  readonly flatTotalRate: number | null
  readonly employeeSharePct: number
  readonly employerSharePct: number
  readonly annualFranchise: number
  readonly annualPensionableSalaryCap: number | null
  readonly provider: string
  readonly sourceReference: string
  readonly sourceValidationStatus: (typeof SOURCE_STATUSES)[number]
  readonly pensionableSalaryMethod: string
  readonly partTimeMethod: string
  readonly partMonthMethod: string
  readonly eligibilityRule: string
  readonly components: readonly PensionArrangementComponentInput[]
  readonly contractClassification: (typeof CONTRACT_CLASSIFICATIONS)[number]
  readonly contractClassificationSourceReference: string
  readonly contractClassificationStatus: 'EMPLOYER_RECORDED' | 'VERIFIED_SOURCE' | 'UNVERIFIED'
  readonly tiers: readonly PensionArrangementTierInput[]
}

export class PensionArrangementManagementError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code)
    this.name = 'PensionArrangementManagementError'
  }
}

export function parsePensionArrangementComponents(value: unknown): readonly PensionArrangementComponentInput[] {
  const parsed = z.array(pensionArrangementComponentSchema).min(1).max(20).safeParse(value)
  if (!parsed.success) throw new Error('INVALID_INPUT')
  return parsed.data
}

function isPensionManager(context: AuthContext): boolean {
  return context.activeRoles.includes('HR_ADMIN') || context.activeRoles.includes('TENANT_ADMIN')
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function isFiniteNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value)
}

function nonEmpty(value: string, maximum: number): boolean {
  return value.trim().length > 0 && value.trim().length <= maximum
}

function validateTier(tier: PensionArrangementTierInput): boolean {
  return Number.isInteger(tier.minAge)
    && Number.isInteger(tier.maxAge)
    && tier.minAge >= 0
    && tier.maxAge >= tier.minAge
    && isFiniteNumber(tier.totalRate)
    && tier.totalRate >= 0
    && tier.totalRate <= 100
}

function validateInput(input: PensionArrangementCreateInput): void {
  const dateRangeValid = isIsoDate(input.effectiveFrom)
    && (input.effectiveTo === null || isIsoDate(input.effectiveTo))
    && (input.transitionDate === null || isIsoDate(input.transitionDate))
    && (input.effectiveTo === null || input.effectiveTo >= input.effectiveFrom)
  const ratesValid = isFiniteNumber(input.employeeSharePct)
    && isFiniteNumber(input.employerSharePct)
    && input.employeeSharePct >= 0
    && input.employeeSharePct <= 100
    && input.employerSharePct >= 0
    && input.employerSharePct <= 100
    && Math.abs((input.employeeSharePct + input.employerSharePct) - 100) < 0.0001
  const amountValid = isFiniteNumber(input.annualFranchise)
    && input.annualFranchise >= 0
    && (input.annualPensionableSalaryCap === null
      || (isFiniteNumber(input.annualPensionableSalaryCap) && input.annualPensionableSalaryCap >= 0))
  const flatRateValid = input.arrangementType === 'FLAT_PREMIUM'
    && isFiniteNumber(input.flatTotalRate)
    && input.flatTotalRate >= 0
    && input.flatTotalRate <= 100
    && input.tiers.length === 0
  const tierRateValid = input.arrangementType === 'PROGRESSIVE_PREMIUM'
    && input.flatTotalRate === null
    && input.tiers.length > 0
    && input.tiers.every(validateTier)
  const contractSourceValid = input.contractClassification !== 'NON_SOLIDARITY'
    || nonEmpty(input.contractClassificationStatus, 40)
  const components = z.array(pensionArrangementComponentSchema).min(1).max(20).safeParse(input.components)
  const uniqueComponentCodes = components.success
    ? new Set(components.data.map((component) => component.code.toLocaleUpperCase('en-US'))).size === components.data.length
    : false
  const componentsWithinArrangementPeriod = components.success && components.data.every((component) =>
    component.effectiveFrom >= input.effectiveFrom
    && (input.effectiveTo === null || component.effectiveFrom <= input.effectiveTo)
    && (component.effectiveTo === null || input.effectiveTo === null || component.effectiveTo <= input.effectiveTo),
  )
  if (!nonEmpty(input.code, 80)
    || !nonEmpty(input.name, 180)
    || !ARRANGEMENT_TYPES.includes(input.arrangementType)
    || !GRANDFATHERING_MODES.includes(input.grandfatheringMode)
    || !CONTRACT_CLASSIFICATIONS.includes(input.contractClassification)
    || !SOURCE_STATUSES.includes(input.sourceValidationStatus)
    || !dateRangeValid
    || !ratesValid
    || !amountValid
    || (!flatRateValid && !tierRateValid)
    || !nonEmpty(input.provider, 180)
    || !nonEmpty(input.sourceReference, 1000)
    || !nonEmpty(input.pensionableSalaryMethod, 1000)
    || !nonEmpty(input.partTimeMethod, 1000)
    || !nonEmpty(input.partMonthMethod, 1000)
    || !nonEmpty(input.eligibilityRule, 1000)
    || !contractSourceValid
    || !components.success
    || !uniqueComponentCodes
    || !componentsWithinArrangementPeriod
    || (input.contractClassificationStatus === 'VERIFIED_SOURCE' && !nonEmpty(input.contractClassificationSourceReference, 1000))) {
    throw new PensionArrangementManagementError('PENSION_ARRANGEMENT_INPUT_INVALID', 400)
  }
}

async function scopedPensionManager(): Promise<{ readonly context: ScopedPensionContext; readonly supabase: Awaited<ReturnType<typeof createClient>> }> {
  const context = await requirePermission('pension:manage')
  if (!context.administrationId || !context.hrGroupId) {
    throw new PensionArrangementManagementError('PENSION_ARRANGEMENT_SCOPE_REQUIRED', 400)
  }
  if (!isPensionManager(context)) {
    throw new PensionArrangementManagementError('PENSION_ARRANGEMENT_FORBIDDEN', 403)
  }
  return { context: context as ScopedPensionContext, supabase: await createClient() }
}

function rpcCode(message: string | undefined, fallback: string): string {
  return message?.match(/PENSION_[A-Z_]+/)?.[0] ?? fallback
}

function rpcObject(data: Json | null, fallback: string): Record<string, Json | undefined> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new PensionArrangementManagementError(fallback, 500)
  }
  return data
}

export async function createPensionArrangement(input: PensionArrangementCreateInput): Promise<{
  readonly arrangementId: string
  readonly versionId: string
  readonly versionNumber: number
}> {
  validateInput(input)
  const { context, supabase } = await scopedPensionManager()
  const contractClassificationProvenance: Json = {
    status: input.contractClassificationStatus,
    sourceReference: input.contractClassificationSourceReference,
  }
  const pensionableSalaryDefinition: Json = {
    provider: input.provider,
    sourceReference: input.sourceReference,
    sourceValidationStatus: input.sourceValidationStatus,
    method: input.pensionableSalaryMethod,
    partTimeMethod: input.partTimeMethod,
    partMonthMethod: input.partMonthMethod,
    components: input.components.map((component) => ({ ...component })),
  }
  const eligibilityRule: Json = {
    description: input.eligibilityRule,
    sourceReference: input.sourceReference,
    sourceValidationStatus: input.sourceValidationStatus,
  }
  const tiers: Json = input.tiers.map((tier) => ({
    min_age: tier.minAge,
    max_age: tier.maxAge,
    total_rate: tier.totalRate,
  }))
  const { data, error } = await supabase.rpc('create_pension_arrangement', {
    p_input: {
      tenant_id: context.tenantId,
      hr_group_id: context.hrGroupId,
      administration_id: context.administrationId,
      code: input.code.trim(),
      name: input.name.trim(),
      arrangement_type: input.arrangementType,
      effective_from: input.effectiveFrom,
      effective_to: input.effectiveTo,
      transition_date: input.transitionDate,
      grandfathering_mode: input.grandfatheringMode,
      flat_total_rate: input.flatTotalRate,
      employer_share_pct: input.employerSharePct,
      employee_share_pct: input.employeeSharePct,
      annual_franchise: input.annualFranchise,
      annual_pensionable_salary_cap: input.annualPensionableSalaryCap,
      pensionable_salary_definition: pensionableSalaryDefinition,
      eligibility_rule: eligibilityRule,
      contract_classification: input.contractClassification,
      contract_classification_provenance: contractClassificationProvenance,
      tiers,
    } satisfies Json,
  })
  if (error || !data) {
    const code = rpcCode(error?.message, 'PENSION_ARRANGEMENT_WRITE_FAILED')
    throw new PensionArrangementManagementError(code, code.endsWith('_FORBIDDEN') ? 403 : 400)
  }
  const result = rpcObject(data, 'PENSION_ARRANGEMENT_WRITE_READBACK_INVALID')
  const arrangementId = result.arrangement_id
  const versionId = result.version_id
  const versionNumber = result.version_number
  if (typeof arrangementId !== 'string' || !UUID_PATTERN.test(arrangementId)
    || typeof versionId !== 'string' || !UUID_PATTERN.test(versionId)
    || typeof versionNumber !== 'number' || !Number.isInteger(versionNumber)) {
    throw new PensionArrangementManagementError('PENSION_ARRANGEMENT_WRITE_READBACK_INVALID', 500)
  }
  return { arrangementId, versionId, versionNumber }
}

export async function createPensionArrangementSuccessorForPensionManager(input: {
  readonly predecessorVersionId: string
  readonly successor: Json
}): Promise<{ readonly versionId: string }> {
  if (!UUID_PATTERN.test(input.predecessorVersionId)
    || !input.successor || typeof input.successor !== 'object' || Array.isArray(input.successor)) {
    throw new PensionArrangementManagementError('PENSION_ARRANGEMENT_SUCCESSOR_INPUT_INVALID', 400)
  }
  const { context, supabase } = await scopedPensionManager()
  const { data: predecessor, error: predecessorError } = await supabase.from('pension_arrangement_versions')
    .select('id')
    .eq('id', input.predecessorVersionId)
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', context.hrGroupId)
    .eq('administration_id', context.administrationId)
    .maybeSingle()
  if (predecessorError || !predecessor) {
    throw new PensionArrangementManagementError('PENSION_ARRANGEMENT_PREDECESSOR_NOT_FOUND', 404)
  }
  const { data, error } = await supabase.rpc('create_pension_arrangement_successor', {
    p_predecessor_version_id: predecessor.id,
    p_successor: input.successor,
  })
  if (error || typeof data !== 'string' || !UUID_PATTERN.test(data)) {
    const code = rpcCode(error?.message, 'PENSION_ARRANGEMENT_SUCCESSOR_WRITE_FAILED')
    throw new PensionArrangementManagementError(code, code.endsWith('_FORBIDDEN') ? 403 : 400)
  }
  return { versionId: data }
}
