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

export function isTestRoleSwitchEnabled(environment: {
  nodeEnv?: string
  explicitFlag?: string
} = {}): boolean {
  const explicitFlag = environment.explicitFlag ?? process.env.LIQUIDHR_TEST_ROLE_SWITCH_ENABLED
  return explicitFlag?.trim().toLowerCase() === 'true' || (environment.nodeEnv ?? process.env.NODE_ENV) !== 'production'
}
