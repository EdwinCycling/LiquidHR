import 'server-only'

export const TEST_ROLE_SWITCH_OWNER_EMAIL = 'edwin@editsolutions.nl'
export const TEST_ROLE_SWITCH_SUPABASE_PROJECT_REF = 'wnpfloqpjvaacobppbpk'

export const TEST_ROLE_SWITCH_TARGETS = [
  { key: 'edwin', email: TEST_ROLE_SWITCH_OWNER_EMAIL, available: true },
  { key: 'hr-admin', email: 'hradmin.fixture@liquidhr.test', available: true },
  { key: 'manager', email: 'manager.fixture@liquidhr.test', available: true },
  { key: 'employee', email: 'employee.fixture@liquidhr.test', available: true },
  { key: 'payroll-lisa', email: 'lisa.test@liquidhr.test', available: true },
  { key: 'payroll-jaap', email: 'jaap.test@liquidhr.test', available: false },
  { key: 'payroll-frits', email: 'frits.test@liquidhr.test', available: false },
] as const

export type TestRoleSwitchTargetKey = (typeof TEST_ROLE_SWITCH_TARGETS)[number]['key']
export type TestRoleSwitchTarget = (typeof TEST_ROLE_SWITCH_TARGETS)[number]

export interface TestRoleSwitchEnvironment {
  nodeEnv?: string
  vercel?: string
  vercelEnv?: string
  vercelUrl?: string
  explicitFlag?: string
  supabaseUrl?: string
}

export interface LocalPersonaIdentity {
  email: string | null | undefined
  emailVerified: boolean
}

function normalizedEnvironment(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}

export function normalizedEmail(email: string | null | undefined): string {
  return email?.trim().toLowerCase() ?? ''
}

export function resolveSupabaseProjectRef(supabaseUrl: string | undefined): string | null {
  if (!supabaseUrl) return null

  try {
    const parsed = new URL(supabaseUrl)
    if (
      parsed.protocol !== 'https:'
      || parsed.username
      || parsed.password
      || parsed.port
      || parsed.pathname !== '/'
      || parsed.search
      || parsed.hash
    ) return null

    const suffix = '.supabase.co'
    const hostname = parsed.hostname.toLowerCase()
    if (!hostname.endsWith(suffix)) return null

    const projectRef = hostname.slice(0, -suffix.length)
    return /^(?=.{1,63}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(projectRef)
      ? projectRef
      : null
  } catch {
    return null
  }
}

export function isTestRoleSwitchEnabled(environment: TestRoleSwitchEnvironment = {}): boolean {
  const nodeEnv = normalizedEnvironment(environment.nodeEnv ?? process.env.NODE_ENV)
  const vercel = normalizedEnvironment(environment.vercel ?? process.env.VERCEL)
  const vercelEnv = normalizedEnvironment(environment.vercelEnv ?? process.env.VERCEL_ENV)
  const vercelUrl = normalizedEnvironment(environment.vercelUrl ?? process.env.VERCEL_URL)
  const explicitFlag = normalizedEnvironment(environment.explicitFlag ?? process.env.LIQUIDHR_TEST_ROLE_SWITCH_ENABLED)
  const projectRef = resolveSupabaseProjectRef(environment.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL)
  const explicitlyEnabledForCanonicalProject = explicitFlag === 'true' && projectRef === TEST_ROLE_SWITCH_SUPABASE_PROJECT_REF

  return nodeEnv === 'development'
    && !vercel
    && !vercelEnv
    && !vercelUrl
    && explicitlyEnabledForCanonicalProject
}

export function isLocalhostHost(host: string | null | undefined): boolean {
  const candidate = host?.trim().toLowerCase()
  if (!candidate || candidate.includes(',') || candidate.includes('/') || candidate.includes('@')) return false

  try {
    const parsed = new URL(`http://${candidate}`)
    if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return false
    if (parsed.host.toLowerCase() !== candidate) return false
    return ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname.toLowerCase())
  } catch {
    return false
  }
}

export function isLocalPersonaRuntime(
  host: string | null | undefined,
  environment: TestRoleSwitchEnvironment = {},
): boolean {
  return isTestRoleSwitchEnabled(environment) && isLocalhostHost(host)
}

export function isTestRoleSwitchAccount(email: string | null | undefined): boolean {
  const candidate = normalizedEmail(email)
  return TEST_ROLE_SWITCH_TARGETS.some((target) => target.email === candidate)
}

export function canInitiateTestRoleSwitch(activeRoles: readonly string[]): boolean {
  return activeRoles.some((role) => role === 'TENANT_ADMIN' || role === 'HR_ADMIN')
}

export function canUseLocalPersonaSwitcher(
  host: string | null | undefined,
  identity: LocalPersonaIdentity,
  environment: TestRoleSwitchEnvironment = {},
): boolean {
  return isLocalPersonaRuntime(host, environment)
    && identity.emailVerified
    && normalizedEmail(identity.email) === TEST_ROLE_SWITCH_OWNER_EMAIL
}

export function canReturnToLocalPersonaOwner(
  host: string | null | undefined,
  identity: LocalPersonaIdentity,
  environment: TestRoleSwitchEnvironment = {},
): boolean {
  return isLocalPersonaRuntime(host, environment)
    && identity.emailVerified
    && isTestRoleSwitchAccount(identity.email)
    && normalizedEmail(identity.email) !== TEST_ROLE_SWITCH_OWNER_EMAIL
}

export function getTestRoleSwitchTarget(value: string | null | undefined): TestRoleSwitchTarget | null {
  return TEST_ROLE_SWITCH_TARGETS.find((target) => target.key === value) ?? null
}

export function getAvailableTestRoleSwitchTarget(value: string | null | undefined): TestRoleSwitchTarget | null {
  const target = getTestRoleSwitchTarget(value)
  return target?.available ? target : null
}
