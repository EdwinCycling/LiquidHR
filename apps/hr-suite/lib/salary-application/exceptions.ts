import {
  resolveSalaryBandAtDate,
  resolveSalaryScaleStepAtDate,
  type SalaryBandValueForResolution,
  type SalaryRevisionForResolution,
  type SalaryScaleStepForResolution,
  type SalaryScaleValueForResolution,
} from './resolution'

export type SalaryExceptionKind = 'SALARY_BAND_INVALID' | 'SCALE_STEP_INVALID'
export type SalaryExceptionSeverity = 'INFO' | 'HIGH'

export interface SalaryExceptionSalaryRow {
  id: string
  employmentId: string
  employeeId: string
  validFrom: string
  salaryRoute: string | null
  salaryStructureId: string | null
  salaryScaleId: string | null
  salaryStepCode: string | null
  salaryBandId: string | null
  fulltimeAmount: string | number | null
}

export interface SalaryExceptionLabel {
  id: string
  code: string | null
  name: string
  structureId?: string
}

export interface SalaryExceptionRecord {
  id: string
  kind: SalaryExceptionKind
  severity: SalaryExceptionSeverity
  status: 'OPEN'
  employeeId: string
  employmentId: string
  salaryId: string
  employeeName: string
  administrationName: string
  employmentNumber: string
  salaryRoute: 'SALARY_BAND' | 'SCALE_WITH_STEPS'
  structureId: string
  structureName: string
  structureCode: string | null
  scaleId: string | null
  scaleName: string | null
  scaleCode: string | null
  stepCode: string | null
  bandId: string | null
  bandName: string | null
  bandCode: string | null
  invalidFrom: string
  salaryAmount: string | null
}

function firstInvalidDate(
  row: SalaryExceptionSalaryRow,
  today: string,
  dates: readonly string[],
  isValidAt: (date: string) => boolean,
): string | null {
  const candidateDates = [...new Set([row.validFrom, ...dates.filter((date) => date >= row.validFrom)])].sort()
  for (const date of candidateDates) if (!isValidAt(date)) return date
  if (!isValidAt(today)) return today
  return null
}

function labelFor(labels: readonly SalaryExceptionLabel[], id: string | null | undefined): SalaryExceptionLabel | null {
  return id ? labels.find((label) => label.id === id) ?? null : null
}

export function findSalaryExceptionForRule(input: {
  row: SalaryExceptionSalaryRow
  today: string
  employeeName: string
  administrationName: string
  employmentNumber: string
  structures: readonly SalaryExceptionLabel[]
  scales: readonly SalaryExceptionLabel[]
  bands: readonly SalaryExceptionLabel[]
  revisions: readonly SalaryRevisionForResolution[]
  scaleValues: readonly SalaryScaleValueForResolution[]
  steps: readonly SalaryScaleStepForResolution[]
  bandValues: readonly SalaryBandValueForResolution[]
}): SalaryExceptionRecord | null {
  const row = input.row
  if (row.salaryRoute !== 'SALARY_BAND' && row.salaryRoute !== 'SCALE_WITH_STEPS') return null
  if (!row.salaryStructureId) return null
  const structure = labelFor(input.structures, row.salaryStructureId)
  if (!structure) return null
  const structureRevisions = input.revisions.filter((revision) => revision.salaryStructureId === row.salaryStructureId && revision.status === 'PUBLISHED')
  const revisionDates = [...new Set(structureRevisions.map((revision) => revision.effectiveFrom))].sort()
  const isValidAt = (date: string): boolean => row.salaryRoute === 'SALARY_BAND'
    ? Boolean(row.salaryBandId && resolveSalaryBandAtDate({ salaryStructureId: row.salaryStructureId!, salaryBandId: row.salaryBandId, asOf: date, revisions: input.revisions, bandValues: input.bandValues }))
    : Boolean(row.salaryScaleId && row.salaryStepCode && resolveSalaryScaleStepAtDate({ salaryStructureId: row.salaryStructureId!, salaryScaleId: row.salaryScaleId, stepCode: row.salaryStepCode, asOf: date, revisions: input.revisions, scaleValues: input.scaleValues, steps: input.steps }))
  const invalidFrom = firstInvalidDate(row, input.today, revisionDates, isValidAt)
  if (!invalidFrom) return null

  const scale = labelFor(input.scales, row.salaryScaleId)
  const band = labelFor(input.bands, row.salaryBandId)
  return {
    id: `${row.id}:${row.salaryRoute}:${invalidFrom}`,
    kind: row.salaryRoute === 'SALARY_BAND' ? 'SALARY_BAND_INVALID' : 'SCALE_STEP_INVALID',
    severity: row.salaryRoute === 'SALARY_BAND' ? 'INFO' : 'HIGH',
    status: 'OPEN',
    employeeId: row.employeeId,
    employmentId: row.employmentId,
    salaryId: row.id,
    employeeName: input.employeeName,
    administrationName: input.administrationName,
    employmentNumber: input.employmentNumber,
    salaryRoute: row.salaryRoute,
    structureId: row.salaryStructureId,
    structureName: structure.name,
    structureCode: structure.code,
    scaleId: row.salaryScaleId,
    scaleName: scale?.name ?? null,
    scaleCode: scale?.code ?? null,
    stepCode: row.salaryStepCode,
    bandId: row.salaryBandId,
    bandName: band?.name ?? null,
    bandCode: band?.code ?? null,
    invalidFrom,
    salaryAmount: row.fulltimeAmount === null ? null : String(row.fulltimeAmount),
  }
}
