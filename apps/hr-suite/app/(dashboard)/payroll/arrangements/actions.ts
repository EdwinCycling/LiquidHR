'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Json } from '@scope/db'
import { AuthenticationError, AuthorizationError } from '@/lib/auth/permissions'
import { ContextAccessError } from '@/lib/context/administration-context'
import { ContextAuthenticationError } from '@/lib/context/server-context'
import {
  createPensionArrangement,
  createPensionArrangementSuccessorForPensionManager,
  parsePensionArrangementComponents,
  PensionArrangementManagementError,
  type PensionArrangementCreateInput,
  type PensionArrangementTierInput,
} from '@/lib/employment/pension-arrangement-management-service'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function scalar(formData: FormData, name: string): string {
  const values = formData.getAll(name)
  if (values.length !== 1 || typeof values[0] !== 'string') throw new Error('INVALID_INPUT')
  return values[0]
}

function optionalScalar(formData: FormData, name: string): string | null {
  const value = scalar(formData, name).trim()
  return value === '' ? null : value
}

function requiredNumber(formData: FormData, name: string): number {
  const value = Number(scalar(formData, name))
  if (!Number.isFinite(value)) throw new Error('INVALID_INPUT')
  return value
}

function optionalNumber(formData: FormData, name: string): number | null {
  const value = optionalScalar(formData, name)
  if (value === null) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error('INVALID_INPUT')
  return parsed
}

function parseTiers(value: string): PensionArrangementTierInput[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error('INVALID_INPUT')
  }
  if (!Array.isArray(parsed)) throw new Error('INVALID_INPUT')
  return parsed.map((candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('INVALID_INPUT')
    const row = candidate as Record<string, unknown>
    if (typeof row.min_age !== 'number' || typeof row.max_age !== 'number' || typeof row.total_rate !== 'number') {
      throw new Error('INVALID_INPUT')
    }
    return { minAge: row.min_age, maxAge: row.max_age, totalRate: row.total_rate }
  })
}

function parseComponents(value: string): PensionArrangementCreateInput['components'] {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error('INVALID_INPUT')
  }
  try {
    return parsePensionArrangementComponents(parsed)
  } catch {
    throw new Error('INVALID_INPUT')
  }
}

function parseCreateInput(formData: FormData): PensionArrangementCreateInput {
  const fields = Array.from(formData.keys()).filter((key) => !key.startsWith('$ACTION_')).sort()
  const expected = [
    'annualFranchise', 'annualPensionableSalaryCap', 'arrangementType', 'code', 'contractClassification',
    'contractClassificationSourceReference', 'contractClassificationStatus', 'effectiveFrom', 'effectiveTo',
    'eligibilityRule', 'employeeSharePct', 'employerSharePct', 'flatTotalRate', 'grandfatheringMode', 'name',
    'componentsJson', 'partMonthMethod', 'partTimeMethod', 'pensionableSalaryMethod', 'provider', 'sourceReference',
    'sourceValidationStatus', 'tiersJson', 'transitionDate',
  ].sort()
  if (fields.join('|') !== expected.join('|')) throw new Error('INVALID_INPUT')
  const arrangementType = scalar(formData, 'arrangementType')
  const grandfatheringMode = scalar(formData, 'grandfatheringMode')
  const contractClassification = scalar(formData, 'contractClassification')
  const sourceValidationStatus = scalar(formData, 'sourceValidationStatus')
  const contractClassificationStatus = scalar(formData, 'contractClassificationStatus')
  if (!['FLAT_PREMIUM', 'PROGRESSIVE_PREMIUM'].includes(arrangementType)
    || !['NONE', 'EERBIEDIGENDE_WERKING'].includes(grandfatheringMode)
    || !['SOLIDARITY', 'NON_SOLIDARITY', 'UNKNOWN'].includes(contractClassification)
    || !['REFERENCE_ONLY', 'EMPLOYER_RECORDED', 'VERIFIED_SOURCE'].includes(sourceValidationStatus)
    || !['EMPLOYER_RECORDED', 'VERIFIED_SOURCE', 'UNVERIFIED'].includes(contractClassificationStatus)) {
    throw new Error('INVALID_INPUT')
  }
  const effectiveFrom = scalar(formData, 'effectiveFrom')
  const effectiveTo = optionalScalar(formData, 'effectiveTo')
  const transitionDate = optionalScalar(formData, 'transitionDate')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)
    || (effectiveTo !== null && !/^\d{4}-\d{2}-\d{2}$/.test(effectiveTo))
    || (transitionDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(transitionDate))) {
    throw new Error('INVALID_INPUT')
  }
  return {
    code: scalar(formData, 'code'),
    name: scalar(formData, 'name'),
    arrangementType: arrangementType as PensionArrangementCreateInput['arrangementType'],
    effectiveFrom,
    effectiveTo,
    transitionDate,
    grandfatheringMode: grandfatheringMode as PensionArrangementCreateInput['grandfatheringMode'],
    flatTotalRate: optionalNumber(formData, 'flatTotalRate'),
    employeeSharePct: requiredNumber(formData, 'employeeSharePct'),
    employerSharePct: requiredNumber(formData, 'employerSharePct'),
    annualFranchise: requiredNumber(formData, 'annualFranchise'),
    annualPensionableSalaryCap: optionalNumber(formData, 'annualPensionableSalaryCap'),
    provider: scalar(formData, 'provider'),
    sourceReference: scalar(formData, 'sourceReference'),
    sourceValidationStatus: sourceValidationStatus as PensionArrangementCreateInput['sourceValidationStatus'],
    pensionableSalaryMethod: scalar(formData, 'pensionableSalaryMethod'),
    partTimeMethod: scalar(formData, 'partTimeMethod'),
    partMonthMethod: scalar(formData, 'partMonthMethod'),
    eligibilityRule: scalar(formData, 'eligibilityRule'),
    components: parseComponents(scalar(formData, 'componentsJson')),
    contractClassification: contractClassification as PensionArrangementCreateInput['contractClassification'],
    contractClassificationSourceReference: scalar(formData, 'contractClassificationSourceReference'),
    contractClassificationStatus: contractClassificationStatus as PensionArrangementCreateInput['contractClassificationStatus'],
    tiers: parseTiers(scalar(formData, 'tiersJson')),
  }
}

function destination(result: string): string {
  return `/payroll/arrangements?pension=${encodeURIComponent(result)}`
}

export async function createPensionArrangementAction(formData: FormData): Promise<never> {
  let result = 'unavailable'
  try {
    await createPensionArrangement(parseCreateInput(formData))
    revalidatePath('/payroll/arrangements')
    result = 'saved'
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof ContextAuthenticationError) result = 'login'
    else if (error instanceof AuthorizationError || error instanceof ContextAccessError) result = 'forbidden'
    else if (error instanceof PensionArrangementManagementError) result = error.status === 400 || error.status === 403 ? error.code : 'unavailable'
    else if (error instanceof Error && error.message === 'INVALID_INPUT') result = 'invalid'
  }
  if (result === 'login') redirect('/login')
  if (result === 'forbidden') redirect('/geen-toegang')
  redirect(destination(result))
}

export async function createPensionArrangementSuccessorForPensionManagerAction(formData: FormData): Promise<never> {
  let result = 'unavailable'
  try {
    const fields = Array.from(formData.keys()).filter((key) => !key.startsWith('$ACTION_')).sort()
    if (fields.join('|') !== ['predecessorVersionId', 'successorJson'].sort().join('|')) throw new Error('INVALID_INPUT')
    const predecessorVersionId = scalar(formData, 'predecessorVersionId')
    const successorJson = scalar(formData, 'successorJson')
    if (!UUID_PATTERN.test(predecessorVersionId) || successorJson.length > 20_000) throw new Error('INVALID_INPUT')
    let successor: unknown
    try {
      successor = JSON.parse(successorJson)
    } catch {
      throw new Error('INVALID_INPUT')
    }
    if (!successor || typeof successor !== 'object' || Array.isArray(successor)) throw new Error('INVALID_INPUT')
    await createPensionArrangementSuccessorForPensionManager({
      predecessorVersionId,
      successor: successor as Json,
    })
    revalidatePath('/payroll/arrangements')
    result = 'versionSaved'
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof ContextAuthenticationError) result = 'login'
    else if (error instanceof AuthorizationError || error instanceof ContextAccessError) result = 'forbidden'
    else if (error instanceof PensionArrangementManagementError) result = error.status === 400 || error.status === 403 || error.status === 409 ? error.code : 'unavailable'
    else if (error instanceof Error && error.message === 'INVALID_INPUT') result = 'invalid'
  }
  if (result === 'login') redirect('/login')
  if (result === 'forbidden') redirect('/geen-toegang')
  redirect(destination(result))
}
