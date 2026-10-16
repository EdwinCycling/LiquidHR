import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import enNavigation from '@/messages/en/navigation.json'
import nlNavigation from '@/messages/nl/navigation.json'

const internalLanguage = /\b(?:synthetic\w*|synthetisch\w*|fixture\w*|benchmark\w*|demo|foundation\w*|coming soon|work in progress|technical key|technische sleutel)\b|test[\s-]*(?:employment|arrangement|data|scenario|payroll|persona|only|dienstverband|regeling|gegevens|rol|gebruiker)/i
const technicalPackageLabel = /\b(?:LHR_DEMO|PAYFULL|CAO-BENCH|PAYRUN01|GC-NL-\d{3})[A-Z0-9_-]*\b/i
const developmentOnlyNavigationKey = /^(?:testRoleSwitch|payrun01|payrollLab|payrollComponents|arrangements(?:Fixtures|Synthetic|SalaryStrategy|EffectiveFrom|PrimaryAssignment|ExactlyOnePrimary|CalculationDate|ResolveComposition|SelectPackage|Assignment|ActivateBeforeAssigning|NoAvailableAssignmentChoice|CompositionSnapshots|Snapshot|Error|PackagesActivated|AvailabilityEnded|AvailabilityStartExtended|Development))/
const normalArrangementNavigationKeys = [
  'arrangementsDescription', 'arrangementsUnavailable', 'arrangementsStorageUnavailable',
  'arrangementsPackagesTitle', 'arrangementsPackagesDescription', 'arrangementsAdminActionTitle',
  'arrangementsAdminActionScope', 'arrangementsAdminActionPackages', 'arrangementsAdminActionPermission',
  'arrangementsMakeAvailableAction', 'arrangementsAdminPermissionRequired', 'arrangementsCatalogueNotice',
  'arrangementsCalculationNotValidated', 'arrangementsNameKinderopvang', 'arrangementsNameRetailMode',
  'arrangementsNameOpenSalaryBands',
] as const

function collectText(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(collectText)
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectText)
  return []
}

function ordinaryMessages(locale: 'en' | 'nl'): string[] {
  const directory = join(process.cwd(), 'messages', locale)
  return readdirSync(directory)
    .filter((filename) => filename.endsWith('.json'))
    .flatMap((filename) => {
      const messages = JSON.parse(readFileSync(join(directory, filename), 'utf8')) as Record<string, unknown>
      if (filename !== 'navigation.json') return collectText(messages)
      return Object.entries(messages)
        .filter(([key]) => !developmentOnlyNavigationKey.test(key))
        .flatMap(([, value]) => collectText(value))
    })
}

describe('Product language regression', () => {
  it('keeps ordinary NL and EN product copy free of internal test, development, and package labels', () => {
    const visibleText = [...ordinaryMessages('en'), ...ordinaryMessages('nl')].join('\n')
    expect(visibleText).not.toMatch(internalLanguage)
    expect(visibleText).not.toMatch(technicalPackageLabel)
  })

  it('keeps arrangements copy and ordinary Payroll navigation business-facing', () => {
    const ordinaryArrangementCopy = [
      ...normalArrangementNavigationKeys.map((key) => enNavigation[key]),
      ...normalArrangementNavigationKeys.map((key) => nlNavigation[key]),
    ].join('\n')

    expect(ordinaryArrangementCopy).not.toMatch(internalLanguage)
    expect(enNavigation.payroll).toBe('Payroll')
    expect(nlNavigation.payroll).toBe('Salarisadministratie')
    expect(enNavigation.sectionPayroll).toBe('Payroll')
    expect(nlNavigation.sectionPayroll).toBe('Payroll')
    expect(`${enNavigation.payroll} ${nlNavigation.payroll} ${enNavigation.sectionPayroll} ${nlNavigation.sectionPayroll}`).not.toMatch(internalLanguage)
  })
})
