import { describe, expect, it } from 'vitest'
import { parseComponentEditorPayload } from './component-editor-contract'

const validPayload = {
  requestId: '30000000-0000-4000-8000-000000000001',
  packageCompositionId: 'NL-PAYROLL-2026',
  displayName: 'Allowance',
  displayCode: 'ALLOWANCE',
  description: 'Synthetic allowance.',
  category: 'Allowance',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  processingScope: 'PAYROLL_RUN',
  inputs: [{ name: 'gross', valueType: 'MONEY', required: true }],
  outputs: [{ name: 'amount', valueType: 'MONEY', rounding: { scale: 2, mode: 'HALF_UP' } }],
  dependencies: [{ componentCode: 'NL_REGULAR_WAGE', outputName: 'monthlySalary', inputName: 'gross' }],
  parameters: [{ name: 'rate', valueType: 'PERCENTAGE', value: '10' }],
  tracePolicy: 'FULL',
  method: { kind: 'expression', formulas: { amount: 'input.gross * parameter.rate' } },
  previewInputs: { gross: '1000.00' },
}

describe('Payroll component editor payload', () => {
  it('parses a bounded typed formula payload into the engine expression AST', () => {
    const parsed = parseComponentEditorPayload(validPayload)

    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.method).toMatchObject({ kind: 'expression', outputs: { amount: { kind: 'binary', operator: '*' } } })
    expect(parsed.data.parameters.rate).toEqual({ valueType: 'PERCENTAGE', value: '10' })
    expect(parsed.data.outputs[0]?.rounding).toEqual({ scale: 2, mode: 'HALF_UP' })
  })

  it('rejects unknown payload fields, duplicate names, invalid formula text, and missing dependencies', () => {
    expect(parseComponentEditorPayload({ ...validPayload, tenantId: '30000000-0000-4000-8000-000000000099' }).success).toBe(false)
    expect(parseComponentEditorPayload({ ...validPayload, outputs: [...validPayload.outputs, validPayload.outputs[0]] }).success).toBe(false)
    expect(parseComponentEditorPayload({ ...validPayload, method: { kind: 'expression', formulas: { amount: 'process.exit()' } } }).success).toBe(false)
    expect(parseComponentEditorPayload({ ...validPayload, dependencies: [{ ...validPayload.dependencies[0], inputName: 'missing' }] }).success).toBe(false)
  })

  it('accepts source as a sentinel without allowing a browser-supplied source path', () => {
    const source = { ...validPayload, method: { kind: 'source' } }
    const parsed = parseComponentEditorPayload(source)
    expect(parsed.success && parsed.data.method).toBeNull()

    const forged = { ...source, method: { kind: 'source', path: ['private', 'field'] } }
    expect(parseComponentEditorPayload(forged).success).toBe(false)
  })
})
