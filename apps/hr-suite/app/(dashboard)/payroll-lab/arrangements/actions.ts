'use server'

import { redirect } from 'next/navigation'
import { AuthenticationError, AuthorizationError } from '@/lib/auth/permissions'
import { ContextAccessError } from '@/lib/context/administration-context'
import { ContextAuthenticationError } from '@/lib/context/server-context'
import { ArrangementFoundationError } from '@/lib/payroll/arrangement-foundation'
import {
  ArrangementServiceError,
  createArrangementCompositionSnapshot,
  createSyntheticArrangementAssignment,
  endArrangementPackageAvailability,
  makeArrangementPackagesAvailable,
} from '@/lib/payroll/arrangement-service'

function fieldsMatch(formData: FormData, expected: readonly string[]): boolean {
  const fields = Array.from(formData.keys()).filter((key) => !key.startsWith('$ACTION_')).sort()
  return fields.length === expected.length && fields.every((field, index) => field === [...expected].sort()[index])
}

function stringField(formData: FormData, name: string, maxLength: number): string | null {
  const value = formData.get(name)
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength ? value : null
}

function safeErrorCode(error: unknown): string {
  if (error instanceof AuthenticationError || error instanceof ContextAuthenticationError) return 'login'
  if (error instanceof AuthorizationError || error instanceof ContextAccessError) return 'access'
  if (error instanceof ArrangementServiceError) {
    if (error.code === 'ARRANGEMENT_NOT_AVAILABLE') return 'not-available'
    if (error.code === 'ARRANGEMENT_ASSIGNMENT_MISSING') return 'missing-assignment'
    if (error.code === 'ARRANGEMENT_ASSIGNMENT_ALREADY_EXISTS') return 'already-assigned'
    if (error.code === 'ARRANGEMENT_INVALID_REQUEST' || error.code === 'ARRANGEMENT_FIXTURE_NOT_AVAILABLE') return 'invalid-input'
  }
  if (error instanceof ArrangementFoundationError) {
    if (error.code === 'ARRANGEMENT_VERSION_NOT_FOUND' || error.code === 'ARRANGEMENT_VERSION_AMBIGUOUS') return 'version-unavailable'
    if (error.code === 'ARRANGEMENT_DATE_INVALID') return 'invalid-date'
    if (error.code === 'ARRANGEMENT_ASSIGNMENT_INACTIVE'
      || error.code === 'ARRANGEMENT_PACKAGE_UNKNOWN'
      || error.code === 'ARRANGEMENT_STRATEGY_UNSUPPORTED'
      || error.code === 'ARRANGEMENT_FIXTURE_UNKNOWN'
      || error.code === 'ARRANGEMENT_FIXTURE_PACKAGE_FORBIDDEN') return 'invalid-input'
  }
  return 'save-failed'
}

function errorLocation(error: unknown): string {
  const code = safeErrorCode(error)
  if (code === 'login') return '/login'
  if (code === 'access') return '/geen-toegang'
  return `/payroll-lab/arrangements?error=${encodeURIComponent(code)}`
}

export async function makeArrangementPackagesAvailableAction(formData: FormData): Promise<never> {
  let destination = '/payroll-lab/arrangements?activated=1'
  try {
    if (!fieldsMatch(formData, ['effectiveFrom', 'effectiveTo'])) throw new Error('Invalid form.')
    const effectiveFrom = stringField(formData, 'effectiveFrom', 10)
    const effectiveToValue = formData.get('effectiveTo')
    if (!effectiveFrom || typeof effectiveToValue !== 'string' || effectiveToValue.length > 10) throw new Error('Invalid form.')
    await makeArrangementPackagesAvailable({ effectiveFrom, effectiveTo: effectiveToValue || null })
  } catch (error) {
    destination = errorLocation(error)
  }
  redirect(destination)
}

export async function endArrangementPackageAvailabilityAction(formData: FormData): Promise<never> {
  let destination = '/payroll-lab/arrangements?ended=1'
  try {
    if (!fieldsMatch(formData, ['packageId', 'effectiveTo'])) throw new Error('Invalid form.')
    const packageId = stringField(formData, 'packageId', 120)
    const effectiveTo = stringField(formData, 'effectiveTo', 10)
    if (!packageId || !effectiveTo) throw new Error('Invalid form.')
    await endArrangementPackageAvailability({ packageId, effectiveTo })
  } catch (error) {
    destination = errorLocation(error)
  }
  redirect(destination)
}

export async function createSyntheticArrangementAssignmentAction(formData: FormData): Promise<never> {
  let destination = '/payroll-lab/arrangements?error=save-failed'
  try {
    if (!fieldsMatch(formData, ['fixtureCode', 'packageId'])) throw new Error('Invalid form.')
    const fixtureCode = stringField(formData, 'fixtureCode', 80)
    const packageId = stringField(formData, 'packageId', 120)
    if (!fixtureCode || !packageId) throw new Error('Invalid form.')
    const assignment = await createSyntheticArrangementAssignment({
      fixtureCode,
      packageId,
      effectiveFrom: '2026-09-01',
      effectiveTo: null,
    })
    destination = `/payroll-lab/arrangements?saved=1&fixture=${encodeURIComponent(assignment.fixture_code)}`
  } catch (error) {
    destination = errorLocation(error)
  }
  redirect(destination)
}

export async function resolveArrangementCompositionAction(formData: FormData): Promise<never> {
  let destination = '/payroll-lab/arrangements?error=save-failed'
  try {
    if (!fieldsMatch(formData, ['fixtureCode', 'asOfDate'])) throw new Error('Invalid form.')
    const fixtureCode = stringField(formData, 'fixtureCode', 80)
    const asOfDate = stringField(formData, 'asOfDate', 10)
    if (!fixtureCode || !asOfDate) throw new Error('Invalid form.')
    const snapshot = await createArrangementCompositionSnapshot({ fixtureCode, asOfDate })
    destination = `/payroll-lab/arrangements?snapshot=1&fixture=${encodeURIComponent(fixtureCode)}&snapshotId=${encodeURIComponent(snapshot.id)}`
  } catch (error) {
    destination = errorLocation(error)
  }
  redirect(destination)
}
