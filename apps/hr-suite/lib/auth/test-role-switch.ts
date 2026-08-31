export const TEST_ROLE_SWITCH_OWNER_EMAIL = 'edwin@editsolutions.nl'

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
}

function normalizedEnvironment(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}

export function isTestRoleSwitchEnabled(environment: TestRoleSwitchEnvironment = {}): boolean {
  const nodeEnv = normalizedEnvironment(environment.nodeEnv ?? process.env.NODE_ENV)
  const vercelEnv = normalizedEnvironment(environment.vercelEnv ?? process.env.VERCEL_ENV)
  const explicitFlag = normalizedEnvironment(environment.explicitFlag ?? process.env.LIQUIDHR_TEST_ROLE_SWITCH_ENABLED)

  // Next.js sets NODE_ENV=production for Preview builds as well. Vercel's
  // server-only VERCEL_ENV lets Preview keep an explicit test capability while
  // Production remains an unconditional deny, even with a stale flag.
  if (vercelEnv === 'production' || (!vercelEnv && nodeEnv === 'production')) return false
  if (vercelEnv && !['preview', 'development', 'test'].includes(vercelEnv)) return false

  return explicitFlag === 'true' || nodeEnv !== 'production'
}
