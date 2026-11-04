export const SYNTHETIC_PENSION_FIXTURE_FLAG = 'PENSION_TEST_FIXTURES_ENABLED'
export const SYNTHETIC_PENSION_FIXTURE_CLAIM = 'liquidhr_pension_test_fixtures_enabled'
export const SYNTHETIC_PENSION_FIXTURE_ENVIRONMENT_CLAIM = 'liquidhr_pension_fixture_environment'

export type PensionFixtureEnvironment = Readonly<Record<string, string | undefined>>
export type PensionFixtureAppMetadata = Readonly<Record<string, unknown>>

export function isSyntheticPensionFixtureRuntimeEnabled(environment: PensionFixtureEnvironment = process.env): boolean {
  if (environment[SYNTHETIC_PENSION_FIXTURE_FLAG] !== 'true') return false
  if (environment.VERCEL_ENV === 'production'
    || environment.LIQUIDHR_RUNTIME_ENV === 'production') return false
  const runtimeEnvironment = environment.LIQUIDHR_RUNTIME_ENV
    ?? environment.VERCEL_ENV
    ?? environment.NODE_ENV
  return runtimeEnvironment !== undefined && ['test', 'development', 'preview'].includes(runtimeEnvironment)
}

export function isSyntheticPensionFixtureEnabled(
  environment: PensionFixtureEnvironment = process.env,
  appMetadata?: PensionFixtureAppMetadata | null,
): boolean {
  if (!isSyntheticPensionFixtureRuntimeEnabled(environment)) return false
  const runtimeEnvironment = environment.LIQUIDHR_RUNTIME_ENV
    ?? environment.VERCEL_ENV
    ?? environment.NODE_ENV
  return appMetadata?.[SYNTHETIC_PENSION_FIXTURE_CLAIM] === true
    && appMetadata[SYNTHETIC_PENSION_FIXTURE_ENVIRONMENT_CLAIM] === runtimeEnvironment
}

export function syntheticPensionSourceClassification(scenario: string): string | null {
  const normalizedScenario = scenario.trim()
  if (normalizedScenario.length < 3 || normalizedScenario.length > 180 || /[\r\n\u0000-\u001f]/.test(normalizedScenario)) {
    return null
  }
  return `SYNTHETIC_TEST_FIXTURE — ${normalizedScenario}`
}
