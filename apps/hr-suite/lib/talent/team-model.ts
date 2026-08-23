import type { Database } from '@scope/db'
import type { TalentTeamMatrixFilters } from './team-schemas'

type CapabilityRecordRow = Database['public']['Tables']['talent_employee_capability_records']['Row']

export type TalentTeamMatrixCapability = Pick<CapabilityRecordRow, 'id' | 'capability_id' | 'status' | 'source_type' | 'valid_from' | 'valid_until' | 'certificate_status' | 'evidence_status' | 'certificate_code'> & {
  capabilityName: string
  capabilityCode: string
  capabilityType: string
}

export type TalentTeamMatrixRow = {
  employeeId: string
  employeeNumber: string
  employeeLabel: string
  jobTitle: string | null
  departmentId: string
  capabilities: TalentTeamMatrixCapability[]
}

export type TalentTeamMatrix = {
  rows: TalentTeamMatrixRow[]
  scopeCount: number
  scopeType: 'TEAM' | 'TENANT'
  aggregatePolicy: 'DISABLED'
  aggregateMinimumGroupSize: 5
  aggregateDisabled: true
}

export function filterTalentTeamMatrixRows(rows: TalentTeamMatrixRow[], filters: TalentTeamMatrixFilters): TalentTeamMatrixRow[] {
  const normalizedQuery = filters.q?.toLocaleLowerCase('nl-NL') ?? ''
  const hasCapabilityFilters = Boolean(filters.type || filters.status || filters.source)

  return rows.flatMap((row) => {
    const employeeMatch = !normalizedQuery || [
      row.employeeLabel,
      row.employeeNumber,
      row.jobTitle ?? '',
      ...row.capabilities.flatMap((capability) => [capability.capabilityName, capability.capabilityCode]),
    ].some((value) => value.toLocaleLowerCase('nl-NL').includes(normalizedQuery))
    if (!employeeMatch) return []

    const capabilities = hasCapabilityFilters
      ? row.capabilities.filter((capability) => (
        (!filters.type || capability.capabilityType === filters.type)
        && (!filters.status || capability.status === filters.status)
        && (!filters.source || capability.source_type === filters.source)
      ))
      : row.capabilities
    if (hasCapabilityFilters && capabilities.length === 0) return []
    return [{ ...row, capabilities }]
  })
}
