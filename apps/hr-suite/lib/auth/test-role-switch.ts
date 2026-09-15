export const TEST_ROLE_SWITCH_OWNER_EMAIL = 'edwin@editsolutions.nl'
export const TEST_ROLE_SWITCH_SUPABASE_PROJECT_REF = 'wnpfloqpjvaacobppbpk'

export const TEST_ROLE_SWITCH_TARGETS = [
  { key: 'edwin', email: TEST_ROLE_SWITCH_OWNER_EMAIL },
  { key: 'hr-admin', email: 'hradmin.fixture@liquidhr.test' },
  { key: 'manager', email: 'manager.fixture@liquidhr.test' },
  { key: 'employee', email: 'employee.fixture@liquidhr.test' },
] as const

export type TestRoleSwitchTargetKey = (typeof TEST_ROLE_SWITCH_TARGETS)[number]['key']
export type TestRoleSwitchTarget = (typeof TEST_ROLE_SWITCH_TARGETS)[number]

export function normalizedEmail(email: string | null | undefined): string {
  return email?.trim().toLowerCase() ?? ''
}

export function isTestRoleSwitchAccount(email: string | null | undefined): boolean {
  const candidate = normalizedEmail(email)
  return TEST_ROLE_SWITCH_TARGETS.some((target) => target.email === candidate)
}

export function getTestRoleSwitchTarget(value: string | null | undefined): TestRoleSwitchTarget | null {
  return TEST_ROLE_SWITCH_TARGETS.find((target) => target.key === value) ?? null
}

interface TestRoleSwitchEnvironment {
  nodeEnv?: string
  vercelEnv?: string
  explicitFlag?: string
  supabaseUrl?: string
}

function normalizedEnvironment(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? ''
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
  const vercelEnv = normalizedEnvironment(environment.vercelEnv ?? process.env.VERCEL_ENV)
  const explicitFlag = normalizedEnvironment(environment.explicitFlag ?? process.env.LIQUIDHR_TEST_ROLE_SWITCH_ENABLED)
  const projectRef = resolveSupabaseProjectRef(environment.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL)
  const explicitlyEnabledForDevProject = explicitFlag === 'true' && projectRef === TEST_ROLE_SWITCH_SUPABASE_PROJECT_REF

  // Vercel's production target is also used for the hosted DEV/test product
  // line. It is safe only when the explicit flag and canonical DEV project
  // ref both match; another Supabase project remains fail-closed.
  if (vercelEnv === 'production') return explicitlyEnabledForDevProject
  if (!vercelEnv && nodeEnv === 'production') return false
  if (vercelEnv && !['preview', 'development', 'test'].includes(vercelEnv)) return false

  return explicitlyEnabledForDevProject
}
