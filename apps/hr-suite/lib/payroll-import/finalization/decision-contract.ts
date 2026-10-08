import { createHash } from 'node:crypto'
import { z } from 'zod'
import { canUseSourceForEmployee } from './field-conflict-policy'

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/i)
const uuidSchema = z.uuid()
const contractTypeSchema = z.enum(['INDEFINITE', 'DEFINITE', 'ON_CALL', 'TEMPORARY_AGENCY', 'EXTERNAL'])
const genderSchema = z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'])

const matchDecisionSchema = z.object({
  action: z.enum(['REUSE_EMPLOYEE', 'CREATE_EMPLOYEE', 'UNRESOLVED']),
  employeeId: uuidSchema.optional(),
  newEmployeeFields: z.object({
    firstName: z.string().trim().min(1).max(120).optional(),
    birthName: z.string().trim().min(1).max(120).optional(),
    gender: genderSchema.optional(),
  }).strict().optional(),
  confirmed: z.boolean(),
}).strict()

const employmentDecisionSchema = z.object({
  action: z.enum(['REUSE_EMPLOYMENT', 'CREATE_DRAFT_EMPLOYMENT', 'UNDECIDED']),
  employmentId: uuidSchema.optional(),
  contractType: contractTypeSchema.optional(),
  startsOn: z.iso.date().optional(),
  seniorityDate: z.iso.date().optional(),
  originalHireDate: z.iso.date().optional(),
  confirmed: z.boolean(),
}).strict()

const incomeRelationshipDecisionSchema = z.object({
  action: z.enum(['CREATE', 'LINK', 'NO_CHANGE', 'UNDECIDED']),
  incomeRelationshipId: uuidSchema.optional(),
  confirmed: z.boolean(),
}).strict()

const sourceFieldDecisionSchema = z.enum(['USE_SOURCE', 'KEEP_CURRENT', 'MANUAL_REVIEW'])

export const payrollImportPersonDecisionSchema = z.object({
  match: matchDecisionSchema,
  incomeRelationshipBySourceRef: z.record(z.string().min(1), incomeRelationshipDecisionSchema),
  employmentByIncomeRelationship: z.record(z.string().min(1), employmentDecisionSchema),
  sourceFieldDecisions: z.record(z.string().min(1), sourceFieldDecisionSchema),
}).strict()

export type PayrollImportPersonDecision = z.infer<typeof payrollImportPersonDecisionSchema>
export type PayrollImportDecisionMatchStatus = 'UNMATCHED' | 'EXACT' | 'PROPOSED' | 'MANUAL_REVIEW' | 'NEW'

export type PayrollImportDecisionSource = {
  personId: string
  matchStatus: PayrollImportDecisionMatchStatus
  proposedEmployeeId?: string | null
  sourceFields: readonly string[]
  conflictingFields: readonly string[]
  incomeRelationships: readonly { sourceRef: string }[]
}

export type PayrollImportDecisionBlocker =
  | 'DECISION_SHAPE_INVALID'
  | 'MATCH_CONFIRMATION_REQUIRED'
  | 'EMPLOYEE_SELECTION_REQUIRED'
  | 'NEW_EMPLOYEE_FIELDS_REQUIRED'
  | 'EXACT_MATCH_TARGET_CHANGED'
  | 'INCOME_RELATIONSHIP_DECISION_REQUIRED'
  | 'EMPLOYMENT_SELECTION_REQUIRED'
  | 'EMPLOYMENT_CONTRACT_TYPE_REQUIRED'
  | 'EMPLOYMENT_DECISION_CONFIRMATION_REQUIRED'
  | 'DRAFT_EMPLOYMENT_TERMS_REQUIRED'
  | 'SOURCE_FIELD_DECISION_REQUIRED'
  | 'SOURCE_FIELD_REVIEW_REQUIRED'
  | 'UNKNOWN_SOURCE_FIELD'
  | 'UNKNOWN_INCOME_RELATIONSHIP'

export type PayrollImportDecisionValidation =
  | { valid: true; decision: PayrollImportPersonDecision; blockers: readonly [] }
  | { valid: false; blockers: readonly PayrollImportDecisionBlocker[] }

export type ConfirmedPayrollImportDecision = {
  decision: PayrollImportPersonDecision
  decisionVersion: number
  confirmerUserId: string
  confirmedAt: string
  sourceHash: string
  analysisHash: string
  coreStateHash: string
  decisionHash: string
}

export type PayrollImportDecisionFreshness = Pick<
  ConfirmedPayrollImportDecision,
  'sourceHash' | 'analysisHash' | 'coreStateHash'
>

export function validatePayrollImportDecision(
  input: unknown,
  source: PayrollImportDecisionSource,
): PayrollImportDecisionValidation {
  const parsed = payrollImportPersonDecisionSchema.safeParse(input)
  if (!parsed.success) return { valid: false, blockers: ['DECISION_SHAPE_INVALID'] }

  const decision = parsed.data
  const blockers = new Set<PayrollImportDecisionBlocker>()
  const isExact = source.matchStatus === 'EXACT'

  if (decision.match.action === 'UNRESOLVED' || (source.matchStatus !== 'EXACT' && !decision.match.confirmed)) {
    blockers.add('MATCH_CONFIRMATION_REQUIRED')
  }
  if (decision.match.action === 'REUSE_EMPLOYEE' && !decision.match.employeeId) {
    blockers.add('EMPLOYEE_SELECTION_REQUIRED')
  }
  if (decision.match.action === 'CREATE_EMPLOYEE' && decision.match.employeeId) {
    blockers.add('EMPLOYEE_SELECTION_REQUIRED')
  }
  if (decision.match.action === 'CREATE_EMPLOYEE'
    && (!decision.match.newEmployeeFields?.firstName || !decision.match.newEmployeeFields.birthName || !decision.match.newEmployeeFields.gender)) {
    blockers.add('NEW_EMPLOYEE_FIELDS_REQUIRED')
  }
  if (isExact && (decision.match.action !== 'REUSE_EMPLOYEE'
    || decision.match.employeeId !== source.proposedEmployeeId)) {
    blockers.add('EXACT_MATCH_TARGET_CHANGED')
  }

  const expectedIncomeRefs = new Set(source.incomeRelationships.map(({ sourceRef }) => sourceRef))
  for (const ref of expectedIncomeRefs) {
    const incomeDecision = decision.incomeRelationshipBySourceRef[ref]
    if (!incomeDecision) {
      blockers.add('INCOME_RELATIONSHIP_DECISION_REQUIRED')
    } else {
      if (!incomeDecision.confirmed || incomeDecision.action === 'UNDECIDED') {
        blockers.add('INCOME_RELATIONSHIP_DECISION_REQUIRED')
      }
      if (incomeDecision.action === 'LINK' && !incomeDecision.incomeRelationshipId) {
        blockers.add('INCOME_RELATIONSHIP_DECISION_REQUIRED')
      }
      if (incomeDecision.action !== 'LINK' && incomeDecision.incomeRelationshipId) {
        blockers.add('INCOME_RELATIONSHIP_DECISION_REQUIRED')
      }
    }
    const employment = decision.employmentByIncomeRelationship[ref]
    if (!employment) {
      blockers.add('INCOME_RELATIONSHIP_DECISION_REQUIRED')
      continue
    }
    if (!employment.confirmed) blockers.add('EMPLOYMENT_DECISION_CONFIRMATION_REQUIRED')
    if (employment.action === 'UNDECIDED') blockers.add('INCOME_RELATIONSHIP_DECISION_REQUIRED')
    if (employment.action === 'REUSE_EMPLOYMENT' && !employment.employmentId) {
      blockers.add('EMPLOYMENT_SELECTION_REQUIRED')
    }
    if (employment.action === 'CREATE_DRAFT_EMPLOYMENT' && employment.employmentId) {
      blockers.add('EMPLOYMENT_SELECTION_REQUIRED')
    }
    if (employment.action === 'CREATE_DRAFT_EMPLOYMENT' && !employment.contractType) blockers.add('EMPLOYMENT_CONTRACT_TYPE_REQUIRED')
    if (employment.action === 'CREATE_DRAFT_EMPLOYMENT' && (!employment.startsOn
      || !employment.seniorityDate || !employment.originalHireDate)) blockers.add('DRAFT_EMPLOYMENT_TERMS_REQUIRED')
  }
  if (Object.keys(decision.employmentByIncomeRelationship).some((ref) => !expectedIncomeRefs.has(ref))) {
    blockers.add('UNKNOWN_INCOME_RELATIONSHIP')
  }
  if (Object.keys(decision.incomeRelationshipBySourceRef).some((ref) => !expectedIncomeRefs.has(ref))) {
    blockers.add('UNKNOWN_INCOME_RELATIONSHIP')
  }

  const expectedFields = new Set(source.sourceFields)
  for (const field of expectedFields) {
    const fieldDecision = decision.sourceFieldDecisions[field]
    if (!fieldDecision) blockers.add('SOURCE_FIELD_DECISION_REQUIRED')
    else if (fieldDecision === 'MANUAL_REVIEW') blockers.add('SOURCE_FIELD_REVIEW_REQUIRED')
    else if (fieldDecision === 'USE_SOURCE'
      && !canUseSourceForEmployee(field, decision.match.action === 'CREATE_EMPLOYEE' ? 'CREATE' : 'UPDATE')) {
      blockers.add('SOURCE_FIELD_REVIEW_REQUIRED')
    }
  }
  if (Object.keys(decision.sourceFieldDecisions).some((field) => !expectedFields.has(field))) {
    blockers.add('UNKNOWN_SOURCE_FIELD')
  }
  for (const field of source.conflictingFields) {
    if (!expectedFields.has(field) || !decision.sourceFieldDecisions[field]
      || decision.sourceFieldDecisions[field] === 'MANUAL_REVIEW') {
      blockers.add('SOURCE_FIELD_DECISION_REQUIRED')
    }
  }

  const result = [...blockers]
  return result.length > 0
    ? { valid: false, blockers: result }
    : { valid: true, decision, blockers: [] }
}

export function confirmPayrollImportDecision(input: Omit<ConfirmedPayrollImportDecision, 'decisionHash'>): ConfirmedPayrollImportDecision {
  const decisionVersion = z.number().int().positive().parse(input.decisionVersion)
  const confirmerUserId = uuidSchema.parse(input.confirmerUserId)
  const confirmedAt = z.iso.datetime({ offset: true }).parse(input.confirmedAt)
  const sourceHash = hashSchema.parse(input.sourceHash.toLowerCase())
  const analysisHash = hashSchema.parse(input.analysisHash.toLowerCase())
  const coreStateHash = hashSchema.parse(input.coreStateHash.toLowerCase())
  const decision = payrollImportPersonDecisionSchema.parse(input.decision)
  const payload = { decision, decisionVersion, confirmerUserId, confirmedAt, sourceHash, analysisHash, coreStateHash }
  const decisionHash = createHash('sha256').update(stableSerialize(payload), 'utf8').digest('hex')

  return { ...payload, decisionHash }
}

/**
 * A persisted confirmation is untrusted input until its server-computed hash
 * and all of its typed metadata have been verified again. This check is kept
 * separate from freshness: a fresh but forged record must still be rejected.
 */
export function isPayrollImportDecisionAuthentic(record: ConfirmedPayrollImportDecision): boolean {
  try {
    const confirmedAt = new Date(record.confirmedAt).toISOString()
    const expected = confirmPayrollImportDecision({
      decision: record.decision,
      decisionVersion: record.decisionVersion,
      confirmerUserId: record.confirmerUserId,
      confirmedAt,
      sourceHash: record.sourceHash,
      analysisHash: record.analysisHash,
      coreStateHash: record.coreStateHash,
    })
    if (expected.decisionHash === record.decisionHash) return true
    if (record.decision.match.action !== 'CREATE_EMPLOYEE') return false

    // Older UI builds hashed an explicit `employeeId: undefined` when a new
    // employee was selected. JSONB drops that property on persistence, so
    // verify that one legacy wire shape while keeping new hashes JSON-stable.
    const legacyDecision = {
      ...record.decision,
      match: { ...record.decision.match, employeeId: undefined },
    }
    const legacyPayload = {
      decision: legacyDecision,
      decisionVersion: record.decisionVersion,
      confirmerUserId: record.confirmerUserId,
      confirmedAt,
      sourceHash: record.sourceHash,
      analysisHash: record.analysisHash,
      coreStateHash: record.coreStateHash,
    }
    return createHash('sha256').update(stableSerializeLegacy(legacyPayload), 'utf8').digest('hex') === record.decisionHash
  } catch {
    return false
  }
}

export function isPayrollImportDecisionFresh(
  record: ConfirmedPayrollImportDecision,
  current: PayrollImportDecisionFreshness,
): boolean {
  return record.sourceHash === current.sourceHash
    && record.analysisHash === current.analysisHash
    && record.coreStateHash === current.coreStateHash
}

export function stableSerialize(value: unknown): string {
  if (value === undefined) return 'null'
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map((entry) => stableSerialize(entry)).join(',')}]`
  const objectValue = value as Record<string, unknown>
  const entries = Object.keys(objectValue)
    .filter((key) => objectValue[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(objectValue[key])}`)
  return `{${entries.join(',')}}`
}

function stableSerializeLegacy(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) as string
  if (Array.isArray(value)) return `[${value.map((entry) => stableSerializeLegacy(entry)).join(',')}]`
  const objectValue = value as Record<string, unknown>
  const entries = Object.keys(objectValue).sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerializeLegacy(objectValue[key])}`)
  return `{${entries.join(',')}}`
}
