import 'server-only'
import { requireAuthContext } from '@/lib/auth/permissions'
import { getVerifiedLocalPersonaIdentity, normalizedEmail } from '@/lib/auth/test-role-switch'
import { selectActiveContext } from '@/lib/context/administration-context'
import { loadAccessibleContextOptions } from '@/lib/context/server-context'
import type { createClient } from '@/lib/supabase/server'

const TEST_TENANT_ID = '07249eb9-545c-883b-b26b-d52f83b4f4a1'
const TEST_HR_GROUP_ID = '6ba6f1df-e376-40f2-abff-ffdf000172e1'

const PERSONAS = {
  'hr-admin': {
    email: 'hradmin.fixture@liquidhr.test',
    passwordEnvironmentKey: 'TALENT_HR_ADMIN_PASSWORD',
    role: 'TENANT_ADMIN',
    labelKey: 'localSignInHrAdmin',
    unavailableKey: 'localSignInHrAdminUnavailable',
  },
  manager: {
    email: 'manager.fixture@liquidhr.test',
    passwordEnvironmentKey: 'TALENT_MANAGER_PASSWORD',
    role: 'DIRECT_MANAGER',
    employeeId: '9048f02b-4fdc-3c4c-e1aa-fd339660029c',
    labelKey: 'localSignInManager',
    unavailableKey: 'localSignInManagerUnavailable',
  },
  employee: {
    email: 'employee.fixture@liquidhr.test',
    passwordEnvironmentKey: 'TALENT_EMPLOYEE_PASSWORD',
    role: 'EMPLOYEE',
    employeeId: 'c6b1c7a9-c250-3d19-b1a0-87e317e80b13',
    labelKey: 'localSignInEmployee',
    unavailableKey: 'localSignInEmployeeUnavailable',
  },
} as const

export type LocalTestPersonaKey = keyof typeof PERSONAS
type LocalTestSignInClient = Awaited<ReturnType<typeof createClient>>

export interface LocalTestSignInOption {
  key: LocalTestPersonaKey
  labelKey: string
  unavailableKey: string
  configured: boolean
}

export interface VerifiedLocalTestPersona {
  userId: string
  tenantId: string
  hrGroupId: string
  employeeId: string | null
  activeRoles: string[]
}

export function isLocalTestPersonaKey(value: unknown): value is LocalTestPersonaKey {
  return typeof value === 'string' && Object.hasOwn(PERSONAS, value)
}

export function getLocalTestSignInOptions(): LocalTestSignInOption[] {
  return (Object.keys(PERSONAS) as LocalTestPersonaKey[]).map((key) => {
    const persona = PERSONAS[key]
    return {
      key,
      labelKey: persona.labelKey,
      unavailableKey: persona.unavailableKey,
      configured: Boolean(process.env[persona.passwordEnvironmentKey]),
    }
  })
}

export function getLocalTestPersonaEmail(key: LocalTestPersonaKey): string {
  return PERSONAS[key].email
}
export function getLocalTestPersonaPasswordEnvironmentKey(key: LocalTestPersonaKey): string {
  return PERSONAS[key].passwordEnvironmentKey
}

export function getLocalTestPersonaPassword(key: LocalTestPersonaKey): string | undefined {
  return process.env[PERSONAS[key].passwordEnvironmentKey] || undefined
}

function rolesMatchPersona(key: LocalTestPersonaKey, activeRoles: string[]): boolean {
  const hasExpectedRole = activeRoles.includes(PERSONAS[key].role)
  const hasPrivilegedAdminRole = activeRoles.some((role) => role === 'TENANT_ADMIN' || role === 'HR_ADMIN')
  if (!hasExpectedRole) return false
  if (key === 'manager') return !hasPrivilegedAdminRole
  if (key === 'employee') {
    return !hasPrivilegedAdminRole && !activeRoles.includes('DIRECT_MANAGER')
  }
  return true
}

export async function verifyLocalTestPersonaIdentity(
  client: LocalTestSignInClient,
  key: LocalTestPersonaKey,
): Promise<VerifiedLocalTestPersona | null> {
  const persona = PERSONAS[key]
  const verified = await getVerifiedLocalPersonaIdentity(client)
  if (
    !verified
    || !verified.identity.emailVerified
    || normalizedEmail(verified.identity.email) !== persona.email
  ) return null

  const accessible = await loadAccessibleContextOptions(verified.userId, client, { requireComplete: true })
  if (accessible.userId !== verified.userId) return null

  const tenant = accessible.tenants.find((option) => option.id === TEST_TENANT_ID)
  const group = tenant?.hrGroups.find((option) => option.id === TEST_HR_GROUP_ID && option.tenantId === TEST_TENANT_ID)
  if (!tenant || !group) return null

  const activeContext = selectActiveContext({
    tenants: accessible.tenants,
    requestedTenantId: TEST_TENANT_ID,
    requestedHrGroupId: TEST_HR_GROUP_ID,
  })
  const authContext = await requireAuthContext(client, activeContext)

  if (
    authContext.userId !== verified.userId
    || authContext.tenantId !== TEST_TENANT_ID
    || authContext.hrGroupId !== TEST_HR_GROUP_ID
    || !rolesMatchPersona(key, authContext.activeRoles)
  ) return null

  if ("employeeId" in persona && authContext.employeeId !== persona.employeeId) return null

  return {
    userId: authContext.userId,
    tenantId: authContext.tenantId,
    hrGroupId: authContext.hrGroupId,
    employeeId: authContext.employeeId,
    activeRoles: authContext.activeRoles,
  }
}
