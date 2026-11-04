'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  assignEmploymentPensionArrangement,
  createPensionArrangement,
  createPensionArrangementSuccessorForAdministration,
  EmploymentPensionArrangementError,
} from '@/lib/employment/pension-arrangement-service'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,79}$/

function scalar(formData: FormData, name: string): string {
  const values = formData.getAll(name)
  if (values.length !== 1 || typeof values[0] !== 'string') throw new Error('INVALID_INPUT')
  return values[0]
}

function numberValue(value: string): number {
  const normalized = Number(value.replace(',', '.'))
  if (!Number.isFinite(normalized)) throw new Error('INVALID_INPUT')
  return normalized
}

function redirectWithStatus(status: 'saved' | 'invalid' | 'blocked' | 'unavailable'): never {
  redirect(`/settings/payroll/pension?status=${status}`)
}

function validateArrangementFields(formData: FormData) {
  const code = scalar(formData, 'code').trim()
  const name = scalar(formData, 'name').trim()
  const effectiveFrom = scalar(formData, 'effectiveFrom')
  const effectiveTo = scalar(formData, 'effectiveTo')
  const employeeRatePercent = numberValue(scalar(formData, 'employeeRatePercent'))
  const employerRatePercent = numberValue(scalar(formData, 'employerRatePercent'))
  const annualFranchise = numberValue(scalar(formData, 'annualFranchise'))
  const annualPensionableSalaryCap = scalar(formData, 'annualPensionableSalaryCap')
  const participantGroup = scalar(formData, 'participantGroup')
  if (!CODE_PATTERN.test(code) || name.length === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)
    || (effectiveTo !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(effectiveTo))
    || employeeRatePercent < 0 || employerRatePercent < 0 || employeeRatePercent + employerRatePercent <= 0
    || annualFranchise < 0 || (annualPensionableSalaryCap !== '' && numberValue(annualPensionableSalaryCap) < 0)
    || !['NEW_ENTRANT', 'GRANDFATHERED'].includes(participantGroup)) {
    throw new Error('INVALID_INPUT')
  }
  return {
    code,
    name,
    effectiveFrom,
    effectiveTo: effectiveTo || null,
    employeeRatePercent,
    employerRatePercent,
    annualFranchise,
    annualPensionableSalaryCap: annualPensionableSalaryCap === '' ? null : numberValue(annualPensionableSalaryCap),
    participantGroup: participantGroup as 'NEW_ENTRANT' | 'GRANDFATHERED',
  }
}

export async function createPensionArrangementSettingsAction(formData: FormData): Promise<never> {
  let status: 'saved' | 'invalid' | 'blocked' | 'unavailable' = 'unavailable'
  try {
    const fields = Array.from(formData.keys()).filter((key) => !key.startsWith('$ACTION_')).sort()
    const expected = ['annualFranchise', 'annualPensionableSalaryCap', 'code', 'effectiveFrom', 'effectiveTo', 'employeeRatePercent', 'employerRatePercent', 'name', 'participantGroup'].sort()
    if (fields.join('|') !== expected.join('|')) throw new Error('INVALID_INPUT')
    await createPensionArrangement(validateArrangementFields(formData))
    revalidatePath('/settings/payroll/pension')
    status = 'saved'
  } catch (error) {
    if (error instanceof EmploymentPensionArrangementError) {
      status = error.status === 400 || error.status === 403 || error.status === 409 ? 'blocked' : 'unavailable'
    } else if (error instanceof Error && error.message === 'INVALID_INPUT') status = 'invalid'
  }
  redirectWithStatus(status)
}

export async function createPensionArrangementVersionSettingsAction(formData: FormData): Promise<never> {
  let status: 'saved' | 'invalid' | 'blocked' | 'unavailable' = 'unavailable'
  try {
    const fields = Array.from(formData.keys()).filter((key) => !key.startsWith('$ACTION_')).sort()
    const expected = ['annualFranchise', 'annualPensionableSalaryCap', 'code', 'effectiveFrom', 'effectiveTo', 'employeeRatePercent', 'employerRatePercent', 'name', 'participantGroup', 'predecessorVersionId'].sort()
    if (fields.join('|') !== expected.join('|')) throw new Error('INVALID_INPUT')
    const predecessorVersionId = scalar(formData, 'predecessorVersionId')
    if (!UUID_PATTERN.test(predecessorVersionId)) throw new Error('INVALID_INPUT')
    await createPensionArrangementSuccessorForAdministration({
      predecessorVersionId,
      settings: validateArrangementFields(formData),
    })
    revalidatePath('/settings/payroll/pension')
    status = 'saved'
  } catch (error) {
    if (error instanceof EmploymentPensionArrangementError) {
      status = error.status === 400 || error.status === 403 || error.status === 409 ? 'blocked' : 'unavailable'
    } else if (error instanceof Error && error.message === 'INVALID_INPUT') status = 'invalid'
  }
  redirectWithStatus(status)
}

export async function assignPensionArrangementFromSettingsAction(formData: FormData): Promise<never> {
  let employeeId = ''
  let employmentId = ''
  let status: 'saved' | 'invalid' | 'blocked' | 'unavailable' = 'unavailable'
  try {
    const fields = Array.from(formData.keys()).filter((key) => !key.startsWith('$ACTION_')).sort()
    const expected = ['arrangementId', 'confirmMapping', 'effectiveFrom', 'effectiveTo', 'employeeId', 'employmentId', 'participantGroup', 'participationStartDate', 'requestKey', 'supersedesAssignmentId', 'supersedesMappingId'].sort()
    if (fields.join('|') !== expected.join('|')) throw new Error('INVALID_INPUT')
    employeeId = scalar(formData, 'employeeId')
    employmentId = scalar(formData, 'employmentId')
    const arrangementId = scalar(formData, 'arrangementId')
    const confirmMapping = scalar(formData, 'confirmMapping')
    const participantGroup = scalar(formData, 'participantGroup')
    const requestKey = scalar(formData, 'requestKey')
    if (![employeeId, employmentId, arrangementId, requestKey].every((value) => UUID_PATTERN.test(value))
      || confirmMapping !== 'yes'
      || !['NEW_ENTRANT', 'GRANDFATHERED'].includes(participantGroup)) throw new Error('INVALID_INPUT')
    await assignEmploymentPensionArrangement({
      employeeId,
      employmentId,
      arrangementId,
      participationStartDate: scalar(formData, 'participationStartDate'),
      effectiveFrom: scalar(formData, 'effectiveFrom'),
      effectiveTo: scalar(formData, 'effectiveTo') || null,
      participantGroup: participantGroup as 'NEW_ENTRANT' | 'GRANDFATHERED',
      confirmMapping: true,
      requestKey,
      supersedesMappingId: scalar(formData, 'supersedesMappingId') || null,
      supersedesAssignmentId: scalar(formData, 'supersedesAssignmentId') || null,
      provenance: { status: 'USER_RECORDED' },
    })
    revalidatePath('/settings/payroll/pension')
    revalidatePath(`/employees/${employeeId}/employments/${employmentId}/pension`)
    status = 'saved'
  } catch (error) {
    if (error instanceof EmploymentPensionArrangementError) {
      status = error.status === 400 || error.status === 403 || error.status === 409 ? 'blocked' : 'unavailable'
    } else if (error instanceof Error && error.message === 'INVALID_INPUT') status = 'invalid'
  }
  redirectWithStatus(status)
}
