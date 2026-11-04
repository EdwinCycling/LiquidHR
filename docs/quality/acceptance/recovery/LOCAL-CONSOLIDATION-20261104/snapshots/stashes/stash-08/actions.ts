'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  assignEmploymentPensionArrangement,
  createPensionArrangementSuccessor,
  EmploymentPensionArrangementError,
} from '@/lib/employment/pension-arrangement-service'
import type { Json } from '@scope/db'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function scalar(formData: FormData, name: string): string {
  const values = formData.getAll(name)
  if (values.length !== 1 || typeof values[0] !== 'string') throw new Error('INVALID_INPUT')
  return values[0]
}

function destination(employeeId: string, employmentId: string, result: 'saved' | 'versionSaved' | 'invalid' | 'blocked' | 'unavailable') {
  const params = new URLSearchParams({
    [result === 'saved' || result === 'versionSaved' ? 'saved' : 'error']: result,
  })
  return `/employees/${encodeURIComponent(employeeId)}/employments/${encodeURIComponent(employmentId)}/pension?${params}`
}

export async function assignEmploymentPensionArrangementAction(formData: FormData): Promise<never> {
  let employeeId = ''
  let employmentId = ''
  let result: 'saved' | 'invalid' | 'blocked' | 'unavailable' = 'unavailable'
  try {
    const fields = Array.from(formData.keys()).filter((key) => !key.startsWith('$ACTION_')).sort()
    const expectedFields = [
      'arrangementId', 'confirmMapping', 'effectiveFrom', 'effectiveTo', 'employeeId', 'employmentId',
      'participantGroup', 'participationStartDate', 'provenanceMode', 'requestKey',
      'supersedesAssignmentId', 'supersedesMappingId', 'testScenario',
    ].sort()
    if (fields.join('|') !== expectedFields.join('|')) {
      throw new Error('INVALID_INPUT')
    }
    employeeId = scalar(formData, 'employeeId')
    employmentId = scalar(formData, 'employmentId')
    const arrangementId = scalar(formData, 'arrangementId')
    const effectiveFrom = scalar(formData, 'effectiveFrom')
    const effectiveTo = scalar(formData, 'effectiveTo')
    const participationStartDate = scalar(formData, 'participationStartDate')
    const participantGroup = scalar(formData, 'participantGroup')
    const confirmMapping = scalar(formData, 'confirmMapping')
    const requestKey = scalar(formData, 'requestKey')
    const supersedesMappingId = scalar(formData, 'supersedesMappingId')
    const supersedesAssignmentId = scalar(formData, 'supersedesAssignmentId')
    const provenanceMode = scalar(formData, 'provenanceMode')
    const testScenario = scalar(formData, 'testScenario')
    if (![employeeId, employmentId, arrangementId].every((value) => UUID_PATTERN.test(value))) {
      throw new Error('INVALID_INPUT')
    }
    if (confirmMapping !== 'yes' || !['NEW_ENTRANT', 'GRANDFATHERED'].includes(participantGroup)
      || !['USER_RECORDED', 'SYNTHETIC_TEST_FIXTURE'].includes(provenanceMode)
      || !UUID_PATTERN.test(requestKey)
      || (supersedesMappingId && !UUID_PATTERN.test(supersedesMappingId))
      || (supersedesAssignmentId && !UUID_PATTERN.test(supersedesAssignmentId))) {
      throw new Error('INVALID_INPUT')
    }
    await assignEmploymentPensionArrangement({
      employeeId,
      employmentId,
      arrangementId,
      effectiveFrom,
      effectiveTo: effectiveTo || null,
      participationStartDate,
      participantGroup: participantGroup as 'NEW_ENTRANT' | 'GRANDFATHERED',
      confirmMapping: true,
      requestKey,
      supersedesMappingId: supersedesMappingId || null,
      supersedesAssignmentId: supersedesAssignmentId || null,
      provenance: provenanceMode === 'SYNTHETIC_TEST_FIXTURE'
        ? { status: 'SYNTHETIC_TEST_FIXTURE', scenario: testScenario }
        : { status: 'USER_RECORDED' },
    })
    revalidatePath(`/employees/${employeeId}/employments/${employmentId}`)
    result = 'saved'
  } catch (error) {
    if (error instanceof EmploymentPensionArrangementError) {
      result = error.status === 400 || error.status === 403 || error.status === 409 ? 'blocked' : 'unavailable'
    } else if (error instanceof Error && error.message === 'INVALID_INPUT') {
      result = 'invalid'
    }
  }
  redirect(destination(employeeId, employmentId, result))
}

export async function createPensionArrangementSuccessorAction(formData: FormData): Promise<never> {
  let employeeId = ''
  let employmentId = ''
  let result: 'versionSaved' | 'invalid' | 'blocked' | 'unavailable' = 'unavailable'
  try {
    const fields = Array.from(formData.keys()).filter((key) => !key.startsWith('$ACTION_')).sort()
    if (fields.join('|') !== ['employeeId', 'employmentId', 'predecessorVersionId', 'successorJson'].sort().join('|')) {
      throw new Error('INVALID_INPUT')
    }
    employeeId = scalar(formData, 'employeeId')
    employmentId = scalar(formData, 'employmentId')
    const predecessorVersionId = scalar(formData, 'predecessorVersionId')
    const successorJson = scalar(formData, 'successorJson')
    if (![employeeId, employmentId, predecessorVersionId].every((value) => UUID_PATTERN.test(value))
      || successorJson.length > 20_000) {
      throw new Error('INVALID_INPUT')
    }
    let successor: unknown
    try {
      successor = JSON.parse(successorJson)
    } catch {
      throw new Error('INVALID_INPUT')
    }
    if (!successor || typeof successor !== 'object' || Array.isArray(successor)) throw new Error('INVALID_INPUT')
    await createPensionArrangementSuccessor({
      employeeId,
      employmentId,
      predecessorVersionId,
      successor: successor as Json,
    })
    revalidatePath(`/employees/${employeeId}/employments/${employmentId}/pension`)
    result = 'versionSaved'
  } catch (error) {
    if (error instanceof EmploymentPensionArrangementError) {
      result = error.status === 400 || error.status === 409 ? 'blocked' : 'unavailable'
    } else if (error instanceof Error && error.message === 'INVALID_INPUT') {
      result = 'invalid'
    }
  }
  redirect(destination(employeeId, employmentId, result))
}
