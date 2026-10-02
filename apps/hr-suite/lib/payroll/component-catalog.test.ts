import {
  forkSystemComponent,
  GC_NL_001_RULE_PACKAGE,
  type PayrollComponentDefinition,
} from '@liquid-hr/payroll-engine'
import {
  NL_2026_PARAMETER_METADATA,
  NL_2026_RULE_PACKAGE,
} from '@liquid-hr/payroll-rules-nl-2026'
import { describe, expect, it } from 'vitest'
import {
  createComponentCatalogEntry,
  filterComponentCatalogEntries,
  findSystemComponentCatalogEntry,
  findSystemComponentCatalogEntryByKey,
  getSystemComponentCatalog,
  SYSTEM_COMPONENT_CATALOG,
  type ComponentCatalogEntry,
} from './component-catalog'

function component(overrides: Partial<PayrollComponentDefinition> = {}): PayrollComponentDefinition {
  return {
    id: 'system:test-component',
    code: 'TEST_COMPONENT',
    version: '1.0.0',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    ownership: { kind: 'SYSTEM' },
    processingScope: 'EMPLOYMENT',
    inputs: [],
    outputs: [{ name: 'Amount', valueType: 'MONEY' }],
    dependencies: [],
    method: { kind: 'source', path: ['amount'] },
    tracePolicy: 'FULL',
    ...overrides,
  }
}

function dependentComponent(
  dependency: PayrollComponentDefinition['dependencies'][number],
  overrides: Partial<PayrollComponentDefinition> = {},
): PayrollComponentDefinition {
  return component({
    id: 'system:test-dependent',
    code: 'TEST_DEPENDENT',
    inputs: [{ name: 'base', valueType: 'MONEY', required: true }],
    dependencies: [dependency],
    method: { kind: 'passThrough', outputs: { Amount: 'base' } },
    ...overrides,
  })
}

function issueCodes(entry: ReturnType<typeof createComponentCatalogEntry>): readonly string[] {
  return entry.validation.issues.map((issue) => issue.code)
}

describe('payroll component catalog', () => {
  it('adapts the real synthetic and NL-2026 packages into unique SYSTEM entries', () => {
    const catalog = getSystemComponentCatalog()

    expect(catalog).toBe(SYSTEM_COMPONENT_CATALOG)
    expect(catalog).toHaveLength(GC_NL_001_RULE_PACKAGE.components.length + NL_2026_RULE_PACKAGE.components.length)
    expect(catalog).toHaveLength(24)
    expect(catalog.every((entry) => entry.ownership === 'SYSTEM')).toBe(true)
    expect(new Set(catalog.map((entry) => entry.key)).size).toBe(catalog.length)
    expect(catalog.every((entry) => entry.validation.valid)).toBe(true)

    const syntheticEntry = findSystemComponentCatalogEntry({
      compositionId: GC_NL_001_RULE_PACKAGE.compositionId,
      code: 'gross_salary',
      version: '1.0.0',
    })
    expect(syntheticEntry?.package.packageId).toBeUndefined()
    expect(syntheticEntry?.definition.method.kind).toBe('source')
    expect(syntheticEntry?.forkable).toBe(true)

    const nlWageTax = findSystemComponentCatalogEntry({
      packageId: 'NL-PAYROLL-2026',
      compositionId: NL_2026_RULE_PACKAGE.compositionId,
      code: 'NL_WAGE_TAX',
      version: '2026.1',
    })
    expect(nlWageTax?.package).toMatchObject({
      packageId: 'NL-PAYROLL-2026',
      version: '2026.1',
      packageHash: NL_2026_RULE_PACKAGE.metadata?.packageHash,
      parameterSetHash: NL_2026_RULE_PACKAGE.metadata?.parameterSetHash,
    })
    expect(nlWageTax?.sourceMetadata).toEqual(NL_2026_RULE_PACKAGE.metadata?.sourceMetadata)
    expect(nlWageTax?.roundingDefinitions).toEqual(
      NL_2026_RULE_PACKAGE.roundingDefinitions?.filter((rounding) => rounding.componentCode === 'NL_WAGE_TAX'),
    )
    expect(nlWageTax?.parameters).toEqual(nlWageTax?.definition.parameters)
    expect(nlWageTax?.parameterMetadata).toEqual(NL_2026_PARAMETER_METADATA)
    expect(nlWageTax?.forkable).toBe(false)
    expect(nlWageTax?.forkBlockReason).toBe('REGISTERED_RULE_NOT_COPYABLE')
    expect(nlWageTax?.definition.method).toMatchObject({ kind: 'registeredRule', ruleKey: 'nl.2026.regular-wage-withholding' })
    expect('execute' in (nlWageTax?.definition.method ?? {})).toBe(false)
  })

  it('uses exact lookup keys and supports package-aware search filters', () => {
    const wageTax = findSystemComponentCatalogEntry({
      packageId: 'NL-PAYROLL-2026',
      code: 'NL_WAGE_TAX',
      version: '2026.1',
    })
    expect(wageTax).not.toBeNull()
    expect(findSystemComponentCatalogEntryByKey(wageTax!.key)).toBe(wageTax)
    expect(findSystemComponentCatalogEntry({ packageId: 'other-package', code: 'NL_WAGE_TAX', version: '2026.1' })).toBeNull()
    expect(findSystemComponentCatalogEntry({ code: 'NL_WAGE_TAX', version: 'missing' })).toBeNull()

    const filtered = filterComponentCatalogEntries(SYSTEM_COMPONENT_CATALOG, {
      query: 'Belastingdienst',
      ownership: 'SYSTEM',
      category: 'registeredRule',
    })
    expect(filtered.map((entry) => entry.definition.code)).toEqual(['NL_WAGE_TAX'])
    expect(filterComponentCatalogEntries(SYSTEM_COMPONENT_CATALOG, { query: ' nl_net_pay ' }).map((entry) => entry.definition.code)).toEqual(['NL_NET_PAY'])
    expect(filterComponentCatalogEntries(SYSTEM_COMPONENT_CATALOG, { category: 'source' }).length).toBeGreaterThan(0)

    const customerDraft = createComponentCatalogEntry({
      definition: component({ ownership: { kind: 'CUSTOMER_CUSTOM' } }),
      compositionId: 'customer-test',
      key: 'draft::customer',
      displayName: 'Extra pensioen',
      category: 'Compensatie',
      status: 'DRAFT',
    })
    expect(filterComponentCatalogEntries([customerDraft], {
      query: 'extra pensioen',
      category: 'compensatie',
      ownership: 'CUSTOMER_CUSTOM',
      status: 'DRAFT',
    })).toEqual([customerDraft])
  })

  it('creates a detached immutable plain snapshot without exposing executable code', () => {
    const path = ['salary', 'amount']
    const source = component({ method: { kind: 'source', path } })
    const entry = createComponentCatalogEntry({
      definition: source,
      compositionId: 'test-composition',
      components: [source],
    })

    path[0] = 'changed'
    expect(entry.definition.method).toEqual({ kind: 'source', path: ['salary', 'amount'] })
    expect(Object.isFrozen(entry)).toBe(true)
    expect(Object.isFrozen(entry.definition)).toBe(true)
    expect(Object.isFrozen(entry.definition.method)).toBe(true)
    expect(Object.isFrozen(entry.definition.method.kind === 'source' ? entry.definition.method.path : [])).toBe(true)
    expect(entry.key).toContain(encodeURIComponent('test-composition'))
  })

  it('rebuilds a detached draft catalog entry from stored source metadata without current-package lookup', () => {
    const sourceEntry = findSystemComponentCatalogEntry({
      packageId: 'NL-PAYROLL-2026',
      code: 'NL_NET_PAY',
      version: '2026.1',
    })
    if (!sourceEntry) throw new Error('Expected an NL-2026 SYSTEM catalog entry.')
    const persistedSource = JSON.parse(JSON.stringify(sourceEntry)) as ComponentCatalogEntry
    const customerCode = `CUSTOM_${'A'.repeat(32)}`
    const definition = forkSystemComponent(persistedSource.definition, {
      id: customerCode,
      code: customerCode,
      version: '1',
      effectiveFrom: persistedSource.definition.effectiveFrom,
      effectiveTo: persistedSource.definition.effectiveTo,
      forkedAt: '2026-10-01T12:00:00.000Z',
    })
    const draft = createComponentCatalogEntry({
      definition,
      key: 'draft::10000000-0000-4000-8000-000000000099',
      packageIdentity: persistedSource.package,
      sourceMetadata: persistedSource.sourceMetadata,
      roundingDefinitions: persistedSource.roundingDefinitions,
      parameters: persistedSource.parameters,
      upstream: persistedSource.upstream,
      downstream: [],
      validation: persistedSource.validation,
      status: 'DRAFT',
    })

    expect(draft.key).toBe('draft::10000000-0000-4000-8000-000000000099')
    expect(draft.ownership).toBe('CUSTOMER_FORK')
    expect(draft.status).toBe('DRAFT')
    expect(draft.package).toEqual(persistedSource.package)
    expect(draft.sourceMetadata).toEqual(persistedSource.sourceMetadata)
    expect(draft.upstream).toEqual(persistedSource.upstream)
    expect(draft.validation).toEqual(persistedSource.validation)
    expect(draft.dependencies).toEqual(definition.dependencies)
    expect(draft.forkable).toBe(false)
    expect(draft.forkBlockReason).toBe('SYSTEM_OWNERSHIP_REQUIRED')
  })

  it('resolves upstream/downstream versions and validates refs, types, and scopes', () => {
    const firstProvider = component({
      id: 'system:test-provider',
      code: 'TEST_PROVIDER',
      version: '1.0.0',
      effectiveTo: '2026-06-30',
    })
    const secondProvider = component({
      id: 'system:test-provider',
      code: 'TEST_PROVIDER',
      version: '2.0.0',
      effectiveFrom: '2026-07-01',
    })
    const consumer = dependentComponent({ componentCode: 'TEST_PROVIDER', outputName: 'Amount', inputName: 'base' })
    const packageComponents = [firstProvider, secondProvider, consumer]
    const entry = createComponentCatalogEntry({
      definition: consumer,
      compositionId: 'versioned-test',
      components: packageComponents,
    })

    expect(entry.validation).toEqual({ valid: true, issues: [] })
    expect(entry.upstream.map((reference) => reference.componentVersion)).toEqual(['1.0.0', '2.0.0'])
    const firstProviderEntry = createComponentCatalogEntry({
      definition: firstProvider,
      compositionId: 'versioned-test',
      components: packageComponents,
    })
    expect(firstProviderEntry.downstream).toEqual([{
      key: entry.key,
      componentCode: 'TEST_DEPENDENT',
      componentVersion: '1.0.0',
      outputName: 'Amount',
      inputName: 'base',
    }])

    const scopeMismatch = dependentComponent(
      { componentCode: 'TEST_PROVIDER', outputName: 'Amount', inputName: 'base' },
      { processingScope: 'PAYROLL_RUN' },
    )
    const invalid = createComponentCatalogEntry({
      definition: scopeMismatch,
      compositionId: 'scope-test',
      components: [firstProvider, scopeMismatch],
    })
    expect(issueCodes(invalid)).toContain('DEPENDENCY_SCOPE_MISMATCH')

    const missingVersion = createComponentCatalogEntry({
      definition: consumer,
      compositionId: 'version-gap',
      components: [firstProvider, consumer],
    })
    expect(issueCodes(missingVersion)).toContain('DEPENDENCY_VERSION_MISSING')
  })

  it('blocks missing, ambiguous, and mismatched graph references', () => {
    const consumer = dependentComponent({ componentCode: 'NO_SUCH_COMPONENT', outputName: 'Missing', inputName: 'base' })
    const missingReference = createComponentCatalogEntry({
      definition: consumer,
      compositionId: 'missing-ref',
      components: [consumer],
    })
    expect(issueCodes(missingReference)).toContain('DEPENDENCY_COMPONENT_UNKNOWN')

    const providerWithoutOutput = component({
      id: 'system:provider-without-output',
      code: 'PROVIDER_WITHOUT_OUTPUT',
      outputs: [{ name: 'Actual', valueType: 'MONEY' }],
    })
    const consumerWithMissingOutput = dependentComponent({
      componentCode: 'PROVIDER_WITHOUT_OUTPUT',
      outputName: 'Missing',
      inputName: 'base',
    })
    const missingOutput = createComponentCatalogEntry({
      definition: consumerWithMissingOutput,
      compositionId: 'missing-output',
      components: [providerWithoutOutput, consumerWithMissingOutput],
    })
    expect(issueCodes(missingOutput)).toContain('DEPENDENCY_OUTPUT_UNKNOWN')

    const overlappingProvider = component({
      id: 'system:test-provider',
      code: 'TEST_PROVIDER',
      version: '2.0.0',
      effectiveFrom: '2026-06-01',
    })
    const versionedConsumer = dependentComponent({ componentCode: 'TEST_PROVIDER', outputName: 'Amount', inputName: 'base' })
    const ambiguous = createComponentCatalogEntry({
      definition: versionedConsumer,
      compositionId: 'ambiguous-ref',
      components: [
        component({ id: 'system:test-provider', code: 'TEST_PROVIDER', version: '1.0.0', effectiveTo: '2026-06-30' }),
        overlappingProvider,
        versionedConsumer,
      ],
    })
    expect(issueCodes(ambiguous)).toContain('DEPENDENCY_VERSION_AMBIGUOUS')
    const overlappingVersion = createComponentCatalogEntry({
      definition: overlappingProvider,
      compositionId: 'ambiguous-ref',
      components: [
        component({ id: 'system:test-provider', code: 'TEST_PROVIDER', version: '1.0.0', effectiveTo: '2026-06-30' }),
        overlappingProvider,
        versionedConsumer,
      ],
    })
    expect(issueCodes(overlappingVersion)).toContain('COMPONENT_EFFECTIVE_OVERLAP')

    const wrongTypeProvider = component({
      id: 'system:wrong-type-provider',
      code: 'WRONG_TYPE_PROVIDER',
      outputs: [{ name: 'Amount', valueType: 'STRING' }],
    })
    const wrongTypeConsumer = dependentComponent({ componentCode: 'WRONG_TYPE_PROVIDER', outputName: 'Amount', inputName: 'base' })
    const typeMismatch = createComponentCatalogEntry({
      definition: wrongTypeConsumer,
      compositionId: 'type-test',
      components: [wrongTypeProvider, wrongTypeConsumer],
    })
    expect(issueCodes(typeMismatch)).toContain('DEPENDENCY_TYPE_MISMATCH')
  })
})
