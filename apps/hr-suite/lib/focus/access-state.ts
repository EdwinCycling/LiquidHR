export type FocusPresentation = 'FOCUS' | 'FULL'
export type FocusExperience = 'EMPLOYEE' | 'MANAGER' | 'PREBOARDING' | 'NO_EMPLOYMENT'
export type FocusDevice = 'PHONE' | 'TABLET' | 'DESKTOP'
export type PortalMode = 'FOCUS_ONLY' | 'FOCUS_AND_FULL'

export const PREBOARDING_ALLOWED_SELF_PERMISSIONS = [
  'self:employee:read',
  'self:employee:write',
  'self:address:write',
  'self:relation:write',
  'self:bank-account:read',
  'self:bank-account:write',
  'self:contract:read',
  'self:custom-field-values:read',
  'self:custom-field-values:write',
  'self:journey:read',
  'self:journey:write',
  'self:document:read',
  'self:document-signing:read',
  'self:document-signing:write',
] as const

export type PreboardingAllowedSelfPermission = (typeof PREBOARDING_ALLOWED_SELF_PERMISSIONS)[number]

export interface EmploymentTimelineEntry {
  startsOn: string
  endsOn: string | null
  recordStatus: 'DRAFT' | 'CONFIRMED' | 'CANCELLED' | string
  deletedAt?: string | null
}

export interface EmploymentAccessState {
  experience: FocusExperience
  effectiveStartDate: string | null
}

export interface PresentationResolutionInput {
  experience: FocusExperience
  activeRoles: readonly string[]
  device: FocusDevice
  explicitPreference?: FocusPresentation | null
  employeePortalMode?: PortalMode
  managerPortalMode?: PortalMode
}

export interface FullPortalPolicyInput {
  experience: FocusExperience
  activeRoles: readonly string[]
  employeePortalMode?: PortalMode
  managerPortalMode?: PortalMode
  blocked?: boolean
}

const ADMIN_PORTAL_ROLES = new Set(['TENANT_ADMIN', 'HR_ADMIN'])
const MANAGER_PORTAL_ROLES = new Set(['DIRECT_MANAGER', 'TEAM_LEAD'])

export function resolvePortalMode(input: Pick<PresentationResolutionInput, 'activeRoles' | 'employeePortalMode' | 'managerPortalMode'>): PortalMode {
  if (input.activeRoles.some((role) => MANAGER_PORTAL_ROLES.has(role))) return input.managerPortalMode ?? 'FOCUS_AND_FULL'
  if (input.activeRoles.includes('EMPLOYEE')) return input.employeePortalMode ?? 'FOCUS_AND_FULL'
  return 'FOCUS_AND_FULL'
}

export function isFullPortalAllowed(input: FullPortalPolicyInput): boolean {
  if (input.blocked || input.experience === 'PREBOARDING' || input.experience === 'NO_EMPLOYMENT') return false
  if (input.activeRoles.some((role) => ADMIN_PORTAL_ROLES.has(role))) return true
  return resolvePortalMode(input) === 'FOCUS_AND_FULL'
}

export function isPreboardingAllowedSelfPermission(permissionCode: string): permissionCode is PreboardingAllowedSelfPermission {
  return (PREBOARDING_ALLOWED_SELF_PERMISSIONS as readonly string[]).includes(permissionCode)
}

export function isDateWithinEmployment(today: string, startsOn: string, endsOn: string | null): boolean {
  return startsOn <= today && (endsOn === null || endsOn >= today)
}

export function resolveEmploymentAccessState(
  today: string,
  employments: readonly EmploymentTimelineEntry[],
): EmploymentAccessState {
  const confirmed = employments
    .filter((employment) => employment.recordStatus === 'CONFIRMED' && employment.deletedAt == null)
    .sort((left, right) => left.startsOn.localeCompare(right.startsOn))

  const active = confirmed.find((employment) => isDateWithinEmployment(today, employment.startsOn, employment.endsOn))
  if (active) return { experience: 'EMPLOYEE', effectiveStartDate: active.startsOn }

  const next = confirmed.find((employment) => employment.startsOn > today)
  if (next) return { experience: 'PREBOARDING', effectiveStartDate: next.startsOn }

  return { experience: 'NO_EMPLOYMENT', effectiveStartDate: null }
}

export function resolveFocusExperience(
  accessState: EmploymentAccessState,
  activeRoles: readonly string[],
): Exclude<FocusExperience, 'NO_EMPLOYMENT'> | 'NO_EMPLOYMENT' {
  if (accessState.experience === 'PREBOARDING' || accessState.experience === 'NO_EMPLOYMENT') return accessState.experience
  return activeRoles.some((role) => role === 'DIRECT_MANAGER' || role === 'TEAM_LEAD') ? 'MANAGER' : 'EMPLOYEE'
}

export function resolvePresentation({
  experience,
  activeRoles,
  device,
  explicitPreference,
  employeePortalMode,
  managerPortalMode,
}: PresentationResolutionInput): FocusPresentation {
  if (experience === 'PREBOARDING' || experience === 'NO_EMPLOYMENT') return 'FOCUS'
  if (activeRoles.some((role) => ADMIN_PORTAL_ROLES.has(role))) {
    return explicitPreference === 'FOCUS' || explicitPreference === 'FULL' ? explicitPreference : 'FULL'
  }
  if (resolvePortalMode({ activeRoles, employeePortalMode, managerPortalMode }) === 'FOCUS_ONLY') return 'FOCUS'
  if (explicitPreference === 'FOCUS' || explicitPreference === 'FULL') return explicitPreference
  if (device === 'PHONE' || experience === 'EMPLOYEE' || experience === 'MANAGER') return 'FOCUS'
  return 'FULL'
}

export function daysUntil(startDate: string, today: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`)
  const current = Date.parse(`${today}T00:00:00Z`)
  return Math.max(0, Math.round((start - current) / 86_400_000))
}
