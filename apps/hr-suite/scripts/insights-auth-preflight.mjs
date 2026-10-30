import { stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const REQUIRED_INSIGHTS_AUTH_KEYS = Object.freeze([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'TALENT_HR_ADMIN_PASSWORD',
  'TALENT_MANAGER_PASSWORD',
  'TALENT_EMPLOYEE_PASSWORD',
  'LIQUIDHR_TEST_ROLE_SWITCH_ENABLED',
])

export function missingInsightsAuthKeys(availableKeyNames) {
  return REQUIRED_INSIGHTS_AUTH_KEYS.filter((key) => !availableKeyNames.has(key))
}

async function configFileStatus(filePath) {
  try {
    await stat(filePath)
    return 'present'
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return 'missing'
    throw new Error('INSIGHTS_AUTH_PREFLIGHT_CONFIG_STATUS_UNAVAILABLE')
  }
}

async function main() {
  const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const localAppData = process.env.LOCALAPPDATA
  const configFiles = [
    { label: 'apps/hr-suite/.env.local', path: path.join(appRoot, '.env.local') },
    ...(localAppData
      ? [
          { label: 'central TEST .env.local', path: path.join(localAppData, 'LiquidHR', 'TestRuntime', '.env.local') },
          { label: 'central TEST persona credentials', path: path.join(localAppData, 'LiquidHR', 'TestRuntime', 'payroll-test-personas.env') },
        ]
      : []),
  ]
  const fileStatuses = []
  for (const configFile of configFiles) {
    fileStatuses.push({ label: configFile.label, status: await configFileStatus(configFile.path) })
  }

  // Object.keys checks only which names exist; it never accesses environment values.
  const availableKeyNames = new Set(Object.keys(process.env))
  const unverified = missingInsightsAuthKeys(availableKeyNames)
  const hasConfigFile = fileStatuses.some((fileStatus) => fileStatus.status === 'present')

  console.log('INS-RELEASE-02 authentication configuration preflight')
  for (const fileStatus of fileStatuses) console.log(fileStatus.label + ': ' + fileStatus.status)
  if (unverified.length && hasConfigFile) {
    console.log('Configuration key names not verified because a config file exists: ' + unverified.join(', '))
    console.log('File contents were not read.')
    process.exitCode = 2
  } else if (unverified.length) {
    console.log('Missing configuration key names: ' + unverified.join(', '))
    process.exitCode = 2
  } else {
    console.log('All required configuration key names exist in the process environment.')
  }
  console.log('No environment values were read or printed. No server, Auth, Supabase, or database request was made.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}