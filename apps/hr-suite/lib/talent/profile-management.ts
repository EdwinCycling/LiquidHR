export type ProfileVersionPeriod = {
  status: string
  valid_from: string | null
  valid_until: string | null
}

export type ProfileCapabilityReference = {
  id: string
  capability_type: string
  status: string
}

export type ProfileRequirementReference = {
  id: string
  capability_id: string
  target_level_id: string | null
  language_level: string | null
  certificate_details: unknown | null
}

export type ProfileActivationIssue = {
  code: 'DATE_REQUIRED' | 'DATE_RANGE_INVALID' | 'CAPABILITY_NOT_FOUND' | 'CAPABILITY_INACTIVE'
    | 'CAPABILITY_TYPE_INVALID' | 'LEVEL_REQUIRED' | 'LEVEL_NOT_FOUND' | 'LEVEL_NOT_ALLOWED'
    | 'LANGUAGE_LEVEL_REQUIRED' | 'LANGUAGE_LEVEL_INVALID' | 'CERTIFICATE_DETAILS_NOT_ALLOWED'
  requirementId?: string
}

const cefrLevels = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
const leveledCapabilityTypes = new Set(['COMPETENCY', 'SKILL', 'KNOWLEDGE'])

export function getProfileVersionPeriodState(version: ProfileVersionPeriod, today: string): 'DRAFT' | 'CURRENT' | 'PLANNED' | 'INACTIVE' {
  if (version.status === 'DRAFT') return 'DRAFT'
  if (version.status !== 'ACTIVE' || !version.valid_from) return 'INACTIVE'
  if (version.valid_from > today) return 'PLANNED'
  return !version.valid_until || version.valid_until > today ? 'CURRENT' : 'INACTIVE'
}

export function getProfileActivationIssues({
  validFrom,
  validUntil,
  requirements,
  capabilities,
  levelIds,
}: {
  validFrom: string | null
  validUntil: string | null
  requirements: ProfileRequirementReference[]
  capabilities: ProfileCapabilityReference[]
  levelIds: ReadonlySet<string>
}): ProfileActivationIssue[] {
  const issues: ProfileActivationIssue[] = []
  if (!validFrom) issues.push({ code: 'DATE_REQUIRED' })
  if (validFrom && validUntil && validUntil <= validFrom) issues.push({ code: 'DATE_RANGE_INVALID' })

  const capabilitiesById = new Map(capabilities.map((capability) => [capability.id, capability]))
  for (const requirement of requirements) {
    const capability = capabilitiesById.get(requirement.capability_id)
    if (!capability) {
      issues.push({ code: 'CAPABILITY_NOT_FOUND', requirementId: requirement.id })
      continue
    }
    if (capability.status !== 'ACTIVE') issues.push({ code: 'CAPABILITY_INACTIVE', requirementId: requirement.id })

    if (leveledCapabilityTypes.has(capability.capability_type)) {
      if (!requirement.target_level_id) issues.push({ code: 'LEVEL_REQUIRED', requirementId: requirement.id })
      else if (!levelIds.has(requirement.target_level_id)) issues.push({ code: 'LEVEL_NOT_FOUND', requirementId: requirement.id })
      if (requirement.language_level) issues.push({ code: 'LEVEL_NOT_ALLOWED', requirementId: requirement.id })
      if (requirement.certificate_details) issues.push({ code: 'CERTIFICATE_DETAILS_NOT_ALLOWED', requirementId: requirement.id })
      continue
    }

    if (capability.capability_type === 'LANGUAGE') {
      if (!requirement.language_level) issues.push({ code: 'LANGUAGE_LEVEL_REQUIRED', requirementId: requirement.id })
      else if (!cefrLevels.has(requirement.language_level)) issues.push({ code: 'LANGUAGE_LEVEL_INVALID', requirementId: requirement.id })
      if (requirement.target_level_id) issues.push({ code: 'LEVEL_NOT_ALLOWED', requirementId: requirement.id })
      if (requirement.certificate_details) issues.push({ code: 'CERTIFICATE_DETAILS_NOT_ALLOWED', requirementId: requirement.id })
      continue
    }

    if (capability.capability_type === 'CERTIFICATE') {
      if (requirement.target_level_id || requirement.language_level) issues.push({ code: 'LEVEL_NOT_ALLOWED', requirementId: requirement.id })
      continue
    }

    issues.push({ code: 'CAPABILITY_TYPE_INVALID', requirementId: requirement.id })
  }
  return issues
}