import { describe, expect, it } from 'vitest'
import type { PayrollComponentDefinition } from '@liquid-hr/payroll-engine'
import { NL_2026_RULE_PACKAGE } from '@liquid-hr/payroll-rules-nl-2026'
import { createComponentCatalogEntry } from './component-catalog'
import { validatePreparedComponentDraft } from './component-editor-engine'

const definition: PayrollComponentDefinition = {
  id: 'CUSTOM_00000000000040008000000000000001',
  code: 'CUSTOM_00000000000040008000000000000001',
  version: '1',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  ownership: { kind: 'CUSTOMER_CUSTOM' },
  processingScope: 'PAYROLL_RUN',
  inputs: [],
  outputs: [{ name: 'amount', valueType: 'MONEY', rounding: { scale: 2, mode: 'HALF_UP' } }],
  dependencies: [],
  parameters: { bonus: { valueType: 'MONEY', value: '5.00' } },
  method: {
    kind: 'expression',
    outputs: { amount: { kind: 'binary', operator: '+', left: { kind: 'literal', valueType: 'MONEY', value: '100.00' }, right: { kind: 'parameter', name: 'bonus' } } },
  },
  tracePolicy: 'FULL',
}

describe('Payroll component editor synthetic engine preview', () => {
  it('runs the candidate through the payroll engine and returns output, rounding, parameters and trace', () => {
    const entry = createComponentCatalogEntry({
      definition,
      packageIdentity: {
        compositionId: NL_2026_RULE_PACKAGE.compositionId,
        packageId: NL_2026_RULE_PACKAGE.metadata?.packageId,
        version: NL_2026_RULE_PACKAGE.metadata?.version,
        packageHash: NL_2026_RULE_PACKAGE.metadata?.packageHash,
        parameterSetHash: NL_2026_RULE_PACKAGE.metadata?.parameterSetHash,
      },
      components: [...NL_2026_RULE_PACKAGE.components.filter((component) => component.code !== definition.code), definition],
      status: 'DRAFT',
      displayName: 'Synthetic amount',
    })

    const result = validatePreparedComponentDraft({ definition, entry, requestId: '30000000-0000-4000-8000-000000000001' })

    expect(result.valid).toBe(true)
    expect(result.result?.outputs).toEqual([{ name: 'amount', valueType: 'MONEY', value: '105.00' }])
    expect(result.result?.method).toBe('expression')
    expect(result.result?.formulas[0]?.formula).toContain('parameter.bonus')
    expect(result.result?.parameters).toEqual([{ name: 'bonus', valueType: 'MONEY', value: '5.00' }])
    expect(result.result?.rounding).toEqual([{ componentCode: definition.code, outputName: 'amount', scale: 2, mode: 'HALF_UP' }])
    expect(result.result?.trace.some((step) => step.componentCode === definition.code)).toBe(true)
    expect(result.result?.trace[0]?.outputs.amount).toEqual({ valueType: 'MONEY', value: '105.00' })
  })
})
