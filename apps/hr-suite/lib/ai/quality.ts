import type { AiQualityProfile } from './contracts'

export const AI_QUALITY_RANK: Readonly<Record<AiQualityProfile, number>> = {
  EFFICIENT: 1,
  BALANCED: 2,
  IN_DEPTH: 3,
}

export const DEFAULT_ROLE_QUALITY_PROFILES: Readonly<Record<string, AiQualityProfile>> = {
  EMPLOYEE: 'EFFICIENT',
  DIRECT_MANAGER: 'BALANCED',
  TEAM_LEAD: 'BALANCED',
  HR_ADVISOR: 'BALANCED',
  PAYROLL_SPECIALIST: 'BALANCED',
  HR_ADMIN: 'IN_DEPTH',
  TENANT_ADMIN: 'IN_DEPTH',
}

export function highestApplicableQualityProfile(activeRoles: readonly string[]): AiQualityProfile | null {
  const applicable = activeRoles
    .map((role) => DEFAULT_ROLE_QUALITY_PROFILES[role])
    .filter((profile): profile is AiQualityProfile => profile !== undefined)

  return applicable.reduce<AiQualityProfile | null>((highest, profile) => {
    if (!highest || AI_QUALITY_RANK[profile] > AI_QUALITY_RANK[highest]) return profile
    return highest
  }, null)
}
