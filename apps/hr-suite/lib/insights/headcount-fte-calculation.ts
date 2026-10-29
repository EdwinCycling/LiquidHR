export interface HeadcountEmploymentSource {
  id: string
  employeeId: string
  administrationId: string
  startsOn: string
  endsOn: string | null
  recordStatus: string
  deletedAt: string | null
}

export interface HeadcountScheduleSource {
  id: string
  employmentId: string
  validFrom: string
  validUntil: string | null
  partTimeFactor: number | string | null
}

export interface HeadcountOrganizationSource {
  id: string
  employeeId: string
  employmentId: string | null
  administrationId: string
  departmentId: string | null
  directManagerId: string | null
  effectiveFrom: string
  effectiveTo: string | null
}

export type HeadcountScheduleStatus = 'VALID' | 'MISSING' | 'MULTIPLE' | 'INVALID_FACTOR'
export type HeadcountPlacementStatus = 'VALID' | 'MISSING' | 'MULTIPLE'

export interface HeadcountFteRow {
  employeeId: string
  employmentId: string
  administrationId: string
  partTimeFactor: number | null
  scheduleStatus: HeadcountScheduleStatus
  departmentId: string | null
  teamId: string | null
  placementStatus: HeadcountPlacementStatus
}

export interface HeadcountFteSnapshot {
  asOf: string
  headcount: number
  activeEmploymentCount: number
  fte: number | null
  knownFte: number
  completeScheduleCount: number
  incompleteScheduleCount: number
  unassignedPlacementCount: number
  rows: HeadcountFteRow[]
}

export interface CalculateHeadcountFteInput {
  asOf: string
  employments: readonly HeadcountEmploymentSource[]
  schedules: readonly HeadcountScheduleSource[]
  organizations: readonly HeadcountOrganizationSource[]
  administrationIds?: readonly string[]
  departmentIds?: readonly string[]
  teamIds?: readonly string[]
}

export function isActiveEmploymentOnDate(employment: HeadcountEmploymentSource, asOf: string): boolean {
  return employment.recordStatus === 'CONFIRMED'
    && employment.deletedAt === null
    && employment.startsOn <= asOf
    && (employment.endsOn === null || employment.endsOn >= asOf)
}

function placementForEmployment(
  employment: HeadcountEmploymentSource,
  organizations: readonly HeadcountOrganizationSource[],
  asOf: string,
): { placement: HeadcountOrganizationSource | null; status: HeadcountPlacementStatus } {
  const inEffect = (row: HeadcountOrganizationSource): boolean => row.effectiveFrom <= asOf
    && (row.effectiveTo === null || row.effectiveTo >= asOf)
    && row.employeeId === employment.employeeId
    && row.administrationId === employment.administrationId

  const linkedRows = organizations.filter((row) => row.employmentId === employment.id
    && row.effectiveFrom <= asOf
    && (row.effectiveTo === null || row.effectiveTo >= asOf))
  if (linkedRows.length === 1) {
    return inEffect(linkedRows[0]) ? { placement: linkedRows[0], status: 'VALID' } : { placement: null, status: 'MULTIPLE' }
  }
  if (linkedRows.length > 1) return { placement: null, status: 'MULTIPLE' }

  return { placement: null, status: 'MISSING' }
}

function scheduleForEmployment(
  employmentId: string,
  schedules: readonly HeadcountScheduleSource[],
  asOf: string,
): { factor: number | null; status: HeadcountScheduleStatus } {
  const effective = schedules.filter((row) => row.employmentId === employmentId
    && row.validFrom <= asOf
    && (row.validUntil === null || row.validUntil > asOf))
  if (effective.length === 0) return { factor: null, status: 'MISSING' }
  if (effective.length > 1) return { factor: null, status: 'MULTIPLE' }
  const sourceFactor = effective[0].partTimeFactor
  if (sourceFactor === null || sourceFactor === undefined || (typeof sourceFactor === 'string' && sourceFactor.trim() === '')) {
    return { factor: null, status: 'INVALID_FACTOR' }
  }
  const factor = Number(sourceFactor)
  if (!Number.isFinite(factor) || factor < 0 || factor > 1) return { factor: null, status: 'INVALID_FACTOR' }
  return { factor, status: 'VALID' }
}

function roundFte(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000
}

export function calculateHeadcountFteSnapshot(input: CalculateHeadcountFteInput): HeadcountFteSnapshot {
  const active = input.employments.filter((row) => isActiveEmploymentOnDate(row, input.asOf)
    && (!input.administrationIds?.length || input.administrationIds.includes(row.administrationId)))

  const rows = active.flatMap((employment): HeadcountFteRow[] => {
    const schedule = scheduleForEmployment(employment.id, input.schedules, input.asOf)
    const organization = placementForEmployment(employment, input.organizations, input.asOf)
    if (input.departmentIds?.length && (!organization.placement?.departmentId || !input.departmentIds.includes(organization.placement.departmentId))) return []
    if (input.teamIds?.length && (!organization.placement?.directManagerId || !input.teamIds.includes(organization.placement.directManagerId))) return []
    return [{
      employeeId: employment.employeeId,
      employmentId: employment.id,
      administrationId: employment.administrationId,
      partTimeFactor: schedule.factor,
      scheduleStatus: schedule.status,
      departmentId: organization.placement?.departmentId ?? null,
      teamId: organization.placement?.directManagerId ?? null,
      placementStatus: organization.status,
    }]
  })

  const completeScheduleCount = rows.filter((row) => row.scheduleStatus === 'VALID').length
  const incompleteScheduleCount = rows.length - completeScheduleCount
  const knownFte = roundFte(rows.reduce((sum, row) => sum + (row.partTimeFactor ?? 0), 0))
  const unassignedPlacementCount = rows.filter((row) => row.placementStatus !== 'VALID').length

  return {
    asOf: input.asOf,
    headcount: new Set(rows.map((row) => row.employeeId)).size,
    activeEmploymentCount: rows.length,
    fte: incompleteScheduleCount === 0 ? knownFte : null,
    knownFte,
    completeScheduleCount,
    incompleteScheduleCount,
    unassignedPlacementCount,
    rows,
  }
}
