import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentCatalogEntry } from '@/lib/payroll/component-catalog'
import { ComponentLibraryEntryDetail } from '@/components/payroll/component-library-entry-detail'
import { AuthorizationError } from '@/lib/auth/permissions'
import { createTranslator, type MessageTree } from '@/lib/i18n/translator'
import { getSystemComponentCatalog } from '@/lib/payroll/component-catalog'
import navigationEn from '../../../messages/en/navigation.json'
import navigationNl from '../../../messages/nl/navigation.json'

const { getComponentLibrary, redirect } = vi.hoisted(() => ({
  getComponentLibrary: vi.fn(),
  redirect: vi.fn((path: string): never => { throw new Error(`redirect:${path}`) }),
}))

vi.mock('next/navigation', () => ({ redirect }))
vi.mock('@/lib/payroll/component-library', () => ({ getComponentLibrary }))
vi.mock('./actions', () => ({ copySystemComponentAction: vi.fn() }))
vi.mock('@/lib/i18n/server', () => ({
  getLocale: vi.fn(async () => 'nl'),
  getTranslator: vi.fn(async () => (key: string, values: Readonly<Record<string, string | number>> = {}) => {
    const labels: Record<string, string> = {
      payrollComponentsName_NL_NET_PAY: 'Netto loon',
      payrollComponentsName_NL_TAXABLE_WAGE: 'Loon voor loonheffing',
      payrollComponentsMethod_expression: 'Formule',
      payrollComponentsMethod_source: 'Bronveld',
      payrollComponentsOwnership_SYSTEM: 'Systeemcomponent',
      payrollComponentsOwnership_CUSTOMER_FORK: 'Eigen kopie',
      payrollComponentsStatus_PACKAGED: 'Geregistreerd in systeembron',
      payrollComponentsStatus_DRAFT: 'Concept',
      payrollComponentsStatus_UNSPECIFIED: 'Status niet vastgelegd',
      payrollComponentsCustomerCopySuffix: 'eigen kopie',
      payrollComponentsDraftInactive: 'Dit concept wordt niet gebruikt in berekeningen. Het ontvangt geen systeemupdates.',
      payrollComponentsSourcePackage: 'Bronregelpakket',
      payrollComponentsSourcePackageVersion: 'Bronpakketversie',
      payrollComponentsSourcePackageHash: 'Bronpakketchecksum',
      payrollComponentsScope_INCOME_RELATIONSHIP: 'Inkomstenverhouding',
      payrollComponentsValueType_MONEY: 'Bedrag',
      payrollComponentsValueType_DECIMAL: 'Decimaal getal',
      payrollComponentsUpstream: 'Ontvangt input van',
      payrollComponentsRoundingMode_HALF_UP: 'Afronden: half omhoog',
      payrollComponentsCopyBlockedRegisteredRule: 'Deze wettelijke systeemregel is in deze versie niet kopieerbaar. De vertrouwde systeemimplementatie blijft uitsluitend systeemcode.',
      payrollComponentsCopied: 'De kopie is opgeslagen als eigen concept.',
      payrollComponentsOfficialSymbol: 'Officieel symbool',
      payrollComponentsSourceValue: 'Bronwaarde',
      payrollComponentsParameterSource: 'Bronverwijzing',
      payrollComponentsInput: 'Invoer',
      payrollComponentsOutput: 'Uitvoer',
    }
    return (labels[key] ?? key).replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, name: string) => String(values[name] ?? `{${name}}`))
  }),
}))

import { redirect as nextRedirect } from 'next/navigation'
import PayrollComponentsPage from './page'

const systemEntry: ComponentCatalogEntry = {
  key: 'NL-PAYROLL-2026::NL_NET_PAY::2026.1',
  definition: {
    id: 'system:nl-2026:nl-net-pay',
    code: 'NL_NET_PAY',
    version: '2026.1',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    ownership: { kind: 'SYSTEM' },
    processingScope: 'INCOME_RELATIONSHIP',
    inputs: [{ name: 'taxableWage', valueType: 'MONEY', required: true }],
    outputs: [{ name: 'netSalary', valueType: 'MONEY', rounding: { scale: 2, mode: 'HALF_UP' } }],
    dependencies: [{ componentCode: 'NL_TAXABLE_WAGE', outputName: 'taxableWage', inputName: 'taxableWage' }],
    method: { kind: 'expression', outputs: { netSalary: { kind: 'binary', operator: '-', left: { kind: 'input', name: 'taxableWage' }, right: { kind: 'literal', valueType: 'MONEY', value: '1.00' } } } },
    tracePolicy: 'FULL',
  },
  ownership: 'SYSTEM',
  package: { compositionId: 'NL-PAYROLL-2026', packageId: 'NL-PAYROLL-2026', version: '2026.1', packageHash: 'package-hash' },
  sourceMetadata: { calculationRulesTitle: 'Belastingplan 2026', sourceUrl: 'https://example.test/source' },
  roundingDefinitions: [],
  parameters: {},
  dependencies: [{ componentCode: 'NL_TAXABLE_WAGE', outputName: 'taxableWage', inputName: 'taxableWage' }],
  upstream: [{ key: 'NL-PAYROLL-2026::NL_TAXABLE_WAGE::2026.1', componentCode: 'NL_TAXABLE_WAGE', componentVersion: '2026.1', outputName: 'taxableWage', inputName: 'taxableWage' }],
  downstream: [],
  validation: { valid: true, issues: [] },
  forkable: true,
}

const draftEntry: ComponentCatalogEntry = {
  key: 'draft::30000000-0000-4000-8000-000000000001',
  definition: {
    ...systemEntry.definition,
    id: 'customer:draft:30000000-0000-4000-8000-000000000001',
    code: 'CUSTOM_30000000000040008000000000000001',
    version: '1.0.0',
    ownership: { kind: 'CUSTOMER_FORK', origin: { id: systemEntry.definition.id, code: systemEntry.definition.code, version: systemEntry.definition.version }, forkedAt: '2026-10-01T10:00:00.000Z' },
    method: { kind: 'source', path: ['source', 'gross'] },
  },
  ownership: 'CUSTOMER_FORK',
  status: 'DRAFT',
  package: { compositionId: 'customer-drafts', packageId: 'customer-drafts' },
  roundingDefinitions: [],
  parameters: {},
  dependencies: [],
  upstream: [],
  downstream: [],
  validation: { valid: true, issues: [] },
  forkable: false,
}

beforeEach(() => {
  getComponentLibrary.mockReset().mockResolvedValue({ components: [systemEntry, draftEntry], canCopy: true })
  vi.mocked(nextRedirect).mockClear()
})

describe('Payroll component library route', () => {
  it('requires the authenticated Payroll library gate before showing the catalog', async () => {
    getComponentLibrary.mockRejectedValueOnce(new AuthorizationError('forbidden'))

    await expect(PayrollComponentsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('redirect:/geen-toegang')
    expect(nextRedirect).toHaveBeenCalledWith('/geen-toegang')
  })

  it('applies URL search, category, ownership and status filters while showing the selected real definition', async () => {
    const page = await PayrollComponentsPage({ searchParams: Promise.resolve({
      q: 'NL_NET_PAY',
      category: 'expression',
      ownership: 'system',
      status: 'packaged',
      component: systemEntry.key,
    }) })
    const markup = renderToStaticMarkup(page)

    expect(markup).toContain('Netto loon')
    expect(markup).toContain('NL_NET_PAY')
    expect(markup).toContain('input.taxableWage - 1.00')
    expect(markup).toContain('Belastingplan 2026')
    expect(markup).toContain('Ontvangt input van')
    expect(markup).toContain('Invoer taxableWage')
    expect(markup).toContain('Uitvoer taxableWage')
    expect(markup).toContain('payroll-lab')
    expect(markup).not.toContain('Klantconcept')
  })

  it('keeps a returned customer draft selected and presents its captured provenance', async () => {
    const page = await PayrollComponentsPage({ searchParams: Promise.resolve({
      ownership: 'customer',
      status: 'draft',
      component: draftEntry.key,
      saved: '1',
    }) })
    const markup = renderToStaticMarkup(page)

    expect(markup).toContain('CUSTOM_30000000000040008000000000000001')
    expect(markup).toContain('Netto loon (eigen kopie)')
    expect(markup).toContain('Concept')
    expect(markup).toContain('NL_NET_PAY v2026.1')
    expect(markup).toContain('12:00')
    expect(markup).toContain('Dit concept wordt niet gebruikt in berekeningen. Het ontvangt geen systeemupdates.')
    expect(markup).toContain('Bronregelpakket')
    expect(markup).toContain('Bronpakketversie')
    expect(markup).toContain('Bronpakketchecksum')
    expect(markup).toContain('De kopie is opgeslagen als eigen concept.')
    expect(markup).not.toContain('name="catalogKey"')
  })

  it('does not label a customer-owned component as registered in a system source without a recorded status', async () => {
    const customEntry: ComponentCatalogEntry = {
      ...draftEntry,
      key: 'customer-custom::customer_custom::1.0.0',
      definition: {
        ...draftEntry.definition,
        code: 'customer_custom',
        ownership: { kind: 'CUSTOMER_CUSTOM' },
      },
      ownership: 'CUSTOMER_CUSTOM',
      status: undefined,
    }
    getComponentLibrary.mockResolvedValue({ components: [customEntry], canCopy: false })
    const page = await PayrollComponentsPage({ searchParams: Promise.resolve({ component: customEntry.key }) })
    const markup = renderToStaticMarkup(page)

    expect(markup).toContain('Status niet vastgelegd')
    expect(markup).not.toContain('Geregistreerd in systeembron')
  })

  it('renders a copy form with only the trusted catalog key and disables registered rules', async () => {
    const registeredRule: ComponentCatalogEntry = {
      ...systemEntry,
      key: 'NL-PAYROLL-2026::NL_WAGE_TAX::2026.1',
      definition: {
        ...systemEntry.definition,
        code: 'NL_WAGE_TAX',
        method: { kind: 'registeredRule', ruleKey: 'nl.2026.regular-wage-withholding', ruleVersion: '2026.1', implementationHash: 'implementation-hash', parameterSetHash: 'parameter-hash' },
      },
      parameters: { annualTableWageLimit: { valueType: 'MONEY', value: '133110' } },
      parameterMetadata: { annualTableWageLimit: {
        officialSymbol: 'Lmax',
        valueType: 'MONEY',
        value: '133110',
        unit: 'EUR per year',
        sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.1 table 1a, p.7; parameter appendix p.4',
      } },
      forkable: false,
      forkBlockReason: 'REGISTERED_RULE_NOT_COPYABLE',
    }
    getComponentLibrary.mockResolvedValue({ components: [systemEntry, registeredRule], canCopy: true })
    const activePage = await PayrollComponentsPage({ searchParams: Promise.resolve({ component: systemEntry.key }) })
    const activeMarkup = renderToStaticMarkup(activePage)
    const blockedPage = await PayrollComponentsPage({ searchParams: Promise.resolve({ component: registeredRule.key }) })
    const blockedMarkup = renderToStaticMarkup(blockedPage)

    expect(activeMarkup).toContain('name="catalogKey"')
    expect(activeMarkup).toContain(systemEntry.key)
    expect(activeMarkup).not.toContain('name="tenantId"')
    expect(activeMarkup).not.toContain('name="definition"')
    expect(blockedMarkup).toContain('Officieel symbool')
    expect(blockedMarkup).toContain('Lmax')
    expect(blockedMarkup).toContain('EUR per year')
    expect(blockedMarkup).toContain('Rekenvoorschriften 2026 v2, §2.2.1 table 1a, p.7')
    expect(blockedMarkup).toContain('Deze wettelijke systeemregel is in deze versie niet kopieerbaar.')
    expect(blockedMarkup).toContain('disabled=""')
  })

  it('renders every real system catalog detail with strict Dutch and English translations', () => {
    const components = getSystemComponentCatalog()
    expect(components).toHaveLength(24)

    for (const [locale, messages] of [
      ['nl', navigationNl as MessageTree],
      ['en', navigationEn as MessageTree],
    ] as const) {
      const translate = createTranslator(messages)

      for (const entry of components) {
        const markup = renderToStaticMarkup(
          <ComponentLibraryEntryDetail components={components} entry={entry} locale={locale} t={translate} />,
        )
        expect(markup).not.toMatch(/payrollComponents[A-Z_]/)
        expect(markup).not.toContain('I18N_MESSAGE_MISSING')
      }
    }
  })
})
